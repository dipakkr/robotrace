import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createWorkflowStore } from './workflows.mjs';
import { tsImport } from 'tsx/esm/api';

const { getEnvironment } = await tsImport('../src/sim/environments.ts', import.meta.url);
const { planCommand, advanceWorld } = await tsImport('../src/sim/engine.ts', import.meta.url);

const checksFor = id => ['task-inventory', 'target-part-red', 'target-part-blue', 'target-part-green', 'controller-settled', ...(id === 'kitchen' ? ['counter-cleared'] : [])].map(id => ({ id, name: id, passed: true, detail: 'Simulator check passed.' }));
function episodeFor(id, overrides = {}) {
  const known = ['workbench', 'kitchen', 'lab'].includes(id);
  const initialWorld = overrides.initialWorld ?? { ...getEnvironment(known ? id : 'workbench').world(), environmentId: id };
  const command = initialWorld.customTask?.instruction ?? (known ? getEnvironment(id).instruction : 'Sort all parts');
  let world = structuredClone(initialWorld);
  if (overrides.outcome === 'failed') world.objects[0].position = [1.92, world.objects[0].position[1], -0.95];
  const initial = structuredClone(world);
  const samples = [{ time: 0, world: structuredClone(world) }];
  const events = [{ time: 0, label: command, kind: 'command' }];
  let completedActions = 0;
  for (const step of planCommand(command, world).steps) {
    let failed = false;
    for (let tick = 0; tick < 100; tick++) {
      const result = advanceWorld(world, step, 1);
      world = result.world;
      if (result.error) { events.push({ time: world.simTime, label: result.error, kind: 'error' }); failed = true; break; }
      if (result.done) { completedActions++; events.push({ time: world.simTime, label: step.label, kind: 'success' }); break; }
    }
    samples.push({ time: world.simTime, world: structuredClone(world) });
    if (failed) break;
  }
  return {
    schema: 'teachtrace.episode.v1', id: `test-${id}`, title: initial.customTask?.title ?? `${id} collection`, createdAt: '2026-11-21T12:00:00Z',
    status: 'approved', outcome: 'completed', command,
    task: { id, acceptance: checksFor(id) }, summary: { taskAcceptancePassed: true }, completedActions, duration: world.simTime, samples, events, ...overrides,
    initialWorld: initial,
  };
}
async function fixture(t) {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'teachtrace-workflows-'));
  t.after(() => rm(dataDirectory, { recursive: true, force: true }));
  return { dataDirectory, store: createWorkflowStore({ dataDirectory }) };
}
const submit = (store, episode) => store.submitApprovedEpisode({ episode, episodeId: randomUUID(), savedAt: '2026-11-21T12:00:00.000Z' });

test('three assigned SOPs expose local sample provenance and reject unknown identifiers', async t => {
  const { store } = await fixture(t);
  const assignments = await store.listAssignments();
  assert.deepEqual(assignments.map(item => item.id), ['workbench', 'kitchen', 'lab']);
  assert.ok(assignments.every(item => item.status === 'assigned' && item.sourceKind === 'locally-authored-sample' && item.acceptance.length));
  assert.equal((await store.getAssignment('lab')).command, 'Route the samples');
  for (const id of ['custom', '../lab', '__proto__', undefined]) assert.equal(await store.getAssignment(id), null);
  assert.equal(await store.getReport('../state'), null);
});

test('approved episode submission atomically links assignment and report across store instances', async t => {
  const { store, dataDirectory } = await fixture(t);
  const receipt = await submit(store, episodeFor('lab'));
  assert.equal(receipt.assignment.status, 'submitted');
  assert.equal(receipt.report.outcome, 'completed');
  assert.equal(receipt.report.accepted, true);
  assert.equal(receipt.report.acceptance.status, 'passed');
  assert.equal(receipt.report.acceptance.independentlyRecomputed, true);
  assert.equal(receipt.report.acceptance.basis, 'server-recomputed-simulator-checks');
  assert.equal(receipt.report.acceptance.replay.matched, true);
  const reopened = createWorkflowStore({ dataDirectory });
  assert.deepEqual((await reopened.getAssignment('lab')).latestReport, receipt.report);
  assert.deepEqual(await reopened.getReport(receipt.report.id), receipt.report);
  assert.equal((await reopened.getAssignment('kitchen')).status, 'assigned');
  const other = await mkdtemp(join(tmpdir(), 'teachtrace-other-'));
  t.after(() => rm(other, { recursive: true, force: true }));
  assert.equal((await createWorkflowStore({ dataDirectory: other }).getAssignment('lab')).status, 'assigned');
});

test('completion and approval alone never assert task acceptance; failures remain submitted evidence', async t => {
  const { store } = await fixture(t);
  const missing = await submit(store, episodeFor('lab', { samples: [{ t: 0 }], task: undefined }));
  assert.equal(missing.report.accepted, false);
  assert.equal(missing.report.acceptance.status, 'unverified');
  assert.equal(missing.report.acceptance.missingCheckIds.length, 5);
  const forged = episodeFor('lab');
  forged.samples.at(-1).world.objects[0].position[0] = -0.5;
  const failedCheck = await submit(store, forged);
  assert.equal(failedCheck.report.outcome, 'completed', 'controller outcome and task acceptance remain distinct facts');
  assert.equal(failedCheck.report.acceptance.status, 'failed');
  assert.equal(failedCheck.report.accepted, false);
  const failedMotion = await submit(store, episodeFor('lab', { outcome: 'failed' }));
  assert.equal(failedMotion.report.outcome, 'failed');
  assert.equal(failedMotion.report.accepted, false);
  assert.equal(failedMotion.assignment.status, 'submitted');
  assert.match(failedMotion.report.followUp, /corrected demonstration/);
});

