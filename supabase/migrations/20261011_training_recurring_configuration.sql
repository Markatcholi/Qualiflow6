-- Recurring training configuration; no automatic cycles until scheduler is implemented.
alter table public.training_assignments drop constraint if exists training_assignments_training_category_check;
alter table public.training_assignments add constraint training_assignments_training_category_check
 check (training_category in ('standard','certification','recurring'));
alter table public.training_assignments
 add column if not exists recurrence_months integer check (recurrence_months between 1 and 120),
 add column if not exists recurrence_basis text check (recurrence_basis in ('completion','calendar')),
 add column if not exists recurring_evidence_mode text check (recurring_evidence_mode in ('signature','attachment','both')),
 add column if not exists recurring_next_due_date date,
 add column if not exists recurring_parent_assignment_id uuid references public.training_assignments(id);
comment on column public.training_assignments.recurring_next_due_date is
 'Planning field only; no automatic assignment or notification generation until scheduler is enabled.';
