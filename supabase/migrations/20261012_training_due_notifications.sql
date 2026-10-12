-- Training notification foundation. Uses the existing notification inbox.
-- Deduplicate only training-owned notification keys, leaving other modules untouched.
create unique index if not exists training_notifications_dedup_unique
 on public.notifications(deduplication_key)
 where related_module='training' and deduplication_key is not null;

create or replace function public.qualisphere_training_assignment_notice()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if nullif(new.assigned_to_email,'') is not null then
   insert into public.notifications(
     user_email,title,message,notification_type,severity,related_record_id,
     related_module,related_url,is_read,read_status,created_by,deduplication_key)
   values (
     lower(new.assigned_to_email),'Training assigned',
     coalesce(new.training_title,'Training') || ' has been assigned to you.',
     'training_assigned','info',new.id,'training','/training/'||new.id::text,
     false,false,'training_system','training:'||new.id::text||':assigned')
   on conflict do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists training_assignment_notice on public.training_assignments;
create trigger training_assignment_notice after insert on public.training_assignments
for each row execute function public.qualisphere_training_assignment_notice();

-- A coordinator can send due-soon / overdue notices without duplicate inbox entries.
-- This function does not modify training records or mark training complete.
create or replace function public.qualisphere_send_training_due_notices(p_as_of date default current_date)
returns integer language plpgsql security definer set search_path=public,auth as $$
declare r record; v_count integer:=0; v_key text; v_kind text;
begin
 if auth.uid() is null or not public.qualisphere_training_is_coordinator(public.qualisphere_resolve_training_tenant()) then
   raise exception 'Training coordinator permission required';
 end if;
 if p_as_of<>current_date then raise exception 'Notices must use the current date'; end if;
 for r in select id,assigned_to_email,training_title,due_date,tenant_id
          from public.training_assignments
          where tenant_id=public.qualisphere_resolve_training_tenant()
            and status not in ('completed','waived','effectiveness_complete')
            and due_date is not null and due_date::date <= p_as_of + 7
 loop
   v_kind:=case when r.due_date::date < p_as_of then 'overdue' else 'due_soon' end;
   -- A due-soon notice is once per due date; overdue reminder at most once per 7-day window.
   v_key:='training:'||r.id::text||':'||v_kind||':'||
     case when v_kind='overdue' then (date_trunc('week',p_as_of::timestamp))::date::text
          else r.due_date::date::text end;
   insert into public.notifications(
     user_email,title,message,notification_type,severity,related_record_id,
     related_module,related_url,is_read,read_status,created_by,deduplication_key)
   values(lower(r.assigned_to_email),
     case when v_kind='overdue' then 'Training overdue' else 'Training due soon' end,
     coalesce(r.training_title,'Training')||' is '||
       case when v_kind='overdue' then 'overdue.' else 'due on '||r.due_date::date::text||'.' end,
     'training_'||v_kind,case when v_kind='overdue' then 'warning' else 'info' end,
     r.id,'training','/training/'||r.id::text,false,false,'training_system',v_key)
   on conflict do nothing;
   if found then v_count:=v_count+1; end if;
 end loop;
 return v_count;
end;
$$;
revoke all on function public.qualisphere_send_training_due_notices(date) from public,anon;
grant execute on function public.qualisphere_send_training_due_notices(date) to authenticated;
