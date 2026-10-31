# Customer-owned Company Administrator delegation

An editable customer QMS role named Administrator previously appeared in the header while Company Administration permissions still depended on the company access record. It did not grant Company Administrator authority. The header and workspace now distinguish Company Member / Company Administrator authority from QMS role names.

Company Administration → Admin Master Data → User Administration now has a Company Administrators section listing active company administrators, an employee selector, Appoint Company Administrator, and Remove Administrator Authority. The employee table displays company authority separately from assigned QMS roles. The page identity label says Signed-in Company Administrator; it identifies the current user, not a permanent owner of Master Data.

## Customer flow

1. The existing customer company administrator saves and activates the employee profile, sends the invitation and verifies the employee can log in.
2. Select that employee in Company Administrators and choose Appoint Company Administrator.
3. Refresh the employee's workspace and verify Company Administration appears and opens.
4. If responsibility is being transferred, the new administrator can remove the former administrator's authority. Company employee access and QMS roles are retained. The removal control rejects removing the last active administrator. Self-removal returns the current user to their workspace.

Changing a QMS role does not grant or revoke this administrative authority. No platform administrator or Supabase dashboard action is required. No existing role assignments are automatically converted; the customer must explicitly appoint administrators.

## Database rollout and validation

Apply `sql/company_administrator_delegation.sql` before the UI rollout. Already applied to Beta only. The protected Internal database has not been changed. The new RPC validates auth.uid, current company-admin membership, active customer tenant and target access/profile. It serializes authority changes using a company row lock and rechecks the caller after the lock. Anonymous execution is revoked. Authenticated SECURITY DEFINER exposure is intentional and guarded; no platform administrator table or Internal company is modified.

Rollback-only Beta tests covered rejecting member self-promotion, cross-company changes and inactive targets; successful appointment; authorization via qualisphere_is_company_admin for the new administrator; removing the former administrator and denying their attempt to restore themselves; and blocking removal of the last administrator through this RPC. Original roles were verified unchanged after rollback. Label and invitation route tests passed. Browser verification is still required.

The last-administrator check in this change covers authority removal through the new RPC. General employee deactivation remains a separate operation; this is not a claim of a platform-wide last-administrator invariant across every possible access mutation.
