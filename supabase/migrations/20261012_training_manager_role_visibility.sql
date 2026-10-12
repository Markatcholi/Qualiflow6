-- Training role access: coordinators can administer, managers can view direct reports.
create or replace function public.qualisphere_training_is_coordinator(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
select auth.uid() is not null and p_tenant is not null and (
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
create or replace function public.qualisphere_training_is_direct_manager(p_tenant uuid,p_assignee text)
returns boolean language sql stable security definer set search_path=public,auth as $$
select auth.uid() is not null and p_tenant=public.qualisphere_resolve_training_tenant()
 and exists(select 1 from public.employee_profiles e
 where e.tenant_id=p_tenant and lower(e.user_email)=lower(p_assignee)
 and lower(e.manager_email)=lower(auth.jwt()->>'email'));
$$;
-- Replace broad within-tenant assignment reads with need-to-know access.
drop policy if exists "Authenticated users can view training assignments" on public.training_assignments;
drop policy if exists training_assignments_role_read on public.training_assignments;
create policy training_assignments_role_read on public.training_assignments
for select to authenticated using (
 tenant_id=public.qualisphere_resolve_training_tenant()
 and (public.qualisphere_training_is_coordinator(tenant_id)
 or public.qualisphere_training_is_assignee(assigned_to_email)
 or public.qualisphere_training_is_direct_manager(tenant_id,assigned_to_email)));
-- Remove any additional permissive SELECT policies only after inspecting their names.
