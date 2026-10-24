# QualiSphere sandbox rollout — first phase

## Inspected current state

- Repository: Markatcholi/Qualiflow6; Vercel checks deploy changes from this repository. The connected tools cannot inspect or change Vercel environment-variable settings.
- Working Supabase project: `cqowueogqykmdyxnkcmt`. It contains QualiSphere Internal (`87bdc084-e0c5-488f-a5a1-16dcd45be55c`), Acme Medical Devices Test, and QualiSphere Customer Test 2.
- An existing separate Supabase project, QualiSphere Beta (`bveewtjluzpolhflosgv`), is active but has no public application tables. Its existence does not make it a usable application sandbox yet.
- No environment-kind or environment-pair fields currently exist on tenants.
- Company selection is stored in localStorage. The live Training and Controlled Documents tenant resolvers count enabled memberships, or fall back to the legacy Internal account; they do not consume that browser selection. A new sandbox membership could therefore cause the wrong tenant to resolve.

## Decision and boundaries

Use a separate database/storage project and separate Vercel deployment for internal code/schema testing. Keep the current working database, tenant IDs, domain and login behavior unchanged. Do not create a second `is_internal=true` tenant: existing legacy resolvers use `limit 1` for Internal and do not distinguish two such tenants.

The existing Beta project is a candidate isolated sandbox, not an already provisioned sandbox. Before using it, inventory its auth/project settings and establish a complete, reproducible schema baseline. The repository's migrations extend an existing application and cannot be assumed to recreate its entire schema.

The customer model remains a production/sandbox pair with a shared customer identity and distinct tenant identities. Where a pair spans deployments/projects, its registry needs project/deployment references as well as tenant IDs. Identical UUIDs in different databases do not identify the same environment.

Only configuration will be promoted after validation and administrator approval. No test assignments, completions, signatures, operational quality records or test attachments transfer. A new customer's production starts from the supplied baseline; pre-go-live configuration promotion may replace that baseline after dependency checks. After go-live, use reviewed updates preserving production records. Document mappings and user references must resolve to destination objects; copying UUIDs is insufficient.

## What this change implements

- An explicit deployment environment flag and a persistent SANDBOX banner.
- A build/dev/start guard requiring sandbox to point at its approved separate project, with a different protected project reference. Legacy JWT API keys, when used, must match that sandbox reference. Keys are never logged.
- Existing unconfigured deployments are unchanged.
- No database provisioning, user access grants, record copying, reset or promotion action is implemented or enabled here.

## Isolated deployment settings

Configure these on a separate Vercel sandbox project/deployment, not on the existing working deployment:

```text
NEXT_PUBLIC_QUALISPHERE_ENVIRONMENT=sandbox
QUALISPHERE_SANDBOX_PROJECT_REF=bveewtjluzpolhflosgv
QUALISPHERE_PROTECTED_PROJECT_REF=cqowueogqykmdyxnkcmt
NEXT_PUBLIC_SUPABASE_URL=https://bveewtjluzpolhflosgv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sandbox project's own publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<sandbox project's own backend key, if platform APIs are enabled>
```

Vercel preview deployments otherwise inherit their configured database credentials; a GitHub branch alone is not isolation. Do not enable these settings until the candidate database has the complete schema and independently configured authentication/storage. Configure sandbox-only auth redirects and disable real outbound integrations during initial tests. Never copy production credentials or operational records.

## Next implementation steps

1. Capture a schema baseline and confirm it can initialize the separate Beta database without operational data. Validate RLS, storage policies, auth, scheduler and integration settings there.
2. Deploy a dedicated sandbox connected exclusively to that project; verify the banner and confirm a test record appears only there.
3. Establish a server-validated selected environment/tenant shared by module resolvers, storage, workers and notifications. Reject ambiguous or unauthorized selection instead of falling back to Internal.
4. Add the environment-pair registry and provisioning UI. Provision QualiSphere's pair first, then use that flow for customers. Grant sandbox membership only after isolation checks pass; it is not automatically authorized by production membership.
5. Implement a versioned configuration package with preview, dependencies, conflict handling and an audit record. No raw database copy and no record promotion.

## Acceptance criteria before calling the sandbox usable

- A user can choose the environment and every module resolves that same environment on the server.
- Sandbox records/files/notifications and background jobs cannot appear in or change production.
- QualiSphere sandbox can be reset without affecting the working account.
- The baseline provisions reliably; configuration promotion is explicitly reviewed and cannot include operational records.

This first-phase PR does not meet all those criteria. It supplies deployment safeguards and records the prerequisites discovered during inspection.
