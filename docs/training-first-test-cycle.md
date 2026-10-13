# QualiSphere Training Module — First Structured Test Cycle

**Status:** Planned; do not claim validation or release readiness until executed and documented.
**Environment:** Use ACME or a dedicated test tenant and synthetic employees; avoid live employee training evidence.
**Evidence:** Record test ID, tester, timestamp, tenant, role, input, expected result, actual result, screenshot/evidence link, defect, retest.

| ID | Test | Expected result |
| --- | --- | --- |
| TR-01 | Coordinator creates standard assignment | Authorized coordinator can assign; employee receives only own task |
| TR-02 | Non-coordinator attempts training creation | UI hidden and database write rejected |
| TR-03 | Employee completes R&U with e-signature | Completion and signature retained in record |
| TR-04 | Certification attachment completion | Evidence required, stored under tenant/assignment path |
| TR-05 | Recurring training creation and next cycle | Correct recurrence basis and no duplicate cycle |
| TR-06 | Recurring automation idempotency | Second scheduled run creates no duplicate child assignment |
| TR-07 | Training reminders | Due-soon and overdue notices deduplicated correctly |
| TR-08 | Manager sees direct-report assignments | Read-only access; no unrelated employees |
| TR-09 | Coordinator compliance report | Correct totals, overdue, waivers and filters |
| TR-10 | CSV export | Matches filtered rows; dangerous spreadsheet prefixes escaped |
| TR-11 | Recurring renewal report | Next due dates, historical cycles and 30-day windows correct |
| TR-12 | Management report | Department totals, 90-day completions, certification risks correct |
| TR-13 | Tenant separation | ACME users cannot view/modify Internal or other tenant records |
| TR-14 | Coordinator role revoked | Report and configuration access denied after session refresh |
| TR-15 | Training matrix | Managed in Admin Master Data; assignments follow tenant configuration |
| TR-16 | Document release training | Training assignments generated according to release requirements |
| TR-17 | Training compliance settings | Authorized coordinator can save own-tenant settings only; invalid thresholds rejected |
| TR-18 | Disabled governance features | No manager escalation or snapshot job runs until separately enabled and deployed |

**Exit criteria:** All critical security and workflow tests pass, all defects triaged, evidence attached, and customer-specific acceptance criteria approved. Do not manually run the daily automation against production records as a test.

**Governance rollout:** This PR establishes tenant settings only. Escalation delivery and immutable audit snapshots require separate design review and explicit activation; neither is implemented by this PR.
