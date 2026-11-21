import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { evaluatePlanOnServer, recomputeEpisodeAcceptance } from './simulation.mjs';

const { getEnvironment } = await tsImport('../src/sim/environments.ts', import.meta.url);
const { planCommand, advanceWorld, destinationPosition, TABLE_TOP } = await tsImport('../src/sim/engine.ts', import.meta.url);

function recording() {
  const initialWorld = getEnvironment('lab').world();
  let world = structuredClone(initialWorld);
  const plan = planCommand('Route the samples', world);
  const samples = [{ time: 0, world: structuredClone(world) }];
  const events = [{ time: 0, label: 'Route the samples', kind: 'command' }];
  for (const step of plan.steps) {
    for (let tick = 0; tick < 100; tick++) {
      const result = advanceWorld(world, step, 1);
      assert.equal(result.error, undefined);
      world = result.world;
      if (result.done) break;
    }
    samples.push({ time: world.simTime, world: structuredClone(world) });
    events.push({ time: world.simTime, label: step.label, kind: 'success' });
  }
  return { schema: 'teachtrace.episode.v1', id: 'native-test', title: 'Sample routing', createdAt: '2026-11-21T12:00:00Z', status: 'approved', outcome: 'completed', initialWorld, samples, events, completedActions: 2, duration: world.simTime, command: 'Route the samples' };
}

function humanRecording(initiallyOccupied = true) {
  const initialWorld = getEnvironment('workbench').world();
  initialWorld.humanPresence = { state: initiallyOccupied ? 'in-workspace' : 'nearby', source: 'scenario-proxy' };
  let world = structuredClone(initialWorld);
  const plan = planCommand('Prepare repair kit', world);
  const samples = [{ time: 0, world: structuredClone(world) }];
  const events = [{ time: 0, label: 'Prepare repair kit', kind: 'command' }];
  const capture = () => samples.push({ time: world.simTime, world: structuredClone(world) });
  if (!initiallyOccupied) {
    world = advanceWorld(world, plan.steps[0], 1).world;
    world = advanceWorld(world, plan.steps[0], 1).world;
    assert.equal(world.robot.heldObjectId, 'part-red');
    world.humanPresence = { state: 'in-workspace', source: 'scenario-proxy' }; world.revision++;
    events.push({ time: world.simTime, label: 'Human scenario changed to in-workspace', kind: 'control' }); capture();
  }
  const blocked = advanceWorld(world, plan.steps[0], 0.1);
  assert.ok(blocked.blocked); world = blocked.world; capture();
  events.push({ time: world.simTime, label: blocked.blocked, kind: 'control' });
  const heldObjects = structuredClone(world.objects);
  const heldTime = world.simTime;
  world.humanPresence = { state: 'clear', source: 'scenario-proxy' }; world.revision++;
  events.push({ time: world.simTime, label: 'Human scenario changed to clear', kind: 'control' }); capture();
  world = advanceWorld(world, plan.steps[0], 0.1).world;
  assert.equal(world.robot.mode, 'paused');
  assert.equal(world.simTime, heldTime); assert.deepEqual(world.objects, heldObjects);
  world.robot.mode = 'running';
  events.push({ time: world.simTime, label: 'Operator resumed motion', kind: 'control' }); capture();
  for (const step of plan.steps) {
    let done = false;
    for (let tick = 0; tick < 100; tick++) {
      const result = advanceWorld(world, step, 1);
      assert.equal(result.error, undefined); world = result.world;
      if (result.done) { done = true; break; }
    }
    assert.ok(done); capture();
    events.push({ time: world.simTime, label: step.label, kind: 'success' });
  }
  return { schema: 'teachtrace.episode.v1', id: 'human-native-test', title: 'Repair kit with scenario hold', createdAt: '2026-11-21T12:00:00Z',
    status: 'approved', outcome: 'completed', initialWorld, samples, events, completedActions: 3, duration: world.simTime, command: 'Prepare repair kit' };
}

