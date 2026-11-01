-- Sandbox-only denial explanation. This does not grant access or change allowed_user.
create or replace function clone_runtime.inactive_company_user()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id')
 and exists(
   select 1 from auth.users u join public.tenant_memberships m on lower(m.user_email)=lower(u.email)
   join public.tenants t on t.id=m.tenant_id
   where u.id=auth.uid() and lower(u.email)=lower(auth.jwt()->>'email')
   and m.membership_status='active' and not t.is_internal and t.status='inactive'
 );
$$;
revoke all on function clone_runtime.inactive_company_user() from public;
grant execute on function clone_runtime.inactive_company_user() to anon,authenticated;
create or replace function clone_runtime.check_request()
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.jwt()->>'role'='service_role' then return; end if;
 if not coalesce(clone_runtime.allowed_user(),false) then
   if clone_runtime.inactive_company_user() then
     raise insufficient_privilege using message='Your company account is inactive. Contact your company administrator.';
   end if;
   raise insufficient_privilege using message='This internal sandbox is restricted to approved test accounts.';
 end if;
end;
$$;
notify pgrst,'reload schema';
