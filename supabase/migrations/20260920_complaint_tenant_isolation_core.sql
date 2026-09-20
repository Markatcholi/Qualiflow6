-- Complaint tenant isolation core
-- Preserves legacy QualiSphere Internal complaints while isolating customer Company Accounts.

create or replace function public.qualisphere_resolve_complaint_tenant()
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
  join public.tenants t on t.id = tm.tenant_id and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'complaints');

  if v_count = 1 then return v_tenant; end if;

  if v_count = 0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email)) = v_email
  ) then
    select t.id into v_tenant
    from public.tenants t
    where t.is_internal = true and t.status = 'active'
    limit 1;
    return v_tenant;
  end if;

  return null;
end;
$$;

alter table public.complaints add column if not exists tenant_id uuid references public.tenants(id);
alter table public.complaint_activity_log add column if not exists tenant_id uuid references public.tenants(id);
alter table public.complaint_quality_links add column if not exists tenant_id uuid references public.tenants(id);

update public.complaints c
set tenant_id = t.id
from public.tenants t
where c.tenant_id is null and t.is_internal = true and t.status = 'active';

update public.complaint_activity_log cal
set tenant_id = c.tenant_id
from public.complaints c
where cal.complaint_id = c.id and cal.tenant_id is null;

update public.complaint_quality_links cql
set tenant_id = c.tenant_id
from public.complaints c
where cql.complaint_id = c.id and cql.tenant_id is null;

alter table public.complaints alter column tenant_id set not null;
alter table public.complaint_activity_log alter column tenant_id set not null;
alter table public.complaint_quality_links alter column tenant_id set not null;

create or replace function public.qualisphere_set_complaint_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant uuid;
begin
  v_tenant := public.qualisphere_resolve_complaint_tenant();
  if v_tenant is null then
    raise exception 'No active Company Account with Complaints access could be resolved for this user.';
  end if;
  if new.tenant_id is null then new.tenant_id := v_tenant; end if;
  if new.tenant_id <> v_tenant then
    raise exception 'Complaint Company Account does not match the active Company Account.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_complaints_tenant on public.complaints;
create trigger trg_complaints_tenant
before insert or update of tenant_id on public.complaints
for each row execute function public.qualisphere_set_complaint_tenant();

create or replace function public.qualisphere_set_complaint_child_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_parent_tenant uuid;
  v_active_tenant uuid;
begin
  select c.tenant_id into v_parent_tenant
  from public.complaints c
  where c.id = new.complaint_id;

  if v_parent_tenant is null then
    raise exception 'Complaint parent record was not found.';
  end if;

  v_active_tenant := public.qualisphere_resolve_complaint_tenant();
  if v_active_tenant is null or v_parent_tenant <> v_active_tenant then
    raise exception 'Complaint child record Company Account does not match the active Company Account.';
  end if;

  new.tenant_id := v_parent_tenant;
  return new;
end;
$$;

drop trigger if exists trg_complaint_activity_log_tenant on public.complaint_activity_log;
create trigger trg_complaint_activity_log_tenant
before insert or update of complaint_id, tenant_id on public.complaint_activity_log
for each row execute function public.qualisphere_set_complaint_child_tenant();

drop trigger if exists trg_complaint_quality_links_tenant on public.complaint_quality_links;
create trigger trg_complaint_quality_links_tenant
before insert or update of complaint_id, tenant_id on public.complaint_quality_links
for each row execute function public.qualisphere_set_complaint_child_tenant();

create unique index if not exists complaints_tenant_complaint_number_uidx
on public.complaints(tenant_id, complaint_number)
where complaint_number is not null;

drop policy if exists complaints_company_boundary on public.complaints;
create policy complaints_company_boundary on public.complaints
as restrictive for all to authenticated
using (tenant_id = public.qualisphere_resolve_complaint_tenant())
with check (tenant_id = public.qualisphere_resolve_complaint_tenant());

drop policy if exists complaint_activity_log_company_boundary on public.complaint_activity_log;
create policy complaint_activity_log_company_boundary on public.complaint_activity_log
as restrictive for all to authenticated
using (tenant_id = public.qualisphere_resolve_complaint_tenant())
with check (tenant_id = public.qualisphere_resolve_complaint_tenant());

drop policy if exists complaint_quality_links_company_boundary on public.complaint_quality_links;
create policy complaint_quality_links_company_boundary on public.complaint_quality_links
as restrictive for all to authenticated
using (tenant_id = public.qualisphere_resolve_complaint_tenant())
with check (tenant_id = public.qualisphere_resolve_complaint_tenant());
