-- Training governance settings: per-tenant configurable policy, no automated escalations enabled by default.
create table if not exists public.training_compliance_settings (
 tenant_id uuid primary key,
 warning_overdue_days integer not null default 7 check (warning_overdue_days between 0 and 365),
 critical_overdue_days integer not null default 30 check (critical_overdue_days between 1 and 730),
 manager_escalation_enabled boolean not null default false,
 manager_escalation_after_days integer not null default 14 check (manager_escalation_after_days between 1 and 365),
 audit_snapshot_enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint training_threshold_order check (critical_overdue_days > warning_overdue_days)
);
alter table public.training_compliance_settings enable row level security;
revoke all on public.training_compliance_settings from anon;
grant select, insert, update on public.training_compliance_settings to authenticated;
drop policy if exists training_settings_coordinator_select on public.training_compliance_settings;
create policy training_settings_coordinator_select on public.training_compliance_settings
 for select to authenticated using (
  tenant_id = (select public.qualisphere_resolve_training_tenant())
  and (select public.qualisphere_training_is_coordinator(tenant_id))
 );
drop policy if exists training_settings_coordinator_insert on public.training_compliance_settings;
create policy training_settings_coordinator_insert on public.training_compliance_settings
 for insert to authenticated with check (
  tenant_id = (select public.qualisphere_resolve_training_tenant())
  and (select public.qualisphere_training_is_coordinator(tenant_id))
 );
drop policy if exists training_settings_coordinator_update on public.training_compliance_settings;
create policy training_settings_coordinator_update on public.training_compliance_settings
 for update to authenticated
 using (tenant_id = (select public.qualisphere_resolve_training_tenant()) and (select public.qualisphere_training_is_coordinator(tenant_id)))
 with check (tenant_id = (select public.qualisphere_resolve_training_tenant()) and (select public.qualisphere_training_is_coordinator(tenant_id)));
comment on table public.training_compliance_settings is 'Tenant-scoped training governance policy. Manager escalation and audit snapshots remain disabled until separate reviewed implementations are deployed.';
