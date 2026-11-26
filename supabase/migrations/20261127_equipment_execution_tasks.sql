alter table public.equipment_schedule_notifications
  drop constraint equipment_schedule_notifications_recipient_type_check;
alter table public.equipment_schedule_notifications
  add constraint equipment_schedule_notifications_recipient_type_check
  check (recipient_type in ('owner','coordinator','specific_user','department','quality'));

create table public.equipment_execution_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  equipment_id uuid not null,
  schedule_id uuid not null references public.equipment_schedule_configurations(id) on delete cascade,
  activity_type text not null check (activity_type in ('calibration','preventive_maintenance')),
  due_date date not null,
  record_number text not null,
  assigned_to_email text not null,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  completed_event_id uuid,
  completed_by_email text,
  completed_at timestamptz,
  unique (schedule_id, due_date)
);
alter table public.equipment_execution_tasks enable row level security;
revoke all on public.equipment_execution_tasks from anon, authenticated;
grant select on public.equipment_execution_tasks to authenticated;
create index equipment_execution_tasks_assignee
  on public.equipment_execution_tasks (tenant_id, assigned_to_email) where status = 'pending';
create policy equipment_execution_tasks_assignee_read on public.equipment_execution_tasks
  for select to authenticated using (
    assigned_to_email = lower(trim(auth.jwt()->>'email'))
    and public.qualisphere_is_active_tenant_member(tenant_id)
    and public.qualisphere_tenant_module_enabled(tenant_id, 'equipment')
    and public.qualisphere_company_is_active(tenant_id)
  );

create function public.qualisphere_equipment_coordinators(p_tenant_id uuid)
returns table (email text)
language sql stable security definer set search_path = ''
as $$
  select distinct lower(trim(m.user_email))
  from public.tenant_memberships m
  join public.tenants t on t.id=m.tenant_id and t.status='active'
  where m.tenant_id=p_tenant_id and m.membership_status='active' and nullif(trim(m.user_email),'') is not null
    and (
      exists (select 1 from public.equipment_governance_members g
        where g.tenant_id=t.id and lower(trim(g.user_email))=lower(trim(m.user_email))
          and g.is_active and g.role='coordinator')
      or case when t.is_internal then
        coalesce((public.get_qualisphere_enterprise_authority(m.user_email)->>'is_equipment_coordinator')::boolean,false)
      else exists (
        select 1 from public.tenant_user_role_assignments a
        join public.customer_roles r on r.id=a.role_id and r.tenant_id=a.tenant_id and r.is_active
        join public.tenant_user_profiles p on p.tenant_id=a.tenant_id
          and lower(trim(p.user_email))=lower(trim(a.user_email)) and p.account_status='active'
        where a.tenant_id=t.id and lower(trim(a.user_email))=lower(trim(m.user_email)) and a.is_active
          and lower(r.role_name) in ('equipment coordinator','equipment administrator')
      ) end
    );
$$;
revoke all on function public.qualisphere_equipment_coordinators(uuid) from public, anon, authenticated;
grant execute on function public.qualisphere_equipment_coordinators(uuid) to service_role;

create function public.qualisphere_can_record_equipment_service(
  p_tenant_id uuid, p_equipment_id uuid, p_owner_scheduled_insert boolean
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.equipment e
    where e.tenant_id=p_tenant_id and e.id=p_equipment_id
      and e.record_status <> 'pending_release'
      and not exists (select 1 from public.equipment_release_requests r
        where r.equipment_id=e.id and r.status='pending')
      and (
        exists (select 1 from public.qualisphere_equipment_coordinators(e.tenant_id) c
          where c.email=lower(trim(auth.jwt()->>'email')))
        or (
          lower(trim(e.owner_email))=lower(trim(auth.jwt()->>'email'))
          and public.qualisphere_is_active_tenant_member(e.tenant_id)
          and (e.record_status='draft' or (e.record_status='released' and p_owner_scheduled_insert))
        )
      )
  );
$$;
revoke all on function public.qualisphere_can_record_equipment_service(uuid,uuid,boolean) from public, anon;
grant execute on function public.qualisphere_can_record_equipment_service(uuid,uuid,boolean) to authenticated;

create policy equipment_calibration_execution_insert on public.equipment_calibration_events
  as restrictive for insert to authenticated with check (
    public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,
      event_source='scheduled' and exists (
        select 1 from public.equipment_schedule_configurations s
        where s.id=schedule_configuration_id and s.equipment_id=equipment_calibration_events.equipment_id
          and s.tenant_id=equipment_calibration_events.tenant_id and s.activity_type='calibration'
          and s.is_active and s.nominal_due_date is not distinct from equipment_calibration_events.nominal_due_date
      ))
  );
