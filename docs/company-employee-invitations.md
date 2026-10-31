# Company employee invitations

Company Administrator: Company Administration → Admin Master Data → User Administration → Send / Resend Invitation beside an active employee.

Saving a profile authorizes company access but does not send email. The invitation button sends a Supabase Auth invitation to a new identity. For an existing Auth identity, Supabase's secure recovery email opens the same password setup page. This can reset that identity's password across this Supabase environment; it does not affect its separate Internal/Beta project password.

The server verifies the bearer token using Auth getUser, company administrator authority for the specified tenant, an active customer tenant, and active target profile and company access. Reads use the administrator's RLS context. A service-role Auth client is created only after authorization. The operation does not change company roles, grant platform access, expose a key, set a password, or auto-send email when a profile is saved. No new database migration is required.

The registry activation control remains for the initial company administrator. The shared activation page uses a role-neutral heading for employee and company administrator recipients.

## Validation

Run `node --test tests/company-employee-invitations.test.cjs`. Tests execute the actual compiled route with mocked Auth delivery. Negative cases cover missing/invalid session, unauthorized tenant administrator, inactive/internal company, absent/inactive employee access or profile, malformed tenant, and database lookup failures. Positive cases cover new invitation and existing identity recovery, and delivery failure handling. No real invitation emails are sent by the tests.

A read-only Beta check as the ABS company administrator confirmed that tenant, employee membership and profile records required by this route are visible through RLS. Browser delivery/acceptance still requires manual verification after deployment. Use a separate browser/profile for the employee invitation so it does not replace the company administrator's session in another tab.

This feature does not add a separate invitation acceptance status or prove acceptance from the employee Active status. The registry's existing Invited By/Joined labels can reflect profile authorization rather than actual email delivery/acceptance.
