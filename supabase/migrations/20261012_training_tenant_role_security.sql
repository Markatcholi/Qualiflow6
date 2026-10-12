-- Training tenant authorization and private evidence storage.
-- Preserve the existing restrictive tenant boundary on training_assignments and employee_profiles.
create or replace function public.qualisphere_training_is_coordinator(p_tenant uuid)
returns boolean language sql stable security definer
set search_path = public, auth as $$
 select auth.uid() is not null and p_tenant is not null and
 (
  exists (
   select 1 from public.tenant_memberships m
   join public.tenant_user_role_assignments a on a.tenant_id=m.tenant_id
     and lower(a.user_email)=lower(m.user_email) and a.is_active=true
   join public.customer_roles r on r.id=a.role_id and r.tenant_id=m.tenant_id and r.is_active=true
   where m.tenant_id=p_tenant and lower(m.user_email)=lower(auth.jwt()->>'email')
     and m.membership_status='active'
     and lower(r.role_name) in ('training coordinator','training administrator','administrator','vp quality')
  )
  or (
   exists(select 1 from public.tenants t where t.id=p_tenant and t.is_internal=true)
   and exists(select 1 from public.user_roles ur where lower(ur.user_email)=lower(auth.jwt()->>'email')
     and lower(coalesce(ur.role,'')) in ('admin','training_admin','vp_quality'))
  )
 );
$$;
create or replace function public.qualisphere_training_is_assignee(p_email text)
returns boolean language sql stable security definer
set search_path = public, auth as $$
 select auth.uid() is not null and lower(coalesce(p_email,''))=lower(coalesce(auth.jwt()->>'email',''));
$$;
-- Remove broad permissive mutation policies and replace with role-aware policies.
drop policy if exists "Authenticated users can insert training assignments" on public.training_assignments;
drop policy if exists "Authenticated users can update training assignments" on public.training_assignments;
create policy training_assignments_coordinator_insert on public.training_assignments
 for insert to authenticated with check (
 tenant_id=public.qualisphere_resolve_training_tenant()
 and public.qualisphere_training_is_coordinator(tenant_id));
create policy training_assignments_coordinator_or_assignee_update on public.training_assignments
 for update to authenticated
 using (tenant_id=public.qualisphere_resolve_training_tenant() and
  (public.qualisphere_training_is_coordinator(tenant_id) or public.qualisphere_training_is_assignee(assigned_to_email)))
 with check (tenant_id=public.qualisphere_resolve_training_tenant() and
  (public.qualisphere_training_is_coordinator(tenant_id) or public.qualisphere_training_is_assignee(assigned_to_email)));
-- Employee profiles: only coordinators may create or change employee directory records.
drop policy if exists "Authenticated users can insert employee profiles" on public.employee_profiles;
drop policy if exists "Authenticated users can update employee profiles" on public.employee_profiles;
drop policy if exists "Authenticated users can delete employee profiles" on public.employee_profiles;
create policy employee_profiles_coordinator_insert on public.employee_profiles
 for insert to authenticated with check (
 tenant_id=public.qualisphere_resolve_training_tenant() and public.qualisphere_training_is_coordinator(tenant_id));
create policy employee_profiles_coordinator_update on public.employee_profiles
 for update to authenticated using (
 tenant_id=public.qualisphere_resolve_training_tenant() and public.qualisphere_training_is_coordinator(tenant_id))
 with check (tenant_id=public.qualisphere_resolve_training_tenant() and public.qualisphere_training_is_coordinator(tenant_id));
create policy employee_profiles_coordinator_delete on public.employee_profiles
 for delete to authenticated using (
 tenant_id=public.qualisphere_resolve_training_tenant() and public.qualisphere_training_is_coordinator(tenant_id));
insert into storage.buckets(id,name,public,file_size_limit)
 values ('training-completion-evidence','training-completion-evidence',false,10485760)
 on conflict (id) do update set public=false;
create or replace function public.qualisphere_can_access_training_evidence(p_path text, p_write boolean default false)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select auth.uid() is not null and
 split_part(p_path,'/',1)=public.qualisphere_resolve_training_tenant()::text
 and (
 public.qualisphere_training_is_coordinator(public.qualisphere_resolve_training_tenant())
 or (not p_write and exists(
 select 1 from public.training_assignments a
 where a.tenant_id=public.qualisphere_resolve_training_tenant()
 and a.id::text=split_part(p_path,'/',2)
 and public.qualisphere_training_is_assignee(a.assigned_to_email)))
 );
$$;
create policy training_completion_evidence_read on storage.objects
 for select to authenticated using (
 bucket_id='training-completion-evidence' and public.qualisphere_can_access_training_evidence(name,false));
create policy training_completion_evidence_upload on storage.objects
 for insert to authenticated with check (
 bucket_id='training-completion-evidence' and public.qualisphere_can_access_training_evidence(name,true));
-- No update/delete storage policies; evidence files remain immutable.
