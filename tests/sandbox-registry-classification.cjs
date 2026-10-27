const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('lib/sandboxRegistry.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, { exports: exportsObject });
const classify = exportsObject.isQualiSphereInternalSandbox;
const registry = new Set(['internal-id', 'customer-id']);
const internal = { id: 'internal-id', tenant_code: 'QUALISPHERE-SANDBOX' };
const customer = { id: 'customer-id', tenant_code: 'BETA-CUSTOMER' };

assert.equal(classify(true, internal, registry), true);
assert.equal(classify(true, customer, registry), false);
assert.equal(classify(false, internal, registry), false);
assert.equal(classify(true, { ...internal, id: 'unregistered-id' }, registry), false);
console.log('Sandbox registry classification passed.');
