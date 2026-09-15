-- QualiSphere NCMR tenant isolation and legacy preservation
-- Applied to production as Supabase migration: ncmr_tenant_isolation_and_legacy_preservation
-- Design rule: Internal retains legacy NCMRs; customer tenants start with empty transactional registries.

alter table public.ncmrs add column if not exists tenant_id uuid;
alter table public.ncmrs drop constraint if exists ncmrs_tenant_id_fkey;
alter table public.ncmrs add constraint ncmrs_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);

-- Preserve all pre-tenant NCMRs as QualiSphere Internal records without changing their IDs/history.
alter table public.ncmrs disable trigger trg_protect_closed_ncmr_record;
update public.ncmrs
set tenant_id = (select id from public.tenants where is_internal = true order by created_at limit 1)
where tenant_id is null;
alter table public.ncmrs enable trigger trg_protect_closed_ncmr_record;

alter table public.ncmrs alter column tenant_id set not null;
create index if not exists ncmrs_tenant_id_idx on public.ncmrs(tenant_id);

create or replace function public.qualisphere_can_access_ncmr(p_ncmr_id uuid)
returns boolean language sql stable security definer set search_path='public','auth' as $$
  select exists (
    select 1 from public.ncmrs n
    where n.id=p_ncmr_id
      and public.qualisphere_is_active_tenant_member(n.tenant_id)
      and public.qualisphere_tenant_module_enabled(n.tenant_id,'ncmr')
  );
$$;

create or replace function public.qualisphere_resolve_ncmr_tenant()
returns trigger language plpgsql security definer set search_path='public','auth' as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_resolved_tenant_id uuid;
  v_membership_count integer;
begin
  if v_email='' then raise exception 'Authenticated user email is required to create an NCMR.'; end if;
  if new.tenant_id is not null
     and public.qualisphere_is_active_tenant_member(new.tenant_id)
     and public.qualisphere_tenant_module_enabled(new.tenant_id,'ncmr') then return new; end if;
  select count(*),min(tm.tenant_id::text)::uuid into v_membership_count,v_resolved_tenant_id
  from public.tenant_memberships tm
  join public.tenant_module_access tma on tma.tenant_id=tm.tenant_id and lower(tma.module_code)='ncmr' and tma.is_enabled=true
  join public.tenants t on t.id=tm.tenant_id and t.status='active'
  where lower(trim(tm.user_email))=v_email and tm.membership_status='active';
  if v_membership_count=1 then new.tenant_id:=v_resolved_tenant_id; return new; end if;
  if v_membership_count=0 then raise exception 'No active Company Account with NCMR access could be resolved for this user.'; end if;
  raise exception 'Multiple active Company Accounts were found. Select the Company Account before creating an NCMR.';
end;
$$;

drop trigger if exists trg_00_resolve_ncmr_tenant on public.ncmrs;
create trigger trg_00_resolve_ncmr_tenant before insert on public.ncmrs
for each row execute function public.qualisphere_resolve_ncmr_tenant();

create or replace function public.qualisphere_enforce_ncmr_row_tenant()
returns trigger language plpgsql security definer set search_path='public','auth' as $$
begin
  if not public.qualisphere_can_access_ncmr(old.id) then raise exception 'NCMR access denied for this Company Account.'; end if;
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'NCMR Company Account ownership cannot be changed.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_01_enforce_ncmr_row_tenant on public.ncmrs;
create trigger trg_01_enforce_ncmr_row_tenant before update or delete on public.ncmrs
for each row execute function public.qualisphere_enforce_ncmr_row_tenant();

alter table public.ncmrs enable row level security;
drop policy if exists ncmrs_company_boundary on public.ncmrs;
create policy ncmrs_company_boundary on public.ncmrs as restrictive for all to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'ncmr'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'ncmr'));

create or replace function public.qualisphere_enforce_ncmr_child_tenant()
returns trigger language plpgsql security definer set search_path='public','auth' as $$
declare v_ncmr_id uuid;
begin
  if tg_op='DELETE' then v_ncmr_id:=old.ncmr_id::text::uuid; else v_ncmr_id:=new.ncmr_id::text::uuid; end if;
  if not public.qualisphere_can_access_ncmr(v_ncmr_id) then raise exception 'NCMR child-record access denied for this Company Account.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['ncmr_affected_items','ncmr_comments','ncmr_mrb_approvers','ncmr_mrb_reviewers'] loop
    execute format('drop trigger if exists trg_ncmr_company_boundary on public.%I',t);
    execute format('create trigger trg_ncmr_company_boundary before insert or update or delete on public.%I for each row execute function public.qualisphere_enforce_ncmr_child_tenant()',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_company_boundary',t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (exists (select 1 from public.ncmrs n where n.id::text=%I.ncmr_id::text and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,''ncmr''))) with check (exists (select 1 from public.ncmrs n where n.id::text=%I.ncmr_id::text and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,''ncmr'')))',t||'_company_boundary',t,t,t);
  end loop;
end $$;

