# QualiSphere sandbox rollout — first phase

## Inspected current state

- Repository: Markatcholi/Qualiflow6; Vercel checks deploy changes from this repository. The connected tools cannot inspect or change Vercel environment-variable settings.
- Working Supabase project: `cqowueogqykmdyxnkcmt`. It contains QualiSphere Internal (`87bdc084-e0c5-488f-a5a1-16dcd45be55c`), Acme Medical Devices Test, and QualiSphere Customer Test 2.
- An existing separate Supabase project, QualiSphere Beta (`bveewtjluzpolhflosgv`), now has the verified structure baseline: 144 tables (all with RLS), 172 functions, 3 invoker-security views and 454 policies. It has no users, tenants or buckets. Its existence does not make it a usable application sandbox yet.
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
- The separate Beta database has received structure only. No user access grants, record copying, reset or promotion action is implemented or enabled here.

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


## Structure baseline applied — 24-Oct-2026

The owner exported the working project's `public` schema with pg_dump 17.11 from Postgres 17.6. The complete export contains no table COPY/INSERT sections. The adapted baseline is `supabase/baselines/qualisphere_sandbox_structure.sql`; its header records the source SHA256. This file is intentionally outside automatic migrations and must never be run against the working project.

Adaptations: remove psql-only restrict commands, tolerate the existing public schema, omit default-privilege changes owned by managed `supabase_admin`, and retain row security. The empty-target guard rejects existing application relations, auth users or buckets. The final statements revoke public-schema usage and all application function execution from PUBLIC, anon and authenticated while the environment is incomplete. Existing object policies and grants are captured, but activation must explicitly restore only reviewed access.

Applied only to Beta `bveewtjluzpolhflosgv`, in migrations `qualisphere_sandbox_structure_baseline` and `keep_unconfigured_sandbox_functions_inaccessible`. No source-project mutation or record export/import was performed. Verification: 144 tables, 144 RLS-enabled tables, 172 functions, 3 views, 454 policies; zero auth users, tenants, training assignments and buckets; client schema usage denied. Local PGlite import with mocked Supabase platform objects passed, including rejection of a nonempty destination. This validates DDL compatibility, not end-to-end Supabase behavior.

Security review found inherited mutable search paths in 11 functions and 10 tables with RLS but no policies. Those tables remain default-deny; do not add broad access policies to silence advisory notices. Function execution is deliberately blocked for client roles until review. Auth/storage policies and auth triggers are outside this public-only export and require separate inventory; no files, users, cron schedules, outbound integrations or environment settings were copied.

Next: review the inherited privileged functions and tenant selection, capture required auth/storage hooks, provision a clean configuration baseline and sandbox-only identity, then configure a dedicated Vercel deployment. Keep this PR in draft and the sandbox unavailable until that work and isolation checks pass.

## Authentication and storage inventory — 24-Oct-2026

The source auth schema has no custom noninternal triggers. Password login in `app/login/page.tsx` needs an active tenant membership (or the legacy Internal bridge); authentication alone does not provision company access. No auth users have been created or copied. Auth site URL, allowed redirects, email provider settings and signup controls have not been inspected through the connected tools.

Storage inventory found seven bucket IDs. The source `Evidence`, `evidence` and `capa-evidence` buckets are public; the lowercase evidence bucket also permits anonymous reads/uploads and CAPA policies permit broad authenticated access. Do not copy these access rules into the customer sandbox design. NCMR and some document/CAPA attachment paths currently store public URLs; private sandbox evidence will require reviewed tenant-scoped authorization and signed downloads before those flows can pass beta testing. No source policies or bucket visibility were changed.

Applied `qualisphere_sandbox_private_storage_containers` to Beta only: seven empty PRIVATE buckets, retaining source file-size caps where configured. No object rows or file bytes were transferred and no client storage policies were created. Verified seven buckets, zero public buckets, zero objects, storage RLS enabled, zero storage policies and zero auth users. Application schema/function access remains disabled. Reproduction SQL is `supabase/baselines/qualisphere_sandbox_private_storage.sql`; run only after the structure baseline on an unused destination.

## Deployment and company preparation — 25-Oct-2026

The owner created the separate Vercel project `qualisphere-sandbox`, configured the five public/environment guard variables for Production and Preview, and set its production branch to `codex/sandbox-pairing-foundation`. Commit `fe0afcd1b42a682e239474805ae8abe0b6e1ae29` triggered the first build. The owner supplied screenshots showing Ready and the SANDBOX banner at `https://qualisphere-sandbox.vercel.app`. Hidden environment values and provider authentication settings were not directly inspected. No working-project settings were edited. This supersedes earlier references to the separate deployment being uncreated.

Applied `prepare_qualisphere_sandbox_company_configuration` to Beta only. It imports 47 role definitions (not user assignments) from the current application role catalog, creates one new `QUALISPHERE-SANDBOX` company with a newly generated ID, `is_internal=false`, and `status=provisioning`. Existing tenant triggers create 44 assignable company-role definitions and 10 standard impact areas. Eleven module-access entries exist but all are disabled; notifications, email notifications and overdue scanning are disabled. No production operational records, training mappings, documents, employee profiles, credentials or user permissions were copied.

Verified with a local PGlite structure+company import and live queries: one provisioning company, 47 role definitions, 44 company roles, 10 impact areas, zero memberships, auth users, enabled modules, outbound settings and training assignments. Client schema usage remains denied. The seed is deliberately one-time and refuses a nonempty company/user/role inventory. Reproduction script: `supabase/baselines/qualisphere_sandbox_company_preparation.sql`, outside automatic migrations. Running the existing production clone routines in an empty project does not reproduce the supplied master-data baseline: they reference a source Internal tenant that is absent here. Departments, configurable training methods, governance rules and other customer baseline configuration still need explicit reviewed seeding; do not call this a complete module configuration.

Next user action: create a sandbox-only authentication identity through Supabase Authentication UI, entering the password privately, without sending an invite. Then verify its identity, attach a company-admin membership through the reviewed provisioning step, and test restricted login. Do not globally re-grant access to all functions: legacy privileged functions and multiple-membership tenant resolution remain under review. No same-database paired membership or configuration-promotion/reset feature is enabled.
