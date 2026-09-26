-- Equipment / OOS-OOT integration security
-- Cross-module relationship is available only when the tenant has both modules enabled.
alter table public.equipment_oos_oot_links enable row level security;

drop policy if exists "qualisphere_equipment_authenticated_access" on public.equipment_oos_oot_links;
drop policy if exists "qualisphere_equipment_tenant_boundary" on public.equipment_oos_oot_links;
drop policy if exists "equipment_oos_oot_links_module_boundary" on public.equipment_oos_oot_links;

create policy "equipment_oos_oot_links_module_boundary"
on public.equipment_oos_oot_links
for all
to authenticated
using (
  public.is_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'equipment')
  and public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot')
)
with check (
  public.is_tenant_member(tenant_id)
  and public.qualisphere_tenant_module_enabled(tenant_id, 'equipment')
  and public.qualisphere_tenant_module_enabled(tenant_id, 'oos_oot')
);