create or replace function public.qualisphere_enforce_ncmr_approval_task_tenant()
returns trigger language plpgsql security definer set search_path='public','auth' as $$
declare v_type text; v_id uuid;
begin
  if tg_op='DELETE' then v_type:=lower(old.entity_type); v_id:=old.entity_id; else v_type:=lower(new.entity_type); v_id:=new.entity_id; end if;
  if v_type='ncmr' and not public.qualisphere_can_access_ncmr(v_id) then raise exception 'NCMR task access denied for this Company Account.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_ncmr_company_boundary on public.approval_tasks;
create trigger trg_ncmr_company_boundary before insert or update or delete on public.approval_tasks
for each row execute function public.qualisphere_enforce_ncmr_approval_task_tenant();
alter table public.approval_tasks enable row level security;
drop policy if exists approval_tasks_ncmr_company_boundary on public.approval_tasks;
create policy approval_tasks_ncmr_company_boundary on public.approval_tasks as restrictive for all to authenticated
using (lower(entity_type)<>'ncmr' or exists(select 1 from public.ncmrs n where n.id=entity_id and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,'ncmr')))
with check (lower(entity_type)<>'ncmr' or exists(select 1 from public.ncmrs n where n.id=entity_id and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,'ncmr')));

create or replace function public.qualisphere_enforce_ncmr_snapshot_tenant()
returns trigger language plpgsql security definer set search_path='public','auth' as $$
declare v_module text; v_id uuid;
begin
  if tg_op='DELETE' then v_module:=upper(old.module_code); v_id:=old.record_id; else v_module:=upper(new.module_code); v_id:=new.record_id; end if;
  if v_module='NCMR' and not public.qualisphere_can_access_ncmr(v_id) then raise exception 'NCMR decision-snapshot access denied for this Company Account.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_ncmr_company_boundary on public.qms_decision_snapshots;
create trigger trg_ncmr_company_boundary before insert or update or delete on public.qms_decision_snapshots
for each row execute function public.qualisphere_enforce_ncmr_snapshot_tenant();
alter table public.qms_decision_snapshots enable row level security;
drop policy if exists qms_decision_snapshots_ncmr_company_boundary on public.qms_decision_snapshots;
create policy qms_decision_snapshots_ncmr_company_boundary on public.qms_decision_snapshots as restrictive for all to authenticated
using (upper(module_code)<>'NCMR' or exists(select 1 from public.ncmrs n where n.id=record_id and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,'ncmr')))
with check (upper(module_code)<>'NCMR' or exists(select 1 from public.ncmrs n where n.id=record_id and public.qualisphere_is_active_tenant_member(n.tenant_id) and public.qualisphere_tenant_module_enabled(n.tenant_id,'ncmr')));

create or replace function public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id uuid)
returns boolean language plpgsql stable security definer set search_path='public','pg_temp' as $$
declare v_email text:=public.qualisphere_current_user_email(); v_owner text:=''; v_authority jsonb:='{}'::jsonb;
begin
  if v_email='' or p_ncmr_id is null then return false; end if;
  if not public.qualisphere_can_access_ncmr(p_ncmr_id) then return false; end if;
  select lower(trim(coalesce(owner,''))) into v_owner from public.ncmrs where id=p_ncmr_id;
  if found and v_owner=v_email then return true; end if;
  begin v_authority:=coalesce(public.get_qualisphere_enterprise_authority(v_email),'{}'::jsonb); exception when others then v_authority:='{}'::jsonb; end;
  return coalesce((v_authority->>'is_admin')::boolean,false) or public.is_qms_governance_admin() or public.is_qualisphere_role_administrator();
end;
$$;

create or replace function public.qualisphere_can_read_ncmr_mrb_task_set(p_ncmr_id uuid)
returns boolean language plpgsql stable security definer set search_path='public','pg_temp' as $$
declare v_email text:=public.qualisphere_current_user_email();
begin
  if v_email='' or p_ncmr_id is null then return false; end if;
  if not public.qualisphere_can_access_ncmr(p_ncmr_id) then return false; end if;
  if public.qualisphere_can_govern_ncmr_tasks(p_ncmr_id) then return true; end if;
  return exists(select 1 from public.approval_tasks t where t.entity_type='ncmr' and t.entity_id=p_ncmr_id and t.task_type in ('mrb_approval','ncmr_mrb_approval','ncmr_mrb_review') and lower(trim(coalesce(t.assigned_to_email,'')))=v_email);
end;
$$;

revoke execute on function public.qualisphere_can_access_ncmr(uuid) from anon;
revoke execute on function public.qualisphere_resolve_ncmr_tenant() from anon;
revoke execute on function public.qualisphere_enforce_ncmr_row_tenant() from anon;
revoke execute on function public.qualisphere_enforce_ncmr_child_tenant() from anon;
revoke execute on function public.qualisphere_enforce_ncmr_approval_task_tenant() from anon;
revoke execute on function public.qualisphere_enforce_ncmr_snapshot_tenant() from anon;
