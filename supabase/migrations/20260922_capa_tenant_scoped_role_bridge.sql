-- Normal resolver used by CAPA UI/RPC role checks. The similarly named
-- qualisphere_resolve_capa_tenant() remains the INSERT trigger.
create or replace function public.qualisphere_current_capa_tenant()
returns uuid
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_tenant uuid;
  v_count integer;
begin
  if v_email = '' then return null; end if;
  select count(distinct tm.tenant_id), min(tm.tenant_id::text)::uuid into v_count, v_tenant
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id and t.status='active'
  where lower(trim(tm.user_email))=v_email and tm.membership_status='active'
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'capa');
  if v_count=1 then return v_tenant; end if;
  if v_count=0 and exists (
    select 1 from public.user_roles ur
    where lower(trim(ur.user_email))=v_email
      and lower(coalesce(ur.account_status,'active')) <> 'inactive'
  ) then
    select t.id into v_tenant from public.tenants t
    where t.is_internal=true and t.status='active'
      and public.qualisphere_tenant_module_enabled(t.id,'capa')
    limit 1;
    return v_tenant;
  end if;
  return null;
end;
$$;

-- CAPA tenant-scoped role bridge
-- Customer Company Accounts use tenant_user_role_assignments/customer_roles.
-- QualiSphere Internal / Development preserves the original QualiSphere 1.0 role model.

create or replace function public.qualisphere_current_capa_role_codes()
returns table(role_code text)
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_email text := lower(trim(coalesce(public.current_user_email(), '')));
  v_is_internal boolean := false;
begin
  v_tenant_id := public.qualisphere_current_capa_tenant();
  if v_tenant_id is null or v_email = '' then return; end if;
  select coalesce(t.is_internal, false) into v_is_internal from public.tenants t where t.id = v_tenant_id;

  if v_is_internal then
    return query
    select distinct x.role_code
    from (
      select lower(trim(usr.role_code)) as role_code from public.user_security_roles usr where lower(trim(usr.user_email)) = v_email
      union all
      select case lower(trim(ur.role))
        when 'admin' then 'administrator' when 'administrator' then 'administrator'
        when 'coordinator' then 'capa_coordinator' when 'approver' then 'approver'
        when 'vp_quality' then 'vp_quality' else lower(trim(ur.role)) end
      from public.user_roles ur
      where lower(trim(ur.user_email)) = v_email and lower(coalesce(ur.account_status, 'active')) <> 'inactive'
    ) x where coalesce(x.role_code, '') <> '';
    return;
  end if;

  if not exists (
    select 1 from public.tenant_memberships tm
    left join public.tenant_user_profiles tup on tup.tenant_id = tm.tenant_id and lower(trim(tup.user_email)) = lower(trim(tm.user_email))
    where tm.tenant_id = v_tenant_id and lower(trim(tm.user_email)) = v_email
      and lower(coalesce(tm.membership_status, 'active')) = 'active'
      and lower(coalesce(tup.account_status, 'active')) <> 'inactive'
  ) then return; end if;

  return query
  select distinct mapped.role_code
  from public.tenant_user_role_assignments tura
  join public.customer_roles cr on cr.id = tura.role_id and cr.tenant_id = tura.tenant_id
  cross join lateral (
    select unnest(case lower(trim(cr.role_name))
      when 'administrator' then array['administrator','capa_administrator','capa_coordinator','capa_user']::text[]
      when 'capa administrator' then array['capa_administrator','capa_coordinator','capa_user']::text[]
      when 'capa coordinator' then array['capa_coordinator','capa_user']::text[]
      when 'capa user' then array['capa_user']::text[]
      when 'capa approver' then array['capa_approver','approver']::text[]
      when 'approver' then array['approver']::text[]
      when 'vp quality' then array['vp_quality','capa_approver','approver']::text[]
      else array[]::text[] end) as role_code
  ) mapped
  where tura.tenant_id = v_tenant_id and lower(trim(tura.user_email)) = v_email
    and coalesce(tura.is_active, true) and coalesce(cr.is_active, true);
end;
$$;

create or replace function public.qualisphere_capa_authorized_users(p_purpose text default 'owner')
returns table(user_email text)
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_tenant_id uuid;
  v_caller text := lower(trim(coalesce(public.current_user_email(), '')));
  v_is_internal boolean := false;
  v_purpose text := lower(trim(coalesce(p_purpose, 'owner')));
begin
  v_tenant_id := public.qualisphere_current_capa_tenant();
  if v_tenant_id is null or v_caller = '' then return; end if;
  select coalesce(t.is_internal, false) into v_is_internal from public.tenants t where t.id = v_tenant_id;

  if v_is_internal then
    return query
    with legacy_access as (
      select lower(trim(usr.user_email)) as email from public.user_security_roles usr
      where lower(trim(usr.role_code)) in ('capa_user','capa_coordinator','capa_administrator','approver','administrator','vp_quality')
      union
      select lower(trim(ur.user_email)) from public.user_roles ur
      where lower(coalesce(ur.account_status, 'active')) <> 'inactive'
        and lower(trim(ur.role)) in ('admin','administrator','approver','vp_quality')
    )
    select distinct la.email from legacy_access la where la.email <> '' order by 1;
    return;
  end if;

  if not exists (
    select 1 from public.tenant_memberships tm where tm.tenant_id = v_tenant_id
      and lower(trim(tm.user_email)) = v_caller and lower(coalesce(tm.membership_status, 'active')) = 'active'
  ) then return; end if;

  return query
  select distinct lower(trim(tura.user_email)) as user_email
  from public.tenant_user_role_assignments tura
  join public.customer_roles cr on cr.id = tura.role_id and cr.tenant_id = tura.tenant_id
  join public.tenant_memberships tm on tm.tenant_id = tura.tenant_id and lower(trim(tm.user_email)) = lower(trim(tura.user_email))
  left join public.tenant_user_profiles tup on tup.tenant_id = tura.tenant_id and lower(trim(tup.user_email)) = lower(trim(tura.user_email))
  where tura.tenant_id = v_tenant_id and coalesce(tura.is_active, true) and coalesce(cr.is_active, true)
    and lower(coalesce(tm.membership_status, 'active')) = 'active'
    and lower(coalesce(tup.account_status, 'active')) <> 'inactive'
    and (case when v_purpose = 'approver'
      then lower(trim(cr.role_name)) in ('capa user','capa coordinator','capa administrator','capa approver','approver','administrator','vp quality')
      else lower(trim(cr.role_name)) in ('capa user','capa coordinator','capa administrator','administrator','vp quality') end)
  order by 1;
end;
$$;

revoke all on function public.qualisphere_current_capa_role_codes() from public;
grant execute on function public.qualisphere_current_capa_role_codes() to authenticated;
revoke all on function public.qualisphere_capa_authorized_users(text) from public;
grant execute on function public.qualisphere_capa_authorized_users(text) to authenticated;

revoke all on function public.qualisphere_current_capa_tenant() from public;
grant execute on function public.qualisphere_current_capa_tenant() to authenticated;
