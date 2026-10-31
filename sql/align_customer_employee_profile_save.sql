-- Atomic customer employee profile and company access save.
-- Uses the existing authorized company-user operation; never writes legacy user_roles.
create or replace function public.qualisphere_save_company_employee(
 p_tenant_id uuid, p_user_email text, p_full_name text,
 p_job_title text, p_department text, p_manager_email text, p_account_status text
) returns void language plpgsql security definer set search_path = '' as $$
declare
 v_email text := lower(btrim(coalesce(p_user_email,'')));
 v_manager text := nullif(lower(btrim(coalesce(p_manager_email,''))),'');
begin
 if auth.uid() is null or not public.qualisphere_is_company_admin(p_tenant_id) then
   raise exception 'Company Administrator access required.';
 end if;
 -- Serialize reporting hierarchy changes within this company.
 perform 1 from public.tenants where id=p_tenant_id and status='active' and not is_internal for update;
 if not found then raise exception 'An active customer Company Account is required.'; end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid user email address.'; end if;
 if v_manager is not null then
   if v_manager=v_email then raise exception 'An employee cannot be their own manager.'; end if;
   if not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and lower(m.user_email)=v_manager and m.membership_status='active') then
     raise exception 'Select an active manager from this Company Account.';
   end if;
   if exists(
     with recursive chain as (
       select lower(e.user_email) email,lower(e.manager_email) manager,array[lower(e.user_email)] seen,false cycle
       from public.employee_profiles e where e.tenant_id=p_tenant_id and lower(e.user_email)=v_manager
       union all
       select lower(e.user_email),lower(e.manager_email),c.seen||lower(e.user_email),lower(e.user_email)=any(c.seen)
       from chain c join public.employee_profiles e on e.tenant_id=p_tenant_id and lower(e.user_email)=c.manager
       where not c.cycle
     ) select 1 from chain where email=v_email or manager=v_email or cycle
   ) then raise exception 'Circular reporting relationships are not allowed.'; end if;
 end if;
 perform public.qualisphere_set_company_user(p_tenant_id,v_email,p_job_title,p_department,p_account_status);
 insert into public.employee_profiles(tenant_id,user_email,full_name,department,manager_email,active)
 values(p_tenant_id,v_email,nullif(btrim(p_full_name),''),nullif(btrim(p_department),''),v_manager,lower(btrim(p_account_status))='active')
 on conflict(tenant_id,user_email) do update set full_name=excluded.full_name,department=excluded.department,manager_email=excluded.manager_email,active=excluded.active;
end;
$$;
revoke all on function public.qualisphere_save_company_employee(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.qualisphere_save_company_employee(uuid,text,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
