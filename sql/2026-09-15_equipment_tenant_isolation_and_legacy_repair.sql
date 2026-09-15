-- QualiSphere Equipment Company Account isolation
-- Applied to Supabase on 2026-09-15.
-- Purpose: preserve Internal Equipment, repair Phase-1 customer tenant fallback rows,
-- and enforce tenant isolation across the Equipment module at the database layer.

create or replace function public.qualisphere_resolve_equipment_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then
    raise exception 'Authenticated user email is required to register equipment.';
  end if;

  if new.tenant_id is not null
     and public.qualisphere_tenant_module_enabled(new.tenant_id, 'equipment') then
    return new;
  end if;

  select count(*), min(tm.tenant_id::text)::uuid
    into v_membership_count, v_resolved_tenant_id
  from public.tenant_memberships tm
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'equipment'
   and tma.is_enabled = true
  join public.tenants t
    on t.id = tm.tenant_id
   and t.status = 'active'
  where lower(trim(tm.user_email)) = v_email
    and tm.membership_status = 'active';

  if v_membership_count = 1 then
    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;

  if v_membership_count = 0 then
    raise exception 'No active Company Account with Equipment access could be resolved for this user.';
  end if;

  raise exception 'Multiple active Company Accounts were found. Select the Company Account before registering equipment.';
end;
$$;

revoke all on function public.qualisphere_resolve_equipment_tenant() from public;

drop trigger if exists trg_00_equipment_tenant on public.equipment;
create trigger trg_00_equipment_tenant
before insert on public.equipment
for each row execute function public.qualisphere_resolve_equipment_tenant();

-- Repair Equipment rows created when the old page used auth.users.id as tenant_id.
with repair as (
  select e.id as equipment_id,
         min(tm.tenant_id::text)::uuid as resolved_tenant_id
  from public.equipment e
  join auth.users u on u.id = e.tenant_id
  join public.tenant_memberships tm
    on lower(trim(tm.user_email)) = lower(trim(u.email))
   and tm.membership_status = 'active'
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'equipment'
   and tma.is_enabled = true
  where not exists (select 1 from public.tenants t where t.id = e.tenant_id)
  group by e.id
  having count(distinct tm.tenant_id) = 1
)
update public.equipment e
set tenant_id = repair.resolved_tenant_id
from repair
where e.id = repair.equipment_id;

-- Repair numbering configuration created from the same legacy fallback.
with repair as (
  select c.id as config_id,
         min(tm.tenant_id::text)::uuid as resolved_tenant_id
  from public.equipment_numbering_configurations c
  join auth.users u on u.id = c.tenant_id
  join public.tenant_memberships tm
    on lower(trim(tm.user_email)) = lower(trim(u.email))
   and tm.membership_status = 'active'
  join public.tenant_module_access tma
    on tma.tenant_id = tm.tenant_id
   and lower(tma.module_code) = 'equipment'
   and tma.is_enabled = true
  where not exists (select 1 from public.tenants t where t.id = c.tenant_id)
  group by c.id
  having count(distinct tm.tenant_id) = 1
)
update public.equipment_numbering_configurations c
set tenant_id = repair.resolved_tenant_id,
    updated_at = now()
from repair
where c.id = repair.config_id;

-- Align child records to their Equipment master record before enforcing the boundary.
do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'equipment_id'
      and table_name like 'equipment_%'
      and table_name not in ('equipment_current_schedule_status','equipment_related_event_counts')
      and exists (
        select 1
        from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name = information_schema.columns.table_name
          and c2.column_name = 'tenant_id'
      )
  loop
    execute format(
      'update public.%I child set tenant_id = e.tenant_id from public.equipment e where child.equipment_id = e.id and child.tenant_id is distinct from e.tenant_id',
      r.table_name
    );
  end loop;
end $$;

-- A restrictive policy is ANDed with existing Equipment workflow/role policies.
-- This preserves existing within-company authorization while making cross-company
-- access impossible for authenticated users.
do $$
declare
  r record;
begin
  for r in
    select distinct c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.table_name like 'equipment%'
      and t.table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('drop policy if exists qualisphere_equipment_tenant_boundary on public.%I', r.table_name);
    execute format(
      'create policy qualisphere_equipment_tenant_boundary on public.%I as restrictive for all to authenticated using (public.qualisphere_tenant_module_enabled(tenant_id, ''equipment'')) with check (public.qualisphere_tenant_module_enabled(tenant_id, ''equipment''))',
      r.table_name
    );
  end loop;
end $$;

-- Ensure Equipment views honor the caller's underlying RLS policies.
alter view if exists public.equipment_current_schedule_status set (security_invoker = true);
alter view if exists public.equipment_related_event_counts set (security_invoker = true);
