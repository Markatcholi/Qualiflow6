const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateEnvironment:check}=require('../scripts/check-sandbox-environment.cjs');
const base={NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT:'sandbox',QUALISPHERE_SANDBOX_PROJECT_REF:'sandbox-project',QUALISPHERE_PROTECTED_PROJECT_REF:'working-project',NEXT_PUBLIC_SUPABASE_URL:'https://sandbox-project.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_test'};
test('existing deployments are unchanged until configured',()=>assert.doesNotThrow(()=>check({})));
test('sandbox requires a separately identified project',()=>{
 assert.throws(()=>check({...base,QUALISPHERE_PROTECTED_PROJECT_REF:undefined}),/references are required/);
 assert.throws(()=>check({...base,QUALISPHERE_SANDBOX_PROJECT_REF:'working-project'}),/different Supabase project/);
});
test('sandbox cannot point at protected or arbitrary endpoints',()=>{
 assert.throws(()=>check({...base,NEXT_PUBLIC_SUPABASE_URL:'https://working-project.supabase.co'}),/does not match/);
 assert.throws(()=>check({...base,NEXT_PUBLIC_SUPABASE_URL:'http://sandbox-project.supabase.co'}),/does not match/);
 assert.doesNotThrow(()=>check(base));
});
test('legacy keys must belong to sandbox, including backend keys',()=>{
 const jwt=ref=>`header.${Buffer.from(JSON.stringify({ref})).toString('base64url')}.signature`;
 assert.throws(()=>check({...base,SUPABASE_SERVICE_ROLE_KEY:jwt('working-project')}),/different Supabase project/);
 assert.doesNotThrow(()=>check({...base,NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt('sandbox-project')}));
});
