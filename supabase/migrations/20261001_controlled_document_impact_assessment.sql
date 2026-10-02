-- Controlled Document impact assessment and disposition foundation
create table if not exists public.document_impact_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  impact_area text not null,
  is_impacted boolean,
  assessment text,
  disposition_required boolean not null default false,
  disposition_summary text,
  assessed_by text,
  assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, impact_area)
);

create index if not exists document_impact_assessments_document_idx on public.document_impact_assessments(document_id);
create index if not exists document_impact_assessments_tenant_idx on public.document_impact_assessments(tenant_id);

alter table public.document_impact_assessments enable row level security;

drop policy if exists document_impact_assessments_company_boundary on public.document_impact_assessments;
create policy document_impact_assessments_company_boundary
on public.document_impact_assessments
for all to authenticated
using (
  qualisphere_is_active_tenant_member(tenant_id)
  and qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
)
with check (
  qualisphere_is_active_tenant_member(tenant_id)
  and qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
);

alter table public.approval_tasks
  add column if not exists document_impact_assessment_id uuid
  references public.document_impact_assessments(id) on delete set null;

create index if not exists approval_tasks_document_impact_idx on public.approval_tasks(document_impact_assessment_id);
