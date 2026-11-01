# Inactive company login message and production rollout

Users whose company has been deactivated see: Your company account is inactive. Contact your company administrator.

The sandbox pre-request gate now distinguishes an existing customer user with an inactive company from the generic approved-test-account denial. Classification requires a matching Auth identity and real session. It never changes allowed_user, grants access, or changes company/employee status. The classification helper is in the non-exposed clone_runtime schema. Missing/anonymous sessions retain the existing generic denial.

Production has no sandbox gate. A self-scoped read-only RPC, qualisphere_company_access_state(), provides the inactive-company diagnosis if RLS returns no active memberships. It accepts no email or tenant parameter, validates the current Auth identity, and exposes no other user's data. A separate active company takes priority so an inactive company does not block access to another active one. The login page shows the exact agreed message instead of wrapping it in an Unable to resolve membership error.

## Rollout completed

- Beta: sandbox_inactive_company_message.sql and company_access_state_message.sql applied.
- Production: platform_company_status.sql and company_status_rls_boundary.sql from PR216 were missing and have now been installed, followed by company_access_state_message.sql. All real company statuses, membership records and module subscriptions were verified unchanged by before/after hashes.
- Never apply sandbox_inactive_company_message.sql to production: clone_runtime is specific to Beta.
- The production company status UI was already deployed from PR216; its backend is now available. The login wording requires merging/deploying this PR.

## Verification

Rollback-only Beta checks used an existing live Joseph session: inactive company access was denied with the exact message, missing/anonymous session classifications stayed generic, and reactivation restored allowed requests. The read-only diagnosis returned inactive_company when appropriate. Production checks created a temporary company fixture in a rollback-only transaction, verified platform deactivate/reactivate and customer denial, tested inactive RLS/authority, and confirmed other active companies still take priority in the login diagnosis. The fixture and audit events were rolled back. Production before/after tenant, membership and module hashes matched. Actual browser confirmation of the new wording is pending.