function protectedRoundTripRecording({ withHuman = true, includeReference = true } = {}) {
  const initialWorld = getEnvironment('lab').world();
  initialWorld.environmentId = 'custom';
  initialWorld.objects[2].position = [...destinationPosition('table', 2)];
  initialWorld.objects[2].position[1] = TABLE_TOP + initialWorld.objects[2].size[1] / 2;
  initialWorld.customTask = { id: 'custom-11111111-1111-4111-8111-111111111111', title: 'Preserve reference', instruction: 'Route carriers and preserve reference', assignments: [
    { objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' },
    { objectId: 'part-green', destination: 'table', unchanged: true },
  ] };
  const steps = planCommand(initialWorld.customTask.instruction, initialWorld).steps;
  if (includeReference) steps.push({ id: 'reference-round-trip', kind: 'pick_place', objectId: 'part-green', destination: 'table', label: 'Pick and return reference' });
  let world = structuredClone(initialWorld), interrupted = false;
  const samples = [{ time: 0, world: structuredClone(world) }];
  const events = [{ time: 0, kind: 'command', label: initialWorld.customTask.instruction }];
  const capture = () => samples.push({ time: world.simTime, world: structuredClone(world) });
  for (const step of steps) {
    let done = false;
    for (let tick = 0; tick < 1000; tick++) {
      const result = advanceWorld(world, step, 0.1);
      assert.equal(result.error, undefined); world = result.world; capture();
      if (withHuman && !interrupted && world.robot.heldObjectId) {
        interrupted = true;
        world.humanPresence = { state: 'in-workspace', source: 'scenario-proxy' }; world.revision++;
        events.push({ time: world.simTime, kind: 'control', label: 'Human scenario changed to in-workspace' }); capture();
        const blocked = advanceWorld(world, step, 0.1); assert.ok(blocked.blocked); world = blocked.world; capture();
        world.humanPresence = { state: 'clear', source: 'scenario-proxy' }; world.revision++;
        events.push({ time: world.simTime, kind: 'control', label: 'Human scenario changed to clear' }); capture();
        world.robot.mode = 'running'; events.push({ time: world.simTime, kind: 'control', label: 'Operator resumed motion' }); capture();
      }
      if (result.done) { done = true; break; }
    }
    assert.equal(done, true);
    events.push({ time: world.simTime, kind: 'success', label: step.label });
  }
  assert.deepEqual(world.objects[2], initialWorld.objects[2]);
  return { schema: 'teachtrace.episode.v1', id: 'protected-round-trip', title: 'Protected reference history', createdAt: '2026-11-21T12:00:00Z',
    initialWorld, duration: world.simTime, status: 'approved', outcome: 'completed', samples, events, completedActions: steps.length, command: initialWorld.customTask.instruction };
}

test('server candidate endpoint adapter runs the shared controller and keeps incorrect goals visible', async () => {
  const world = getEnvironment('lab').world();
  const input = { world, source: 'human', label: 'Correct lab plan', steps: [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }] };
  const result = await evaluatePlanOnServer(input);
  assert.equal(result.taskAccepted, true);
  assert.equal(result.completedActions, 2);
  assert.equal(result.independentlyComputed, true);
  assert.equal(result.evaluationBasis, 'server-executed-kinematic-controller');
  const wrong = await evaluatePlanOnServer({ ...input, source: 'llm', steps: [{ objectId: 'part-red', destination: 'tray-b' }, { objectId: 'part-blue', destination: 'tray-a' }] });
  assert.equal(wrong.outcome, 'completed');
  assert.equal(wrong.taskAccepted, false);
  assert.deepEqual(world, getEnvironment('lab').world());
});

test('bounded adapter refuses malformed worlds while preserving invalid candidate results', async () => {
  const input = { world: getEnvironment('lab').world(), source: 'human', label: 'Candidate', steps: [{ objectId: 'missing', destination: 'tray-a' }] };
  const invalid = await evaluatePlanOnServer(input);
  assert.equal(invalid.outcome, 'invalid');
  assert.equal(invalid.completedActions, 0);
  await assert.rejects(evaluatePlanOnServer({ ...input, world: { objects: [] } }), error => error.status === 400);
  await assert.rejects(evaluatePlanOnServer({ ...input, label: 'x'.repeat(101) }), error => error.status === 400);
  await assert.rejects(evaluatePlanOnServer({ ...input, source: 'arbitrary-module.ts' }), error => error.status === 400);
});

test('a complete native controller recording passes recomputation and deterministic command replay', async () => {
  const result = await recomputeEpisodeAcceptance(recording());
  assert.equal(result.independentlyRecomputed, true);
  assert.equal(result.recordingValid, true);
  assert.equal(result.basis, 'server-recomputed-simulator-checks');
  assert.deepEqual(result.replay, { performed: true, matched: true });
  assert.ok(result.checks.every(check => check.passed));
});

