-- External QA-approved certification evidence; QualiSphere does not issue qualifications.
-- Existing issued records, if any, must be reconciled with approved evidence before operational use.
alter table public.training_certifications
  alter column expires_on drop not null;
alter table public.training_certifications
  add column if not exists evidence_storage_path text,
  add column if not exists evidence_file_name text,
  add column if not exists qa_approved_by text,
  add column if not exists qa_approved_on date,
  add column if not exists training_requirements_reference text,
  add column if not exists recorded_at timestamptz not null default now();
-- New records must reference the actual approved QA form stored privately.
alter table public.training_certifications
  add constraint certification_requires_approved_evidence
  check (
    evidence_storage_path is not null and length(btrim(evidence_storage_path)) > 0
    and evidence_file_name is not null and length(btrim(evidence_file_name)) > 0
    and qa_approved_by is not null and length(btrim(qa_approved_by)) > 0
    and qa_approved_on is not null
  ) not valid;
-- NOT VALID protects preexisting records; all new/updated records must meet this check.
alter table public.training_certifications
  add constraint certification_expiry_after_approval
  check (qa_approved_on is null or expires_on is null or expires_on >= qa_approved_on) not valid;
comment on table public.training_certifications is
  'Evidence registry for externally QA-approved employee certifications; QualiSphere does not issue or approve certifications. Renewals are separate historical records.';
comment on column public.training_certifications.evidence_storage_path is
  'Private storage object path of the actual QA-approved certification form; never a public URL.';
comment on column public.training_certifications.expires_on is
  'Nullable for certifications without a defined expiration; no expiry must be supported in UI.';
