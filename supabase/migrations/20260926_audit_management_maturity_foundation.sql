-- Audit Management maturity foundation
alter table public.audits
  add column if not exists audit_objectives text,
  add column if not exists audit_criteria text,
  add column if not exists lead_auditor text,
  add column if not exists audit_team text,
  add column if not exists scheduled_start_date date,
  add column if not exists scheduled_end_date date,
  add column if not exists actual_start_date date,
  add column if not exists actual_end_date date,
  add column if not exists execution_notes text;

alter table public.audit_findings
  add column if not exists finding_owner text,
  add column if not exists response_due_date date,
  add column if not exists auditee_response text,
  add column if not exists correction text,
  add column if not exists corrective_action text,
  add column if not exists verification_notes text,
  add column if not exists verified_by text,
  add column if not exists verified_at timestamptz;

comment on column public.audit_findings.finding_severity is
  'Audit finding classification. Controlled values: observation, minor, major.';

alter table public.audit_findings drop constraint if exists audit_findings_finding_severity_check;
alter table public.audit_findings add constraint audit_findings_finding_severity_check
  check (finding_severity is null or finding_severity in ('observation','minor','major'));