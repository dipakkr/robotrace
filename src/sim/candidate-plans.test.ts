import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialWorld, destinationPosition, TABLE_TOP } from './engine';
import { getEnvironment } from './environments';
import { evaluateCandidatePlan, validateCandidatePlan } from './candidate-plans';
import type { CandidatePlanSource } from './candidate-plans';

const labPlan = [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }];
const evaluateLab = (steps: unknown, source: CandidatePlanSource = 'human') => evaluateCandidatePlan({
  world: getEnvironment('lab').world(), steps, source, label: `${source} candidate`, instruction: 'Route the samples',
});

test('a correct human plan completes real controller actions and satisfies the assignment', () => {
  const result = evaluateLab(labPlan);
  assert.equal(result.source, 'human');
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.taskAccepted, true);
  assert.equal(result.completedActions, 2);
  assert.ok(result.simulatedDuration > 10);
  assert.ok(result.checks.every(check => check.passed));
  assert.equal(result.finalWorld.robot.heldObjectId, null);
  assert.equal(result.finalWorld.objects.find(object => object.id === 'part-red')?.location, 'tray-a');
});

test('a valid plan with incorrect destinations can finish while failing task acceptance', () => {
  const result = evaluateLab([{ objectId: 'part-red', destination: 'tray-b' }, { objectId: 'part-blue', destination: 'tray-a' }], 'llm');
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedActions, 2);
  assert.equal(result.taskAccepted, false);
  assert.ok(result.checks.some(check => !check.passed && check.id === 'target-part-red'));
});

test('a candidate is allowed to move the reference and its acceptance failure stays visible', () => {
  const result = evaluateLab([...labPlan, { objectId: 'part-green', destination: 'tray-a' }], 'llm');
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedActions, 3, 'the evaluator must not silently remove the model reference action');
  assert.equal(result.finalWorld.objects.find(object => object.id === 'part-green')?.location, 'tray-a');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.checks.find(check => check.id === 'target-part-green')?.passed, false);
});

test('protected-reference checks use the frozen initial pose rather than a template pose', () => {
  const world = getEnvironment('lab').world();
  world.objects.find(object => object.id === 'part-green')!.position[0] -= 0.12;
  const result = evaluateCandidatePlan({ world, steps: labPlan, source: 'baseline', label: 'same snapshot' });
  assert.equal(result.taskAccepted, true);
  assert.deepEqual(result.finalWorld.objects[2], world.objects[2]);
});

test('unknown IDs, destination aliases and duplicate object assignments are rejected without partial steps', () => {
  const world = getEnvironment('lab').world();
  for (const steps of [
    [{ objectId: 'Sample alpha', destination: 'tray-a' }],
    [{ objectId: 'part-purple', destination: 'tray-a' }],
    [{ objectId: 'part-red', destination: 'Rack A' }],
    [{ objectId: 'part-red ', destination: 'tray-a' }],
    [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-red', destination: 'tray-b' }],
    [{ objectId: 'part-red', destination: 'tray-a', kind: 'wait' }],
    [null],
    Array(2),
  ]) {
    const validation = validateCandidatePlan(steps, world);
    assert.equal(validation.valid, false, JSON.stringify(steps));
    assert.ok(validation.errors.length > 0);
    assert.deepEqual(validation.steps, []);
  }
});

test('invalid model output remains invalid and performs no controller work', () => {
  const result = evaluateLab({ assignments: labPlan }, 'llm');
  assert.equal(result.planValid, false);
  assert.equal(result.outcome, 'invalid');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.completedActions, 0);
  assert.equal(result.simulatedDuration, 0);
  assert.deepEqual(result.finalWorld, result.initialWorld);
});

test('candidate arrays are bounded and exact scene IDs must be unique', () => {
  const world = getEnvironment('workbench').world();
  assert.equal(validateCandidatePlan(Array.from({ length: 7 }, () => ({ objectId: 'part-red', destination: 'tray-a' })), world).valid, false);
  world.objects.push(structuredClone(world.objects[0]));
  assert.equal(validateCandidatePlan([{ objectId: 'part-red', destination: 'tray-a' }], world).valid, false);
});

