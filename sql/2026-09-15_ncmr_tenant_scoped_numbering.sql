-- QualiSphere NCMR Tenant-Scoped Numbering
-- Date: 2026-09-15
-- Purpose: Preserve QualiSphere Internal legacy numbering while giving every customer Company Account an independent NCMR sequence.

create table if not exists public.ncmr_tenant_number_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ncmr_tenant_number_counters enable row level security;
revoke all on table public.ncmr_tenant_number_counters from anon, authenticated;

-- Seed from existing tenant-owned NCMRs. Internal retains its existing sequence position.
insert into public.ncmr_tenant_number_counters (tenant_id,last_number,updated_at)
select n.tenant_id,
       coalesce(max(case when n.ncmr_number ~ '^NCMR[0-9]+$' then substring(n.ncmr_number from 5)::bigint else 0 end),0),
       now()
from public.ncmrs n
where n.tenant_id is not null
group by n.tenant_id
on conflict (tenant_id) do update
set last_number=greatest(public.ncmr_tenant_number_counters.last_number,excluded.last_number),updated_at=now();

-- Controlled correction for a customer tenant that has exactly one validation NCMR.
-- Existing Internal records are excluded and never renumbered.
alter table public.ncmrs disable trigger trg_01_enforce_ncmr_row_tenant;
with customer_first as (
  select n.id,n.tenant_id,
         row_number() over(partition by n.tenant_id order by n.created_at,n.id) rn,
         count(*) over(partition by n.tenant_id) tenant_count
  from public.ncmrs n
  join public.tenants t on t.id=n.tenant_id
  where coalesce(t.is_internal,false)=false
)
update public.ncmrs n
set ncmr_number='NCMR0000001'
from customer_first c
where n.id=c.id and c.tenant_count=1 and c.rn=1;
alter table public.ncmrs enable trigger trg_01_enforce_ncmr_row_tenant;

-- Re-seed after the controlled correction.
insert into public.ncmr_tenant_number_counters(tenant_id,last_number,updated_at)
select n.tenant_id,
       coalesce(max(case when n.ncmr_number ~ '^NCMR[0-9]+$' then substring(n.ncmr_number from 5)::bigint else 0 end),0),now()
from public.ncmrs n
where n.tenant_id is not null
group by n.tenant_id
on conflict(tenant_id) do update
set last_number=excluded.last_number,updated_at=now();

create or replace function public.generate_ncmr_number()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_next bigint;
begin
  if new.ncmr_number is not null and btrim(new.ncmr_number)<>'' then
    return new;
  end if;

  if new.tenant_id is null then
    raise exception 'Company Account is required before an NCMR number can be generated.';
  end if;

  insert into public.ncmr_tenant_number_counters(tenant_id,last_number,updated_at)
  values(new.tenant_id,1,now())
  on conflict(tenant_id) do update
     set last_number=public.ncmr_tenant_number_counters.last_number+1,
         updated_at=now()
  returning last_number into v_next;

  new.ncmr_number:='NCMR'||lpad(v_next::text,7,'0');
  return new;
end;
$$;

-- Remove both legacy global numbering paths. Tenant resolution is trigger 00;
-- tenant-aware numbering is trigger 02 and therefore runs after tenant resolution.
drop trigger if exists trg_set_ncmr_number on public.ncmrs;
drop trigger if exists trg_ncmr_number on public.ncmrs;
drop trigger if exists trg_02_ncmr_number on public.ncmrs;
create trigger trg_02_ncmr_number
before insert on public.ncmrs
for each row execute function public.generate_ncmr_number();

-- Same NCMR number may exist in separate companies, but never twice in one company.
create unique index if not exists uq_ncmrs_tenant_ncmr_number
on public.ncmrs(tenant_id,ncmr_number)
where tenant_id is not null and ncmr_number is not null;