test('forged passed booleans and location metadata cannot replace recorded geometric evidence', async () => {
  const native = recording();
  const forged = structuredClone(native);
  forged.task = { acceptance: [{ id: 'target-part-red', passed: true }] };
  forged.samples.at(-1).world.objects[0].position[0] = -0.5;
  const result = await recomputeEpisodeAcceptance(forged);
  assert.equal(result.independentlyRecomputed, true);
  assert.equal(result.checks.find(check => check.id === 'target-part-red').passed, false);
  assert.equal(result.replay.matched, false);
  const missing = await recomputeEpisodeAcceptance({ outcome: 'completed', summary: { taskAcceptancePassed: true } });
  assert.equal(missing.independentlyRecomputed, false);
  assert.deepEqual(missing.checks, []);
});

test('recording consistency rejects invented action counts and preserves the simulation boundary', async () => {
  const native = recording();
  native.completedActions = 99;
  const result = await recomputeEpisodeAcceptance(native);
  assert.equal(result.recordingValid, false);
  assert.match(result.limits, /do not authenticate the recording/);
  assert.match(result.limits, /physical contact/);
});

test('recorded human hold, clearance and explicit resume retain independent task acceptance without claiming command-only replay', async () => {
  for (const initiallyOccupied of [true, false]) {
    const native = humanRecording(initiallyOccupied);
    const result = await recomputeEpisodeAcceptance(native);
    assert.equal(result.independentlyRecomputed, true);
    assert.equal(result.recordingValid, true);
    assert.ok(result.checks.every(check => check.passed));
    assert.deepEqual(result.replay, { performed: false, matched: null, reason: 'Human scenario interventions require control-aware replay; final task geometry was independently recomputed.' });
    assert.equal(result.checks.some(check => check.id === 'recorded-command-replay'), false);
    assert.equal(native.completedActions, 3);
    assert.equal(native.initialWorld.humanPresence.state, initiallyOccupied ? 'in-workspace' : 'nearby');
  }
});

test('human interventions never bypass final task geometry and missing clearance/resume evidence retains replay failure', async () => {
  const forged = humanRecording();
  forged.samples.at(-1).world.objects[0].position[0] = -0.5;
  const geometry = await recomputeEpisodeAcceptance(forged);
  assert.equal(geometry.independentlyRecomputed, true);
  assert.equal(geometry.replay.performed, false);
  assert.equal(geometry.checks.find(check => check.id === 'target-part-red').passed, false);
  for (const missing of [/Human scenario changed to clear/, /Operator resumed motion/]) {
    const native = humanRecording();
    native.events = native.events.filter(event => !missing.test(event.label));
    const result = await recomputeEpisodeAcceptance(native);
    assert.deepEqual(result.replay, { performed: true, matched: false });
    assert.equal(result.checks.find(check => check.id === 'recorded-command-replay').passed, false);
  }
  const unchangedOccupancy = humanRecording();
  for (const sample of unchangedOccupancy.samples) sample.world.humanPresence = { state: 'in-workspace', source: 'scenario-proxy' };
  assert.deepEqual((await recomputeEpisodeAcceptance(unchangedOccupancy)).replay, { performed: true, matched: false });
});

test('failed and stopped human-scenario recordings retain their outcomes and never claim completed replay', async () => {
  for (const outcome of ['failed', 'stopped']) {
    const native = humanRecording();
    native.outcome = outcome;
    native.samples.at(-1).world.robot.mode = outcome === 'failed' ? 'error' : 'stopped';
    native.events.push({ time: native.duration, label: outcome === 'failed' ? 'Controller reported a fault' : 'Operator stopped motion', kind: outcome === 'failed' ? 'error' : 'control' });
    const result = await recomputeEpisodeAcceptance(native);
    assert.equal(result.recordingValid, true);
    assert.deepEqual(result.replay, { performed: false, matched: null });
    assert.equal(native.outcome, outcome);
    assert.equal(result.checks.find(check => check.id === 'controller-settled').passed, false);
  }
});

test('restored protected objects fail server acceptance even when valid human intervention skips command replay', async () => {
  for (const withHuman of [false, true]) {
    const native = protectedRoundTripRecording({ withHuman });
    const result = await recomputeEpisodeAcceptance(native);
    assert.equal(result.recordingValid, true);
    assert.equal(result.independentlyRecomputed, true);
    assert.equal(result.checks.find(check => check.id === 'target-part-green').passed, false);
    assert.match(result.checks.find(check => check.id === 'target-part-green').detail, /restoring its final state/);
    assert.equal(result.checks.every(check => check.passed), false);
    assert.equal(result.replay.performed, !withHuman);
  }
  const correct = await recomputeEpisodeAcceptance(protectedRoundTripRecording({ withHuman: true, includeReference: false }));
  assert.equal(correct.recordingValid, true);
  assert.equal(correct.checks.every(check => check.passed), true, 'An ordinary hold/resume must preserve valid task acceptance');
  assert.equal(correct.replay.performed, false);
});
