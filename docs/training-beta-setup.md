# Training beta update

## Apply

1. Run `sql/training_beta_audiences_and_assignments.sql` in the Supabase SQL Editor for the database used by this deployment, before deploying the UI.
2. Deploy this branch after reviewing the pull request.
3. As a Training or Document Control Coordinator, configure a procedure audience in Admin Master Data. Choose **All active employees**, or add departments and select specific roles. No roles selected means every role in that department.
4. In Training Management → Administration → **Assign Training From Matrix**, choose a procedure or employee, then **Find**. Review existing completion/assignment status, deselect anyone who should not be assigned, choose a configured method, frequency and due date, then assign.

The SQL was tested against an isolated PostgreSQL engine. Installation on the connected Supabase project could not be completed because both schema execution calls returned `Invalid or expired requestState`; a follow-up read confirmed the new functions were absent. It must be applied before the UI can save matrix audiences or create matrix assignments.

## Preserved behavior

- Existing matrix mappings are displayed by procedure. Saving edits deactivates prior mappings (`required_training=false`) rather than deleting them.
- Role-only legacy mappings remain editable and continue to match across departments.
- Matrix rules use employee training roles, not application permission roles. Available role choices come from active employee profiles; department options also include Admin Master Data departments.
- The current tenant is resolved by the existing training resolver. **All employees** means active employee profiles in that tenant. Employees must have a training profile to be included.
- The assignment preview creates nothing. Assignment rechecks current eligibility and released/effective document status on the server. Due dates are entered by the coordinator.
- Existing non-cancelled/non-withdrawn assignments for the same document/revision are skipped, including completed or waived records. A cancelled or withdrawn assignment may be replaced. Overlapping audiences and repeated matrix assignment requests do not create duplicates.
- Recurring assignments use the existing recurring cycle engine. Certification training may use the configured evidence-based method; externally approved certifications still use the existing Certification Register.
- Method evidence settings determine acknowledgement, attachment, or both. Existing recurring evidence and approved-form requirements are honored.
- Inactive methods are hidden for new selection and retained for existing references. Removing a method now deactivates it.
- Effectiveness controls and dashboard metrics are removed. A before-insert trigger disables effectiveness on all new training (including recurring cycles); historical data and signatures are not rewritten.

## Verification

- `npx tsc --noEmit`
- Production `npm run build` with placeholder Supabase build environment values: passed (80 pages).
- Compile `lib/trainingMatrix.ts` to CommonJS and run `tests/training-matrix.test.cjs` with `TRAINING_TEST_MODULE` set to the compiled file: 5 tests passed.
- Run `tests/training-matrix.database.cjs` with `PGLITE_MODULE` pointing to an isolated `@electric-sql/pglite@0.5.11` installation: passed SQL creation, audience edits, assignment eligibility, tenant checks, coordinator checks, duplicate skipping, recurrence, history preservation and evidence enforcement.

## Beta acceptance check

With test employee profiles only, check a procedure shared by Quality/Inspection and Manufacturing/Operators. Confirm that a Manufacturing/Inspection profile is not accidentally included. Then test **All employees**, an inactive employee, and a repeated assignment request. Complete an acknowledgement assignment as its employee and an evidence-based assignment with an uploaded form. A manager should retain team visibility but should not gain assignment creation rights.

These live, signed-in acceptance checks remain outstanding. Local SQL tests use a minimal schema and do not replace verification of the deployed RLS and file-storage configuration.
