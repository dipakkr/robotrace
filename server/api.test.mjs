import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiServer } from './index.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { tsImport } from 'tsx/esm/api';

const { getEnvironment } = await tsImport('../src/sim/environments.ts', import.meta.url);
const { planCommand, advanceWorld } = await tsImport('../src/sim/engine.ts', import.meta.url);

function nativeRecording(initialWorld, command, outcome = 'completed') {
  let world = structuredClone(initialWorld);
  if (outcome === 'failed') world.objects[0].position = [1.92, world.objects[0].position[1], -0.95];
  const initial = structuredClone(world);
  const samples = [{ time: 0, world: structuredClone(world) }];
  const events = [{ time: 0, label: command, kind: 'command' }];
  let completedActions = 0;
  for (const step of planCommand(command, world).steps) {
    let failed = false;
    for (let tick = 0; tick < 100; tick++) {
      const result = advanceWorld(world, step, 1); world = result.world;
      if (result.error) { events.push({ time: world.simTime, label: result.error, kind: 'error' }); failed = true; break; }
      if (result.done) { completedActions++; events.push({ time: world.simTime, label: step.label, kind: 'success' }); break; }
    }
    samples.push({ time: world.simTime, world: structuredClone(world) });
    if (failed) break;
  }
  return { schema: 'teachtrace.episode.v1', id: 'native-api-test', title: initial.customTask?.title ?? 'Native lab test', createdAt: '2026-11-21T12:00:00Z',
    status: 'approved', outcome, initialWorld: initial, command, completedActions, duration: world.simTime, samples, events };
}

const configuredEnv = {
  AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
  MURF_API_KEY: 'private-murf-sentinel', LLM_API_KEY: 'private-llm-sentinel', PUBLIC_API_BASE_URL: 'https://callback.example',
};
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

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
  const start = await post('/api/voice/start', { world: { simTime: 0, environmentId: 'lab' } });
  assert.equal(start.status, 201);
  const session = await start.json();
  assert.equal(typeof session.token, 'string');
  assert.equal(JSON.stringify(session).includes('test-secret'), false);
  const commandTool = providerPayload.properties.llm.tools[1];
  const contextTool = providerPayload.properties.llm.tools[0];
  const context = await (await post(new URL(contextTool.server.url).pathname, {}, contextTool.server.headers)).json();
  assert.equal(context.assignment.id, 'lab');
  assert.equal(context.assignment.status, 'assigned');
  assert.equal(context.taskGuide.id, 'TT-LAB-001');
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

test('voice lifecycle uses certificate REST auth without exposing server auth tokens to the browser', async t => {
  const fakeEnv = {
    AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
    MURF_API_KEY: 'private-murf-sentinel', LLM_API_KEY: 'private-llm-sentinel', PUBLIC_API_BASE_URL: 'https://callback.example',
  };
  const headers = [];
  const paths = [];
  const providerFetch = async (url, request) => {
    headers.push(request.headers.Authorization);
    paths.push(url);
    return new Response(JSON.stringify(url.endsWith('/join') ? { agent_id: 'certificate-agent' } : {}));
  };
  const { base, post } = await fixture(t, { env: fakeEnv, fetchImpl: providerFetch });
  const status = await (await fetch(`${base}/api/integrations/status`)).json();
  assert.equal(status.configured, true);
  const start = await post('/api/voice/start', {});
  assert.equal(start.status, 201);
  const session = await start.json();
  const announce = await post('/api/voice/announce', { sessionId: session.sessionId, text: 'Ready.' });
  assert.equal(announce.status, 202);
  const stop = await post('/api/voice/stop', { sessionId: session.sessionId });
  assert.equal(stop.status, 200);
  assert.deepEqual(paths.map(path => path.split('/').pop()), ['join', 'speak', 'leave']);
  assert.ok(headers.every(header => header.startsWith('agora token=007')));
  const publicResponses = JSON.stringify([status, session, await announce.json(), await stop.json()]);
  for (const value of [...headers, fakeEnv.AGORA_APP_CERTIFICATE, fakeEnv.MURF_API_KEY, fakeEnv.LLM_API_KEY]) {
    assert.equal(publicResponses.includes(value), false);
  }
});

