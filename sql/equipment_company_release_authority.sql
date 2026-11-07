create or replace function public.get_equipment_company_authority(p_tenant_id uuid,p_user_email text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_email text:=lower(trim(p_user_email)); v_internal boolean; v_admin boolean:=false; v_coord boolean:=false; v_approve boolean:=false;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and lower(email)=lower(auth.jwt()->>'email')) then raise exception 'Authentication required.'; end if;
 select is_internal into v_internal from tenants where id=p_tenant_id and status='active';
 if not found or not exists(select 1 from tenant_memberships where tenant_id=p_tenant_id and lower(user_email)=lower(auth.jwt()->>'email') and membership_status='active') then raise exception 'Active company membership required.'; end if;
 if not exists(select 1 from tenant_memberships where tenant_id=p_tenant_id and lower(user_email)=v_email and membership_status='active') then return jsonb_build_object('is_admin',false,'is_equipment_coordinator',false,'is_equipment_approver',false); end if;
 if v_internal then return public.get_qualisphere_enterprise_authority(v_email); end if;
 if not exists(select 1 from tenant_user_profiles where tenant_id=p_tenant_id and lower(user_email)=v_email and account_status='active') then return jsonb_build_object('is_admin',false,'is_equipment_coordinator',false,'is_equipment_approver',false); end if;
 select coalesce(bool_or(lower(r.role_name)='equipment administrator'),false),
 coalesce(bool_or(lower(r.role_name) in ('equipment coordinator','equipment administrator')),false),
 coalesce(bool_or(lower(r.role_name) in ('equipment approver','equipment administrator')),false)
 into v_admin,v_coord,v_approve
 from tenant_user_role_assignments a join customer_roles r on r.id=a.role_id and r.tenant_id=a.tenant_id
 where a.tenant_id=p_tenant_id and lower(a.user_email)=v_email and a.is_active and r.is_active;
 return jsonb_build_object('account_active',true,'is_admin',v_admin,'is_equipment_coordinator',v_coord,'is_equipment_approver',v_approve,'is_quality_approver',false);
end $$;
revoke all on function public.get_equipment_company_authority(uuid,text) from public,anon;
grant execute on function public.get_equipment_company_authority(uuid,text) to authenticated;
CREATE OR REPLACE FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text)
 RETURNS equipment_release_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_approver_email text := lower(trim(coalesce(p_approver_email,'')));
  v_equipment public.equipment;
  v_submitter_authority jsonb;
  v_approver_authority jsonb;
  v_can_submit boolean := false;
  v_request public.equipment_release_requests;
  v_task_id uuid;
