// The bootstrap code identifies QualiSphere's existing internal sandbox.
// This is a presentation classification, not an access-control decision.
export const INTERNAL_SANDBOX_CODE = "QUALISPHERE-SANDBOX";

export function isQualiSphereInternalSandbox(
  sandbox: boolean,
  tenant: { id: string; tenant_code: string },
  registeredIds: ReadonlySet<string>,
): boolean {
  return sandbox && tenant.tenant_code === INTERNAL_SANDBOX_CODE && registeredIds.has(tenant.id);
}
