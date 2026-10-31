create or replace function public.qualisphere_import_company_employees(p_tenant_id uuid,p_employees jsonb,p_overwrite boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare rows_json jsonb; item jsonb; total integer;
begin
 if auth.uid() is null or not public.qualisphere_is_company_admin(p_tenant_id) then raise exception 'Company Administrator access required.'; end if;
 perform 1 from public.tenants where id=p_tenant_id and status='active' and not is_internal for update;
 if not found then raise exception 'An active customer Company Account is required.'; end if;
 if jsonb_typeof(p_employees) is distinct from 'array' then raise exception 'Provide an employee array.'; end if;
 total:=jsonb_array_length(p_employees);
 if total not between 1 and 1000 then raise exception 'Provide between 1 and 1000 employee rows.'; end if;
 select jsonb_agg(jsonb_build_object('email',lower(btrim(x->>'email')),'manager',nullif(nullif(lower(btrim(x->>'manager')),'top-level'),''),'name',btrim(x->>'name'),'title',btrim(x->>'title'),'department',btrim(x->>'department'))) into rows_json from jsonb_array_elements(p_employees) x;
 for item in select value from jsonb_array_elements(rows_json) loop
   if coalesce(item->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or coalesce(item->>'name','')='' or coalesce(item->>'title','')='' or coalesce(item->>'department','')=''
     or (item->>'manager' is not null and item->>'manager' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
     or item->>'manager'=item->>'email' then raise exception 'Invalid employee fields.'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(rows_json) x group by x->>'email' having count(*)>1) then raise exception 'Duplicate employee email.'; end if;
 if exists(select 1 from jsonb_array_elements(rows_json) x group by lower(x->>'name') having count(*)>1) then raise exception 'Duplicate employee name.'; end if;
 if not coalesce(p_overwrite,false) and exists(select 1 from jsonb_array_elements(rows_json) x join public.employee_profiles e on e.tenant_id=p_tenant_id and lower(e.user_email)=x->>'email') then raise exception 'Existing profiles found; enable overwrite.'; end if;
 if exists(select 1 from jsonb_array_elements(rows_json) x where x->>'manager' is not null
   and not exists(select 1 from jsonb_array_elements(rows_json) y where y->>'email'=x->>'manager')
   and not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and lower(m.user_email)=x->>'manager' and m.membership_status='active')) then raise exception 'Manager must be in the import or active in this Company Account.'; end if;
 if exists(
   with recursive edges as (
     select x->>'email' email,x->>'manager' manager from jsonb_array_elements(rows_json) x
     union all
     select lower(e.user_email),lower(e.manager_email) from public.employee_profiles e where e.tenant_id=p_tenant_id
     and not exists(select 1 from jsonb_array_elements(rows_json) x where x->>'email'=lower(e.user_email))
   ), paths as (
     select email,manager,array[email] seen,false cycle from edges
     union all
     select e.email,e.manager,p.seen||e.email,e.email=any(p.seen) from paths p join edges e on e.email=p.manager where not p.cycle
   ) select 1 from paths where cycle
 ) then raise exception 'Circular reporting relationships are not allowed.'; end if;
 for item in select value from jsonb_array_elements(rows_json) loop
   insert into public.tenant_memberships(tenant_id,user_email,membership_role,membership_status,invited_by)
   select p_tenant_id,item->>'email','member','invited',public.current_user_email()
   where not exists(select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and lower(m.user_email)=item->>'email');
   insert into public.employee_profiles(tenant_id,user_email,full_name,department,manager_email,active)
   values(p_tenant_id,item->>'email',item->>'name',item->>'department',item->>'manager',false)
   on conflict(tenant_id,user_email) do update set full_name=excluded.full_name,department=excluded.department,manager_email=excluded.manager_email;
   insert into public.tenant_user_profiles(tenant_id,user_email,job_title,department,account_status)
   values(p_tenant_id,item->>'email',item->>'title',item->>'department','inactive')
   on conflict(tenant_id,user_email) do update set job_title=excluded.job_title,department=excluded.department;
 end loop;
 return total;
end;
$$;
revoke all on function public.qualisphere_import_company_employees(uuid,jsonb,boolean) from public,anon;
grant execute on function public.qualisphere_import_company_employees(uuid,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
