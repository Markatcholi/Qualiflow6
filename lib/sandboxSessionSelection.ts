type RpcResult = { data: unknown; error: unknown };
type Rpc = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;

export async function readSandboxSelection(rpc: Rpc): Promise<string | null> {
  const result = await rpc('sandbox_current_session_company');
  if (result.error || (result.data !== null && typeof result.data !== 'string')) {
    throw new Error('Sandbox company access could not be verified. Please try again.');
  }
  return result.data as string | null;
}

export async function chooseSandboxSelection(rpc: Rpc, tenantId: string): Promise<void> {
  const result = await rpc('sandbox_select_session_company', { p_tenant: tenantId });
  if (result.error || result.data !== tenantId || await readSandboxSelection(rpc) !== tenantId) {
    throw new Error('Sandbox company access could not be verified. Please try again.');
  }
}
