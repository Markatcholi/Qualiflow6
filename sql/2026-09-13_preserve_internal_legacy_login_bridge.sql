-- QualiSphere Development / Validation legacy login bridge
-- Preserves QualiSphere 1.0 user_roles as the source of truth while creating
-- only the technical Internal access record required by the tenant-aware shell.

create or replace function public.qualisphere_bridge_internal_legacy_access()
returns table (
  tenant_id uuid,
  company_name text,
  slug text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := public.current_user_email();
  v_tenant_id uuid;
  v_company_name text;
  v_slug text;
  v_rows integer := 0;
begin
  if nullif(trim(coalesce(v_email, '')), '') is null then
    return;
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where lower(ur.user_email) = lower(v_email)
      and lower(trim(coalesce(ur.account_status, 'active'))) = 'active'
  ) then
    return;
  end if;

  select t.id, t.company_name, t.slug
  into v_tenant_id, v_company_name, v_slug
  from public.tenants t
  where coalesce(t.is_internal, false) = true
    and t.status = 'active'
  order by t.created_at
  limit 1;

  if v_tenant_id is null then
    return;
  end if;

  update public.tenant_memberships tm
  set membership_status = 'active',
      joined_at = coalesce(tm.joined_at, now()),
      updated_at = now()
  where tm.tenant_id = v_tenant_id
    and lower(tm.user_email) = lower(v_email);

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.tenant_memberships (
      tenant_id,
      user_email,
      membership_role,
      membership_status,
      invited_by,
      invited_at,
      joined_at
    )
    values (
      v_tenant_id,
      lower(v_email),
      'member',
      'active',
      'qualisphere-legacy-login-bridge',
      now(),
      now()
    );
  end if;

  tenant_id := v_tenant_id;
  company_name := v_company_name;
  slug := v_slug;
  return next;
end;
$$;

grant execute on function public.qualisphere_bridge_internal_legacy_access() to authenticated;
