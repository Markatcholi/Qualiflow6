-- QualiSphere tenant timezone foundation
-- Stores an IANA timezone per Company Account while keeping database timestamps in UTC.

alter table public.company_settings
  add column if not exists timezone text;

update public.company_settings
set timezone = 'America/Chicago'
where timezone is null or btrim(timezone) = '';

alter table public.company_settings
  alter column timezone set default 'America/Chicago';

alter table public.company_settings
  alter column timezone set not null;

comment on column public.company_settings.timezone is
  'IANA timezone used to render user-facing workflow, approval, task, audit, and report timestamps for the tenant. Canonical database timestamps remain UTC.';
