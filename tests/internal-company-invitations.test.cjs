const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require(process.env.TYPESCRIPT_PATH || "typescript");
const routePath = process.env.INVITATION_ROUTE || "app/api/company-administration/invite-employee/route.ts";
const source = ts.transpileModule(fs.readFileSync(routePath,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const tenantId = "87bdc084-e0c5-488f-a5a1-16dcd45be55c";
async function invoke(overrides = {}) {
  const config = {authorized:true,internal:true,member:true,legacyActive:true,profile:null,...overrides};
  let mailCalls=0;
  const filters=[];
  const client={
    auth:{getUser:async()=>({data:{user:{email:"admin@example.com"}}}),resetPasswordForEmail:async()=>{mailCalls++;return {error:null};}},
    rpc:async()=>({data:config.authorized,error:null}),
    from(table) {
      const chain={
        select(){return chain;},eq(k,v){filters.push([table,k,v]);return chain;},
        async maybeSingle(){
          const data = table==="tenants" ? {id:tenantId,status:config.companyInactive?"inactive":"active",is_internal:config.internal}
            : table==="tenant_memberships" ? (config.member?{membership_status:"active"}:null)
            : table==="tenant_user_profiles" ? config.profile
            : table==="user_roles" ? {account_status:config.legacyActive?"active":"inactive"} : null;
          return {data,error:null};
        }
      };return chain;
    }
  };
  const admin={auth:{admin:{inviteUserByEmail:async()=>{mailCalls++;return {error:config.existing?{code:"email_exists"}:null};}}}};
  const module={exports:{}};
  vm.runInNewContext(source,{exports:module.exports,module,URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:"https://example.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"dummy",SUPABASE_SERVICE_ROLE_KEY:"dummy-secret"}},require(name){
    if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options.status})}};
    if(name==="@supabase/supabase-js")return {createClient:(url,key)=>key==="dummy-secret"?admin:client};
    throw Error("Unexpected dependency");
  }});
  const response=await module.exports.POST({url:"https://example.invalid/api/company-administration/invite-employee",headers:{get:()=>config.noToken?null:"Bearer dummy"},json:async()=>({tenantId,email:"employee@example.com"})});
  return {response,mailCalls,filters};
}
test("active Internal employee can receive an invitation",async()=>{const r=await invoke();assert.equal(r.response.status,200);assert.equal(r.mailCalls,1);assert(r.filters.some(([t,k,v])=>t==="tenant_memberships"&&k==="tenant_id"&&v===tenantId));});
test("existing identity receives account setup email",async()=>{const r=await invoke({existing:true});assert.equal(r.response.body.mode,"resent");assert.equal(r.mailCalls,2);});
for(const [label,config] of [["unauthenticated",{noToken:true}],["not company administrator",{authorized:false}],["outside-company employee",{member:false}],["inactive Internal profile",{legacyActive:false}],["inactive company",{companyInactive:true}],["inactive tenant profile",{profile:{account_status:"inactive"}}],["customer without own profile",{internal:false}]]){
  test(label+" cannot trigger email",async()=>{const r=await invoke(config);assert(r.response.status>=400);assert.equal(r.mailCalls,0);});
}
test("customer invitation still requires its active tenant profile",async()=>{const r=await invoke({internal:false,legacyActive:false,profile:{account_status:"active"}});assert.equal(r.response.status,200);assert(!r.filters.some(([t])=>t==="user_roles"));});
