-- Run after 20261012_training_tenant_role_security.sql.
-- RLS checks rows, not changed columns. This trigger protects assignment metadata
-- from an assignee's direct table UPDATE while allowing completion-related fields.
create or replace function public.qualisphere_guard_training_assignment_update()
returns trigger language plpgsql security definer
set search_path=public,auth as $$
begin
 if auth.uid() is null then
   return new;
 end if;
 if public.qualisphere_training_is_coordinator(old.tenant_id) then
   return new;
 end if;
 if not public.qualisphere_training_is_assignee(old.assigned_to_email) then
   raise exception 'Only the assigned employee or an authorized training coordinator may update training';
 end if;
 if (to_jsonb(new) - array[
  'status','completed_at','completed_by','acknowledged_at','acknowledged_by',
  'signature_id','training_comments','training_evidence_storage_path',
  'training_evidence_file_name','training_valid_until','retraining_due_date',
  'training_completed_on'
 ]::text[]) is distinct from (to_jsonb(old) - array[
  'status','completed_at','completed_by','acknowledged_at','acknowledged_by',
  'signature_id','training_comments','training_evidence_storage_path',
  'training_evidence_file_name','training_valid_until','retraining_due_date',
  'training_completed_on'
 ]::text[]) then
   raise exception 'Training assignment requirements and ownership are coordinator-controlled';
 end if;
 if new.status is distinct from old.status
    and new.status not in ('completed') then
   raise exception 'Employee may only mark assigned training completed';
 end if;
 if new.completed_by is distinct from old.completed_by
    and lower(coalesce(new.completed_by,'')) <> lower(coalesce(auth.jwt()->>'email','')) then
   raise exception 'Training completion must identify the assigned employee';
 end if;
 if new.acknowledged_by is distinct from old.acknowledged_by
    and lower(coalesce(new.acknowledged_by,'')) <> lower(coalesce(auth.jwt()->>'email','')) then
   raise exception 'Training acknowledgement must identify the assigned employee';
 end if;
 return new;
end;
$$;
drop trigger if exists guard_training_assignment_update on public.training_assignments;
create trigger guard_training_assignment_update before update on public.training_assignments
for each row execute function public.qualisphere_guard_training_assignment_update();
-- Training matrix is master data; ordinary employees must not mutate it.
drop policy if exists "Authenticated users can insert training matrix" on public.training_matrix;
drop policy if exists "Authenticated users can update training matrix" on public.training_matrix;
create policy training_matrix_coordinator_insert on public.training_matrix
 for insert to authenticated with check (
 tenant_id=public.qualisphere_resolve_training_tenant()
 and public.qualisphere_training_is_coordinator(tenant_id));
create policy training_matrix_coordinator_update on public.training_matrix
 for update to authenticated using (
 tenant_id=public.qualisphere_resolve_training_tenant()
 and public.qualisphere_training_is_coordinator(tenant_id))
 with check (
 tenant_id=public.qualisphere_resolve_training_tenant()
 and public.qualisphere_training_is_coordinator(tenant_id));
