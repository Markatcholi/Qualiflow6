// Proposed subscription scope only. Module readiness and authorization are
// enforced separately; these defaults do not enable any module.
export const CUSTOMER_BETA_MODULES = [
  'controlled_documents', 'training', 'ncmr', 'equipment',
] as const;

export function suggestedSandboxModules(
  owner: 'internal' | 'customer',
  catalog: ReadonlyArray<{ code: string }>,
): string[] {
  const available = new Set(catalog.map((module) => module.code));
  if (owner === 'internal') return [...available];
  const missing = CUSTOMER_BETA_MODULES.filter((code) => !available.has(code));
  if (missing.length) throw new Error(`Beta modules missing from catalog: ${missing.join(', ')}`);
  return [...CUSTOMER_BETA_MODULES];
}
