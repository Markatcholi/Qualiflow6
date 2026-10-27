// Subscription planning only. This helper grants no access and is not wired to
// the existing platform administration subscription workflow yet.

export function suggestedSandboxModules(
  owner: 'internal' | 'customer',
  catalog: ReadonlyArray<{ code: string }>,
  customerSelections: readonly string[] = [],
): string[] {
  const available = new Set(catalog.map((module) => module.code));
  if (owner === 'internal') return [...available];
  const unknown = customerSelections.filter((code) => !available.has(code));
  if (unknown.length) throw new Error(`Unknown modules: ${unknown.join(', ')}`);
  return [...new Set(customerSelections)];
}
