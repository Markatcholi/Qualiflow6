-- Equipment reminders: workspace delivery only. Email delivery requires a separately verified provider.
-- Never update equipment.use_status or equipment_schedule_configurations.overdue_use_action here.
create unique index if not exists equipment_notifications_dedup_unique
on public.notifications (deduplication_key)
where related_module = 'equipment' and deduplication_key is not null;

create or replace function public.qualisphere_equipment_daily_notifications()
returns integer
language plpgsql
set search_path = public, pg_catalog
as $fn$
declare
  r record;
  v_email text;
  v_key text;
  v_inserted integer := 0;
  v_due date;
  v_label text;
begin
  if session_user <> 'postgres' then
    raise exception 'Database scheduler only';
  end if;

  for r in
    select s.id as schedule_id, s.tenant_id, s.activity_type, s.hard_due_date,
           s.nominal_due_date, e.id as equipment_id, e.equipment_number,
           e.equipment_name, e.owner_email, n.days_before_due
    from public.equipment_schedule_configurations s
    join public.equipment e on e.id=s.equipment_id and e.tenant_id=s.tenant_id
    join public.equipment_schedule_notifications n
      on n.schedule_configuration_id=s.id and n.tenant_id=s.tenant_id
    where s.is_active is true and n.is_enabled is true
      and s.activity_type in ('calibration','preventive_maintenance')
      and coalesce(s.hard_due_date,s.nominal_due_date) is not null
      and coalesce(s.hard_due_date,s.nominal_due_date) - current_date = n.days_before_due
  loop
    v_due := coalesce(r.hard_due_date,r.nominal_due_date);
    v_label := case when r.activity_type='calibration' then 'Calibration' else 'Preventive maintenance' end;
    for v_email in
      select distinct lower(trim(recipient)) from (
        select r.owner_email as recipient
        union all
        select a.user_email
        from public.tenant_user_role_assignments a
        join public.customer_roles cr
          on cr.id=a.role_id and cr.tenant_id=a.tenant_id
        join public.tenant_user_profiles p
          on p.tenant_id=a.tenant_id and lower(p.user_email)=lower(a.user_email)
        where a.tenant_id=r.tenant_id
          and a.is_active is true and cr.is_active is true
          and lower(cr.role_name)='equipment coordinator'
          and lower(coalesce(p.account_status,'active'))='active'
      ) recipients
      where recipient is not null and trim(recipient) <> ''
        and exists (
          select 1 from public.tenant_user_profiles p2
          where p2.tenant_id=r.tenant_id
            and lower(p2.user_email)=lower(trim(recipient))
            and lower(coalesce(p2.account_status,'active'))='active'
        )
    loop
      v_key := 'equipment:'||r.tenant_id||':'||r.schedule_id||':'||
        v_due||':'||r.days_before_due||':'||v_email;
      insert into public.notifications
        (user_email,title,message,notification_type,severity,related_record_id,
         related_module,related_url,is_read,read_status,created_by,deduplication_key)
      values
        (v_email, v_label||case when r.days_before_due<0 then ' overdue'
            when r.days_before_due=0 then ' due today' else ' reminder' end,
         coalesce(r.equipment_number,r.equipment_name,'Equipment')||': '||v_label||
           ' due '||v_due::text||'.',
         'equipment_schedule_reminder',
         case when r.days_before_due<=0 then 'warning' else 'info' end,
         r.equipment_id,'equipment','/equipment/'||r.equipment_id::text,
         false,false,'equipment_scheduler',v_key)
      on conflict do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end loop;
  end loop;
  return v_inserted;
end;
$fn$;
revoke all on function public.qualisphere_equipment_daily_notifications() from public, anon, authenticated;
-- Deployment: schedule daily under the privileged postgres role only after Sandbox validation.
-- select cron.schedule('qualisphere-equipment-daily','30 6 * * *',
--   'select public.qualisphere_equipment_daily_notifications();');
