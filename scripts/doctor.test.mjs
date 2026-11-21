import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnostics, checkLocalHealth, runDoctor } from './doctor.mjs';

const valid = () => ({
  AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
  AGORA_CUSTOMER_ID: 'customer-private-sentinel', AGORA_CUSTOMER_SECRET: 'rest-private-sentinel',
  MURF_API_KEY: 'murf-private-sentinel', LLM_API_KEY: 'llm-private-sentinel',
  PUBLIC_API_BASE_URL: 'https://callback-origin-sentinel.example',
});

test('doctor reports missing fields without claiming live readiness', () => {
  const report = diagnostics({});
  assert.equal(report.ready, false);
  assert.equal(report.liveVerified, false);
  assert.equal(report.missing.length, 5);
  assert.deepEqual(report.invalid, []);
});

test('optional REST account credentials do not block certificate-based readiness', () => {
  const env = valid();
  delete env.AGORA_CUSTOMER_ID;
  delete env.AGORA_CUSTOMER_SECRET;
  const report = diagnostics(env);
  assert.equal(report.ready, true);
  assert.deepEqual(report.missing, []);
  assert.equal(report.checks.find(check => check.name === 'AGORA_CUSTOMER_ID').status, 'optional-unset');
  assert.equal(diagnostics({ ...env, AGORA_CUSTOMER_ID: 'partial-private-sentinel' }).ready, true);
});

test('doctor checks Agora formats and a nonloopback HTTPS origin', () => {
  const report = diagnostics(valid());
  assert.equal(report.ready, true);
  assert.equal(report.liveVerified, false);
  assert.equal(report.checks.find(check => check.name === 'MURF_API_KEY').valid, null);
  const wrong = diagnostics({ ...valid(), AGORA_APP_ID: 'wrong', AGORA_APP_CERTIFICATE: 'g'.repeat(32) });
  assert.deepEqual(wrong.invalid, ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE']);
  for (const url of ['http://callback.example', 'https://localhost', 'https://127.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://user:password@callback.example', 'https://callback.example/api', 'https://callback.example?secret=value']) {
    assert.equal(diagnostics({ ...valid(), PUBLIC_API_BASE_URL: url }).ready, false);
  }
});

test('no supplied credential or URL value appears in the serialized report or CLI output', async () => {
  const env = valid();
  const output = [];
  await runDoctor({ env, write: line => output.push(line) });
  const serialized = JSON.stringify(diagnostics(env)) + output.join('\n');
  for (const value of Object.values(env)) assert.equal(serialized.includes(value), false);
  const invalidSecret = 'malformed-secret-never-echo-me';
  assert.equal(JSON.stringify(diagnostics({ ...env, AGORA_APP_ID: invalidSecret })).includes(invalidSecret), false);
});

test('--check fails missing configuration; normal diagnostics remain useful without keys', async () => {
  const write = () => {};
  assert.equal(await runDoctor({ env: {}, args: [], write }), 0);
  assert.equal(await runDoctor({ env: {}, args: ['--check'], write }), 1);
  assert.equal(await runDoctor({ env: valid(), args: ['--check'], write }), 0);
  assert.equal(await runDoctor({ env: {}, args: ['--unknown-secret-value'], write }), 2);
});

test('health checks use only loopback GETs and never echo response payloads or exception details', async () => {
  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    return url.endsWith('/status')
      ? new Response(JSON.stringify({ available: true, configured: false, secret: 'payload-private-sentinel' }))
      : new Response('<title>RoboTrace</title>');
  };
  const result = await checkLocalHealth({ FRONTEND_ORIGIN: 'https://untrusted.example', API_PORT: '8787' }, fetchImpl);
  assert.equal(result.every(item => item.reachable && item.recognized), true);
  assert.equal(requested.every(item => item.url.startsWith('http://127.0.0.1:') && item.options.method === 'GET' && item.options.redirect === 'error'), true);
  assert.equal(JSON.stringify(result).includes('payload-private-sentinel'), false);
  const failed = await checkLocalHealth({}, async () => { throw new Error('secret-exception-sentinel'); });
  assert.equal(failed.every(item => !item.reachable), true);
  assert.equal(JSON.stringify(failed).includes('secret-exception-sentinel'), false);
  const code = await runDoctor({ env: valid(), args: ['--check', '--health'], fetchImpl: async () => { throw new Error('offline'); }, write: () => {} });
  assert.equal(code, 1);
});