test('reset is idempotent, blocks new starts until remote cleanup settles, and permits the next session', async t => {
  const leaving = deferred();
  const finishLeave = deferred();
  let joins = 0;
  let leaves = 0;
  const providerFetch = async url => {
    if (url.endsWith('/join')) return Response.json({ agent_id: `agent-${++joins}` });
    if (url.endsWith('/leave')) { leaves++; leaving.resolve(); await finishLeave.promise; }
    return Response.json({});
  };
  const { post } = await fixture(t, { env: configuredEnv, fetchImpl: providerFetch });
  assert.equal((await post('/api/voice/start', {})).status, 201);
  const reset = post('/api/voice/reset', {});
  await leaving.promise;
  const duplicateReset = post('/api/voice/reset', {});
  assert.equal((await post('/api/voice/start', {})).status, 409);
  assert.equal(leaves, 1);
  finishLeave.resolve();
  assert.equal((await (await reset).json()).cleanupVerified, true);
  assert.equal((await (await duplicateReset).json()).reset, true);
  assert.equal((await post('/api/voice/start', {})).status, 201);
  assert.equal(joins, 2);
});

test('rejected concurrent starts cannot unlock the active join and reset retires a late-created agent', async t => {
  const joining = deferred();
  const finishJoin = deferred();
  const leaving = deferred();
  const finishLeave = deferred();
  let joins = 0;
  const retired = [];
  const providerFetch = async url => {
    if (url.endsWith('/join')) {
      joins++;
      if (joins === 1) { joining.resolve(); await finishJoin.promise; }
      return Response.json({ agent_id: `agent-${joins}` });
    }
    if (url.endsWith('/leave')) { retired.push(url); leaving.resolve(); await finishLeave.promise; }
    return Response.json({});
  };
  const { post } = await fixture(t, { env: configuredEnv, fetchImpl: providerFetch });
  const first = post('/api/voice/start', {});
  await joining.promise;
  assert.equal((await post('/api/voice/start', {})).status, 409);
  assert.equal((await post('/api/voice/start', {})).status, 409);
  assert.equal(joins, 1);
  const reset = post('/api/voice/reset', {});
  await delay(15); // Let the reset invalidate the still-blocked provider join.
  finishJoin.resolve();
  await leaving.promise;
  assert.match(retired[0], /agents\/agent-1\/leave$/);
  assert.equal((await post('/api/voice/start', {})).status, 409);
  finishLeave.resolve();
  assert.equal((await first).status, 409);
  assert.equal((await (await reset).json()).cleanupVerified, true);
  assert.equal((await post('/api/voice/start', {})).status, 201);
});

test('sessions with no initial SSE connection are retired after the startup grace', async t => {
  const retired = deferred();
  let leaves = 0;
  const providerFetch = async url => {
    if (url.endsWith('/join')) return Response.json({ agent_id: 'unconnected-agent' });
    if (url.endsWith('/leave')) { leaves++; retired.resolve(); }
    return Response.json({});
  };
  const { post } = await fixture(t, { env: configuredEnv, fetchImpl: providerFetch, voiceTimings: { startupGraceMs: 25 } });
  assert.equal((await post('/api/voice/start', {})).status, 201);
  await Promise.race([retired.promise, delay(1000).then(() => { throw new Error('Disconnected agent was not retired'); })]);
  assert.equal(leaves, 1);
  assert.equal((await post('/api/voice/start', {})).status, 201);
});

test('SSE response disconnects receive reconnect grace and reconnect cancels orphan cleanup', async t => {
  const retired = deferred();
  let leaves = 0;
  const providerFetch = async url => {
    if (url.endsWith('/join')) return Response.json({ agent_id: 'reconnect-agent' });
    if (url.endsWith('/leave')) { leaves++; retired.resolve(); }
    return Response.json({});
  };
  const { base, post } = await fixture(t, { env: configuredEnv, fetchImpl: providerFetch, voiceTimings: { startupGraceMs: 100, reconnectGraceMs: 60 } });
  const session = await (await post('/api/voice/start', {})).json();
  const firstAbort = new AbortController();
  const first = await fetch(`${base}/api/voice/events?sessionId=${session.sessionId}`, { signal: firstAbort.signal });
  await first.body.getReader().read();
  firstAbort.abort();
  await delay(15);
  const secondAbort = new AbortController();
  const second = await fetch(`${base}/api/voice/events?sessionId=${session.sessionId}`, { signal: secondAbort.signal });
  await second.body.getReader().read();
  await delay(110);
  assert.equal(leaves, 0, 'active SSE response must survive both cleanup deadlines');
  secondAbort.abort();
  await Promise.race([retired.promise, delay(1000).then(() => { throw new Error('Orphaned agent was not retired'); })]);
  assert.equal(leaves, 1);
});

