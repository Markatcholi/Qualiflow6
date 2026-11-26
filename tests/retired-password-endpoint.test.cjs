const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require('node:path').join(__dirname, '../app/api/admin/set-user-password/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

for (const authorization of [undefined, 'Bearer invalid', 'Bearer example-admin-session']) {
  test(`retired endpoint rejects requests (${authorization || 'anonymous'}) without accessing credentials or the body`, async () => {
    const exports = {};
    vm.runInNewContext(compiled, {
      exports, Response,
      require() { throw new Error('Retired endpoint must not load privileged clients'); },
      process: { get env() { throw new Error('Retired endpoint must not read server secrets'); } },
    });
    const request = {
      headers: new Headers(authorization ? { authorization } : {}),
      json() { throw new Error('Retired endpoint must not read passwords'); },
    };
    const response = await exports.POST(request);
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match((await response.json()).error, /Direct password setting is disabled/);
  });
}
