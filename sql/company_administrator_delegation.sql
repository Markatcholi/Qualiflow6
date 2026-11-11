-- Company administrative delegation is independent of QMS and platform roles.
-- Apply to each environment before deploying the related administration UI.
create or replace function public.qualisphere_set_company_administrator(p_tenant_id uuid,p_user_email text,p_is_administrator boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(coalesce(p_user_email,''))); v_role text; v_internal boolean;
begin
 if auth.uid() is null or not public.qualisphere_is_company_admin(p_tenant_id) then raise exception 'Company Administrator access required.'; end if;
 select is_internal into v_internal from public.tenants where id=p_tenant_id and status='active' for update;
 if not found then raise exception 'An active Company Account is required.'; end if;
 -- Recheck after the company lock so concurrent removals cannot remove each other.
 if not public.qualisphere_is_company_admin(p_tenant_id) then raise exception 'Company Administrator access required.'; end if;
 if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=lower(coalesce(auth.jwt()->>'email',''))) then raise exception 'Invalid signed-in identity.'; end if;
 if v_internal and not exists(select 1 from public.user_roles u where lower(u.user_email)=lower(coalesce(auth.jwt()->>'email','')) and u.account_status='active') then raise exception 'Active employee profile required.'; end if;
 if p_is_administrator is null then raise exception 'Select company administrative authority.'; end if;
 select m.membership_role into v_role from public.tenant_memberships m
 where m.tenant_id=p_tenant_id and lower(m.user_email)=v_email and m.membership_status='active' for update;
 if not found then raise exception 'Select an active employee from this Company Account.'; end if;
 if exists(select 1 from public.tenant_user_profiles p where p.tenant_id=p_tenant_id and lower(p.user_email)=v_email and p.account_status<>'active') then
   raise exception 'Activate the employee profile before changing administrative authority.';
 end if;
 if v_internal and not exists(select 1 from public.user_roles u where lower(u.user_email)=v_email and u.account_status='active') then
   raise exception 'Activate the employee profile before changing administrative authority.';
 end if;
 if not p_is_administrator and v_role='company_admin' and not exists(
   select 1 from public.tenant_memberships m where m.tenant_id=p_tenant_id and lower(m.user_email)<>v_email and m.membership_role='company_admin' and m.membership_status='active'
   and (not v_internal or exists(select 1 from public.user_roles u where lower(u.user_email)=lower(m.user_email) and u.account_status='active'))
   and not exists(select 1 from public.tenant_user_profiles p where p.tenant_id=m.tenant_id and lower(p.user_email)=lower(m.user_email) and p.account_status<>'active')
 ) then raise exception 'Keep at least one active Company Administrator. Appoint another administrator first.'; end if;
 update public.tenant_memberships set membership_role=case when p_is_administrator then 'company_admin' else 'member' end,updated_at=now()
 where tenant_id=p_tenant_id and lower(user_email)=v_email and membership_status='active';
end;
$$;
revoke all on function public.qualisphere_set_company_administrator(uuid,text,boolean) from public,anon;
grant execute on function public.qualisphere_set_company_administrator(uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
