-- Create execution tasks 30 days before the nominal due date, independently of reminder settings.
create or replace function public.qualisphere_reconcile_equipment_tasks()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cycle record;
  v_assignee text;
  v_event uuid;
begin
  for cycle in
    select s.id, s.tenant_id, s.equipment_id, s.activity_type, s.nominal_due_date,
           e.equipment_number, e.owner_email
    from public.equipment_schedule_configurations s
    join public.equipment e on e.id=s.equipment_id and e.tenant_id=s.tenant_id
    join public.tenants t on t.id=s.tenant_id and t.status='active'
    where s.is_active and s.nominal_due_date <= current_date + 30 and e.record_status='released'
      and ((s.activity_type='calibration' and e.calibration_required)
        or (s.activity_type='preventive_maintenance' and e.preventive_maintenance_required))
      and not exists(select 1 from public.equipment_release_requests r
        where r.equipment_id=e.id and r.status='pending')
    order by s.id
    for no key update of s
  loop
    select nullif(lower(trim(cycle.owner_email)),'') into v_assignee
    where exists (select 1 from public.tenant_memberships m where m.tenant_id=cycle.tenant_id
      and m.membership_status='active' and lower(trim(m.user_email))=lower(trim(cycle.owner_email)));
    if v_assignee is null then
      select c.email into v_assignee from public.qualisphere_equipment_coordinators(cycle.tenant_id) c
      order by c.email limit 1;
    end if;
    if v_assignee is null then continue; end if;

    if cycle.activity_type='calibration' then
      select e.id into v_event from public.equipment_calibration_events e
      where e.tenant_id=cycle.tenant_id and e.equipment_id=cycle.equipment_id
        and e.schedule_configuration_id=cycle.id and e.nominal_due_date=cycle.nominal_due_date
        and e.status='completed' and e.performed_date is not null limit 1;
    else
      select e.id into v_event from public.equipment_maintenance_events e
      where e.tenant_id=cycle.tenant_id and e.equipment_id=cycle.equipment_id
        and e.schedule_configuration_id=cycle.id and e.nominal_due_date=cycle.nominal_due_date
        and e.maintenance_type='preventive' and e.status='completed' and e.performed_date is not null limit 1;
    end if;
    if v_event is not null then continue; end if;

    insert into public.equipment_execution_tasks
      (tenant_id,equipment_id,schedule_id,activity_type,due_date,record_number,assigned_to_email)
    values (cycle.tenant_id,cycle.equipment_id,cycle.id,cycle.activity_type,cycle.nominal_due_date,
            cycle.equipment_number,v_assignee)
    on conflict (schedule_id,due_date) do update
      set assigned_to_email=excluded.assigned_to_email,status='pending'
      where public.equipment_execution_tasks.status <> 'completed'
        and (public.equipment_execution_tasks.status <> 'pending'
          or public.equipment_execution_tasks.assigned_to_email <> excluded.assigned_to_email);
  end loop;

  update public.equipment_execution_tasks task set status='cancelled'
  where task.status='pending' and not exists (
    select 1 from public.equipment_schedule_configurations s
    join public.equipment e on e.id=s.equipment_id and e.tenant_id=s.tenant_id
    join public.tenants t on t.id=s.tenant_id and t.status='active'
    where s.id=task.schedule_id and s.is_active and s.nominal_due_date=task.due_date
      and s.nominal_due_date <= current_date + 30
      and e.record_status='released'
      and ((s.activity_type='calibration' and e.calibration_required)
        or (s.activity_type='preventive_maintenance' and e.preventive_maintenance_required))
      and not exists(select 1 from public.equipment_release_requests r
        where r.equipment_id=e.id and r.status='pending')
  );
end;
$$;

select public.qualisphere_reconcile_equipment_tasks();