test('reset closes pending tool outcomes and retires the browser stream', async t => {
  let providerPayload;
  const providerFetch = async (url, request) => {
    if (url.endsWith('/join')) { providerPayload = JSON.parse(request.body); return Response.json({ agent_id: 'pending-agent' }); }
    return Response.json({});
  };
  const { base, post } = await fixture(t, { env: configuredEnv, fetchImpl: providerFetch });
  const session = await (await post('/api/voice/start', {})).json();
  const stream = await fetch(`${base}/api/voice/events?sessionId=${session.sessionId}`);
  const reader = stream.body.getReader();
  await reader.read();
  const tool = providerPayload.properties.llm.tools[1];
  const pending = post(new URL(tool.server.url).pathname, { command: 'Move red to tray A', toolCallId: 'reset-pending' }, tool.server.headers);
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: command/);
  assert.equal((await post('/api/voice/reset', {})).status, 200);
  const outcome = await (await pending).json();
  assert.equal(outcome.completed, false);
  assert.match(outcome.error, /Voice session closed/);
  assert.equal((await reader.read()).done, true);
  assert.equal((await post('/api/voice/context', { sessionId: session.sessionId, world: {} })).status, 404);
});

function reviewedLabEpisode(outcome = 'completed') {
  return {
    ...nativeRecording(getEnvironment('lab').world(), 'Route the samples', outcome),
    task: { id: 'lab', acceptance: ['task-inventory', 'target-part-red', 'target-part-blue', 'target-part-green', 'controller-settled'].map(id => ({ id, name: id, passed: outcome === 'completed', detail: 'Recorded simulator check.' })) },
  };
}

test('reviewed API submission updates a retrievable assignment and report across API instances', async t => {
  const first = await fixture(t);
  const initial = await (await fetch(`${first.base}/api/assignments`)).json();
  assert.equal(initial.assignments.length, 3);
  assert.ok(initial.assignments.every(item => item.status === 'assigned'));
  const response = await first.post('/api/episodes', reviewedLabEpisode());
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.equal(receipt.saved, true);
  assert.equal(receipt.assignment.status, 'submitted');
  assert.equal(receipt.report.episodeId, receipt.id);
  assert.equal(receipt.report.accepted, true);
  const second = await fixture(t, { dataDirectory: first.dataDirectory });
  const assignment = await (await fetch(`${second.base}/api/assignments/lab`)).json();
  assert.deepEqual(assignment.latestReport, receipt.report);
  const report = await (await fetch(`${second.base}/api/reports/${receipt.report.id}`)).json();
  assert.deepEqual(report, receipt.report);
  assert.equal((await fetch(`${second.base}/api/assignments/unknown`)).status, 404);
  assert.equal((await fetch(`${second.base}/api/reports/not-a-report`)).status, 404);
  const failed = await (await first.post('/api/episodes', reviewedLabEpisode('failed'))).json();
  assert.equal(failed.assignment.status, 'submitted');
  assert.equal(failed.report.outcome, 'failed');
  assert.equal(failed.report.accepted, false);
  assert.equal(failed.report.acceptance.status, 'failed');
});

test('workflow commit failure refuses success and rolls back the episode file', async t => {
  const { base, post, dataDirectory } = await fixture(t);
  await writeFile(join(dataDirectory, '.assignments'), 'Blocks the workflow directory');
  const response = await post('/api/episodes', reviewedLabEpisode());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).saved, undefined);
  const episodes = await (await fetch(`${base}/api/episodes`)).json();
  assert.deepEqual(episodes.episodes, []);
  assert.deepEqual(await readdir(dataDirectory), ['.assignments']);
});

