const {test}=require('node:test');const assert=require('node:assert/strict');
const {resolveTrainingMaterial:resolve,controlledDocumentPath:path}=require(process.env.TRAINING_MATERIAL_TEST_MODULE);
const project='https://project.supabase.co';
const source=`${project}/storage/v1/object/public/controlled-documents/SOP-0005/A/Cleaning%20Procedure.docx`;
const doc={status:'release',revision:'A',file_url:source};
test('released document never substitutes its source file for the formal controlled copy',async()=>{
 const result=await resolve(doc,project,async()=>assert.fail('source file must not be signed'),'A');
 assert.deepEqual(result,{url:null,source:'Controlled Copy'});
});
test('controlled copy is preferred, including a path with no legacy URL',async()=>{
 const result=await resolve({...doc,controlled_copy_file_path:'tenant/company/SOP-0005/A/copy.pdf'},project,async p=>{assert.equal(p,'tenant/company/SOP-0005/A/copy.pdf');return 'signed-copy';});
 assert.equal(result.source,'Controlled Copy');assert.equal(result.url,'signed-copy');
});
test('access failure on a controlled copy does not silently fall back to another file',async()=>{
 await assert.rejects(resolve({...doc,controlled_copy_file_path:'tenant/company/copy.pdf'},project,async()=>{throw new Error('Access denied');}),/Access denied/);
});
test('missing material and revision mismatch are distinct',async()=>{
 assert.equal((await resolve({...doc,file_url:null},project,async()=>assert.fail())).url,null);
 await assert.rejects(resolve(doc,project,async()=>assert.fail(),'B'),/requires revision B/);
});
test('external links remain links and are never sent for storage signing',async()=>{
 const external='https://customer.example/approved-procedure.pdf';
 assert.equal((await resolve({...doc,status:'draft',file_url:external},project,async()=>assert.fail())).url,external);
 assert.equal(path('https://other.supabase.co/storage/v1/object/public/controlled-documents/file.pdf',project),null);
 assert.equal(path('https://project.supabase.co/storage/v1/object/public/other-bucket/file.pdf',project),null);
});

test('legacy controlled-copy links in a private bucket are signed',async()=>{
 const result=await resolve({...doc,controlled_copy_file_url:source.replace('.docx','.pdf')},project,async p=>{assert.equal(p,'SOP-0005/A/Cleaning Procedure.pdf');return 'signed-controlled';});
 assert.deepEqual(result,{url:'signed-controlled',source:'Controlled Copy'});
});

test('acknowledgement training cannot use a working draft either',async()=>{
 const result=await resolve({...doc,status:'draft'},project,async()=>assert.fail(),null,true);
 assert.deepEqual(result,{url:null,source:'Controlled Copy'});
});
