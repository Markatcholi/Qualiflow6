-- QualiSphere Training: unattended daily recurring cycles and reminders.
-- This migration installs a database-only worker; it never accepts client-supplied tenant IDs.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.qualisphere_training_daily_automation()
returns table(cycles_created integer, notices_created integer)
language plpgsql security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_base date;
  v_due date;
  v_cycles integer := 0;
  v_notices integer := 0;
  v_kind text;
  v_key text;
begin
  -- Never expose the scheduler as a user-callable endpoint.
  if current_user <> 'postgres' and session_user <> 'postgres' then
    raise exception 'Database scheduler only';
  end if;
  for r in
    select a.* from public.training_assignments a
    where a.training_category = 'recurring'
      and a.status = 'completed'
      and a.recurrence_months between 1 and 120
      and not exists (
        select 1 from public.training_assignments child
        where child.recurring_parent_assignment_id = a.id
      )
    order by a.created_at, a.id
    for update of a skip locked
  loop
    if r.recurrence_basis = 'calendar' then
      v_base := coalesce(r.due_date, r.training_completed_on, r.completed_at::date);
    else
      v_base := coalesce(r.training_completed_on, r.completed_at::date);
    end if;
    if v_base is null then continue; end if;
    v_due := (v_base + make_interval(months => r.recurrence_months))::date;
    if v_due > current_date then continue; end if;
    insert into public.training_assignments (
      tenant_id,document_id,assigned_to_email,assigned_by_email,assignment_source,
      role_name,department,training_title,training_description,due_date,status,
      effectiveness_required,effectiveness_status,supervisor_verification_required,
      acknowledgement_required,originating_change_control_id,retraining_assignment,
      source_document_revision,previous_training_assignment_id,training_requirement_id,
      training_group_id,training_method_id,release_blocking,training_category,
      recurrence_months,recurrence_basis,recurring_evidence_mode,
      recurring_next_due_date,recurring_parent_assignment_id
    ) values (
      r.tenant_id,r.document_id,r.assigned_to_email,'training_system','recurring',
      r.role_name,r.department,r.training_title,r.training_description,v_due,'assigned',
      r.effectiveness_required,
      case when r.effectiveness_required then 'effectiveness_pending' else null end,
      r.supervisor_verification_required,r.acknowledgement_required,
      r.originating_change_control_id,true,r.source_document_revision,r.id,
      r.training_requirement_id,r.training_group_id,r.training_method_id,
      r.release_blocking,'recurring',r.recurrence_months,r.recurrence_basis,
      r.recurring_evidence_mode,null,r.id
    )
    on conflict (recurring_parent_assignment_id)
      where recurring_parent_assignment_id is not null do nothing;
    if found then v_cycles := v_cycles + 1; end if;
  end loop;

  for r in
    select a.id,a.assigned_to_email,a.training_title,a.due_date,a.tenant_id
    from public.training_assignments a
    where a.status not in ('completed','waived','effectiveness_complete')
      and a.due_date is not null and a.due_date <= current_date + 7
  loop
    v_kind := case when r.due_date < current_date then 'overdue' else 'due_soon' end;
    v_key := 'training:' || r.id::text || ':' || v_kind || ':' ||
      case when v_kind='overdue'
        then date_trunc('week',current_date::timestamp)::date::text
        else r.due_date::text end;
    insert into public.notifications (
      user_email,title,message,notification_type,severity,related_record_id,
      related_module,related_url,is_read,read_status,created_by,deduplication_key
    ) values (
      lower(r.assigned_to_email),
      case when v_kind='overdue' then 'Training overdue' else 'Training due soon' end,
      coalesce(r.training_title,'Training') || ' is ' ||
        case when v_kind='overdue' then 'overdue.'
             else 'due on ' || r.due_date::text || '.' end,
      'training_' || v_kind,
      case when v_kind='overdue' then 'warning' else 'info' end,
      r.id,'training','/training/' || r.id::text,false,false,'training_system',v_key
    ) on conflict do nothing;
    if found then v_notices := v_notices + 1; end if;
  end loop;
  return query select v_cycles,v_notices;
end;
$$;
revoke all on function public.qualisphere_training_daily_automation() from public, anon, authenticated;
-- Cron runs as the migration owner (postgres). Avoid granting access to API roles.
do $$
begin
  if not exists(select 1 from cron.job where jobname='qualisphere-training-daily') then
    perform cron.schedule(
      'qualisphere-training-daily','15 6 * * *',
      'select * from public.qualisphere_training_daily_automation()'
    );
  end if;
end $$;
