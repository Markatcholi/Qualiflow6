-- Permit each trainee to upload evidence only into their own assignment directory.
create or replace function public.qualisphere_can_access_training_evidence(p_path text,p_write boolean default false)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select auth.uid() is not null
 and split_part(p_path,'/',1)=public.qualisphere_resolve_training_tenant()::text
 and exists(
  select 1 from public.training_assignments a
  where a.tenant_id=public.qualisphere_resolve_training_tenant()
   and a.id::text=split_part(p_path,'/',2)
   and (public.qualisphere_training_is_coordinator(a.tenant_id)
    or public.qualisphere_training_is_assignee(a.assigned_to_email))
 )
$$;
-- Require evidence and a completion date when a certification or attachment-based
-- recurring training assignment is marked completed (including signature-service updates).
create or replace function public.qualisphere_enforce_training_completion_evidence()
returns trigger language plpgsql security definer set search_path=public,auth,storage as $$
declare v_required boolean;
begin
 if new.status='completed' and old.status is distinct from 'completed' then
  v_required := new.training_category='certification'
    or (new.training_category='recurring' and coalesce(new.recurring_evidence_mode,'attachment') in ('attachment','both'));
  if new.training_completed_on is null then
   raise exception 'Training completion date is required';
  end if;
  if v_required then
   if nullif(new.training_evidence_storage_path,'') is null
      or nullif(new.training_evidence_file_name,'') is null then
     raise exception 'Signed training evidence is required for this training type';
   end if;
   if split_part(new.training_evidence_storage_path,'/',1)<>new.tenant_id::text
      or split_part(new.training_evidence_storage_path,'/',2)<>new.id::text then
     raise exception 'Training evidence must belong to this tenant and assignment';
   end if;
   if not exists(select 1 from storage.objects o where o.bucket_id='training-completion-evidence'
      and o.name=new.training_evidence_storage_path) then
     raise exception 'Training evidence file has not been uploaded';
   end if;
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists enforce_training_completion_evidence on public.training_assignments;
create trigger enforce_training_completion_evidence before update on public.training_assignments
for each row execute function public.qualisphere_enforce_training_completion_evidence();
