const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('lib/sandboxSessionSelection.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exported = {};
vm.runInNewContext(code, { exports: exported });

(async () => {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push([name, args]);
    return { data: 'company-a', error: null };
  };
  await exported.chooseSandboxSelection(rpc, 'company-a');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'sandbox_select_session_company');
  assert.equal(calls[0][1].p_tenant, 'company-a');
  assert.equal(calls[1][0], 'sandbox_current_session_company');
  await assert.rejects(exported.chooseSandboxSelection(async () => ({ data: null, error: { message: 'denied' } }), 'company-a'));
  await assert.rejects(exported.chooseSandboxSelection(async name => ({ data: name === 'sandbox_select_session_company' ? 'company-a' : 'company-b', error: null }), 'company-a'));
  await assert.rejects(exported.readSandboxSelection(async () => ({ data: null, error: { message: 'missing RPC' } })));
  assert.equal(await exported.readSandboxSelection(async () => ({ data: null, error: null })), null);
  console.log('Sandbox session selection verification passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
