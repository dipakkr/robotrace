import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerService, plannerModels, requestedAssetCounts } from './planner-models.mjs';

const env = { LLM_API_KEY: 'private-provider-key-sentinel', LLM_MODEL: 'gpt-4o-mini' };
const world = {
  environmentId: 'lab', objects: [
    { id: 'part-red', label: 'Sample alpha', position: [-0.6, 0.9, -0.4], location: 'table' },
    { id: 'part-green', label: 'Reference sample', position: [-0.3, 0.9, 0.4], location: 'table' },
  ], destinationLabels: { 'tray-a': 'Rack A', 'tray-b': 'Rack B', reject: 'Review', table: 'Sample bench' },
};
const input = () => ({ model: 'gpt-4o-mini', environmentId: 'lab', world: structuredClone(world), instruction: 'Route the samples' });
const response = value => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
const scene = () => ({
  version: 1, title: 'Counter collection', baseEnvironmentId: 'kitchen', instruction: 'Place the cup on the serving tray',
  objects: [{ id: 'cup-one', label: 'Cup one', asset: 'cup', color: 'blue', slot: 0 }],
  assignments: [{ objectId: 'cup-one', destination: 'tray-a', unchanged: false }],
});

test('explicit scene inventory counts are preserved without double-counting task prose', () => {
  assert.deepEqual(requestedAssetCounts('Create two cups and one bowl. Put two cups in serving.'), { cup: 2, bowl: 1 });
  assert.deepEqual(requestedAssetCounts('One red cup and one blue cup, with a green bowl.'), { cup: 2, bowl: 1 });
  assert.deepEqual(requestedAssetCounts('A kitchen counter with three blocks.'), { block: 3 });
});

test('scene drafts reject a standard inventory substituted for a requested count', async () => {
  const service = createPlannerService({ env, fetchImpl: async () => response(scene()) });
  await assert.rejects(service.draft({ prompt: 'Create two cups and one bowl', baseEnvironmentId: 'kitchen' }), /requested object types and counts/);
});

test('model list is a bounded explicit allowlist and adds the comparison model only for OpenAI', () => {
  assert.deepEqual(plannerModels({}), []);
  assert.deepEqual(plannerModels(env).map(model => model.id), ['gpt-4o-mini', 'gpt-4.1-mini']);
  assert.ok(plannerModels(env).every(model => model.access === 'configured-unverified'));
  assert.deepEqual(plannerModels({ ...env, LLM_API_URL: 'https://proxy.example/v1/chat/completions' }).map(model => model.id), ['gpt-4o-mini']);
  assert.deepEqual(plannerModels({ ...env, EVAL_MODELS: 'model-a, model-b,model-a, invalid model' }).map(model => model.id), ['model-a', 'model-b']);
});

test('planner sends bounded retrieved context, records latency, and preserves wrong-goal candidates', async () => {
  let request;
  const candidate = { steps: [{ objectId: 'unknown-object', destination: 'reject' }, { objectId: 'part-green', destination: 'tray-b' }] };
  const service = createPlannerService({ env, fetchImpl: async (url, options) => { request = { url, options, payload: JSON.parse(options.body) }; return response(candidate); } });
  const plan = await service.plan(input());
  assert.deepEqual(plan.steps, candidate.steps, 'schema-valid model mistakes must reach the evaluator unchanged');
  assert.equal(plan.source, 'llm-planner');
  assert.ok(Number.isFinite(plan.requestDurationMs) && plan.requestDurationMs >= 0);
  assert.equal(request.payload.max_completion_tokens, 800);
  assert.equal(request.payload.response_format.type, 'json_schema');
  assert.equal(request.payload.response_format.json_schema.strict, true);
  assert.equal(request.options.signal instanceof AbortSignal, true);
  assert.equal(request.options.redirect, 'error');
  const context = JSON.parse(request.payload.messages[1].content);
  assert.equal(context.taskGuide.id, 'TT-LAB-001');
  assert.equal(context.world.destinationLabels['tray-a'], 'Rack A');
  assert.equal(context.taskGuide.assignments.find(item => item.objectId === 'part-green').unchanged, true);
  assert.equal(JSON.stringify(plan).includes(env.LLM_API_KEY), false);
});

test('request validation refuses unlisted models and oversized/malformed worlds without provider calls', async () => {
  let calls = 0;
  const service = createPlannerService({ env, fetchImpl: async () => { calls++; return response({ steps: [] }); } });
  for (const value of [
    { ...input(), model: 'not-allowlisted' },
    { ...input(), instruction: 'x'.repeat(1501) },
    { ...input(), environmentId: 'kitchen' },
    { ...input(), world: { ...world, objects: Array.from({ length: 7 }, () => world.objects[0]) } },
    { ...input(), world: { ...world, objects: [{ ...world.objects[0], position: [NaN, 0, 0] }] } },
    { ...input(), world: { ...world, objects: [{ ...world.objects[0], id: 12 }] } },
    { ...input(), world: { ...world, customTask: { title: 'x'.repeat(101) } } },
  ]) await assert.rejects(service.plan(value), error => error.status === 400);
  assert.equal(calls, 0);
  await assert.rejects(createPlannerService({ env: {} }).plan(input()), error => error.status === 503);
});

test('plan schema rejects extra actions, code, malformed IDs and excess steps without goal repair', async () => {
  for (const candidate of [
    { steps: [{ objectId: 'part-red', destination: 'outside' }] },
    { steps: [{ objectId: 12, destination: 'tray-a' }] },
    { steps: [{ objectId: 'part-red', destination: 'tray-a', code: 'run()' }] },
    { steps: [], execute: true },
    { steps: Array.from({ length: 7 }, () => ({ objectId: 'part-red', destination: 'tray-a' })) },
  ]) await assert.rejects(createPlannerService({ env, fetchImpl: async () => response(candidate) }).plan(input()), error => error.status === 502);
});

