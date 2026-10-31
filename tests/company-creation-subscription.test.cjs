const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const page = fs.readFileSync(path.join(__dirname, '../app/admin/companies/page.tsx'), 'utf8');
const start = page.indexOf('  const saveSubscriptionModules =');
const end = page.indexOf('  const createTenant', start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(page.slice(start, end) + '\n globalThis.save = saveSubscriptionModules;', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

function setup({ token = 'test-session', sessionError = null, ok = true, result = {} } = {}) {
  const requests = [];
  const context = {
    selectedModules: ['controlled_documents', 'training'],
    supabase: {
      auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null }, error: sessionError }) },
      from() { throw new Error('Subscription writes must not use the browser database client'); },
    },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok, json: async () => result }; },
  };
  vm.runInNewContext(compiled, context);
  return { context, requests };
}

test('creation submits selected modules and the created company ID to the authorized API', async () => {
  const { context, requests } = setup();
  await context.save('created-company');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/platform/company-subscription');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-session');
  assert.deepEqual(JSON.parse(requests[0].options.body), { tenantId: 'created-company', enabledModuleCodes: ['controlled_documents', 'training'] });
});

test('missing session prevents the subscription request', async () => {
  const { context, requests } = setup({ token: null });
  await assert.rejects(context.save('created-company'), /session has expired/);
  assert.equal(requests.length, 0);
});

test('session errors prevent use of a returned token', async () => {
  const { context, requests } = setup({ sessionError: { message: 'failed' } });
  await assert.rejects(context.save('created-company'), /session has expired/);
  assert.equal(requests.length, 0);
});

test('API failures reach the existing partial-creation error handler', async () => {
  const { context } = setup({ ok: false, result: { error: 'Platform Administrator access required.' } });
  await assert.rejects(context.save('created-company'), /Platform Administrator access required/);
});