test('unreachable plans report controller failure without fabricated completed actions', () => {
  const world = getEnvironment('lab').world();
  world.objects[0].position = [1.92, world.objects[0].position[1], -0.95];
  const result = evaluateCandidatePlan({ world, steps: labPlan, source: 'human', label: 'reach test' });
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.completedActions, 0);
  assert.equal(result.simulatedDuration, 0);
  assert.match(result.error!, /outside/);
  assert.deepEqual(result.finalWorld.objects, result.initialWorld.objects);
});

test('candidates share reproducible snapshots and never mutate the live source world', () => {
  const world = getEnvironment('lab').world();
  const before = structuredClone(world);
  const results = (['human', 'llm', 'baseline'] as const).map(source => evaluateCandidatePlan({ world, steps: labPlan, source, label: source }));
  assert.deepEqual(world, before);
  for (const result of results) {
    assert.deepEqual(result.initialWorld, before);
    assert.deepEqual(result.finalWorld, results[0].finalWorld);
  }
  results[0].initialWorld.objects[0].position[0] = 99;
  results[0].finalWorld.objects[1].position[0] = 98;
  assert.deepEqual(world, before);
  assert.notEqual(results[1].initialWorld.objects[0].position[0], 99);
  assert.notEqual(results[1].finalWorld.objects[1].position[0], 98);
});

test('an empty plan receives no invented task success unless the goal is already satisfied', () => {
  const empty = evaluateLab([]);
  assert.equal(empty.planValid, true);
  assert.equal(empty.outcome, 'completed');
  assert.equal(empty.taskAccepted, false);
  assert.equal(empty.completedActions, 0);
  const completed = evaluateLab(labPlan).finalWorld;
  const alreadyDone = evaluateCandidatePlan({ world: completed, steps: [], source: 'human', label: 'no-op after completion' });
  assert.equal(alreadyDone.taskAccepted, true);
});

test('scenes with active controller state must settle before a comparison', () => {
  for (const mode of ['running', 'paused', 'stopped', 'error'] as const) {
    const world = getEnvironment('lab').world();
    world.robot.mode = mode;
    const result = evaluateCandidatePlan({ world, steps: labPlan, source: 'human', label: mode });
    assert.equal(result.outcome, 'invalid');
    assert.deepEqual(result.finalWorld, world);
  }
});

test('custom tasks evaluate explicit table/review goals and preserved references', () => {
  const world = Object.assign(createInitialWorld(), { customTask: { title: 'Review a part', instruction: 'Move red to review; leave green untouched.', assignments: [
    { objectId: 'part-red', destination: 'reject' as const },
    { objectId: 'part-blue', destination: 'table' as const },
    { objectId: 'part-green', destination: 'table' as const, unchanged: true },
  ] } });
  const result = evaluateCandidatePlan({ world, steps: [{ objectId: 'part-red', destination: 'reject' }], source: 'human', label: 'custom', requestDurationMs: 123 });
  assert.equal(result.taskAccepted, true);
  assert.equal(result.requestDurationMs, 123);
  const moved = evaluateCandidatePlan({ world, steps: [{ objectId: 'part-red', destination: 'reject' }, { objectId: 'part-green', destination: 'tray-a' }], source: 'llm', label: 'disturbed' });
  assert.equal(moved.outcome, 'completed');
  assert.equal(moved.taskAccepted, false);
});

