import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiServer } from './index.mjs';

async function fixture(t, options = {}) {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'teachtrace-api-'));
  const server = createApiServer({ env: {}, dataDirectory, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await server.closeVoiceSessions();
    await new Promise(resolve => server.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  });
  const post = (path, payload, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  return { base, post, dataDirectory };
}

test('unconfigured voice refuses to connect and status does not invent readiness', async t => {
  const { base, post } = await fixture(t);
  const status = await (await fetch(`${base}/api/integrations/status`)).json();
  assert.equal(status.available, true);
  assert.equal(status.configured, false);
  assert.equal(status.liveVerified, false);
  const start = await post('/api/voice/start', {});
  assert.equal(start.status, 503);
  const rejected = await post('/api/episodes', { title: 'forbidden' }, { Origin: 'https://untrusted.example' });
  assert.equal(rejected.status, 403);
});

test('episode records persist without deriving file paths from user input', async t => {
  const { base, post, dataDirectory } = await fixture(t);
  const response = await post('/api/episodes', { id: '../../outside', title: 'Blue block transfer', frames: [{ simTime: 1 }] }, { Origin: 'http://127.0.0.1:5189' });
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.saved, true);
  assert.match(saved.id, /^[a-f\d-]{36}$/);
  const files = await readdir(dataDirectory);
  assert.equal(files.length, 1);
  const record = JSON.parse(await readFile(join(dataDirectory, files[0]), 'utf8'));
  assert.equal(record.episode.title, 'Blue block transfer');
  const list = await (await fetch(`${base}/api/episodes`)).json();
  assert.equal(list.episodes[0].title, 'Blue block transfer');
  assert.equal((await post('/api/episodes', [])).status, 400);
});

test('real adapter payload uses a private callback and waits for simulator acknowledgment', async t => {
  const fakeEnv = {
    AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
    AGORA_CUSTOMER_ID: 'test-customer', AGORA_CUSTOMER_SECRET: 'test-secret',
    MURF_API_KEY: 'test-murf', LLM_API_KEY: 'test-llm', PUBLIC_API_BASE_URL: 'https://callback.example',
  };
  let providerPayload;
  const providerFetch = async (url, request) => {
    if (url.endsWith('/join')) {
      providerPayload = JSON.parse(request.body);
      return new Response(JSON.stringify({ agent_id: 'test-agent-id' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
  const { base, post } = await fixture(t, { env: fakeEnv, fetchImpl: providerFetch });
  const start = await post('/api/voice/start', { world: { simTime: 0 } });
  assert.equal(start.status, 201);
  const session = await start.json();
  assert.equal(typeof session.token, 'string');
  assert.equal(JSON.stringify(session).includes('test-secret'), false);
  const commandTool = providerPayload.properties.llm.tools[1];
  const toolPath = new URL(commandTool.server.url).pathname;
  assert.equal((await post(toolPath, { command: 'stop', toolCallId: 'unauthorized' })).status, 401);
  const abort = new AbortController();
  const stream = await fetch(`${base}/api/voice/events?sessionId=${session.sessionId}`, { signal: abort.signal });
  const reader = stream.body.getReader();
  await reader.read(); // ready event proves that the browser bridge is connected
  let resolved = false;
  const outcome = post(toolPath, { command: 'Move red to tray A', toolCallId: 'call-1' }, commandTool.server.headers).then(async response => {
    resolved = true;
    assert.equal(response.status, 200);
    return response.json();
  });
  const next = new TextDecoder().decode((await reader.read()).value);
  const instruction = JSON.parse(next.match(/data: (.+)/)[1]);
  assert.equal(instruction.command, 'Move red to tray A');
  assert.equal(resolved, false);
  const ack = await post('/api/voice/ack', { sessionId: session.sessionId, commandId: instruction.id, result: { completed: true, summary: 'Verified red in tray A' } });
  assert.equal(ack.status, 200);
  assert.equal((await outcome).summary, 'Verified red in tray A');
  // Same provider tool ID returns its outcome without executing a second motion.
  const duplicate = await post(toolPath, { command: 'Move red to tray A', toolCallId: 'call-1' }, commandTool.server.headers);
  assert.equal((await duplicate.json()).completed, true);
  // Preparing a plan is a valid exchange, not a failed HTTP tool invocation.
  const planning = post(toolPath, { command: 'Move blue to tray B', toolCallId: 'call-2' }, commandTool.server.headers);
  const planningEvent = new TextDecoder().decode((await reader.read()).value);
  const planningInstruction = JSON.parse(planningEvent.match(/data: (.+)/)[1]);
  await post('/api/voice/ack', { sessionId: session.sessionId, commandId: planningInstruction.id, result: { completed: false, summary: 'Plan awaits operator approval.' } });
  const planned = await planning;
  assert.equal(planned.status, 200);
  assert.equal((await planned.json()).completed, false);
  abort.abort();
  await post('/api/voice/stop', { sessionId: session.sessionId });
});

test('progress narration uses documented non-interrupting TTS with session and length/rate limits', async t => {
  const fakeEnv = {
    AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
    AGORA_CUSTOMER_ID: 'test-customer', AGORA_CUSTOMER_SECRET: 'test-secret',
    MURF_API_KEY: 'test-murf', LLM_API_KEY: 'test-llm', PUBLIC_API_BASE_URL: 'https://callback.example',
  };
  const spokenRequests = [];
  const providerFetch = async (url, request) => {
    if (url.endsWith('/join')) return new Response(JSON.stringify({ agent_id: 'test-agent-id' }), { status: 200 });
    if (url.endsWith('/speak')) spokenRequests.push({ url, body: JSON.parse(request.body) });
    return new Response('{}', { status: 200 });
  };
  const { post } = await fixture(t, { env: fakeEnv, fetchImpl: providerFetch });
  const missing = await post('/api/voice/announce', { sessionId: 'unknown', text: 'Moving.' });
  assert.equal(missing.status, 404);
  assert.equal(spokenRequests.length, 0);
  const session = await (await post('/api/voice/start', {})).json();
  const tooLong = await post('/api/voice/announce', { sessionId: session.sessionId, text: '界'.repeat(200) });
  assert.equal(tooLong.status, 400); // 200 characters, but 600 UTF-8 bytes
  const response = await post('/api/voice/announce', { sessionId: session.sessionId, text: 'Red block placed in tray A.' });
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.spoken, true);
  assert.equal(result.accepted, true);
  assert.equal(result.queued, true);
  assert.equal(result.playbackVerified, false);
  assert.equal(spokenRequests.length, 1);
  assert.match(spokenRequests[0].url, /\/agents\/test-agent-id\/speak$/);
  assert.deepEqual(spokenRequests[0].body, {
    text: 'Red block placed in tray A.', priority: 'APPEND', interruptable: true,
  });
  const duplicate = await post('/api/voice/announce', { sessionId: session.sessionId, text: 'Red block placed in tray A.' });
  assert.equal((await duplicate.json()).suppressed, true);
  assert.equal(spokenRequests.length, 1);
  await post('/api/voice/stop', { sessionId: session.sessionId });
});
