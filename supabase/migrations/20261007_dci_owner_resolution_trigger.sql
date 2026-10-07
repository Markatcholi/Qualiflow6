-- DCI collaboration owner-resolution handoff
create or replace function public.qualisphere_dci_collaboration_owner_handoff()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread public.collaboration_threads%rowtype;
  v_owner_email text;
  v_dci_number text;
begin
  if new.status is distinct from 'completed' or old.status is not distinct from 'completed' then return new; end if;
  select * into v_thread from public.collaboration_threads where id = new.thread_id;
  if not found or v_thread.module <> 'document_change_initiation' or v_thread.status <> 'open' then return new; end if;
  if exists (select 1 from public.collaboration_participants where thread_id = new.thread_id and status = 'active') then return new; end if;
  select lower(trim(owner_email)), dci_number into v_owner_email, v_dci_number from public.document_change_initiations where id = v_thread.record_id;
  if coalesce(v_owner_email, '') = '' then return new; end if;
  if not exists (
    select 1 from public.approval_tasks
    where entity_type='document_change_initiation' and entity_id=v_thread.record_id
      and task_type='collaboration_resolution' and lower(trim(assigned_to_email))=v_owner_email and status='pending'
  ) then
    insert into public.approval_tasks (
      entity_type,entity_id,task_type,task_title,required_function,assigned_to_email,assigned_by_email,status,comments,record_number
    ) values (
      'document_change_initiation',v_thread.record_id,'collaboration_resolution',
      'Resolve Collaboration for '||coalesce(v_dci_number,v_thread.record_number),'DCI Owner',
      v_owner_email,new.user_email,'pending',
      'All collaborator reviews are complete. Review the collaboration feedback, enter the resolution summary, and close or reopen the collaboration round.',
      coalesce(v_dci_number,v_thread.record_number)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dci_collaboration_owner_handoff on public.collaboration_participants;
create trigger trg_dci_collaboration_owner_handoff
after update of status on public.collaboration_participants
for each row execute function public.qualisphere_dci_collaboration_owner_handoff();
