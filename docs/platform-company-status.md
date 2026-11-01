# Platform-controlled customer company status

QualiSphere Platform Administration → Company Registry → Open Company → Company Status → Active / Inactive → Save Company Status.

Only QualiSphere's active platform administrators can change customer company status. Inactivation requires confirmation in the UI; the server validates platform authority independently. The Internal environment is excluded from this control. An expected-status check rejects concurrent stale saves rather than overwriting another change.

Company status is independent of employee active/inactive status, Company Administrator authority, QMS roles, subscribed modules and email activation. Inactivation preserves those records. Reactivation permits users with active company access to return; it does not activate employees who were individually deactivated. The platform can continue viewing an inactive company and reactivate it.

The operation atomically updates the tenant status and inserts a company_status_changed audit_logs record with the previous status, new status and acting platform administrator. A no-op save does not add another audit event. Company administrators' existing tenant profile UPDATE permission cannot be used to change status directly.

## Access enforcement

Login already excludes inactive companies. Shared membership/admin/module helpers now require an active parent company, and training coordinator authorization does too. A restrictive status boundary supplements existing access policies on every current public RLS table with a UUID tenant_id (93 tables in Beta). It does not grant new access: existing tenant, module and role policies still apply. Platform access remains subject to those existing permissions, with a status-boundary exception for platform administration. Global null-tenant rows are preserved under their existing policies. New tenant-owned tables must receive the same company-status boundary in future migrations.

Existing browser pages can retain information already loaded, and previously issued downloads or cached files are not recalled. Subsequent protected requests are checked against company status. This work does not claim a complete audit of all legacy SECURITY DEFINER operations or third-party storage links.

## Rollout

Apply sql/platform_company_status.sql, then sql/company_status_rls_boundary.sql before deploying the new UI. Both are now installed in Beta and production. Production tenant, membership and subscription records were verified unchanged during rollout; the installation changed schema, functions and policies only. No real company was deactivated during verification: all status transitions and audit events were inside a transaction that was rolled back.

## Verification

Full Next.js production build passed (81 pages), 18 existing label/invitation tests passed, and diff checks passed. Rollback-only database checks passed for customer RPC denial, direct table-update denial, platform deactivation/reactivation, Internal protection, invalid status, stale updates, inactive company permissions and profile RLS, restored access after reactivation, unchanged memberships/subscriptions, and two audit events. Confirmed ABS remained active and no test audit events persisted. Anonymous execution of the new RPC is denied. Security advisors were reviewed; authenticated SECURITY DEFINER helper/RPC exposure is intentional and protected by the platform authorization check for the mutating operation.

The parameterized rollback test is tests/company-status.integration.sql. Run only with a sandbox fixture where the customer_email is an active company administrator, platform_email is an active platform administrator, and tenant_id is an active customer with employee profiles and module subscriptions. It requires a database-owner test connection to set authenticated-role claims; it does not mint credentials or alter Auth sessions. Browser confirmation of the status selector and resulting login behavior remains pending.
