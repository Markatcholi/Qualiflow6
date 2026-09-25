create table if not exists public.audit_tenant_number_counters (
  tenant_id uuid not null references public.tenants(id),
  record_year integer not null,
  last_number integer not null default 0,
  primary key (tenant_id, record_year)
);

insert into public.audit_tenant_number_counters (tenant_id, record_year, last_number)
select tenant_id, extract(year from coalesce(audit_date, created_at::date))::integer, count(*)::integer
from public.audits
group by tenant_id, extract(year from coalesce(audit_date, created_at::date))::integer
on conflict (tenant_id, record_year)
do update set last_number = excluded.last_number;

create or replace function public.generate_audit_number(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  if p_tenant_id is null then
    raise exception 'Tenant is required to generate an audit number.';
  end if;

  insert into public.audit_tenant_number_counters (tenant_id, record_year, last_number)
  values (p_tenant_id, v_year, 1)
  on conflict (tenant_id, record_year)
  do update set last_number = public.audit_tenant_number_counters.last_number + 1
  returning last_number into v_next;

  return 'AUD-' || v_year || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create or replace function public.set_audit_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.audit_number is null then
    new.audit_number := public.generate_audit_number(new.tenant_id);
  end if;
  return new;
end;
$$;