test('posted check claims are ignored and cannot make incomplete recordings accepted', async t => {
  const { store } = await fixture(t);
  for (const task of [
    { id: 'lab', acceptance: checksFor('lab').slice(0, 1) },
    { id: 'lab', acceptance: [...checksFor('lab'), checksFor('lab')[0]] },
    { id: 'lab', acceptance: checksFor('lab').map(item => ({ ...item, passed: 'true' })) },
    { id: 'kitchen', acceptance: checksFor('lab') },
  ]) assert.equal((await submit(store, episodeFor('lab', { task, samples: [{ t: 0 }] }))).report.accepted, false);
  assert.equal((await submit(store, episodeFor('lab', { task: { id: 'wrong', acceptance: [{ passed: false }] } }))).report.accepted, true, 'valid native evidence is evaluated independently of posted booleans');
});

test('legacy, unapproved, and custom episodes do not change workplace assignments', async t => {
  const { store } = await fixture(t);
  for (const episode of [{ title: 'Legacy record' }, episodeFor('lab', { status: 'review' }), episodeFor('lab', { schema: 'other' }), episodeFor('custom')]) {
    assert.equal(await submit(store, episode), null);
  }
  assert.ok((await store.listAssignments()).every(item => item.status === 'assigned'));
});

test('concurrent submissions preserve all reports, while a failed commit leaves the prior assignment intact', async t => {
  const { store, dataDirectory } = await fixture(t);
  const [first, second] = await Promise.all([submit(store, episodeFor('lab')), submit(createWorkflowStore({ dataDirectory }), episodeFor('kitchen'))]);
  assert.deepEqual(await store.getReport(first.report.id), first.report);
  assert.deepEqual(await store.getReport(second.report.id), second.report);
  const broken = createWorkflowStore({ dataDirectory, fs: { readFile, mkdir, writeFile, rm, rename: async () => { throw new Error('Simulated disk commit failure'); } } });
  await assert.rejects(submit(broken, episodeFor('lab', { outcome: 'failed' })), /disk commit failure/);
  assert.deepEqual((await store.getAssignment('lab')).latestReport, first.report);
  const recovered = await submit(store, episodeFor('workbench'));
  assert.equal(recovered.report.accepted, true);
});

function customEpisode(id = `custom-${randomUUID()}`, title = 'Authored sample collection') {
  const template = getEnvironment('lab').world();
  const initialWorld = {
    ...template,
    environmentId: 'custom', baseEnvironmentId: 'lab',
    objects: [{ ...template.objects[0], id: 'carrier-one', label: 'Carrier one' }, { ...template.objects[2], id: 'reference-one', label: 'Reference carrier' }],
    customTask: { id, title, instruction: 'Route Carrier one to Rack A and leave the reference untouched', assignments: [
      { objectId: 'carrier-one', destination: 'tray-a', unchanged: false }, { objectId: 'reference-one', destination: 'table', unchanged: true },
    ] }, sceneProvenance: { source: 'ai-draft', model: 'test-model' },
  };
  return episodeFor('custom', { initialWorld, task: { id, acceptance: ['task-inventory', 'target-carrier-one', 'target-reference-one', 'controller-settled'].map(id => ({ id, name: id, passed: true })) } });
}

test('two authored scenes retain separate persistent assignments, titles and reports', async t => {
  const { store, dataDirectory } = await fixture(t);
  const a = customEpisode(undefined, 'Carrier collection A');
  const b = customEpisode(undefined, 'Carrier collection B');
  const initial = await store.assignmentForWorld(a.initialWorld);
  assert.equal(initial.status, 'assigned');
  assert.equal(initial.id, a.initialWorld.customTask.id);
  const first = await submit(store, a);
  const second = await submit(store, b);
  assert.notEqual(first.assignment.id, second.assignment.id);
  assert.equal(first.report.accepted, true);
  assert.equal(second.report.accepted, true);
  assert.equal(first.report.title, 'Carrier collection A');
  assert.equal(first.report.acceptance.requiredCheckIds.length, 4);
  assert.equal(first.report.sourceKind, 'operator-reviewed-ai-assisted-scene');
  const reopened = createWorkflowStore({ dataDirectory });
  assert.equal((await reopened.listAssignments()).length, 5);
  assert.deepEqual((await reopened.getAssignment(first.assignment.id)).latestReport, first.report);
  assert.deepEqual(await reopened.getReport(second.report.id), second.report);
});

test('custom assignments reject forged goals and identity reuse, and derive the exact task identity from recorded state', async t => {
  const { store } = await fixture(t);
  const forged = customEpisode();
  forged.initialWorld.customTask.assignments[0].objectId = 'missing-carrier';
  assert.equal(await submit(store, forged), null);
  assert.equal((await store.listAssignments()).length, 3);
  const wrongTask = customEpisode();
  wrongTask.task.id = 'custom';
  assert.equal((await submit(store, wrongTask)).report.acceptance.status, 'passed');
  const valid = customEpisode();
  const first = await submit(store, valid);
  const changed = structuredClone(valid);
  changed.initialWorld.customTask.assignments[0].destination = 'tray-b';
  await assert.rejects(submit(store, changed), error => error.status === 409);
  assert.deepEqual((await store.getAssignment(first.assignment.id)).latestReport, first.report);
});
