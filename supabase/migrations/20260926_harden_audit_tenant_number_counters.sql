-- Harden tenant-specific Audit numbering counter
alter table public.audit_tenant_number_counters enable row level security;

revoke all privileges on table public.audit_tenant_number_counters from anon;
revoke all privileges on table public.audit_tenant_number_counters from authenticated;

-- No browser-facing RLS policies are intentionally created.
-- Audit numbers are generated through the SECURITY DEFINER numbering function
-- invoked by the Audit numbering trigger.
