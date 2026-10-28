# Internal sandbox clone

## Baseline and scope

Application baseline: Internal `main` commit `7ffe3b3a9114d2f6f3f5af37c215403f09fae80b`.
Clone branch: `codex/internal-sandbox-clone`.
Working database: protected; all source reads only.
Sandbox target: separate QualiSphere Beta project, connected to the separate Vercel sandbox project.

Module pages, services, customer subscription APIs, company selection, administration screens, and workflow code are unchanged from the baseline. The application differences are the existing environment banner and build/start connection guard. Do not merge the older sandbox-specific company-selection implementation into this clone.

## Database preparation applied

- 381 configuration rows across 27 populated tables were copied or matched. Behavioral row comparisons passed for all 27, excluding creation/update timestamps.
- Internal company identity is preserved within the separate database because existing clone functions reference it. No identity links databases.
- All 172 source public functions and all 98 application triggers now match the source definitions after normalizing line endings. Original 454 public policies restored.
- All 144 original tables retain RLS. The former sandbox registry table remains inaccessible, with RLS and no policy.
- One approved sandbox authentication account retained; no source credentials, employee profiles, controlled documents, training assignments, NCMRs, CAPAs, or equipment records copied.
- Existing sandbox login mapped to the source owner's primary role and four security-role codes, rather than importing other users.
- All 15 catalog modules enabled for Internal. Former preparation company and membership retained inactive; no operational data deleted.
- In-app configuration preserved; outbound email and automated overdue scanning disabled.
- No operational history, queued emails, evidence objects, or counters copied.

One-time configuration payloads are intentionally absent from this public repository. The applied sandbox migration records retain the exact import. Reconcile future source schema/configuration changes explicitly; a branch by itself does not synchronize a database.

## Sandbox infrastructure boundaries

`supabase/baselines/qualisphere_internal_clone_runtime.sql` documents the applied access boundary and grants. It is outside automatic migrations, applies only to an isolated prepared sandbox, and must never run on the working database.

The Data API accepts only explicitly approved testers with an active matching account and a current Supabase session. This is an environment boundary, not a replacement for the source module permissions. Non-provisioned signups are not approved automatically. Anonymous application schema access and GraphQL access are denied. No Realtime publications are enabled. Deprecated sandbox-only functions remain uncallable by client roles.

All seven storage buckets stay private and empty at import. The 19 source storage policies were restored with the approved-tester boundary. Controlled-document, training, audit, and supplier attachment flows use the inherited private-storage paths; browser upload/download checks are still required.

## Known differences and remaining acceptance checks

1. Source evidence buckets `evidence`, `Evidence`, and `capa-evidence` are public, while the sandbox keeps them private. Source code paths that save public evidence URLs can therefore upload but cannot use those URLs for downloads. These paths need a shared source fix or an explicit storage decision; do not claim attachment parity.
2. The Vercel screenshots list no `SUPABASE_SERVICE_ROLE_KEY`. Source subscription editing and backend user administration require the sandbox's own server key. Configure it privately in the sandbox Vercel project only; never use `NEXT_PUBLIC_`, copy the working key, or commit a key.
3. Auth login and full browser workflows are not yet validated. The tester must sign in again to create a current session.
4. The source security advisor warnings for legacy privileged functions and mutable search paths remain. The internal tester boundary does not certify customer tenant isolation. Do not open customer beta access on the basis of this clone.
5. Platform invitations and password emails must remain paused during initial testing.
6. This branch is a pinned source snapshot. Future module changes should be promoted from the same reviewed source revision; avoid maintaining separate module implementations.

## Verification

- Configuration import tested with local PGlite; repeat/source-target guard rejected a second import.
- All 27 populated configuration tables matched expected source behavior.
- 172/172 public function definitions matched.
- Live database checks under the authenticated role confirmed platform administration, Internal training/document tenant resolution, 21 departments, and 6 methods.
- A training-method save passed inside a rolled-back transaction.
- Approved tester accepted and anonymous request rejected in local gate tests; a live anonymous Data API request returned 401 without data.
- Four environment guard tests passed.
- Full Next.js production build passed with non-secret placeholder build settings.
- End-to-end browser tests, private evidence uploads/downloads, subscription editing, and operational module workflows remain acceptance work.

