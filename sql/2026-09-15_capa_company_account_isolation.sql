-- QualiSphere CAPA Company Account Isolation
-- Date: 2026-09-15
-- Purpose: Preserve legacy CAPA records in QualiSphere Internal while enforcing customer Company Account isolation.

alter table public.capas add column if not exists tenant_id uuid references public.tenants(id);
create index if not exists idx_capas_tenant_id on public.capas(tenant_id);

update public.capas
set tenant_id=(select id from public.tenants where coalesce(is_internal,false)=true order by created_at limit 1)
where tenant_id is null;
alter table public.capas alter column tenant_id set not null;

create or replace function public.qualisphere_resolve_capa_tenant()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_tenant uuid; v_count integer;
begin
 if new.tenant_id is not null and exists(select 1 from public.tenants t where t.id=new.tenant_id) then return new; end if;
 select count(distinct tm.tenant_id),min(tm.tenant_id) into v_count,v_tenant
 from public.tenant_memberships tm
 where tm.user_id=auth.uid() and tm.is_active=true
   and public.qualisphere_tenant_module_enabled(tm.tenant_id,'capa');
 if v_count<>1 or v_tenant is null then raise exception 'Unable to resolve a unique active CAPA Company Account.'; end if;
 new.tenant_id:=v_tenant;
 return new;
end;$$;

drop trigger if exists trg_00_resolve_capa_tenant on public.capas;
create trigger trg_00_resolve_capa_tenant before insert on public.capas for each row execute function public.qualisphere_resolve_capa_tenant();

create or replace function public.qualisphere_enforce_capa_row_tenant()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'CAPA Company Account cannot be changed.'; end if;
 if auth.uid() is not null and not (public.qualisphere_is_active_tenant_member(new.tenant_id) and public.qualisphere_tenant_module_enabled(new.tenant_id,'capa')) then raise exception 'CAPA Company Account access denied.'; end if;
 return new;
end;$$;

drop trigger if exists trg_01_enforce_capa_row_tenant on public.capas;
create trigger trg_01_enforce_capa_row_tenant before insert or update on public.capas for each row execute function public.qualisphere_enforce_capa_row_tenant();

alter table public.capas enable row level security;
drop policy if exists capas_company_boundary on public.capas;
create policy capas_company_boundary on public.capas as restrictive for all to authenticated
using(public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'capa'))
with check(public.qualisphere_is_active_tenant_member(tenant_id) and public.qualisphere_tenant_module_enabled(tenant_id,'capa'));

do $$ declare r text; begin
 foreach r in array array['capa_tasks','capa_approval_tasks','capa_gate_approvers','capa_workflow_returns'] loop
  execute format('alter table public.%I enable row level security',r);
  execute format('drop policy if exists %I on public.%I',r||'_company_boundary',r);
  execute format($p$create policy %I on public.%I as restrictive for all to authenticated using(exists(select 1 from public.capas c where c.id=%I.capa_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa'))) with check(exists(select 1 from public.capas c where c.id=%I.capa_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa')))$p$,r||'_company_boundary',r,r,r);
 end loop;
end$$;

drop policy if exists approval_tasks_capa_company_boundary on public.approval_tasks;
create policy approval_tasks_capa_company_boundary on public.approval_tasks as restrictive for all to authenticated
using(lower(entity_type)<>'capa' or exists(select 1 from public.capas c where c.id=approval_tasks.entity_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa')))
with check(lower(entity_type)<>'capa' or exists(select 1 from public.capas c where c.id=approval_tasks.entity_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa')));

drop policy if exists qms_decision_snapshots_capa_company_boundary on public.qms_decision_snapshots;
create policy qms_decision_snapshots_capa_company_boundary on public.qms_decision_snapshots as restrictive for all to authenticated
using(upper(module_code)<>'CAPA' or exists(select 1 from public.capas c where c.id=qms_decision_snapshots.record_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa')))
with check(upper(module_code)<>'CAPA' or exists(select 1 from public.capas c where c.id=qms_decision_snapshots.record_id and public.qualisphere_is_active_tenant_member(c.tenant_id) and public.qualisphere_tenant_module_enabled(c.tenant_id,'capa')));

create table if not exists public.capa_tenant_number_counters(tenant_id uuid primary key references public.tenants(id) on delete cascade,last_number bigint not null default 0 check(last_number>=0),updated_at timestamptz not null default now());
alter table public.capa_tenant_number_counters enable row level security;
revoke all on public.capa_tenant_number_counters from anon,authenticated;
insert into public.capa_tenant_number_counters(tenant_id,last_number,updated_at)
select tenant_id,coalesce(max(case when capa_number ~ '^CAPA[0-9]+$' then substring(capa_number from 5)::bigint else 0 end),0),now() from public.capas group by tenant_id
on conflict(tenant_id) do update set last_number=greatest(public.capa_tenant_number_counters.last_number,excluded.last_number),updated_at=now();

create or replace function public.generate_capa_number()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$ declare v_next bigint; begin
 if new.capa_number is not null and btrim(new.capa_number)<>'' then return new; end if;
 if new.tenant_id is null then raise exception 'Company Account is required before a CAPA number can be generated.'; end if;
 insert into public.capa_tenant_number_counters(tenant_id,last_number,updated_at) values(new.tenant_id,1,now())
 on conflict(tenant_id) do update set last_number=public.capa_tenant_number_counters.last_number+1,updated_at=now() returning last_number into v_next;
 new.capa_number:='CAPA'||lpad(v_next::text,7,'0'); return new;
end;$$;

drop trigger if exists trg_set_capa_number on public.capas;
drop trigger if exists trg_capa_number on public.capas;
drop trigger if exists trg_02_capa_number on public.capas;
create trigger trg_02_capa_number before insert on public.capas for each row execute function public.generate_capa_number();
create unique index if not exists uq_capas_tenant_capa_number on public.capas(tenant_id,capa_number) where capa_number is not null;
