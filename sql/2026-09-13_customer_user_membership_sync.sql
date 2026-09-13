-- Customer Company Account user provisioning
-- Keeps tenant user profile status and Company Account membership status aligned.

create or replace function public.qualisphere_set_company_user(
  p_tenant_id uuid,
  p_user_email text,
  p_job_title text default null,
  p_department text default null,
  p_account_status text default 'active'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_user_email, '')));
  v_status text := lower(trim(coalesce(p_account_status, 'active')));
  v_actor text := public.current_user_email();
  v_rows integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'Company Account ID is required.';
  end if;
  if v_email = '' then
    raise exception 'User email is required.';
  end if;
  if v_status not in ('active', 'inactive') then
    raise exception 'Account status must be active or inactive.';
  end if;
  if not public.qualisphere_is_company_admin(p_tenant_id) then
    raise exception 'Company Administrator access required.';
  end if;
  if exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id
      and coalesce(t.is_internal, false) = true
  ) then
    raise exception 'QualiSphere Development / Validation users are administered through the original QualiSphere 1.0 user administration.';
  end if;

  insert into public.tenant_user_profiles (
    tenant_id, user_email, job_title, department, account_status, created_by, updated_by, updated_at
  ) values (
    p_tenant_id,
    v_email,
    nullif(trim(coalesce(p_job_title, '')), ''),
    nullif(trim(coalesce(p_department, '')), ''),
    v_status,
    v_actor,
    v_actor,
    now()
  )
  on conflict (tenant_id, user_email)
  do update set
    job_title = excluded.job_title,
    department = excluded.department,
    account_status = excluded.account_status,
    updated_by = v_actor,
    updated_at = now();

  update public.tenant_memberships
  set membership_status = v_status,
      joined_at = case
        when v_status = 'active' then coalesce(joined_at, now())
        else joined_at
      end,
      updated_at = now()
  where tenant_id = p_tenant_id
    and lower(user_email) = v_email;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.tenant_memberships (
      tenant_id, user_email, membership_role, membership_status, invited_by, invited_at, joined_at
    ) values (
      p_tenant_id,
      v_email,
      'member',
      v_status,
      v_actor,
      now(),
      case when v_status = 'active' then now() else null end
    );
  end if;
end;
$$;

grant execute on function public.qualisphere_set_company_user(uuid, text, text, text, text) to authenticated;