test('planner and scene APIs use explicit bounded provider calls and preserve candidate actions', async t => {
  const requests = [];
  const spec = {
    version: 1, title: 'Cup collection', baseEnvironmentId: 'kitchen', instruction: 'Place the cup in Serving tray',
    objects: [{ id: 'cup-1', label: 'Cup one', asset: 'cup', color: 'blue', slot: 0 }],
    assignments: [{ objectId: 'cup-1', destination: 'tray-a', unchanged: false }],
  };
  const fetchImpl = async (_url, options) => {
    const payload = JSON.parse(options.body);
    requests.push(payload);
    const value = payload.response_format.json_schema.name === 'teachtrace_scene_spec' ? spec : { steps: [{ objectId: 'part-green', destination: 'reject' }] };
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
  };
  const { base, post } = await fixture(t, { env: { ...configuredEnv, LLM_MODEL: 'gpt-4o-mini' }, fetchImpl });
  const models = await (await fetch(`${base}/api/planner/models`)).json();
  assert.deepEqual(models.models.map(model => model.id), ['gpt-4o-mini', 'gpt-4.1-mini']);
  assert.equal(requests.length, 0, 'listing model configuration must not make a provider call');
  const instruction = 'Route the samples';
  const world = { environmentId: 'lab', objects: [{ id: 'part-green', label: 'Reference sample', position: [-0.3, 0.9, 0.4], location: 'table' }] };
  const planResponse = await post('/api/planner/plan', { model: 'gpt-4o-mini', environmentId: 'lab', world, instruction });
  assert.equal(planResponse.status, 200);
  const plan = await planResponse.json();
  assert.deepEqual(plan.steps, [{ objectId: 'part-green', destination: 'reject' }]);
  assert.ok(Number.isFinite(plan.requestDurationMs));
  assert.equal(plan.instruction, instruction);
  assert.equal((await post('/api/planner/plan', { model: 'not-allowed', environmentId: 'lab', world, instruction })).status, 400);
  assert.equal(requests.length, 1);
  const draftResponse = await post('/api/scenes/draft', { prompt: 'One blue cup to serving tray', baseEnvironmentId: 'kitchen' });
  assert.equal(draftResponse.status, 200);
  const draft = await draftResponse.json();
  assert.deepEqual(draft.spec, spec);
  assert.equal(draft.source, 'llm-scene-draft');
  assert.equal(requests.length, 2);
  assert.equal(JSON.stringify([models, plan, draft]).includes(configuredEnv.LLM_API_KEY), false);
});

test('episode detail reopens the full stored native record and keeps UUID lookup isolated', async t => {
  const first = await fixture(t);
  const native = { ...reviewedLabEpisode(), id: '../../client-supplied-id', events: [{ t: 1, type: 'place' }] };
  const receipt = await (await first.post('/api/episodes', native)).json();
  const reopened = await fetch(`${first.base}/api/episodes/${receipt.id}`);
  assert.equal(reopened.status, 200);
  assert.deepEqual(await reopened.json(), { id: receipt.id, savedAt: receipt.savedAt, episode: native });
  assert.equal((await fetch(`${first.base}/api/episodes/not-a-uuid`)).status, 404);
  assert.equal((await fetch(`${first.base}/api/episodes/00000000-0000-0000-0000-000000000000`)).status, 404);
  const other = await fixture(t);
  assert.equal((await fetch(`${other.base}/api/episodes/${receipt.id}`)).status, 404);
});

