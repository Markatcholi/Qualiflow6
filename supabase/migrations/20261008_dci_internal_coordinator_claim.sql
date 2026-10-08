create or replace function public.qualisphere_claim_dci_administrative_review(p_task_id uuid)
returns public.approval_tasks
language plpgsql security definer set search_path=public
as $$
declare
 v_email text := lower(coalesce(auth.jwt()->>'email',''));
 v_task public.approval_tasks;
 v_tenant uuid;
 v_authorized boolean := false;
begin
 if v_email='' then raise exception 'Authentication required'; end if;
 select d.tenant_id into v_tenant from public.approval_tasks t
 join public.document_change_initiations d on d.id=t.entity_id
 where t.id=p_task_id and t.entity_type='document_change_initiation'
 and t.task_type='dci_administrative_review' and t.status='pending';
 if v_tenant is null then raise exception 'Administrative review task not found'; end if;
 select exists(
 select 1 from public.tenant_memberships m
 where m.tenant_id=v_tenant and lower(m.user_email)=v_email and m.membership_status='active'
 and (
 exists(select 1 from public.tenant_user_role_assignments a join public.customer_roles r on r.id=a.role_id
 where a.tenant_id=v_tenant and lower(a.user_email)=v_email and a.is_active=true and r.is_active=true
 and lower(trim(r.role_name))='document control coordinator')
 or exists(select 1 from public.user_security_roles u join public.security_roles s on s.code=u.role_code
 where lower(u.user_email)=v_email and u.role_code='document_control_coordinator' and s.is_active=true)
 )
 ) into v_authorized;
 if not v_authorized then raise exception 'Document Control Coordinator role required'; end if;
 update public.approval_tasks set assigned_to_email=v_email
 where id=p_task_id and status='pending' and assigned_to_email is null
 returning * into v_task;
 if v_task.id is null then raise exception 'This task has already been claimed'; end if;
 perform public.qualisphere_add_audit_log('document_change_initiation',v_task.entity_id,'administrative_review_claimed','Claimed by '||v_email);
 return v_task;
end; $$;
grant execute on function public.qualisphere_claim_dci_administrative_review(uuid) to authenticated;