const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const session1 = '10000000-0000-4000-8000-000000000001';
  const session2 = '10000000-0000-4000-8000-000000000002';
  const company1 = '20000000-0000-4000-8000-000000000001';
  const company2 = '20000000-0000-4000-8000-000000000002';
  const claims = async (sub, email, session_id) => db.query(
    "SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, email, session_id })]);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA qualisphere_sandbox_auth;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
        'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(auth.jwt()->>''sub'','''')::uuid';
      CREATE TABLE public.tenants(id uuid PRIMARY KEY, status text, is_internal boolean);
      CREATE TABLE public.tenant_memberships(tenant_id uuid, user_email text, membership_status text);
      CREATE TABLE public.sandbox_company_environments(tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id));
      CREATE TABLE public.tenant_module_access(is_enabled boolean);
      CREATE FUNCTION qualisphere_sandbox_auth.company_member(p_tenant uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
        SELECT auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.sandbox_company_environments e
          JOIN public.tenants t ON t.id=e.tenant_id
          JOIN public.tenant_memberships m ON m.tenant_id=t.id
          WHERE t.id=p_tenant AND NOT t.is_internal AND t.status IN ('provisioning','active')
            AND lower(m.user_email)=lower(coalesce(auth.jwt()->>'email',''))
            AND m.membership_status='active');
      $$;
    `);
    await db.query("INSERT INTO public.tenants VALUES ($1,'provisioning',false),($2,'provisioning',false)", [company1, company2]);
    await db.query('INSERT INTO public.sandbox_company_environments VALUES ($1),($2)', [company1, company2]);
    await db.query("INSERT INTO public.tenant_memberships VALUES ($1,'owner@example.test','active'),($2,'owner@example.test','active'),($2,'other@example.test','active')", [company1, company2]);
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/baselines/qualisphere_sandbox_session_company.sql'), 'utf8'));
    await db.exec('SET ROLE authenticated');
    await claims(owner, 'owner@example.test', session1);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, null);
    assert.equal((await db.query('SELECT public.sandbox_select_session_company($1) AS tenant', [company1])).rows[0].tenant, company1);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, company1);
    await claims(owner, 'owner@example.test', session2);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, null);
    await db.query('SELECT public.sandbox_select_session_company($1)', [company2]);
    await claims(owner, 'owner@example.test', session1);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, company1);
    await claims(other, 'other@example.test', session1);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, null);
    await assert.rejects(db.query('SELECT public.sandbox_select_session_company($1)', [company1]));
    await assert.rejects(db.query('SELECT * FROM qualisphere_sandbox_auth.session_company_selection'));
    await claims(owner, 'owner@example.test', 'not-a-uuid');
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, null);
    await assert.rejects(db.query('SELECT public.sandbox_select_session_company($1)', [company1]));
    await db.exec('RESET ROLE');
    await db.query("UPDATE public.tenant_memberships SET membership_status='inactive' WHERE tenant_id=$1 AND user_email='owner@example.test'", [company1]);
    await db.exec('SET ROLE authenticated');
    await claims(owner, 'owner@example.test', session1);
    assert.equal((await db.query('SELECT public.sandbox_current_session_company() AS tenant')).rows[0].tenant, null);
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT public.sandbox_current_session_company()'));
    console.log('Sandbox session company isolation tests passed');
  } finally { await db.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
