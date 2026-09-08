-- ============================================================
-- QualiSphere — Management Review Report Approval Package
-- Adds required approver due-date storage and a governed approval/rejection RPC.
-- ============================================================

alter table public.management_review_approvers
  add column if not exists approver_due_date date;

create or replace function public.qualisphere_decide_management_review_approval(
  p_task_id uuid,
  p_decision text,
  p_comment text default null,
  p_signature_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_task public.approval_tasks%rowtype;
  v_approver public.management_review_approvers%rowtype;
  v_now timestamptz := now();
  v_all_approved boolean := false;
  v_decision text;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_decision := lower(trim(coalesce(p_decision, '')));

  if v_email = '' then
    raise exception 'An authenticated user is required.';
  end if;

  if lower(trim(coalesce(p_signature_email, ''))) <> v_email then
    raise exception 'Electronic signature email does not match the authenticated user.';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  if v_decision = 'rejected' and trim(coalesce(p_comment, '')) = '' then
    raise exception 'A rejection comment is required.';
  end if;

  select *
    into v_task
  from public.approval_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'Approval task was not found.';
  end if;

  if lower(coalesce(v_task.entity_type, '')) <> 'management_review'
     or lower(coalesce(v_task.task_type, '')) <> 'management_review_approval' then
    raise exception 'This is not a Management Review approval task.';
  end if;

  if lower(coalesce(v_task.assigned_to_email, '')) <> v_email then
    raise exception 'Only the assigned approver may complete this task.';
  end if;

  if lower(coalesce(v_task.status, '')) <> 'pending' then
    raise exception 'This approval task is no longer pending.';
  end if;

  select *
    into v_approver
  from public.management_review_approvers
  where management_review_id = v_task.entity_id
    and lower(coalesce(approver_email, '')) = v_email
    and lower(coalesce(approval_status, 'pending')) = 'pending'
  limit 1
  for update;

  if not found then
    raise exception 'No pending configured Management Review approver record matches this authenticated user.';
  end if;

  if v_decision = 'approved' then
    update public.management_review_approvers
    set
      approval_status = 'approved',
      signed_by = v_email,
      signed_at = v_now,
      signature_meaning = coalesce(
        nullif(v_approver.signature_meaning, ''),
        'I approve this Management Review report.'
      )
    where id = v_approver.id;

    update public.approval_tasks
    set
      status = 'approved',
      approver_comment = nullif(trim(coalesce(p_comment, '')), ''),
      signature_meaning = coalesce(
        nullif(v_approver.signature_meaning, ''),
        'I approve this Management Review report.'
      ),
      completed_by = v_email,
      completed_at = v_now,
      signed_by = v_email,
      signed_at = v_now
    where id = v_task.id;

    select not exists (
      select 1
      from public.management_review_approvers mra
      where mra.management_review_id = v_task.entity_id
        and lower(coalesce(mra.approval_status, 'pending')) <> 'approved'
    )
    into v_all_approved;

    if v_all_approved then
      update public.management_reviews
      set
        approval_status = 'approved',
        status = 'approved',
        is_locked = true,
        locked_at = v_now,
        locked_by = v_email,
        fully_approved_at = v_now
      where id = v_task.entity_id;

      perform public.qualisphere_add_audit_log(
        'management_review',
        v_task.entity_id,
        'management_review_fully_approved_locked',
        'All required approvers approved the submitted read-only Management Review report snapshot. Record locked.'
      );
    else
      update public.management_reviews
      set
        approval_status = 'pending_approval',
        status = 'pending_approval'
      where id = v_task.entity_id;
    end if;

    perform public.qualisphere_add_audit_log(
      'management_review',
      v_task.entity_id,
      'management_review_report_approved',
      format('Management Review report approval task %s approved by %s.', v_task.id, v_email)
    );

    return jsonb_build_object(
      'decision', 'approved',
      'all_approved', v_all_approved,
      'management_review_id', v_task.entity_id,
      'task_id', v_task.id
    );
  end if;

  update public.management_review_approvers
  set
    approval_status = 'rejected',
    signed_by = v_email,
    signed_at = v_now,
    signature_meaning = 'I reject this Management Review report and require revision.'
  where id = v_approver.id;

  update public.approval_tasks
  set
    status = 'rejected',
    approver_comment = trim(p_comment),
    signature_meaning = 'I reject this Management Review report and require revision.',
    completed_by = v_email,
    completed_at = v_now,
    signed_by = v_email,
    signed_at = v_now
  where id = v_task.id;

  update public.approval_tasks
  set status = 'cancelled'
  where entity_type = 'management_review'
    and entity_id = v_task.entity_id
    and task_type = 'management_review_approval'
    and status = 'pending'
    and id <> v_task.id;

  update public.management_reviews
  set
    approval_status = 'rejected',
    status = 'rejected'
  where id = v_task.entity_id;

  perform public.qualisphere_add_audit_log(
    'management_review',
    v_task.entity_id,
    'management_review_report_rejected',
    format('Management Review report rejected by %s. Reason: %s', v_email, trim(p_comment))
  );

  return jsonb_build_object(
    'decision', 'rejected',
    'all_approved', false,
    'management_review_id', v_task.entity_id,
    'task_id', v_task.id
  );
end;
$$;

revoke all on function public.qualisphere_decide_management_review_approval(uuid, text, text, text) from public;
revoke all on function public.qualisphere_decide_management_review_approval(uuid, text, text, text) from anon;
grant execute on function public.qualisphere_decide_management_review_approval(uuid, text, text, text) to authenticated;
grant execute on function public.qualisphere_decide_management_review_approval(uuid, text, text, text) to service_role;
