const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  const a = '20000000-0000-4000-8000-000000000001';
  const b = '20000000-0000-4000-8000-000000000002';
  const user = '00000000-0000-4000-8000-000000000001';
  const set = (name, value) => db.query('SELECT set_config($1,$2,false)', [name, value]);
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE SCHEMA qualisphere_sandbox_auth;
      CREATE TABLE public.sandbox_company_environments(tenant_id uuid PRIMARY KEY);
      CREATE TABLE public.tenant_module_access(tenant_id uuid, module_code text, is_enabled boolean);
      CREATE TABLE public.equipment(tenant_id uuid, name text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(current_setting(''test.user'',true),'''')::uuid';
      CREATE FUNCTION qualisphere_sandbox_auth.current_session_company() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(current_setting(''test.company'',true),'''')::uuid';
      CREATE FUNCTION public.sandbox_current_session_company() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT qualisphere_sandbox_auth.current_session_company()';
      CREATE FUNCTION public.qualisphere_tenant_module_enabled(p_tenant uuid,p_module text) RETURNS boolean
      LANGUAGE sql STABLE AS 'SELECT EXISTS(SELECT 1 FROM public.tenant_module_access WHERE tenant_id=p_tenant AND module_code=p_module AND is_enabled)';
    `);
    await db.exec(fs.readFileSync('supabase/baselines/qualisphere_sandbox_equipment_tenant_guard.sql', 'utf8'));
    await db.exec('CREATE TRIGGER equipment_tenant BEFORE INSERT ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.qualisphere_resolve_equipment_tenant()');
    await db.query("INSERT INTO public.tenant_module_access VALUES ($1,'equipment',true),($2,'equipment',false)", [a, b]);
    await set('test.user', user);
    await set('test.company', a);
    assert.equal((await db.query("INSERT INTO public.equipment(name) VALUES('A') RETURNING tenant_id")).rows[0].tenant_id, a);
    await assert.rejects(db.query("INSERT INTO public.equipment(tenant_id,name) VALUES($1,'wrong company')", [b]), /does not match/);
    await set('test.company', b);
    await assert.rejects(db.query("INSERT INTO public.equipment(name) VALUES('disabled')"), /not enabled/);
    await set('test.company', '');
    await assert.rejects(db.query("INSERT INTO public.equipment(name) VALUES('missing selection')"), /Select an authorized/);
    await set('test.user', '');
    await assert.rejects(db.query("INSERT INTO public.equipment(name) VALUES('anonymous')"), /Authentication is required/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.equipment')).rows[0].n, 1);
    console.log('Sandbox Equipment tenant guard tests passed.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
