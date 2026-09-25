-- Tenantize Management Review and its child records.
alter table public.management_reviews add column if not exists tenant_id uuid references public.tenants(id);
alter table public.management_review_approvers add column if not exists tenant_id uuid references public.tenants(id);
alter table public.management_review_actions add column if not exists tenant_id uuid references public.tenants(id);

do $$
declare v_internal uuid;
begin
  select id into v_internal from public.tenants where is_internal=true and is_active=true order by created_at limit 1;
  if v_internal is null then raise exception 'Active QualiSphere Internal tenant not found'; end if;

  update public.management_reviews set tenant_id=v_internal where tenant_id is null;
  update public.management_review_approvers a
    set tenant_id=r.tenant_id from public.management_reviews r
    where a.management_review_id=r.id and a.tenant_id is null;
  update public.management_review_actions a
    set tenant_id=r.tenant_id from public.management_reviews r
    where a.management_review_id=r.id and a.tenant_id is null;
end $$;

alter table public.management_reviews alter column tenant_id set not null;
alter table public.management_review_approvers alter column tenant_id set not null;
alter table public.management_review_actions alter column tenant_id set not null;

create index if not exists management_reviews_tenant_idx on public.management_reviews(tenant_id);
create index if not exists management_review_approvers_tenant_idx on public.management_review_approvers(tenant_id);
create index if not exists management_review_actions_tenant_idx on public.management_review_actions(tenant_id);

create or replace function public.qualisphere_current_management_review_tenant()
returns uuid language sql stable security definer set search_path=public as $$
  select tm.tenant_id
  from public.tenant_memberships tm
  join public.tenants t on t.id=tm.tenant_id
  where lower(tm.user_email)=lower(coalesce(auth.jwt()->>'email',''))
    and tm.is_active=true and t.is_active=true
    and public.qualisphere_tenant_module_enabled(tm.tenant_id,'management_review')
  order by t.is_internal desc, tm.created_at
  limit 1
$$;

create or replace function public.qualisphere_enforce_management_review_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Management Review tenant cannot be changed.';
  end if;
  if new.tenant_id is null then new.tenant_id:=public.qualisphere_current_management_review_tenant(); end if;
  if new.tenant_id is null
     or not public.qualisphere_is_active_tenant_member(new.tenant_id)
     or not public.qualisphere_tenant_module_enabled(new.tenant_id,'management_review') then
    raise exception 'Management Review tenant access denied.';
  end if;
  return new;
end $$;

create or replace function public.qualisphere_set_management_review_child_tenant()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.management_reviews where id=new.management_review_id;
  if v_tenant is null then raise exception 'Parent Management Review not found.'; end if;
  if tg_op='UPDATE' and new.management_review_id is distinct from old.management_review_id then
    raise exception 'Management Review child parent cannot be changed.';
  end if;
  new.tenant_id:=v_tenant;
  if not public.qualisphere_is_active_tenant_member(v_tenant)
     or not public.qualisphere_tenant_module_enabled(v_tenant,'management_review') then
    raise exception 'Management Review tenant access denied.';
  end if;
  return new;
end $$;

drop trigger if exists trg_management_reviews_tenant on public.management_reviews;
create trigger trg_management_reviews_tenant before insert or update on public.management_reviews
for each row execute function public.qualisphere_enforce_management_review_tenant();

drop trigger if exists trg_management_review_approvers_tenant on public.management_review_approvers;
create trigger trg_management_review_approvers_tenant before insert or update on public.management_review_approvers
for each row execute function public.qualisphere_set_management_review_child_tenant();

drop trigger if exists trg_management_review_actions_tenant on public.management_review_actions;
create trigger trg_management_review_actions_tenant before insert or update on public.management_review_actions
for each row execute function public.qualisphere_set_management_review_child_tenant();

alter table public.management_reviews enable row level security;
alter table public.management_review_approvers enable row level security;
alter table public.management_review_actions enable row level security;

do $$
declare p record;
begin
 for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('management_reviews','management_review_approvers','management_review_actions')
 loop execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename); end loop;
end $$;

create policy "management review tenant select" on public.management_reviews for select to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review tenant insert" on public.management_reviews for insert to authenticated
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review tenant update" on public.management_reviews for update to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));

create policy "management review approver tenant select" on public.management_review_approvers for select to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review approver tenant insert" on public.management_review_approvers for insert to authenticated
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review approver tenant update" on public.management_review_approvers for update to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review approver tenant delete" on public.management_review_approvers for delete to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));

create policy "management review action tenant select" on public.management_review_actions for select to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review action tenant insert" on public.management_review_actions for insert to authenticated
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
create policy "management review action tenant update" on public.management_review_actions for update to authenticated
using (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'))
with check (public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'management_review'));
