// Run with PGLITE_MODULE pointing to @electric-sql/pglite's entry point.
// Uses an isolated PostgreSQL engine and minimal fixtures; no customer records.
const {PGlite}=require(process.env.PGLITE_MODULE);
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
 CREATE FUNCTION public.qualisphere_resolve_training_tenant() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.tenant',true),'')::uuid$$;
 CREATE FUNCTION public.qualisphere_training_is_coordinator(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.coordinator',true),'false')='true'$$;
 CREATE TABLE public.controlled_documents(id uuid PRIMARY KEY,tenant_id uuid,document_number text,title text,revision text,status text);
 CREATE TABLE public.employee_profiles(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,user_email text,department text,role_name text,active boolean);
 CREATE TABLE public.training_methods(id uuid PRIMARY KEY,tenant_id uuid,label text,is_active boolean,acknowledgement_required boolean,evidence_required boolean);
 CREATE TABLE public.training_matrix(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,document_number text,department text,role_name text,required_training boolean,effectiveness_required boolean);
 CREATE TABLE public.training_assignments(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,document_id uuid,source_document_revision text,assigned_to_email text,assigned_by_email text,assignment_source text,role_name text,department text,training_title text,training_description text,due_date date,status text,training_method_id uuid,training_category text,recurrence_months integer,recurrence_basis text,recurring_evidence_mode text,acknowledgement_required boolean,effectiveness_required boolean,effectiveness_status text,supervisor_verification_required boolean,release_blocking boolean,training_completed_on date,training_evidence_storage_path text,training_evidence_file_name text,approved_evaluation_attachment_required boolean);
 CREATE TABLE storage.objects(bucket_id text,name text);
 `);
 await db.exec(readFileSync('sql/training_beta_audiences_and_assignments.sql','utf8'));
 const tenant='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',doc='10000000-0000-0000-0000-000000000001',method='20000000-0000-0000-0000-000000000001';
 await db.query(`SELECT set_config('test.uid',$1,false),set_config('test.tenant',$2,false),set_config('test.coordinator','true',false),set_config('test.jwt','{"email":"coordinator@example.test"}',false)`,[tenant,tenant]);
 await db.query(`INSERT INTO controlled_documents VALUES($1,$2,'SOP-001','GDP','A','effective'),('10000000-0000-0000-0000-000000000002',$3,'SOP-001','Other tenant','A','effective')`,[doc,tenant,other]);
 await db.query(`INSERT INTO training_methods VALUES($1,$2,'Read and Acknowledge',true,true,false)`,[method,tenant]);
 await db.query(`INSERT INTO employee_profiles(tenant_id,user_email,department,role_name,active) VALUES($1,'inspector@example.test','Quality','Inspector',true),($1,'operator@example.test','Manufacturing','Operator',true),($1,'inactive@example.test','Quality','Inspector',false),($2,'outsider@example.test','Quality','Inspector',true)`,[tenant,other]);
 const save=targets=>db.query(`SELECT qualisphere_save_training_matrix_audience('SOP-001',$1::jsonb)`,[JSON.stringify(targets)]);
 const assign=(targets,months=null)=>db.query(`SELECT qualisphere_assign_training_matrix($1::jsonb,$2,'2026-11-01',$3,'completion') AS count`,[JSON.stringify(targets),method,months]);
 const target=email=>({document_id:doc,user_email:email});
 await save([{department:'Quality',role_name:'Inspector'}]);
 assert.equal((await assign([target('operator@example.test'),target('inspector@example.test'),target('INSPECTOR@example.test'),target('inactive@example.test'),target('outsider@example.test')])).rows[0].count,1);
 assert.equal((await assign([target('INSPECTOR@example.test')])).rows[0].count,0);
 await save([{department:null,role_name:null}]);
 assert.equal((await assign([target('operator@example.test'),target('inspector@example.test'),target('inactive@example.test'),target('outsider@example.test')],12)).rows[0].count,1);
 const operator=(await db.query(`SELECT * FROM training_assignments WHERE assigned_to_email='operator@example.test'`)).rows[0];
 assert.equal(operator.training_category,'recurring');assert.equal(operator.recurrence_months,12);assert.equal(operator.effectiveness_required,false);
 assert.equal((await assign([{document_id:'10000000-0000-0000-0000-000000000002',user_email:'inspector@example.test'}])).rows[0].count,0);
 assert.equal((await db.query(`SELECT count(*)::integer AS n FROM training_matrix`)).rows[0].n,2,'old audience row is preserved');
 await save([]);
 assert.equal((await db.query(`SELECT count(*)::integer AS n FROM training_assignments`)).rows[0].n,2,'disabling matrix keeps assignments');
 await db.query(`SELECT set_config('test.coordinator','false',false)`);
 await assert.rejects(assign([target('operator@example.test')]),/coordinator permission/);
 await assert.rejects(save([{department:null,role_name:null}]),/coordinator permission/);
 await db.query(`SELECT set_config('test.coordinator','true',false)`);
 await save([{department:null,role_name:null}]);
 await assert.rejects(assign([target('operator@example.test')],0),/recurrence/);
 await db.query(`UPDATE controlled_documents SET status='superseded' WHERE id=$1`,[doc]);
 assert.equal((await assign([target('new@example.test')])).rows[0].count,0);
 // Evidence enforcement must apply to configured one-time attachment methods.
 await db.exec(`CREATE TRIGGER enforce_evidence BEFORE UPDATE ON training_assignments FOR EACH ROW EXECUTE FUNCTION qualisphere_enforce_training_completion_evidence();`);
 await db.query(`UPDATE training_assignments SET recurring_evidence_mode='attachment' WHERE assigned_to_email='inspector@example.test'`);
 await assert.rejects(db.query(`UPDATE training_assignments SET status='completed',training_completed_on='2026-10-24' WHERE assigned_to_email='inspector@example.test'`),/evidence is required/);
 console.log('Database checks passed: audiences, tenant isolation, active employees, permissions, duplicate skipping, recurrence, history preservation, evidence enforcement.');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
