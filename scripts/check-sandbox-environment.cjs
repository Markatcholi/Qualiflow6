// Fail a sandbox build closed if it points at the protected working database.
function validateEnvironment(env) {
 const mode=env.NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT||'';
 if(!mode)return; // Existing deployments remain unchanged until explicitly configured.
 if(!['internal','production','sandbox'].includes(mode))throw new Error('Unknown QualiSphere environment.');
 if(mode!=='sandbox')return;
 const sandbox=env.QUALISPHERE_SANDBOX_PROJECT_REF;
 const protectedProject=env.QUALISPHERE_PROTECTED_PROJECT_REF;
 if(!sandbox||!protectedProject)throw new Error('Sandbox and protected Supabase project references are required for a sandbox deployment.');
 if(sandbox===protectedProject)throw new Error('Sandbox must use a different Supabase project from the protected working environment.');
 let url;try{url=new URL(env.NEXT_PUBLIC_SUPABASE_URL||'');}catch{throw new Error('Sandbox Supabase URL is missing or invalid.');}
 if(url.protocol!=='https:'||url.hostname!==`${sandbox}.supabase.co`)throw new Error('Sandbox Supabase URL does not match the approved sandbox project.');
 if(!env.NEXT_PUBLIC_SUPABASE_ANON_KEY)throw new Error('Sandbox publishable/anon key is required.');
 // Legacy JWT keys encode their project reference. New opaque keys are validated
 // by Supabase against the configured endpoint; never print either kind of key.
 for(const key of [env.NEXT_PUBLIC_SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean)) {
  const parts=key.split('.');if(parts.length!==3)continue;
  let payload;try{payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());}catch{throw new Error('Invalid sandbox API key format.');}
  if(payload.ref&&payload.ref!==sandbox)throw new Error('A configured API key belongs to a different Supabase project.');
 }
}
module.exports={validateEnvironment};
if(require.main===module){try{validateEnvironment(process.env);}catch(error){console.error(error.message);process.exit(1);}}
