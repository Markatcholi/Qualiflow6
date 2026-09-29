alter table public.audits
  add column if not exists lead_auditor_email text;

comment on column public.audits.lead_auditor_email is
  'QualiSphere user email designated to receive audit finding verification tasks.';
