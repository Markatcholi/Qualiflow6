-- Training completion evidence foundation (additive; existing assignments unaffected).
-- Evidence files will be stored privately under tenant-specific paths by a separate secured workflow.
alter table public.training_assignments
 add column if not exists training_evidence_storage_path text,
 add column if not exists training_evidence_file_name text,
 add column if not exists training_valid_until date,
 add column if not exists retraining_due_date date,
 add column if not exists training_completed_on date;
comment on column public.training_assignments.training_evidence_storage_path is 'Private tenant-scoped storage object path for signed training evidence; not a public URL.';
comment on column public.training_assignments.training_valid_until is 'Optional date through which the documented qualification is valid.';
comment on column public.training_assignments.retraining_due_date is 'Optional date on which retraining becomes due.';
-- Do not add blanket storage policies or enable completion without required evidence.
