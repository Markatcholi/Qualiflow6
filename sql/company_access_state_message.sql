-- Read-only, self-scoped login diagnosis. Never returns another person's data
-- or grants access to an inactive company.
create or replace function public.qualisphere_company_access_state()
returns text language plpgsql stable security definer set search_path='' as $$
declare email_value text;
begin
 if auth.uid() is null then return null; end if;
 select lower(u.email) into email_value from auth.users u where u.id=auth.uid() and lower(u.email)=lower(auth.jwt()->>'email');
 if email_value is null then return null; end if;
 if exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
   where lower(m.user_email)=email_value and m.membership_status='active' and t.status='active'
   and not exists(select 1 from public.tenant_user_profiles p where p.tenant_id=m.tenant_id and lower(p.user_email)=email_value and p.account_status<>'active')
 ) then return 'active'; end if;
 if exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
   where lower(m.user_email)=email_value and m.membership_status='active' and not t.is_internal and t.status='inactive'
 ) then return 'inactive_company'; end if;
 return 'no_active_company';
end;
$$;
revoke all on function public.qualisphere_company_access_state() from public,anon;
grant execute on function public.qualisphere_company_access_state() to authenticated;
notify pgrst,'reload schema';
