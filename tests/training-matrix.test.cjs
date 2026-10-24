const {test}=require('node:test');
const assert=require('node:assert/strict');
const {trainingAudienceMatches:matches,trainingAssignmentState:state,trainingEvidenceMode:evidence,buildTrainingAudienceTargets:targets}=require(process.env.TRAINING_TEST_MODULE);
const person={user_email:'inspector@example.test',role_name:'Quality Inspection',department:'Quality',active:true};
const row={document_number:'SOP-001',role_name:null,department:null,required_training:true};
test('all employees includes active employees without a role or department',()=>{
 assert.equal(matches([row],'sop-001',{...person,role_name:null,department:null}),true);
 assert.equal(matches([row],'SOP-001',{...person,active:false}),false);
 assert.equal(matches([{...row,required_training:false}],'SOP-001',person),false);
});
test('department and role pairs do not create a cross product',()=>{
 const rows=[{...row,department:'Quality',role_name:'Quality Inspection'},{...row,department:'Manufacturing',role_name:'Operator'}];
 assert.equal(matches(rows,'SOP-001',person),true);
 assert.equal(matches(rows,'SOP-001',{...person,department:'Manufacturing'}),false);
 assert.equal(matches(rows,'OTHER',person),false);
});
test('department-wide and legacy role-only mappings stay compatible',()=>{
 assert.equal(matches([{...row,department:' Quality '}],'SOP-001',person),true);
 assert.equal(matches([{...row,role_name:'quality inspection'}],'SOP-001',{...person,department:'Other'}),true);
});
test('same revision is skipped; cancelled and withdrawn assignments may be reassigned',()=>{
 const assignment={document_id:'doc1',assigned_to_email:'INSPECTOR@example.test',status:'assigned',source_document_revision:'B'};
 assert.equal(state([assignment],'doc1','B',person.user_email),'Already assigned');
 assert.equal(state([{...assignment,status:'completed'}],'doc1','B',person.user_email),'Completed / waived');
 assert.equal(state([{...assignment,status:'cancelled'}],'doc1','B',person.user_email),'Needs assignment');
 assert.equal(state([{...assignment,status:'withdrawn'}],'doc1','B',person.user_email),'Needs assignment');
 assert.equal(state([assignment],'doc1','C',person.user_email),'Needs assignment');
 assert.equal(state([{...assignment,source_document_revision:null}],'doc1','B',person.user_email),'Already assigned');
});
test('one-time evidence methods and existing recurring/certification records keep their completion requirements',()=>{
 assert.equal(evidence({training_category:'standard',recurring_evidence_mode:'attachment'}),'attachment');
 assert.equal(evidence({training_category:'standard'}),'signature');
 assert.equal(evidence({training_category:'recurring'}),'attachment');
 assert.equal(evidence({training_category:'recurring',recurring_evidence_mode:'both'}),'both');
 assert.equal(evidence({training_category:'certification'}),'attachment');
});

test('specific role audiences cannot silently broaden to all department employees',()=>{
 assert.throws(()=>targets(false,[{department:'Manufacturing',allRoles:false,roles:[]}]),/Add at least one role/);
 assert.deepEqual(targets(false,[{department:'Manufacturing',allRoles:true,roles:[]}]),[{department:'Manufacturing',role_name:null}]);
 assert.deepEqual(targets(false,[{department:'Manufacturing',allRoles:false,roles:[' Operator ','operator','Supervisor']}]),[{department:'Manufacturing',role_name:'operator'},{department:'Manufacturing',role_name:'Supervisor'}]);
 assert.deepEqual(targets(true,[]),[{department:null,role_name:null}]);
});