test('provider failures, refusals, truncation, secret echoes and timeout details never reach API errors', async () => {
  const fetchers = [
    async () => new Response(env.LLM_API_KEY, { status: 401 }),
    async () => new Response(env.LLM_API_KEY),
    async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: env.LLM_API_KEY } }] }),
    async () => Response.json({ choices: [{ finish_reason: 'stop', message: { refusal: env.LLM_API_KEY } }] }),
    async () => { throw new Error(env.LLM_API_KEY); },
    async () => response({ steps: [{ objectId: env.LLM_API_KEY, destination: 'tray-a' }] }),
  ];
  for (const fetchImpl of fetchers) await assert.rejects(createPlannerService({ env, fetchImpl }).plan(input()), error => error.status === 502 && !error.message.includes(env.LLM_API_KEY));
  await assert.rejects(createPlannerService({ env, fetchImpl: async () => { throw Object.assign(new Error(env.LLM_API_KEY), { name: 'TimeoutError' }); } }).plan(input()), error => error.status === 504 && !error.message.includes(env.LLM_API_KEY));
});

test('non-OpenAI compatible endpoints receive JSON mode and one bounded call', async () => {
  let payload;
  let calls = 0;
  const service = createPlannerService({ env: { ...env, LLM_API_URL: 'https://proxy.example/v1/chat/completions' }, fetchImpl: async (_url, options) => { calls++; payload = JSON.parse(options.body); return response({ steps: [] }); } });
  assert.deepEqual((await service.plan(input())).steps, []);
  assert.equal(calls, 1);
  assert.equal(payload.max_tokens, 800);
  assert.deepEqual(payload.response_format, { type: 'json_object' });
});

test('scene generator returns a bounded proposed spec and rejects geometry, code, wrong templates and oversized labels', async () => {
  const service = createPlannerService({ env, fetchImpl: async () => response(scene()) });
  const draft = await service.draft({ prompt: 'A blue cup to the serving tray', baseEnvironmentId: 'kitchen' });
  assert.deepEqual(draft.spec, scene());
  assert.equal(draft.model, 'gpt-4o-mini');
  assert.equal(draft.source, 'llm-scene-draft');
  assert.ok(Number.isFinite(draft.requestDurationMs));
  for (const spec of [
    { ...scene(), geometry: 'arbitrary mesh' },
    { ...scene(), baseEnvironmentId: 'lab' },
    { ...scene(), objects: [{ ...scene().objects[0], position: [0, 0, 0] }] },
    { ...scene(), objects: [{ ...scene().objects[0], label: 'x'.repeat(81) }] },
    { ...scene(), assignments: [{ ...scene().assignments[0], unchanged: 'yes' }] },
  ]) await assert.rejects(createPlannerService({ env, fetchImpl: async () => response(spec) }).draft({ prompt: 'Counter collection', baseEnvironmentId: 'kitchen' }), error => error.status === 502);
});

test('custom scene plans carry reviewed custom task assignments without irrelevant world payloads', async () => {
  let context;
  const custom = { ...world, environmentId: 'custom', baseEnvironmentId: 'lab', customTask: { title: 'Review carrier', instruction: 'Review alpha', assignments: [{ objectId: 'part-red', destination: 'reject', unchanged: false }] }, irrelevant: 'must-not-forward' };
  const service = createPlannerService({ env, fetchImpl: async (_url, options) => { context = JSON.parse(JSON.parse(options.body).messages[1].content); return response({ steps: [{ objectId: 'part-red', destination: 'reject' }] }); } });
  await service.plan({ ...input(), environmentId: 'custom', world: custom });
  assert.deepEqual(context.world.customTask, custom.customTask);
  assert.equal(context.world.baseEnvironmentId, 'lab');
  assert.equal(JSON.stringify(context).includes('must-not-forward'), false);
});

test('reference images are transient low-detail multimodal inputs, never scene output or geometry', async () => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1xkAAAAASUVORK5CYII=';
  let payload;
  const service = createPlannerService({ env, fetchImpl: async (_url, options) => { payload = JSON.parse(options.body); return response(scene()); } });
  const draft = await service.draft({ prompt: 'Use this reviewed frame as a reference', baseEnvironmentId: 'kitchen', referenceImage: image });
  assert.equal(payload.messages[1].content[0].type, 'text');
  assert.deepEqual(payload.messages[1].content[1], { type: 'image_url', image_url: { url: image, detail: 'low' } });
  assert.equal(JSON.stringify(draft).includes(image), false);
  assert.match(payload.messages[0].content, /Never infer calibrated 3D reconstruction/);
});

test('image validation refuses URLs, unsupported formats, invalid encodings, incomplete files and oversized data before calling a model', async () => {
  let calls = 0;
  const service = createPlannerService({ env, fetchImpl: async () => { calls++; return response(scene()); } });
  for (const referenceImage of [
    'https://example.com/image.png',
    'data:image/gif;base64,R0lGODlh',
    'data:image/png;base64,!!!!',
    'data:image/png;base64,a',
    'data:image/png;base64,aGVsbG8=',
    'data:image/png;base64,iVBORw0KGgo=',
    `data:image/jpeg;base64,${Buffer.alloc(600 * 1024 + 1).toString('base64')}`,
  ]) await assert.rejects(service.draft({ prompt: 'A collection scene', baseEnvironmentId: 'kitchen', referenceImage }), error => error.status === 400);
  assert.equal(calls, 0);
});
