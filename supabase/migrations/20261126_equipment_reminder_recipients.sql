alter table public.equipment_schedule_notifications
  drop constraint if exists equipment_schedule_notifications_days_before_due_check;
alter table public.equipment_schedule_notifications
  add constraint equipment_schedule_notifications_days_before_due_check
  check (days_before_due between -365 and 365);

alter table public.notifications
  add column if not exists workspace_visible boolean not null default true;

create policy equipment_email_only_hidden_from_workspace on public.notifications
  as restrictive for select to authenticated using (workspace_visible);

create function public.qualisphere_save_equipment_schedule(
  p_schedule_id uuid, p_schedule jsonb, p_rules jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_input public.equipment_schedule_configurations;
  v_schedule_id uuid;
  v_equipment public.equipment;
  v_email text := lower(trim(auth.jwt()->>'email'));
begin
  if auth.uid() is null or coalesce(v_email, '') = '' then
    raise exception 'Authentication required';
  end if;
  v_input := jsonb_populate_record(null::public.equipment_schedule_configurations, p_schedule);
  v_input.created_by := v_email;

  select e.* into v_equipment from public.equipment e
  where e.id = v_input.equipment_id and e.tenant_id = v_input.tenant_id
  for update;
  if not found or v_equipment.record_status = 'pending_release' or exists (
    select 1 from public.equipment_release_requests r
    where r.equipment_id = v_equipment.id and r.status = 'pending'
  ) then
    raise exception 'Equipment is unavailable for schedule configuration';
  end if;

  if not (
    coalesce(v_equipment.record_status = 'draft' and lower(trim(v_equipment.owner_email)) = v_email, false)
    or exists (
      select 1 from public.equipment_governance_members g
      where g.tenant_id = v_input.tenant_id and lower(g.user_email) = v_email
        and g.is_active and g.role = 'coordinator'
    )
    or coalesce((public.get_equipment_company_authority(v_input.tenant_id, v_email)->>'is_equipment_coordinator')::boolean, false)
  ) then
    raise exception 'Equipment schedule configuration requires coordinator access';
  end if;

  if v_input.activity_type is null or v_input.activity_type not in ('calibration', 'preventive_maintenance') then
    raise exception 'Invalid Equipment schedule activity';
  end if;

  if p_schedule_id is null then
    insert into public.equipment_schedule_configurations (
      tenant_id, equipment_id, activity_type, is_active, frequency_value,
      frequency_unit, schedule_mode, nominal_due_date, scheduled_service_date, hard_due_date,
      early_window_days, late_window_days, equipment_family, max_events_per_day, max_events_per_week,
      provider_type, provider_name, procedure_document_number, procedure_revision, overdue_use_action,
      created_by
    ) values (
      v_input.tenant_id, v_input.equipment_id, v_input.activity_type,
      v_input.is_active, v_input.frequency_value, v_input.frequency_unit,
      v_input.schedule_mode, v_input.nominal_due_date, v_input.scheduled_service_date,
      v_input.hard_due_date, v_input.early_window_days, v_input.late_window_days,
      v_input.equipment_family, v_input.max_events_per_day, v_input.max_events_per_week,
      v_input.provider_type, v_input.provider_name, v_input.procedure_document_number,
      v_input.procedure_revision, v_input.overdue_use_action, v_input.created_by
    ) returning id into v_schedule_id;
  else
    update public.equipment_schedule_configurations s
    set is_active = v_input.is_active,
        frequency_value = v_input.frequency_value,
        frequency_unit = v_input.frequency_unit,
        schedule_mode = v_input.schedule_mode,
        scheduled_service_date = v_input.scheduled_service_date,
        early_window_days = v_input.early_window_days,
        late_window_days = v_input.late_window_days,
        equipment_family = v_input.equipment_family,
        max_events_per_day = v_input.max_events_per_day,
        max_events_per_week = v_input.max_events_per_week,
        provider_type = v_input.provider_type,
        provider_name = v_input.provider_name,
        overdue_use_action = v_input.overdue_use_action,
        created_by = v_input.created_by,
        procedure_document_number = case when p_schedule ? 'procedure_document_number' then v_input.procedure_document_number else s.procedure_document_number end,
        procedure_revision = case when p_schedule ? 'procedure_revision' then v_input.procedure_revision else s.procedure_revision end
    where s.id = p_schedule_id and s.tenant_id = v_input.tenant_id
      and s.equipment_id = v_input.equipment_id and s.activity_type = v_input.activity_type
    returning s.id into v_schedule_id;
    if not found then raise exception 'Equipment schedule is unavailable'; end if;
  end if;

  delete from public.equipment_schedule_notifications
  where schedule_configuration_id = v_schedule_id and tenant_id = v_input.tenant_id
    and is_enabled;

  insert into public.equipment_schedule_notifications (
    tenant_id, schedule_configuration_id, days_before_due, is_enabled,
    recipient_type, recipient_email, notification_type, created_by
  )
  select v_input.tenant_id, v_schedule_id, r.days_before_due, true,
         r.recipient_type, nullif(lower(trim(r.recipient_email)), ''), r.notification_type, v_email
  from jsonb_to_recordset(p_rules) as r(
    days_before_due integer, recipient_type text, recipient_email text, notification_type text
  )
  on conflict (schedule_configuration_id, days_before_due, recipient_type, recipient_email)
  do update set is_enabled = true, notification_type = excluded.notification_type;
end;
$$;
revoke all on function public.qualisphere_save_equipment_schedule(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.qualisphere_save_equipment_schedule(uuid, jsonb, jsonb) to authenticated;

-- The old database job broadcasts to owners and coordinators regardless of delivery preferences.
-- Coordinate this migration with the rollout of the preference-aware Vercel generator.
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'qualisphere-equipment-daily';
  end if;
end;
$$;
