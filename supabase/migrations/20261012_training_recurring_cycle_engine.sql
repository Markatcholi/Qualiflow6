-- Training recurring cycles: idempotent, tenant-aware generation.
-- This function is invoked by an authorized coordinator; no automatic completion.
create unique index if not exists training_recurring_one_child_per_parent
 on public.training_assignments(recurring_parent_assignment_id)
 where recurring_parent_assignment_id is not null;

create or replace function public.qualisphere_generate_recurring_training_cycles(p_as_of date default current_date)
returns integer language plpgsql security definer
set search_path=public,auth as $$
declare
  r record;
  v_due date;
  v_base date;
  v_count integer := 0;
  v_tenant uuid;
begin
  v_tenant := public.qualisphere_resolve_training_tenant();
  if auth.uid() is null or v_tenant is null
     or not public.qualisphere_training_is_coordinator(v_tenant) then
    raise exception 'Training coordinator permission required';
  end if;
  if p_as_of > current_date then
    raise exception 'Future cycle generation is not permitted';
  end if;
  for r in
    select a.* from public.training_assignments a
    where a.tenant_id=v_tenant
      and a.training_category='recurring'
      and a.status='completed'
      and a.recurrence_months between 1 and 120
      and not exists(select 1 from public.training_assignments child
                     where child.recurring_parent_assignment_id=a.id)
    order by a.created_at,a.id
    for update of a skip locked
  loop
    if r.recurrence_basis='calendar' then
      v_base := coalesce(r.due_date::date,r.training_completed_on,r.completed_at::date);
    else
      v_base := coalesce(r.training_completed_on,r.completed_at::date);
    end if;
    if v_base is null then continue; end if;
    v_due := (v_base + make_interval(months => r.recurrence_months))::date;
    -- Calendar schedule does not drift when a cycle is completed late.
    -- Never generate an additional cycle ahead of its scheduled due date.
    if v_due > p_as_of then continue; end if;
    insert into public.training_assignments(
      tenant_id,document_id,assigned_to_email,assigned_by_email,assignment_source,
      role_name,department,training_title,training_description,due_date,status,
      effectiveness_required,effectiveness_status,supervisor_verification_required,
      acknowledgement_required,originating_change_control_id,retraining_assignment,
      source_document_revision,previous_training_assignment_id,training_requirement_id,
      training_group_id,training_method_id,release_blocking,training_category,
      recurrence_months,recurrence_basis,recurring_evidence_mode,
      recurring_next_due_date,recurring_parent_assignment_id)
    values(
      r.tenant_id,r.document_id,r.assigned_to_email,auth.jwt()->>'email','recurring',
      r.role_name,r.department,r.training_title,r.training_description,v_due,'assigned',
      r.effectiveness_required,case when r.effectiveness_required then 'effectiveness_pending' else null end,
      r.supervisor_verification_required,r.acknowledgement_required,
      r.originating_change_control_id,true,r.source_document_revision,r.id,
      r.training_requirement_id,r.training_group_id,r.training_method_id,
      r.release_blocking,'recurring',r.recurrence_months,r.recurrence_basis,
      r.recurring_evidence_mode,null,r.id)
    on conflict (recurring_parent_assignment_id) where recurring_parent_assignment_id is not null
      do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.qualisphere_generate_recurring_training_cycles(date) from public,anon;
grant execute on function public.qualisphere_generate_recurring_training_cycles(date) to authenticated;
