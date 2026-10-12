-- Distinguish certification-required training from ordinary training.
alter table public.training_assignments
 add column if not exists training_category text not null default 'standard'
 check (training_category in ('standard','certification'));
comment on column public.training_assignments.training_category is
 'Certification training is a requirement/assignment, NOT proof of QA-approved certification.';
