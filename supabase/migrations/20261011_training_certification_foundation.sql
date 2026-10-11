-- Training Certification Foundation (beta phase 1)
-- Apply in Supabase SQL Editor separately; GitHub merging does not apply this migration.
-- A certification is an issued qualification, not merely a training assignment.
create table if not exists public.training_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.qualisphere_resolve_training_tenant(),
  employee_email text not null check (length(btrim(employee_email)) > 0),
  certification_title text not null check (length(btrim(certification_title)) > 0),
  training_assignment_id uuid references public.training_assignments(id) on delete set null,
  certified_on date not null,
  expires_on date not null,
  reminder_days integer not null default 30 check (reminder_days between 0 and 365),
  assessor_email text,
  evidence_reference text,
  notes text,
  renewal_of_id uuid references public.training_certifications(id) on delete restrict,
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint training_certification_valid_dates check (expires_on >= certified_on)
);
create index if not exists training_certifications_tenant_employee
  on public.training_certifications (tenant_id, employee_email);
create index if not exists training_certifications_tenant_expiry
  on public.training_certifications (tenant_id, expires_on);
alter table public.training_certifications enable row level security;
-- Restrictive policy is intentional: even if another permissive policy is
-- added later, rows must still belong to the active company tenant.
create policy training_certifications_tenant_boundary
  on public.training_certifications as restrictive for all to authenticated
  using (tenant_id = public.qualisphere_resolve_training_tenant())
  with check (tenant_id = public.qualisphere_resolve_training_tenant());
-- Read-only baseline for authenticated members of the active tenant.
-- Creation/renewal will be enabled after tenant-scoped coordinator role
-- authorization is verified; do not grant blanket certification writes.
create policy training_certifications_read
  on public.training_certifications for select to authenticated using (true);
grant select on public.training_certifications to authenticated;
comment on table public.training_certifications is
  'Tenant-isolated issued certifications. Expiry is derived from expires_on; renewals create new rows to preserve history.';
