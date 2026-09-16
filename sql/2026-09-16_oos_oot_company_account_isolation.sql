-- QualiSphere OOS/OOT Company Account isolation
-- Preserves legacy OOS/OOT records as QualiSphere Internal and enforces tenant ownership.

alter table public.oos_oot_investigations
  add column if not exists tenant_id uuid references public.tenants(id);

create index if not exists idx_oos_oot_investigations_tenant_id
  on public.oos_oot_investigations(tenant_id);

update public.oos_oot_investigations
set tenant_id = (select id from public.tenants where is_internal = true limit 1)
where tenant_id is null;

alter table public.oos_oot_investigations alter column tenant_id set not null;

create table if not exists public.oos_oot_tenant_number_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prefix text not null,
  last_number integer not null default 0,
  primary key (tenant_id, prefix)
);

alter table public.oos_oot_tenant_number_counters enable row level security;

insert into public.oos_oot_tenant_number_counters (tenant_id, prefix, last_number)
select i.tenant_id,
       substring(i.investigation_number from '^[A-Za-z]+'),
       max((substring(i.investigation_number from '[0-9]+$'))::integer)
from public.oos_oot_investigations i
where i.investigation_number ~ '^[A-Za-z]+[0-9]+$'
group by i.tenant_id, substring(i.investigation_number from '^[A-Za-z]+')
on conflict (tenant_id, prefix) do update
set last_number = greatest(public.oos_oot_tenant_number_counters.last_number, excluded.last_number);

create or replace function public.qualisphere_resolve_oos_oot_tenant()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email = '' then raise exception 'Authenticated user email is required to create an OOS/OOT investigation.'; end if;
  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id, 'oos_oot') then
    return new;
  end if;

  select count(distinct tm.tenant_id) into v_membership_count
  from public.tenant_memberships tm
  join public.tenant_module_access tma on tma.tenant_id=tm.tenant_id and lower(tma.module_code)='oos_oot' and tma.is_enabled=true
  join public.tenants t on t.id=tm.tenant_id and t.status='active'
  where lower(trim(tm.user_email))=v_email and tm.membership_status='active';

  if v_membership_count=1 then
    select tm.tenant_id into v_resolved_tenant_id
    from public.tenant_memberships tm
    join public.tenant_module_access tma on tma.tenant_id=tm.tenant_id and lower(tma.module_code)='oos_oot' and tma.is_enabled=true
    join public.tenants t on t.id=tm.tenant_id and t.status='active'
    where lower(trim(tm.user_email))=v_email and tm.membership_status='active'
    group by tm.tenant_id limit 1;
    new.tenant_id := v_resolved_tenant_id;
    return new;
  end if;
  if v_membership_count=0 then raise exception 'No active Company Account with OOS/OOT access could be resolved for this user.'; end if;
  raise exception 'Multiple active Company Accounts were found. Select the Company Account before creating an OOS/OOT investigation.';
end; $$;

create or replace function public.qualisphere_enforce_oos_oot_row_tenant()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'OOS/OOT investigation Company Account cannot be reassigned.'; end if;
  if not public.qualisphere_is_active_tenant_member(new.tenant_id)
     or not public.qualisphere_tenant_module_enabled(new.tenant_id,'oos_oot') then
    raise exception 'Active Company Account membership with OOS/OOT access is required.';
  end if;
  return new;
end; $$;

create or replace function public.generate_oos_oot_number(p_tenant_id uuid,p_prefix text)
returns text language plpgsql security definer set search_path=public as $$
declare v_next integer;
begin
  insert into public.oos_oot_tenant_number_counters(tenant_id,prefix,last_number)
  values(p_tenant_id,upper(p_prefix),0) on conflict(tenant_id,prefix) do nothing;
  update public.oos_oot_tenant_number_counters set last_number=last_number+1
  where tenant_id=p_tenant_id and prefix=upper(p_prefix) returning last_number into v_next;
  return upper(p_prefix)||lpad(v_next::text,7,'0');
end; $$;

create or replace function public.set_oos_oot_number()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_prefix text;
begin
  if new.investigation_number is null then
    if new.tenant_id is null then raise exception 'Company Account must be resolved before OOS/OOT numbering.'; end if;
    if new.event_type='OOS - Out of Specification' then v_prefix:='OOS';
    elsif new.event_type='OOT - Out of Trend' then v_prefix:='OOT';
    elsif new.event_type='Calibration Out of Tolerance' then v_prefix:='CAL';
    else v_prefix:='EM'; end if;
    new.investigation_number:=public.generate_oos_oot_number(new.tenant_id,v_prefix);
  end if;
  return new;
end; $$;

drop trigger if exists trg_00_resolve_oos_oot_tenant on public.oos_oot_investigations;
create trigger trg_00_resolve_oos_oot_tenant before insert on public.oos_oot_investigations for each row execute function public.qualisphere_resolve_oos_oot_tenant();
drop trigger if exists trg_set_oos_oot_number on public.oos_oot_investigations;
create trigger trg_set_oos_oot_number before insert on public.oos_oot_investigations for each row execute function public.set_oos_oot_number();
drop trigger if exists trg_99_enforce_oos_oot_row_tenant on public.oos_oot_investigations;
create trigger trg_99_enforce_oos_oot_row_tenant before insert or update on public.oos_oot_investigations for each row execute function public.qualisphere_enforce_oos_oot_row_tenant();

drop policy if exists "allow insert oos oot investigations" on public.oos_oot_investigations;
drop policy if exists "allow read oos oot investigations" on public.oos_oot_investigations;
drop policy if exists "allow update oos oot investigations" on public.oos_oot_investigations;
drop policy if exists oos_oot_company_boundary on public.oos_oot_investigations;
create policy oos_oot_company_boundary on public.oos_oot_investigations as restrictive for all to authenticated
using(public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'oos_oot'))
with check(public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'oos_oot'));
drop policy if exists oos_oot_authenticated_access on public.oos_oot_investigations;
create policy oos_oot_authenticated_access on public.oos_oot_investigations for all to authenticated using(true) with check(true);

drop policy if exists oos_oot_counter_client_access on public.oos_oot_tenant_number_counters;
revoke all on public.oos_oot_tenant_number_counters from anon,authenticated;
drop policy if exists "allow insert oos oot counters" on public.oos_oot_number_counters;
drop policy if exists "allow read oos oot counters" on public.oos_oot_number_counters;
drop policy if exists "allow update oos oot counters" on public.oos_oot_number_counters;
revoke all on public.oos_oot_number_counters from anon,authenticated;

create unique index if not exists uq_oos_oot_tenant_investigation_number
on public.oos_oot_investigations(tenant_id,investigation_number) where investigation_number is not null;

revoke all on function public.generate_oos_oot_number(uuid,text) from public;
revoke all on function public.generate_oos_oot_number(uuid,text) from anon,authenticated;
revoke all on function public.qualisphere_resolve_oos_oot_tenant() from public;
revoke all on function public.qualisphere_enforce_oos_oot_row_tenant() from public;
