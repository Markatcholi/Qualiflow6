-- DCI parent/child foundation for Controlled Documents
-- A DCI is the review/approval package. Each affected document retains its own impact assessment.

create table if not exists public.document_change_initiations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dci_number text not null,
  title text,
  change_description text not null,
  change_justification text not null,
  owner_email text not null,
  status text not null default 'draft'
    check (status in ('draft','collaboration','document_control_review','formal_review','approved','implementation','released','withdrawn')),
  release_strategy text not null default 'coordinated'
    check (release_strategy in ('coordinated','independent')),
  originating_change_control_id uuid,
  withdrawn_reason text,
  withdrawn_by text,
  withdrawn_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, dci_number)
);

create table if not exists public.document_change_initiation_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dci_id uuid not null references public.document_change_initiations(id) on delete cascade,
  document_id uuid not null references public.controlled_documents(id) on delete restrict,
  change_type text not null check (change_type in ('new','revision','reinstatement')),
  source_document_id uuid references public.controlled_documents(id) on delete restrict,
  sequence_no integer not null default 1,
  created_by text,
  created_at timestamptz not null default now(),
  unique (dci_id, document_id)
);

alter table public.controlled_documents
  add column if not exists dci_id uuid references public.document_change_initiations(id) on delete set null;

create index if not exists idx_dci_tenant_status
  on public.document_change_initiations(tenant_id, status);
create index if not exists idx_dci_documents_dic
  on public.document_change_initiation_documents(dci_id, sequence_no);
create index if not exists idx_controlled_documents_dic
  on public.controlled_documents(dci_id);

create table if not exists public.document_change_number_counters (
  tenant_id uuid primary key,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.generate_dci_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_next integer;
begin
  v_tenant_id := public.qualisphere_current_controlled_documents_tenant();
  if v_tenant_id is null then
    raise exception 'No active Controlled Documents tenant context.';
  end if;

  insert into public.document_change_number_counters(tenant_id, last_number)
  values (v_tenant_id, 1)
  on conflict (tenant_id)
  do update set last_number = document_change_number_counters.last_number + 1,
                updated_at = now()
  returning last_number into v_next;

  return 'DCI-' || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.qualisphere_set_dci_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := public.qualisphere_current_controlled_documents_tenant();
  if v_tenant_id is null then
    raise exception 'No active Controlled Documents tenant context.';
  end if;
  if new.tenant_id is null then new.tenant_id := v_tenant_id; end if;
  if new.tenant_id <> v_tenant_id then
    raise exception 'DCI tenant does not match active tenant.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_dci_tenant on public.document_change_initiations;
create trigger trg_set_dci_tenant
before insert or update on public.document_change_initiations
for each row execute function public.qualisphere_set_dci_tenant();

create or replace function public.qualisphere_set_dci_document_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dci_tenant uuid;
  v_document_tenant uuid;
begin
  select tenant_id into v_dci_tenant from public.document_change_initiations where id = new.dci_id;
  select tenant_id into v_document_tenant from public.controlled_documents where id = new.document_id;
  if v_dci_tenant is null or v_document_tenant is null or v_dci_tenant <> v_document_tenant then
    raise exception 'DCI and controlled document must belong to the same tenant.';
  end if;
  new.tenant_id := v_dci_tenant;
  return new;
end;
$$;

drop trigger if exists trg_set_dci_document_tenant on public.document_change_initiation_documents;
create trigger trg_set_dci_document_tenant
before insert or update on public.document_change_initiation_documents
for each row execute function public.qualisphere_set_dci_document_tenant();

alter table public.document_change_initiations enable row level security;
alter table public.document_change_initiation_documents enable row level security;
alter table public.document_change_number_counters enable row level security;

drop policy if exists document_change_initiations_company_boundary on public.document_change_initiations;
create policy document_change_initiations_company_boundary
on public.document_change_initiations for all to authenticated
using (
  public.qualisphere_is_active_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
)
with check (
  public.qualisphere_is_active_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
);

drop policy if exists document_change_initiation_documents_company_boundary on public.document_change_initiation_documents;
create policy document_change_initiation_documents_company_boundary
on public.document_change_initiation_documents for all to authenticated
using (
  public.qualisphere_is_active_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
)
with check (
  public.qualisphere_is_active_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
);

drop policy if exists document_change_number_counters_company_boundary on public.document_change_number_counters;
create policy document_change_number_counters_company_boundary
on public.document_change_number_counters for select to authenticated
using (
  public.qualisphere_is_active_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'controlled_documents')
);

grant select, insert, update on public.document_change_initiations to authenticated;
grant select, insert, update, delete on public.document_change_initiation_documents to authenticated;
grant select on public.document_change_number_counters to authenticated;
grant execute on function public.generate_dci_number() to authenticated;

comment on table public.document_change_initiations is 'Parent Document Change Initiation (DCI) package. Collaboration and formal approval occur at this package level.';
comment on table public.document_change_initiation_documents is 'Affected controlled documents within a DCI. Each document retains its own impact assessment and downstream requirements.';
