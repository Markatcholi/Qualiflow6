-- QualiSphere CAPA tenant-aware user validation
-- Customer Company Accounts validate CAPA users only against their own active tenant directory.
-- QualiSphere Internal preserves legacy user_roles validation.
-- UUID tenant resolution intentionally avoids aggregate functions such as min(uuid).

create or replace function public.qualisphere_validate_capa_user(p_user_email text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_email text:=lower(btrim(coalesce(p_user_email,'')));
  v_tenant uuid;
  v_is_internal boolean;
  v_count integer;
begin
  if auth.uid() is null or v_email='' then return false; end if;

  select count(distinct tm.tenant_id)
    into v_count
  from public.tenant_memberships tm
  where tm.user_id=auth.uid()
    and tm.is_active=true
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'capa');

  if v_count<>1 then return false; end if;

  select tm.tenant_id
    into v_tenant
  from public.tenant_memberships tm
  where tm.user_id=auth.uid()
    and tm.is_active=true
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'capa')
  group by tm.tenant_id
  limit 1;

  if v_tenant is null then return false; end if;

  select coalesce(t.is_internal,false) into v_is_internal
  from public.tenants t where t.id=v_tenant;

  if v_is_internal then
    return exists(
      select 1 from public.user_roles ur
      where lower(btrim(ur.user_email))=v_email
        and lower(coalesce(ur.account_status,'active'))='active'
    );
  end if;

  return exists(
    select 1
    from public.tenant_user_profiles tup
    where tup.tenant_id=v_tenant
      and lower(btrim(tup.user_email))=v_email
      and lower(coalesce(tup.account_status,''))='active'
      and exists(
        select 1 from public.tenant_memberships tm
        where tm.tenant_id=v_tenant
          and lower(btrim(tm.user_email))=v_email
          and tm.is_active=true
      )
      and exists(
        select 1 from public.tenant_user_role_assignments ura
        where ura.tenant_id=v_tenant
          and lower(btrim(ura.user_email))=v_email
          and ura.is_active=true
      )
  );
end;$$;

revoke all on function public.qualisphere_validate_capa_user(text) from public,anon;
grant execute on function public.qualisphere_validate_capa_user(text) to authenticated;
