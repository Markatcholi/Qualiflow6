const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const tenantId='11111111-1111-4111-8111-111111111111';
const email='employee@example.invalid';
function setup(options={}) {
 const sent=[],clients=[];
 const rows={tenants:{id:tenantId,status:'active',is_internal:false},tenant_memberships:{user_email:email,membership_status:'active'},tenant_user_profiles:{user_email:email,account_status:'active'},...options.rows};
 const createClient=(url,key,opts)=>{
   const privileged=key==='test-secret';clients.push({key,opts});
   return {
     auth:{getUser:async()=>({data:{user:options.badSession?null:{email:'admin@example.invalid'}},error:options.badSession?{message:'invalid'}:null}),
       admin:{inviteUserByEmail:async(address,settings)=>{assert.equal(privileged,true);sent.push({type:'invite',address,settings});return {error:options.inviteError||null};}},
       resetPasswordForEmail:async(address,settings)=>{sent.push({type:'recovery',address,settings});return {error:options.recoveryError||null};}},
     rpc:async(name,args)=>{assert.equal(name,'qualisphere_is_company_admin');assert.equal(args.p_tenant_id,tenantId);return {data:options.authorized!==false,error:null};},
     from:table=>{const filters=[];const query={select:()=>query,eq:(column,value)=>{filters.push([column,value]);return query;},maybeSingle:async()=>{assert.ok(filters.some(([c,v])=>c===(table==='tenants'?'id':'tenant_id')&&v===tenantId));if(table!=='tenants')assert.ok(filters.some(([c,v])=>c==='user_email'&&v===email));return {data:rows[table],error:options.queryError?{message:'database error'}:null};}};return query;}
   };
 };
 const source=fs.readFileSync('app/api/company-administration/invite-employee/route.ts','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-anon',SUPABASE_SERVICE_ROLE_KEY:'test-secret'}},require:name=>{
   if(name==='next/server')return {NextResponse:{json:(body,{status,headers})=>({body,status,headers})}};
   if(name==='@supabase/supabase-js')return {createClient};
   throw Error('Unexpected import '+name);
 }});
 const run=()=>exports.POST({headers:{get:()=>options.noToken?'':'Bearer test-token'},url:'https://sandbox.example.invalid/api/company-administration/invite-employee',json:async()=>options.body||{tenantId,email:' Employee@example.invalid '}});
 return {run,sent,clients};
}
for(const [name,options,status] of [
 ['missing bearer',{noToken:true},401],['invalid session',{badSession:true},401],['non company administrator',{authorized:false},403],
 ['inactive company',{rows:{tenants:{status:'inactive',is_internal:false}}},403],
 ['internal company',{rows:{tenants:{status:'active',is_internal:true}}},403],
 ['no employee in this company',{rows:{tenant_memberships:null}},403],
 ['inactive company access',{rows:{tenant_memberships:{membership_status:'inactive'}}},403],
 ['inactive employee profile',{rows:{tenant_user_profiles:{account_status:'inactive'}}},403],
 ['missing employee profile',{rows:{tenant_user_profiles:null}},403],['lookup failure',{queryError:true},500],
 ['invalid tenant',{body:{tenantId:'other',email}},400]
])test(name+' cannot send mail',async()=>{const f=setup(options);const r=await f.run();assert.equal(r.status,status);assert.equal(f.sent.length,0);assert.equal(f.clients.some(c=>c.key==='test-secret'),false);});
test('authorized active employee receives invite to application activation page',async()=>{const f=setup();const r=await f.run();assert.equal(r.status,200);assert.equal(r.body.mode,'invited');assert.equal(f.sent.length,1);assert.equal(f.sent[0].address,email);assert.equal(f.sent[0].settings.redirectTo,'https://sandbox.example.invalid/activate-account?tenant='+tenantId);assert.equal(r.headers['Cache-Control'],'no-store');});
test('registered identity receives secure password setup link',async()=>{const f=setup({inviteError:{code:'email_exists',message:'Already registered'}});const r=await f.run();assert.equal(r.body.mode,'resent');assert.deepEqual(f.sent.map(s=>s.type),['invite','recovery']);assert.equal(f.sent[1].address,email);});
test('delivery failure is reported without sending recovery',async()=>{const f=setup({inviteError:{code:'over_email_send_rate_limit',message:'Rate limited'}});const r=await f.run();assert.equal(r.status,400);assert.equal(f.sent.length,1);});
test('recovery failure is not reported as successful resend',async()=>{const f=setup({inviteError:{code:'email_exists',message:'Already registered'},recoveryError:{message:'Rate limited'}});const r=await f.run();assert.equal(r.status,400);assert.equal(r.body.ok,undefined);});
