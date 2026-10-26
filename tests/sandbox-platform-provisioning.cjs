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
    await db.exec('BEGIN;' + read('qualisphere_sandbox_basic_configuration.sql') + 'COMMIT;');
    await db.exec('BEGIN;' + read('qualisphere_sandbox_standard_administration.sql') + 'COMMIT;');
    await db.exec('BEGIN;' + read('qualisphere_sandbox_platform_provisioning.sql') + 'COMMIT;');
    await db.exec(`INSERT INTO public.tenants(tenant_code,company_name,slug,status,is_internal)
      VALUES('OTHER-TEST','Other company','other-test','active',false);`);
    const claims = { sub: '00000000-0000-4000-8000-000000000001', email: 'owner@example.test', role: 'authenticated' };
    async function as(role, jwt, fn) {
      await db.exec('BEGIN');
      await db.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify(jwt)]);
      await db.exec(`SET LOCAL ROLE ${role}`);
      try { await fn(); } finally { await db.exec('ROLLBACK'); }
    }

    await db.exec('BEGIN;' + read('qualisphere_sandbox_private_coordinator_check.sql') + 'COMMIT;');
    await db.exec('BEGIN;' + read('qualisphere_sandbox_kpi_catalog.sql') + 'COMMIT;');
    const tenant = (await db.query("SELECT id FROM public.tenants WHERE tenant_code='QUALISPHERE-SANDBOX'")).rows[0].id;
    const other = (await db.query("SELECT id FROM public.tenants WHERE tenant_code='OTHER-TEST'")).rows[0].id;
    await as('authenticated', claims, async () => {
      assert.equal((await db.query('SELECT public.qualisphere_is_company_admin($1) AS allowed',[tenant])).rows[0].allowed,true);
      assert.equal((await db.query('SELECT public.is_platform_admin() AS allowed')).rows[0].allowed,false);
      await db.query("SELECT public.qualisphere_sandbox_save_settings($1,$2)",[tenant,JSON.stringify({timezone:'UTC',enable_notifications:true,overdue_bucket_1:5,overdue_bucket_2:10,overdue_bucket_3:20})]);
      assert.equal((await db.query('SELECT timezone FROM public.company_settings')).rows[0].timezone,'UTC');
      assert.equal((await db.query('SELECT default_timezone FROM public.tenants')).rows[0].default_timezone,'UTC');
      await db.query("INSERT INTO public.md_departments(tenant_id,code,label) VALUES($1,'QA','Quality')",[tenant]);
      await db.query("UPDATE public.md_departments SET label='Quality Assurance' WHERE tenant_id=$1",[tenant]);
      assert.equal((await db.query('SELECT label FROM public.md_departments')).rows[0].label,'Quality Assurance');
      await db.query("DELETE FROM public.md_departments WHERE tenant_id=$1",[tenant]);
      const role=(await db.query("SELECT id FROM public.customer_roles WHERE tenant_id=$1 AND lower(role_name)='training coordinator' LIMIT 1",[tenant])).rows[0].id;
      await db.query("INSERT INTO public.tenant_user_role_assignments(tenant_id,user_email,role_id) VALUES($1,'owner@example.test',$2)",[tenant,role]);
      const method=(await db.query("SELECT public.qualisphere_save_training_method($1,NULL,'Read and Acknowledge',false,true,false) m",[tenant])).rows[0].m.id;
      await db.query("SELECT public.qualisphere_save_training_method($1,$2,'Read and Understand',false,true,false)",[tenant,method]);
      await db.query('DELETE FROM public.training_methods WHERE id=$1',[method]);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.kpi_library_definitions')).rows[0].n,52);
      await db.query("SELECT public.qualisphere_set_company_user($1,'trainee@example.test','Inspector','Quality','active')",[tenant]);
      assert.equal((await db.query("SELECT membership_role FROM public.tenant_memberships WHERE user_email='trainee@example.test'")).rows[0].membership_role,'member');
      await db.query("SELECT public.qualisphere_sandbox_save_kpis($1,$2)",[tenant,JSON.stringify([{module_name:'training',kpi_key:'pending',executive_dashboard:false,management_review:true,display_order:1}])]);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.company_dashboard_kpi_configuration')).rows[0].n,1);
    });
    await db.query("INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status) VALUES($1,'ordinary@example.test','member','active')",[tenant]);
    await assert.rejects(as('authenticated',claims,()=>db.query("UPDATE public.tenant_memberships SET membership_role='company_admin' WHERE user_email='ordinary@example.test'")),/row-level security/);
    for (const [sql,args,pattern] of [
      ["SELECT public.qualisphere_sandbox_assign_company_admin($1,'unauthorized@example.test')",[tenant],/Platform Administrator/],
      ["INSERT INTO public.tenant_memberships(tenant_id,user_email,membership_role,membership_status) VALUES($1,'escalate@example.test','company_admin','active')",[tenant],/row-level security/],
      ["SELECT public.qualisphere_sandbox_save_settings($1,$2)",[other,JSON.stringify({timezone:'UTC'})],/Administrator required/],
      ["SELECT public.qualisphere_sandbox_save_settings($1,$2)",[tenant,JSON.stringify({enable_email_notifications:true})],/disabled/],
      ["SELECT public.qualisphere_sandbox_save_settings($1,$2)",[tenant,JSON.stringify({overdue_bucket_1:20,overdue_bucket_2:10})],/increasing/],
      ["UPDATE public.company_settings SET enable_email_notifications=true",[],/permission denied|check constraint/],
      ["UPDATE public.tenants SET status='active'",[],/permission denied/],
      ["UPDATE public.tenant_module_access SET is_enabled=true",[],/permission denied/],
      ["INSERT INTO public.md_departments(tenant_id,code,label) VALUES($1,'OTHER','Other')",[other],/row-level security/],
      ["INSERT INTO public.platform_administrators(user_email) VALUES('owner@example.test')",[],/permission denied/],
      ["INSERT INTO public.training_assignments(tenant_id) VALUES($1)",[tenant],/permission denied/]
    ]) await assert.rejects(as('authenticated',claims,()=>db.query(sql,args)),pattern);
    await as('authenticated',{...claims,email:'outsider@example.test',user_metadata:{email:claims.email}},async()=>{
      assert.equal((await db.query('SELECT count(*)::int n FROM public.company_settings')).rows[0].n,0);
      assert.equal((await db.query('SELECT public.is_platform_admin() a')).rows[0].a,false);
    });
    const foreignRole=(await db.query("INSERT INTO public.customer_roles(tenant_id,role_name) VALUES($1,'Other Role') RETURNING id",[other])).rows[0].id;
    const foreignGroup=(await db.query("INSERT INTO public.training_groups(tenant_id,group_name) VALUES($1,'Other Group') RETURNING id",[other])).rows[0].id;
    await assert.rejects(as('authenticated',claims,()=>db.query("INSERT INTO public.tenant_user_role_assignments(tenant_id,user_email,role_id) VALUES($1,'owner@example.test',$2)",[tenant,foreignRole])),/row-level security/);
    await assert.rejects(as('authenticated',claims,()=>db.query("INSERT INTO public.training_group_members(tenant_id,training_group_id,user_email) VALUES($1,$2,'owner@example.test')",[tenant,foreignGroup])),/row-level security/);
    await as('authenticated',claims,async()=>{
      await db.query("SELECT public.qualisphere_sandbox_save_kpis($1,$2)",[tenant,JSON.stringify([{module_name:'training',kpi_key:'keep',executive_dashboard:false,management_review:true,display_order:1}])]);
      await db.exec('SAVEPOINT before_invalid');
      await assert.rejects(db.query("SELECT public.qualisphere_sandbox_save_kpis($1,$2)",[tenant,JSON.stringify([{module_name:'training',display_order:2}])]),/null value/);
      await db.exec('ROLLBACK TO SAVEPOINT before_invalid');
      assert.equal((await db.query('SELECT kpi_key FROM public.company_dashboard_kpi_configuration')).rows[0].kpi_key,'keep');
      await db.query("INSERT INTO public.custom_kpi_definitions(tenant_id,company_name,module_name,kpi_key,kpi_name,data_source,calculation_type) VALUES($1,'Sandbox','training','test','Test KPI','training_assignments','count')",[tenant]);
      await db.query("UPDATE public.custom_kpi_definitions SET active=false WHERE tenant_id=$1",[tenant]);
    });
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')")).rows[0].n,0);
    await db.query("INSERT INTO public.platform_administrators(user_email,is_active) VALUES('platform@example.test',true)");
    await as('authenticated',{...claims,email:'platform@example.test'},async()=>{
      assert.equal((await db.query('SELECT public.is_platform_admin() a')).rows[0].a,true);
      await db.query("SELECT public.qualisphere_sandbox_assign_company_admin($1,'newadmin@example.test')",[tenant]);
      assert.equal((await db.query("SELECT membership_role FROM public.tenant_memberships WHERE user_email='newadmin@example.test'")).rows[0].membership_role,'company_admin');
      assert.equal((await db.query('SELECT count(*)::int n FROM public.company_settings')).rows[0].n,0);
    });
    await as('authenticated',{email:'platform@example.test'},async()=>assert.equal((await db.query('SELECT public.is_platform_admin() a')).rows[0].a,false));
    await assert.rejects(as('anon',{},()=>db.query('SELECT * FROM public.company_settings')),/permission denied/);
    await as('authenticated',{...claims,email:'platform@example.test'},async()=>{
      const make=(request,code,slug,email)=>db.query("SELECT public.qualisphere_sandbox_create_company($1,$2,'',$3,$4,'contact@example.test',$5,'US','America/Chicago') id",[request,code+' Company',code,slug,email]);
      const request='10000000-0000-4000-8000-000000000001';
      const a=(await make(request,'BETA-A','beta-a','admin-a@example.test')).rows[0].id;
      const retry=(await make(request,'BETA-A','beta-a','admin-a@example.test')).rows[0].id;
      assert.equal(a,retry);
      const b=(await make('10000000-0000-4000-8000-000000000002','BETA-B','beta-b','admin-b@example.test')).rows[0].id;
      const ta=(await db.query('SELECT * FROM public.tenants WHERE id=$1',[a])).rows[0];
      assert.equal(ta.status,'provisioning');assert.equal(ta.is_internal,false);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.tenant_module_access WHERE tenant_id=$1 AND is_enabled',[a])).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.sandbox_company_environments WHERE tenant_id IN ($1,$2)',[a,b])).rows[0].n,2);
      await db.exec('RESET ROLE');
      const allowedTables=new Set(['company_settings','customer_roles','tenant_module_access','tenant_memberships','training_methods','md_document_impact_areas','sandbox_company_environments']);
      const scopedTables=(await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' AND table_name IN (SELECT tablename FROM pg_tables WHERE schemaname='public')")).rows;
      for (const {table_name} of scopedTables) {
        const count=(await db.query(`SELECT count(*)::int n FROM public."${table_name}" WHERE tenant_id IN ($1,$2)`,[a,b])).rows[0].n;
        if (count) assert.equal(allowedTables.has(table_name),true,`Unexpected copied/created records in ${table_name}`);
      }
      assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,0);
      await db.exec('SET LOCAL ROLE authenticated');
      await db.exec('SAVEPOINT duplicate_company');
      await assert.rejects(make('10000000-0000-4000-8000-000000000003','BETA-A','another-slug','admin@example.test'),/duplicate key/);
      await db.exec('ROLLBACK TO SAVEPOINT duplicate_company');
      await db.exec('SAVEPOINT reused_request');
      await assert.rejects(make(request,'BETA-C','beta-c','admin-c@example.test'),/different company details/);
      await db.exec('ROLLBACK TO SAVEPOINT reused_request');
      await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,email:'admin-a@example.test'})]);
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows.length,1);
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows[0].id,a);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.customer_roles')).rows[0].n,44);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.md_document_impact_areas')).rows[0].n,10);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.training_methods')).rows[0].n,3);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.training_assignments')).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM public.tenant_user_profiles')).rows[0].n,0);
      await db.query("SELECT public.qualisphere_sandbox_save_settings($1,$2)",[a,JSON.stringify({timezone:'UTC'})]);
      await db.exec('SAVEPOINT cross_company');
      await assert.rejects(db.query("SELECT public.qualisphere_sandbox_save_settings($1,$2)",[b,JSON.stringify({timezone:'UTC'})]),/Administrator required/);
      await db.exec('ROLLBACK TO SAVEPOINT cross_company');
      await db.exec('SAVEPOINT non_platform');
      await assert.rejects(make('10000000-0000-4000-8000-000000000004','BETA-D','beta-d','admin-d@example.test'),/Platform Administrator/);
      await db.exec('ROLLBACK TO SAVEPOINT non_platform');
      await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,email:'admin-b@example.test'})]);
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows[0].id,b);
      assert.equal((await db.query('SELECT timezone FROM public.company_settings')).rows[0].timezone,'America/Chicago');
      await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,email:'platform@example.test'})]);
      await db.query('SELECT public.qualisphere_sandbox_assign_company_admin($1,$2)',[b,'admin-a@example.test']);
      await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({...claims,email:'admin-a@example.test'})]);
      assert.equal((await db.query('SELECT id FROM public.tenants')).rows.length,2);
      assert.equal((await db.query('SELECT tenant_id FROM public.sandbox_company_environments')).rows.length,2);
      assert.equal((await db.query('SELECT public.is_platform_admin() a')).rows[0].a,false);
    });
    console.log('Platform provisioning passed: clean companies, baseline roles/methods/impact areas, disabled modules, idempotent retry, duplicate rollback, administrator assignment, multiple memberships, cross-company isolation and platform privilege denial.');
    console.log('Standard administration passed: settings/timezone, department CRUD, company user setup, atomic KPI save, platform-only administrator assignment, tenant isolation, escalation denial, outbound-job and operational-write denial.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
