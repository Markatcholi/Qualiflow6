const {PGlite}=require(process.env.PGLITE_MODULE);
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
 CREATE TABLE employee_profiles(id text PRIMARY KEY,tenant_id text,user_email text,full_name text,role_name text,active boolean);
 CREATE TABLE training_assignments(tenant_id text,assigned_to_email text,status text);
 CREATE TABLE training_certifications(tenant_id text,employee_email text);
 CREATE TABLE training_group_members(tenant_id text,user_email text);
 CREATE TABLE controlled_documents(id text PRIMARY KEY,tenant_id text);
 CREATE TABLE document_training_assignments(document_id text,user_email text);
 INSERT INTO controlled_documents VALUES('doc1','company1');`);
 await db.exec(readFileSync('sql/training_employee_profile_history_guard.sql','utf8'));
 const add=()=>db.exec(`INSERT INTO employee_profiles VALUES('employee','company1','person@example.test','Original','Inspector',true)`);
 await add();await db.exec(`UPDATE employee_profiles SET user_email='corrected@example.test' WHERE id='employee';DELETE FROM employee_profiles WHERE id='employee'`);
 assert.equal((await db.query('SELECT * FROM employee_profiles')).rows.length,0);
 for(const statement of [
  "INSERT INTO training_assignments VALUES('company1','PERSON@example.test','completed')",
  "INSERT INTO training_certifications VALUES('company1','person@example.test')",
  "INSERT INTO training_group_members VALUES('company1','person@example.test')",
  "INSERT INTO document_training_assignments VALUES('doc1','person@example.test')"
 ]){
  await add();await db.exec(statement);
  await assert.rejects(db.exec("DELETE FROM employee_profiles WHERE id='employee'"),/linked training or group records/);
  await assert.rejects(db.exec("UPDATE employee_profiles SET user_email='other@example.test' WHERE id='employee'"),/linked training or group records/);
  await db.exec("UPDATE employee_profiles SET full_name='Updated',role_name='Supervisor',active=false WHERE id='employee'");
  const row=(await db.query("SELECT * FROM employee_profiles WHERE id='employee'")).rows[0];
  assert.equal(row.full_name,'Updated');assert.equal(row.active,false);assert.equal(row.user_email,'person@example.test');
  await db.exec("UPDATE employee_profiles SET active=true WHERE id='employee'");
  await db.exec('TRUNCATE training_assignments,training_certifications,training_group_members,document_training_assignments');
  await db.exec("DELETE FROM employee_profiles WHERE id='employee'");
 }
 await add();await db.exec("INSERT INTO training_assignments VALUES('other_company','person@example.test','completed');DELETE FROM employee_profiles WHERE id='employee'");
 assert.equal((await db.query('SELECT * FROM training_assignments')).rows.length,1,'other tenant records preserved');
 console.log('Employee profile SQL checks passed: add, edit, deactivate/reactivate, unused deletion/email correction, linked-record protection and tenant scope.');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
