// Run with PGLITE_MODULE pointing to a pinned @electric-sql/pglite installation.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'supabase/baselines', name), 'utf8');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE ROLE supabase_admin; CREATE ROLE supabase_auth_admin; CREATE ROLE authenticator;
      CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
      CREATE TABLE storage.buckets(id text); CREATE TABLE storage.objects(id uuid,bucket_id text,name text);
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(auth.jwt()->>''sub'','''')::uuid';
      CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
    await db.exec('BEGIN;' + read('qualisphere_sandbox_structure.sql') + read('qualisphere_sandbox_company_preparation.sql') + 'COMMIT;');
    await db.exec(`INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status)
      SELECT id,'owner@example.test','company_admin','active' FROM public.tenants;`);
    await db.exec('BEGIN;' + read('qualisphere_sandbox_login_access.sql') + 'COMMIT;');
    await db.exec(`INSERT INTO public.tenants(tenant_code,company_name,slug,status,is_internal)
      VALUES('OTHER-TEST','Other company','other-test','active',false);`);
    const claims = { sub: '00000000-0000-4000-8000-000000000001', email: 'owner@example.test', role: 'authenticated' };
    async function as(role, jwt, fn) {
      await db.exec('BEGIN');
      await db.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify(jwt)]);
      await db.exec(`SET LOCAL ROLE ${role}`);
      try { await fn(); } finally { await db.exec('ROLLBACK'); }
    }
    await as('authenticated', claims, async () => {
      const rows = await db.query('SELECT tenant_code,company_name,status FROM public.tenants');
      assert.deepEqual(rows.rows, [{ tenant_code: 'QUALISPHERE-SANDBOX', company_name: 'QualiSphere Sandbox', status: 'provisioning' }]);
      assert.equal((await db.query('SELECT user_email,membership_role FROM public.tenant_memberships')).rows.length, 1);
    });
    await as('authenticated', { ...claims, email: 'outsider@example.test', user_metadata: { email: claims.email } }, async () => {
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows.length, 0);
      assert.equal((await db.query('SELECT id FROM public.tenant_memberships')).rows.length, 0);
    });
    await as('authenticated', { email: claims.email }, async () => {
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows.length, 0);
    });
    for (const sql of [
      'SELECT * FROM public.training_assignments',
      "UPDATE public.tenant_memberships SET membership_role='member'",
      "INSERT INTO public.tenants(tenant_code,company_name,slug) VALUES('BAD','BAD','bad')",
      'SELECT public.is_platform_admin()',
      'SELECT primary_contact_email FROM public.tenants'
    ]) {
      await assert.rejects(as('authenticated', claims, () => db.query(sql)), /permission denied/);
    }
    await assert.rejects(as('anon', {}, () => db.query('SELECT id FROM public.tenants')), /permission denied/);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND has_function_privilege('authenticated',p.oid,'EXECUTE')`)).rows[0].n, 0);
    console.log('Sandbox login permissions passed: own-company read, unrelated user isolation, JWT subject requirement, metadata spoof rejection, module/write/RPC/private-column/anonymous denial.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
