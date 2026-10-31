-- Company status is controlled by QualiSphere; employee authorization is retained.
create or replace function public.qualisphere_set_company_status(p_tenant_id uuid,p_status text,p_expected_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare company public.tenants%rowtype; next_status text:=lower(btrim(coalesce(p_status,'')));
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform Administrator access required.'; end if;
 if next_status not in ('active','inactive') then raise exception 'Company status must be active or inactive.'; end if;
 select * into company from public.tenants where id=p_tenant_id for update;
 if not found then raise exception 'Company Account not found.'; end if;
 if company.is_internal then raise exception 'The Internal environment status cannot be changed here.'; end if;
 if p_expected_status is null or company.status<>p_expected_status then raise exception 'Company status changed. Refresh the Company Account and try again.'; end if;
 if company.status<>next_status then
   update public.tenants set status=next_status,updated_at=now() where id=p_tenant_id;
   insert into public.audit_logs(tenant_id,entity_type,entity_id,action,details,user_email)
   values(p_tenant_id,'company_account',p_tenant_id,'company_status_changed',
     jsonb_build_object('previous_status',company.status,'status',next_status)::text,public.current_user_email());
 end if;
 return jsonb_build_object('tenantId',p_tenant_id,'status',next_status);
end;
$$;
revoke all on function public.qualisphere_set_company_status(uuid,text,text) from public,anon;
grant execute on function public.qualisphere_set_company_status(uuid,text,text) to authenticated;

-- Existing tenant UPDATE policies allow customer administrators to edit their
-- profile. Prevent using that permission to change the platform-controlled status.
create or replace function public.qualisphere_guard_company_status_update()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status is distinct from old.status and current_user not in ('postgres','supabase_admin','service_role') and not public.is_platform_admin() then
   raise exception 'Only QualiSphere Platform Administration may change company status.';
 end if;
 return new;
end;
$$;
revoke all on function public.qualisphere_guard_company_status_update() from public,anon,authenticated;
drop trigger if exists qualisphere_guard_company_status on public.tenants;
create trigger qualisphere_guard_company_status before update of status on public.tenants for each row execute function public.qualisphere_guard_company_status_update();

create or replace function public.qualisphere_is_active_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and lower(btrim(m.user_email))=lower(btrim(coalesce(auth.jwt()->>'email','')))
 and m.membership_status='active' and t.status='active');
$$;
create or replace function public.qualisphere_is_company_admin(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tenant_memberships m join public.tenants t on t.id=m.tenant_id
 where m.tenant_id=p_tenant_id and lower(btrim(m.user_email))=lower(btrim(coalesce(auth.jwt()->>'email','')))
 and m.membership_status='active' and m.membership_role='company_admin' and t.status='active');
$$;
create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.qualisphere_is_company_admin(p_tenant_id);
$$;
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.qualisphere_is_active_tenant_member(p_tenant_id);
$$;
create or replace function public.qualisphere_training_is_coordinator(p_tenant uuid)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and p_tenant is not null
and exists(select 1 from public.tenants where id=p_tenant and status='active') and (
 exists(select 1 from public.tenant_memberships m
 join public.tenant_user_role_assignments a on a.tenant_id=m.tenant_id and lower(a.user_email)=lower(m.user_email) and a.is_active=true
 join public.customer_roles r on r.id=a.role_id and r.tenant_id=m.tenant_id and r.is_active=true
 where m.tenant_id=p_tenant and lower(m.user_email)=lower(auth.jwt()->>'email') and m.membership_status='active'
 and lower(r.role_name) in ('training coordinator','training administrator','document control coordinator','administrator','vp quality'))
 or (exists(select 1 from public.tenants t where t.id=p_tenant and t.is_internal=true)
 and exists(select 1 from public.user_roles ur where lower(ur.user_email)=lower(auth.jwt()->>'email')
 and lower(coalesce(ur.role,'')) in ('admin','training_admin','vp_quality')))
);
$$;
notify pgrst,'reload schema';