test('custom acceptance rejects forged location metadata outside actual destination bounds', () => {
  const world = Object.assign(createInitialWorld(), { customTask: { title: 'Place red', instruction: 'Red to tray A', assignments: [
    { objectId: 'part-red', destination: 'tray-a' as const },
    { objectId: 'part-blue', destination: 'table' as const, unchanged: true },
    { objectId: 'part-green', destination: 'table' as const, unchanged: true },
  ] } });
  const object = world.objects[0];
  object.location = 'tray-a'; object.status = 'placed';
  object.position = destinationPosition('tray-a');
  object.position[1] = TABLE_TOP + 0.07 + object.size[1] / 2;
  assert.equal(evaluateCandidatePlan({ world, steps: [], source: 'human', label: 'contained' }).taskAccepted, true);
  object.position[0] = -0.5;
  assert.equal(evaluateCandidatePlan({ world, steps: [], source: 'human', label: 'forged' }).taskAccepted, false);
});

test('unknown or malformed task goals cannot turn controller completion into accepted work', () => {
  const world = createInitialWorld();
  assert.equal(evaluateCandidatePlan({ world, steps: [], source: 'human', label: 'no goals' }).taskAccepted, false);
  const malformed = Object.assign(world, { customTask: { title: 'Malformed', instruction: 'No implicit goals', assignments: [{ objectId: 'missing', destination: 'tray-a' as const }] } });
  const result = evaluateCandidatePlan({ world: malformed, steps: [], source: 'human', label: 'bad goals' });
  assert.equal(result.outcome, 'completed');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.checks[0].id, 'task-defined');
});

test('reused snapshots do not trigger a prior step idempotency shortcut', () => {
  const world = getEnvironment('lab').world();
  world.lastCompletedStepId = 'candidate-0-0-part-red-tray-a';
  const result = evaluateCandidatePlan({ world, steps: labPlan, source: 'baseline', label: 'fresh IDs' });
  assert.equal(result.taskAccepted, true);
  assert.equal(result.completedActions, 2);
  assert.notEqual(result.steps[0].id, world.lastCompletedStepId);
});

test('software human-workspace blockage returns immediately without moving or mutating the seed', () => {
  const world = getEnvironment('lab').world();
  world.humanPresence = { state: 'in-workspace', source: 'scenario-proxy' };
  const snapshot = structuredClone(world);
  const result = evaluateCandidatePlan({ world, steps: labPlan, source: 'llm', label: 'occupied scenario' });
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.completedActions, 0);
  assert.equal(result.simulatedDuration, 0);
  assert.equal(result.finalWorld.motion, null);
  assert.equal(result.finalWorld.robot.mode, 'paused');
  assert.match(result.error!, /Human workspace scenario.*Clear the scenario.*resume/);
  assert.doesNotMatch(result.error!, /ticks|budget/);
  assert.deepEqual(result.finalWorld.objects, snapshot.objects);
  assert.deepEqual(result.finalWorld.robot.position, snapshot.robot.position);
  assert.deepEqual(world, snapshot);
});

test('a protected reference picked and returned to its identical table state still fails acceptance', () => {
  for (const custom of [false, true]) {
    const world = getEnvironment('lab').world();
    world.objects[2].position = [...destinationPosition('table', 2)];
    world.objects[2].position[1] = TABLE_TOP + world.objects[2].size[1] / 2;
    if (custom) world.customTask = { title: 'Preserve the reference', instruction: 'Route carriers and preserve reference', assignments: [
      { objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' },
      { objectId: 'part-green', destination: 'table', unchanged: true },
    ] };
    const result = evaluateCandidatePlan({ world, steps: [...labPlan, { objectId: 'part-green', destination: 'table' }], source: 'llm', label: 'Reference round trip' });
    assert.equal(result.outcome, 'completed');
    assert.equal(result.completedActions, 3, 'The wrong candidate must still execute without removing its reference action');
    assert.deepEqual(result.finalWorld.objects[2], world.objects[2]);
    assert.equal(result.taskAccepted, false);
    assert.equal(result.checks.find(check => check.id === 'target-part-green')?.passed, false);
    assert.match(result.checks.find(check => check.id === 'target-part-green')!.detail, /restoring its final state/);
  }
});
