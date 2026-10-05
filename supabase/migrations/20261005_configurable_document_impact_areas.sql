-- Tenant-configurable Controlled Document Impact Assessment areas
create table if not exists public.md_document_impact_areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  label text not null,
  sort_order integer not null default 100,
  behavior_type text not null default 'generic'
    check (behavior_type in ('generic','inventory_wip','validation','training')),
  is_active boolean not null default true,
  is_system_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, code)
);

create index if not exists md_document_impact_areas_tenant_idx
  on public.md_document_impact_areas(tenant_id, sort_order);

alter table public.md_document_impact_areas enable row level security;

drop policy if exists md_document_impact_areas_company_boundary on public.md_document_impact_areas;
create policy md_document_impact_areas_company_boundary
on public.md_document_impact_areas
for all to authenticated
using (qualisphere_is_active_tenant_member(tenant_id))
with check (qualisphere_is_active_tenant_member(tenant_id));

-- Provision the existing QualiSphere baseline for every current tenant.
insert into public.md_document_impact_areas
  (tenant_id, code, label, sort_order, behavior_type, is_active, is_system_seed)
select t.id, seed.code, seed.label, seed.sort_order, seed.behavior_type, true, true
from public.tenants t
cross join (values
  ('product_design','Product / Design',10,'generic'),
  ('manufacturing_process','Manufacturing / Process',20,'generic'),
  ('tooling_equipment','Tooling / Equipment',30,'generic'),
  ('inspection_test_methods','Inspection / Test Methods',40,'generic'),
  ('specifications','Specifications',50,'generic'),
  ('supplier','Supplier',60,'generic'),
  ('inventory_wip','Inventory / WIP',70,'inventory_wip'),
  ('regulatory_risk','Regulatory / Risk',80,'generic'),
  ('validation','Validation',90,'validation'),
  ('training','Training',100,'training')
) as seed(code,label,sort_order,behavior_type)
on conflict (tenant_id, code) do nothing;

-- New Company Accounts receive the same baseline automatically.
create or replace function public.qualisphere_seed_document_impact_areas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.md_document_impact_areas
    (tenant_id, code, label, sort_order, behavior_type, is_active, is_system_seed)
  values
    (new.id,'product_design','Product / Design',10,'generic',true,true),
    (new.id,'manufacturing_process','Manufacturing / Process',20,'generic',true,true),
    (new.id,'tooling_equipment','Tooling / Equipment',30,'generic',true,true),
    (new.id,'inspection_test_methods','Inspection / Test Methods',40,'generic',true,true),
    (new.id,'specifications','Specifications',50,'generic',true,true),
    (new.id,'supplier','Supplier',60,'generic',true,true),
    (new.id,'inventory_wip','Inventory / WIP',70,'inventory_wip',true,true),
    (new.id,'regulatory_risk','Regulatory / Risk',80,'generic',true,true),
    (new.id,'validation','Validation',90,'validation',true,true),
    (new.id,'training','Training',100,'training',true,true)
  on conflict (tenant_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_document_impact_areas on public.tenants;
create trigger trg_seed_document_impact_areas
after insert on public.tenants
for each row execute function public.qualisphere_seed_document_impact_areas();
