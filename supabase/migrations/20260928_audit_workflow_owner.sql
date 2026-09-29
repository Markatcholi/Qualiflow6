alter table public.audits
  add column if not exists owner_email text;

create index if not exists idx_audits_tenant_owner_status
  on public.audits (tenant_id, owner_email, status);

comment on column public.audits.owner_email is
  'Authenticated QualiSphere user responsible for progressing the Audit workflow.';
