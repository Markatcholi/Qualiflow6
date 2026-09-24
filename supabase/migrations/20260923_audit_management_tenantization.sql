-- QualiSphere Audit Management tenantization
-- Preserves legacy development records under QualiSphere Internal and enforces Company Account isolation.

alter table public.audits add column if not exists tenant_id uuid references public.tenants(id);
alter table public.audit_findings add column if not exists tenant_id uuid references public.tenants(id);

-- Existing Audit Management records predate tenantization and belong to the original Internal / Development environment.
update public.audits a
set tenant_id = t.id
from public.tenants t
where a.tenant_id is null
  and t.is_internal = true
  and t.status = 'active';

update public.audit_findings f
set tenant_id = a.tenant_id
from public.audits a
where f.audit_id = a.id
  and f.tenant_id is null;

alter table public.audits alter column tenant_id set not null;
alter table public.audit_findings alter column tenant_id set not null;

create index if not exists audits_tenant_id_idx on public.audits(tenant_id);
create index if not exists audit_findings_tenant_id_idx on public.audit_findings(tenant_id);
create index if not exists audit_findings_tenant_audit_idx on public.audit_findings(tenant_id,audit_id);

create or replace function public.qualisphere_current_audit_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;

  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid
    into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id and t.status='active'
  where lower(trim(tm.user_email))=v_email
    and tm.membership_status='active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'audit_management');

  if v_count=1 then return v_tenant; end if;

  if v_count=0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email))=v_email
      and lower(coalesce(ur.account_status,'active')) <> 'inactive'
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal=true and t.status='active'
      and public.qualisphere_tenant_module_enabled(t.id,'audit_management')
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;

create or replace function public.qualisphere_resolve_audit_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to create an audit.'; end if;
  v_tenant := public.qualisphere_current_audit_tenant();
  if v_tenant is null then raise exception 'Select one active Company Account with Audit Management access before creating an audit.'; end if;
  if new.tenant_id is not null and new.tenant_id <> v_tenant then raise exception 'Audit Company Account access denied.'; end if;
  new.tenant_id := v_tenant;
  return new;
end;
$$;

create or replace function public.qualisphere_enforce_audit_row_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Audit Company Account cannot be changed.';
  end if;
  if auth.uid() is not null and not (
    public.qualisphere_is_active_tenant_member(new.tenant_id)
    and public.qualisphere_tenant_module_enabled(new.tenant_id,'audit_management')
  ) then
    raise exception 'Audit Company Account access denied.';
  end if;
  return new;
end;
$$;

create or replace function public.qualisphere_set_audit_finding_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_parent_tenant uuid;
begin
  select tenant_id into v_parent_tenant from public.audits where id=new.audit_id;
  if v_parent_tenant is null then raise exception 'Parent audit not found.'; end if;
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'Audit finding Company Account cannot be changed.'; end if;
  if new.tenant_id is not null and new.tenant_id <> v_parent_tenant then raise exception 'Audit finding Company Account must match parent audit.'; end if;
  new.tenant_id := v_parent_tenant;
  return new;
end;
$$;

drop trigger if exists audits_resolve_tenant on public.audits;
create trigger audits_resolve_tenant before insert on public.audits for each row execute function public.qualisphere_resolve_audit_tenant();
drop trigger if exists audits_enforce_tenant on public.audits;
create trigger audits_enforce_tenant before update on public.audits for each row execute function public.qualisphere_enforce_audit_row_tenant();
drop trigger if exists audit_findings_set_tenant on public.audit_findings;
create trigger audit_findings_set_tenant before insert or update on public.audit_findings for each row execute function public.qualisphere_set_audit_finding_tenant();

alter table public.audits enable row level security;
alter table public.audit_findings enable row level security;

drop policy if exists "allow insert audits" on public.audits;
drop policy if exists "allow read audits" on public.audits;
drop policy if exists "allow update audits" on public.audits;
drop policy if exists "audit tenant select" on public.audits;
drop policy if exists "audit tenant insert" on public.audits;
drop policy if exists "audit tenant update" on public.audits;

create policy "audit tenant select" on public.audits for select to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));
create policy "audit tenant insert" on public.audits for insert to authenticated
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));
create policy "audit tenant update" on public.audits for update to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));

drop policy if exists "allow insert audit findings" on public.audit_findings;
drop policy if exists "allow read audit findings" on public.audit_findings;
drop policy if exists "allow update audit findings" on public.audit_findings;
drop policy if exists "audit finding tenant select" on public.audit_findings;
drop policy if exists "audit finding tenant insert" on public.audit_findings;
drop policy if exists "audit finding tenant update" on public.audit_findings;

create policy "audit finding tenant select" on public.audit_findings for select to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));
create policy "audit finding tenant insert" on public.audit_findings for insert to authenticated
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));
create policy "audit finding tenant update" on public.audit_findings for update to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'audit_management'));

comment on column public.audits.tenant_id is 'Company Account that owns this Audit Management record.';
comment on column public.audit_findings.tenant_id is 'Company Account inherited from the parent audit.';
