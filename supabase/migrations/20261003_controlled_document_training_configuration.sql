-- Controlled Document training configuration and post-approval assignment foundation
-- Customer-configured training methods/groups; no due-date defaults are encoded.

create table if not exists public.training_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  release_blocking boolean not null default false,
  acknowledgement_required boolean not null default true,
  evidence_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, group_name)
);

create table if not exists public.training_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  training_group_id uuid not null references public.training_groups(id) on delete cascade,
  user_email text not null,
  created_at timestamptz not null default now(),
  unique(training_group_id, user_email)
);

create table if not exists public.document_training_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete cascade,
  impact_assessment_id uuid references public.document_impact_assessments(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id),
  rationale text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_assignments
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists training_requirement_id uuid references public.document_training_requirements(id) on delete set null,
  add column if not exists training_group_id uuid references public.training_groups(id) on delete set null,
  add column if not exists training_method_id uuid references public.training_methods(id) on delete set null,
  add column if not exists release_blocking boolean not null default false;

create index if not exists training_methods_tenant_idx on public.training_methods(tenant_id);
create index if not exists training_groups_tenant_idx on public.training_groups(tenant_id);
create index if not exists training_group_members_group_idx on public.training_group_members(training_group_id);
create index if not exists document_training_requirements_document_idx on public.document_training_requirements(document_id);
create index if not exists training_assignments_requirement_idx on public.training_assignments(training_requirement_id);

alter table public.training_methods enable row level security;
alter table public.training_groups enable row level security;
alter table public.training_group_members enable row level security;
alter table public.document_training_requirements enable row level security;

drop policy if exists training_methods_company_boundary on public.training_methods;
create policy training_methods_company_boundary on public.training_methods for all to authenticated
using (qualisphere_is_active_tenant_member(tenant_id))
with check (qualisphere_is_active_tenant_member(tenant_id));

drop policy if exists training_groups_company_boundary on public.training_groups;
create policy training_groups_company_boundary on public.training_groups for all to authenticated
using (qualisphere_is_active_tenant_member(tenant_id))
with check (qualisphere_is_active_tenant_member(tenant_id));

drop policy if exists training_group_members_company_boundary on public.training_group_members;
create policy training_group_members_company_boundary on public.training_group_members for all to authenticated
using (qualisphere_is_active_tenant_member(tenant_id))
with check (qualisphere_is_active_tenant_member(tenant_id));

drop policy if exists document_training_requirements_company_boundary on public.document_training_requirements;
create policy document_training_requirements_company_boundary on public.document_training_requirements for all to authenticated
using (
  qualisphere_is_active_tenant_member(tenant_id)
  and qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
)
with check (
  qualisphere_is_active_tenant_member(tenant_id)
  and qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
);