create policy equipment_maintenance_execution_insert on public.equipment_maintenance_events
  as restrictive for insert to authenticated with check (
    public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,
      maintenance_type='preventive' and exists (
        select 1 from public.equipment_schedule_configurations s
        where s.id=schedule_configuration_id and s.equipment_id=equipment_maintenance_events.equipment_id
          and s.tenant_id=equipment_maintenance_events.tenant_id and s.activity_type='preventive_maintenance'
          and s.is_active and s.nominal_due_date is not distinct from equipment_maintenance_events.nominal_due_date
      ))
  );
create policy equipment_calibration_execution_update on public.equipment_calibration_events
  as restrictive for update to authenticated
  using (public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,false))
  with check (public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,false));
create policy equipment_maintenance_execution_update on public.equipment_maintenance_events
  as restrictive for update to authenticated
  using (public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,false))
  with check (public.qualisphere_can_record_equipment_service(tenant_id,equipment_id,false));

create function public.qualisphere_reconcile_equipment_tasks()
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
    where s.is_active and s.nominal_due_date is not null and e.record_status='released'
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
      and e.record_status='released'
      and ((s.activity_type='calibration' and e.calibration_required)
        or (s.activity_type='preventive_maintenance' and e.preventive_maintenance_required))
      and not exists(select 1 from public.equipment_release_requests r
        where r.equipment_id=e.id and r.status='pending')
  );
end;
$$;
revoke all on function public.qualisphere_reconcile_equipment_tasks() from public, anon, authenticated;
grant execute on function public.qualisphere_reconcile_equipment_tasks() to service_role;

create function public.qualisphere_complete_equipment_task()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor text := lower(trim(auth.jwt()->>'email'));
begin
  if new.status <> 'completed' or new.performed_date is null
    or new.nominal_due_date is null or new.schedule_configuration_id is null then
    return new;
  end if;
  if tg_table_name='equipment_maintenance_events' then
    if new.maintenance_type <> 'preventive' then return new; end if;
  end if;
  if v_actor is null or not exists (
    select 1 from public.equipment e
    where e.id=new.equipment_id and e.tenant_id=new.tenant_id and e.record_status='released'
      and not exists (select 1 from public.equipment_release_requests r where r.equipment_id=e.id and r.status='pending')
      and (exists (select 1 from public.qualisphere_equipment_coordinators(e.tenant_id) c where c.email=v_actor)
        or (lower(trim(e.owner_email))=v_actor and exists (select 1 from public.tenant_memberships m
          where m.tenant_id=e.tenant_id and lower(trim(m.user_email))=v_actor and m.membership_status='active')))
  ) then return new; end if;

  perform 1 from public.equipment_schedule_configurations s
    where s.id=new.schedule_configuration_id and s.equipment_id=new.equipment_id
      and s.tenant_id=new.tenant_id
      and s.activity_type=case when tg_table_name='equipment_calibration_events' then 'calibration' else 'preventive_maintenance' end
    for no key update;
  if not found then return new; end if;

  update public.equipment_execution_tasks
  set status='completed', completed_event_id=new.id, completed_by_email=v_actor, completed_at=now()
  where schedule_id=new.schedule_configuration_id and tenant_id=new.tenant_id
    and equipment_id=new.equipment_id and due_date=new.nominal_due_date and status='pending';

  update public.notifications
  set delivery_status='not_required'
  where related_module='equipment' and related_record_id=new.equipment_id
    and created_by='equipment_scheduler' and notification_type='equipment_schedule_reminder'
    and (delivery_status is null or delivery_status='pending')
    and deduplication_key like new.tenant_id::text||':'||new.schedule_configuration_id::text||':'||new.nominal_due_date::text||':%';
  return new;
end;
$$;
revoke all on function public.qualisphere_complete_equipment_task() from public, anon, authenticated;

create trigger equipment_calibration_complete_task
  after insert or update on public.equipment_calibration_events
  for each row execute function public.qualisphere_complete_equipment_task();
create trigger equipment_maintenance_complete_task
  after insert or update on public.equipment_maintenance_events
  for each row execute function public.qualisphere_complete_equipment_task();

select public.qualisphere_reconcile_equipment_tasks();