test('voice retrieves an authored scene SOP and its submitted custom assignment report', async t => {
  const taskId = 'custom-11111111-2222-4333-8444-555555555555';
  const world = {
    ...getEnvironment('kitchen').world(),
    environmentId: 'custom', baseEnvironmentId: 'kitchen',
    objects: [{ ...getEnvironment('kitchen').world().objects[0], id: 'cup-one', label: 'Cup one' }, { ...getEnvironment('kitchen').world().objects[2], id: 'reference-one', label: 'Reference carrier' }],
    customTask: { id: taskId, title: 'Authored counter collection', instruction: 'Move Cup one to Serving tray and preserve Reference carrier', assignments: [
      { objectId: 'cup-one', destination: 'tray-a', unchanged: false }, { objectId: 'reference-one', destination: 'table', unchanged: true },
    ] }, sceneProvenance: { source: 'ai-draft', model: 'test-model' },
  };
  let providerPayload;
  const fetchImpl = async (url, request) => {
    if (url.endsWith('/join')) { providerPayload = JSON.parse(request.body); return Response.json({ agent_id: 'custom-scene-agent' }); }
    return Response.json({});
  };
  const { base, post } = await fixture(t, { env: configuredEnv, fetchImpl });
  const session = await (await post('/api/voice/start', { world })).json();
  const tool = providerPayload.properties.llm.tools[0];
  const contextPath = new URL(tool.server.url).pathname;
  const before = await (await post(contextPath, {}, tool.server.headers)).json();
  assert.equal(before.taskGuide.id, taskId);
  assert.equal(before.taskGuide.title, world.customTask.title);
  assert.equal(before.assignment.id, taskId);
  assert.equal(before.assignment.status, 'assigned');
  const episode = {
    ...nativeRecording(world, world.customTask.instruction),
    task: { id: taskId, acceptance: ['task-inventory', 'target-cup-one', 'target-reference-one', 'controller-settled'].map(id => ({ id, name: id, passed: true })) },
  };
  const receipt = await (await post('/api/episodes', episode)).json();
  assert.equal(receipt.assignment.id, taskId);
  assert.equal(receipt.report.title, world.customTask.title);
  assert.equal(receipt.report.accepted, true);
  assert.equal(receipt.report.sourceKind, 'operator-reviewed-ai-assisted-scene');
  const after = await (await post(contextPath, {}, tool.server.headers)).json();
  assert.equal(after.assignment.status, 'submitted');
  assert.deepEqual(after.assignment.latestReport, receipt.report);
  assert.equal((await (await fetch(`${base}/api/assignments`)).json()).assignments.length, 4);
  assert.equal((await (await fetch(`${base}/api/assignments/${taskId}`)).json()).latestReport.id, receipt.report.id);
  await post('/api/voice/stop', { sessionId: session.sessionId });
});

test('authoritative evaluation API executes the shared controller and retains wrong-goal failures without provider calls', async t => {
  let providerCalls = 0;
  const { post } = await fixture(t, { fetchImpl: async () => { providerCalls++; throw new Error('No provider should be called'); } });
  const world = getEnvironment('lab').world();
  const steps = [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }];
  const correct = await post('/api/evaluations/plan', { world, steps, source: 'human', label: 'Human plan' });
  assert.equal(correct.status, 200);
  const result = await correct.json();
  assert.equal(result.taskAccepted, true);
  assert.equal(result.completedActions, 2);
  assert.equal(result.independentlyComputed, true);
  const wrong = await (await post('/api/evaluations/plan', { world, steps: [{ objectId: 'part-red', destination: 'tray-b' }], source: 'llm', label: 'Wrong model plan' })).json();
  assert.equal(wrong.outcome, 'completed');
  assert.equal(wrong.taskAccepted, false);
  const unknown = await (await post('/api/evaluations/plan', { world, steps: [{ objectId: 'missing', destination: 'tray-a' }], source: 'llm', label: 'Unknown ID' })).json();
  assert.equal(unknown.outcome, 'invalid');
  assert.equal(unknown.completedActions, 0);
  assert.equal((await post('/api/evaluations/plan', { world: {}, steps, source: 'human', label: 'Invalid world' })).status, 400);
  assert.equal(providerCalls, 0);
});

test('episode reports recompute geometry and refuse forged success claims or incomplete recordings', async t => {
  const { post } = await fixture(t);
  const native = reviewedLabEpisode();
  const valid = await (await post('/api/episodes', native)).json();
  assert.equal(valid.report.acceptance.independentlyRecomputed, true);
  assert.equal(valid.report.acceptance.replay.matched, true);
  const forged = structuredClone(native);
  forged.samples.at(-1).world.objects[0].position[0] = -0.5;
  const rejected = await (await post('/api/episodes', forged)).json();
  assert.equal(rejected.saved, true, 'failed evidence is retained truthfully');
  assert.equal(rejected.report.accepted, false);
  assert.equal(rejected.report.acceptance.status, 'failed');
  assert.equal(rejected.report.acceptance.checks.find(check => check.id === 'target-part-red').passed, false);
  const legacy = await (await post('/api/episodes', { ...native, samples: [{ t: 0 }] })).json();
  assert.equal(legacy.report.accepted, false);
  assert.equal(legacy.report.acceptance.status, 'unverified');
});
