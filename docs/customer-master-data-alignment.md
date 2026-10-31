# Customer Master Data alignment

Internal and customer user administration previously maintained separate employee profile forms. The customer form omitted employee name, manager email and Excel import.

Both screens now render `components/EmployeeProfileForm.tsx`. Add future employee field and layout changes there, then update both persistence adapters when the data contract changes. Excel import and Training Matrix are also shared components. Customer configuration values remain tenant-owned; deploying a UI improvement must not copy Internal configuration over a customer's data.

Customer saves use `qualisphere_save_company_employee`, which atomically calls the existing company user authorization operation and updates the employee profile. It validates the authenticated company administrator, active customer company, manager belonging to that company and reporting cycles. No legacy `user_roles` records are created.

Customer Excel import uses `qualisphere_import_company_employees`. It validates the batch and reporting hierarchy before writing, preserves existing access status on overwrite and creates new inactive profiles with invited company access. Import does not send email or assign module roles. The Internal import operation is unchanged.

Training Matrix uses the same component as Internal. Company administrator authority alone does not grant coordinator authority; editing remains restricted to the existing Training Coordinator / Document Control Coordinator permission.

## Database rollout

Apply `sql/align_customer_employee_profile_save.sql` and `sql/import_company_employees.sql` to the target database before deploying the customer UI. Both are already applied to the Beta sandbox. The protected Internal database has not been modified.

## Verification

Sandbox rollback-only tests executed as the authenticated ABS administrator checked name/manager persistence, clearing a manager, employee profile and company access deactivation, cross-company save/import rejection, self-manager rejection, inactive bulk import, and reporting-cycle rejection. Test rows were rolled back and absence confirmed. Anonymous execution is revoked for both new RPCs. Security advisor flags their authenticated SECURITY DEFINER exposure; this is intentional for the authorized operation and guarded by database identity and tenant checks.

Browser verification of the deployed form, Excel upload and Training Matrix remains required. Employee send/resend invitation controls are not part of this change.