begin
  if v_user_email='' then
    raise exception 'You must be signed in to submit Equipment Record Release.';
  end if;

  if v_approver_email='' then
    raise exception 'Equipment Approver is required.';
  end if;

  select * into v_equipment
  from public.equipment
  where id=p_equipment_id for update;

  if not found then
    raise exception 'Equipment record not found.';
  end if;

  v_submitter_authority := public.get_equipment_company_authority(v_equipment.tenant_id,v_user_email);

  -- Preserve current behavior: owner and creator remain allowed. Central Equipment
  -- Coordinator / Equipment Administrator authority is added as the enterprise path.
  v_can_submit :=
       lower(coalesce(v_equipment.owner_email,''))=v_user_email
    or lower(coalesce(v_equipment.created_by,''))=v_user_email
    or coalesce((v_submitter_authority->>'is_equipment_coordinator')::boolean,false)
    or exists (
      select 1
      from public.equipment_governance_members gm
      where gm.tenant_id=v_equipment.tenant_id
        and lower(gm.user_email)=v_user_email
        and gm.is_active=true
        and gm.role='coordinator'
    );

  if not v_can_submit then
    raise exception 'Only the Equipment Owner, record creator, Equipment Coordinator, or Equipment Administrator may submit this Equipment record for release.';
  end if;

  v_approver_authority := public.get_equipment_company_authority(v_equipment.tenant_id,v_approver_email);

  if not coalesce((v_approver_authority->>'is_equipment_approver')::boolean,false) then
    raise exception 'The selected user is not an authorized Equipment Approver or Administrator in User Administration.';
  end if;

  if v_equipment.record_status <> 'draft' then raise exception 'Only draft equipment can be submitted.'; end if;
  if v_approver_email=v_user_email or v_approver_email=lower(coalesce(v_equipment.owner_email,'')) then raise exception 'The Equipment Owner or submitter cannot approve their own record.'; end if;
  if exists (
    select 1
    from public.equipment_release_requests r
    where r.equipment_id=p_equipment_id
      and r.status='pending'
  ) then
    raise exception 'A pending Equipment Record Release request already exists for this equipment.';
  end if;

  insert into public.equipment_release_requests
    (tenant_id,equipment_id,submitted_by,approver_email,status)
  values
    (v_equipment.tenant_id,p_equipment_id,v_user_email,v_approver_email,'pending')
  returning * into v_request;

  update public.equipment
  set
    record_status='pending_release',
    equipment_status='pending_production_release',
    use_status='restricted',
    use_status_reason='Equipment is not authorized for operational use while Equipment Record Release is pending.'
  where id=p_equipment_id;

  -- Create one central My Workspace approval task for this release request.
  insert into public.approval_tasks (
    entity_type,
    entity_id,
    task_type,
    required_function,
    task_title,
    task_instructions,
    assigned_to_email,
    assigned_by_email,
    status,
    required,
    comments
  )
  values (
    'equipment',
    p_equipment_id,
    'equipment_record_release',
    'Equipment Approver',
    'Equipment Record Release: ' || coalesce(v_equipment.equipment_number,'Equipment'),
    'Review Equipment Master readiness and approve or reject the controlled Equipment Record Release.',
    v_approver_email,
    v_user_email,
    'pending',
    true,
    'Controlled Equipment Record Release approval.'
  )
  returning id into v_task_id;

  insert into public.notification_queue (
    recipient_email,
    subject,
    body,
    entity_type,
    entity_id,
    task_id,
    status
  )
  values (
    v_approver_email,
    'Equipment Record Release assigned: ' || coalesce(v_equipment.equipment_number,'Equipment'),
    'You have been assigned an Equipment Record Release approval. Please open My Workspace.',
    'equipment',
    p_equipment_id,
    v_task_id,
    'pending'
  );

  return v_request;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_equipment_record_release(p_release_request_id uuid, p_decision text, p_comment text DEFAULT NULL::text)
 RETURNS equipment_release_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_decision text := lower(trim(coalesce(p_decision,'')));
  v_request public.equipment_release_requests;
  v_authority jsonb;
  v_is_admin boolean := false;
  v_is_equipment_approver boolean := false;
  v_now timestamptz := now();
begin
  if v_user_email='' then
    raise exception 'You must be signed in to process Equipment Record Release.';
  end if;

  if v_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if v_decision='rejected' and trim(coalesce(p_comment,''))='' then
    raise exception 'A comment is required when rejecting an Equipment Record Release.';
  end if;

  select * into v_request
  from public.equipment_release_requests
  where id=p_release_request_id for update;

  if not found then
    raise exception 'Equipment Record Release request not found.';
  end if;

  if v_request.status<>'pending' then
    raise exception 'This Equipment Record Release request is no longer pending.';
  end if;

  v_authority:=public.get_equipment_company_authority(v_request.tenant_id,v_user_email);
  v_is_admin:=coalesce((v_authority->>'is_admin')::boolean,false);
  v_is_equipment_approver:=coalesce((v_authority->>'is_equipment_approver')::boolean,false);

  if not v_is_equipment_approver then
    raise exception 'Only an authorized Equipment Approver or Administrator may process Equipment Record Release.';
  end if;

  if lower(coalesce(v_request.approver_email,''))<>v_user_email then
    raise exception 'This Equipment Record Release request is assigned to another Equipment Approver.';
  end if;

  if lower(v_request.submitted_by)=v_user_email or exists(select 1 from equipment where id=v_request.equipment_id and lower(owner_email)=v_user_email) then raise exception 'Self approval is not permitted.'; end if;
  update public.equipment_release_requests
  set
    status=v_decision,
    decision_by=v_user_email,
    decision_at=v_now,
    decision_comment=nullif(trim(coalesce(p_comment,'')),'')
  where id=p_release_request_id
  returning * into v_request;

  if v_decision='approved' then
    update public.equipment
    set
      record_status='released',
      lifecycle_phase='operation_maintenance',
      equipment_status='active',
      lifecycle_status='released',
      use_status='available_for_use',
      use_status_reason='Equipment Master released through controlled Equipment Record Release.',
      released_by=v_user_email,
      released_at=v_now
    where id=v_request.equipment_id;
  else
    update public.equipment
    set
      record_status='draft',
      equipment_status='pending_production_release',
      use_status='restricted',
      use_status_reason=nullif(trim(coalesce(p_comment,'')),'')
    where id=v_request.equipment_id;
  end if;

  -- Close the corresponding central task so it no longer appears as pending.
  update public.approval_tasks
  set
    status=v_decision,
    comments=case
      when nullif(trim(coalesce(p_comment,'')),'') is not null
        then trim(p_comment)
      else comments
    end
  where entity_type='equipment'
    and entity_id=v_request.equipment_id
    and task_type='equipment_record_release'
    and lower(coalesce(assigned_to_email,''))=lower(coalesce(v_request.approver_email,''))
    and status='pending';



  return v_request;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_equipment_record_for_release(p_equipment_id uuid, p_approver_email text, p_approver_department text, p_approver_job_title text, p_approve_by_date date)
 RETURNS equipment_release_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_request public.equipment_release_requests;
  v_today date;
begin
  if trim(coalesce(p_approver_department,''))='' then
    raise exception 'Approving Department is required.';
  end if;

  if trim(coalesce(p_approver_job_title,''))='' then
    raise exception 'Approving Job Title is required.';
  end if;

  if p_approve_by_date is null then
    raise exception 'Approve By Date is required.';
  end if;

  select (now() at time zone coalesce(nullif(t.default_timezone,''),'UTC'))::date into v_today from equipment e join tenants t on t.id=e.tenant_id where e.id=p_equipment_id;
  if p_approve_by_date < v_today then
    raise exception 'Approve By Date cannot be earlier than today.';
  end if;

  -- Reuse the already-deployed controlled release function. This preserves
  -- authorization, readiness workflow, Equipment status changes, My Workspace
  -- task creation, and notification behavior.
  select *
  into v_request
  from public.submit_equipment_record_for_release(
    p_equipment_id,
    p_approver_email
  );

  update public.equipment_release_requests
  set
    approver_department = trim(p_approver_department),
    approver_job_title = trim(p_approver_job_title),
    approve_by_date = p_approve_by_date
  where id = v_request.id
  returning * into v_request;

  -- The existing release submission creates the My Workspace task.
  -- Carry the owner-selected Approve By Date into that task as its due date.
  update public.approval_tasks
  set
    due_date = p_approve_by_date,
    required_function = trim(p_approver_department) || ' / ' || trim(p_approver_job_title)
  where entity_type = 'equipment'
    and entity_id = p_equipment_id
    and task_type = 'equipment_record_release'
    and lower(assigned_to_email) = lower(trim(p_approver_email))
    and status = 'pending';

  return v_request;
end;
$function$;

create or replace function public.list_equipment_company_approvers(p_tenant_id uuid)
returns table(user_email text,access_label text) language sql stable security definer set search_path=public as $$
 select lower(m.user_email),'Equipment Approver'::text from tenant_memberships m
 where m.tenant_id=p_tenant_id and m.membership_status='active'
 and (public.get_equipment_company_authority(p_tenant_id,m.user_email)->>'is_equipment_approver')::boolean
 order by 1;
$$;
revoke all on function public.list_equipment_company_approvers(uuid) from public,anon;
grant execute on function public.list_equipment_company_approvers(uuid) to authenticated;