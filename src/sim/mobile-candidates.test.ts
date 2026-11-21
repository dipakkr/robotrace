import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineMobileCandidate, evaluateMobileCandidate, validateMobileCandidate } from './mobile-candidates';
import type { MobileCandidate, MobileCandidateAction } from './mobile-candidates';
import { createMobileKitchen, setMobileHuman } from './mobile-navigation';
import type { MobileWorld } from './mobile-navigation';
import { MOBILE_PROTECTED_POLICY, mobileProtectedChange } from '../data/mobile-protected-policy.mjs';

function evaluate(candidate: unknown, world = createMobileKitchen()) {
  return evaluateMobileCandidate({ world, candidate, source: 'human', label: 'Submitted plan' });
}
const navigate = (station: 'counter' | 'table' | 'sink' | 'home'): MobileCandidateAction => ({ skill: 'navigate', station });
const handle = (skill: 'reach-check' | 'pickup' | 'place', station: 'counter' | 'table' | 'sink', objectId: 'cup' | 'bowl' = 'cup'): MobileCandidateAction => ({ skill, station, objectId });

// These use the actual controller, routing, carrier state and task checks, not a mock executor.
test('a correctly ordered authored recipe passes the actual frozen cup-to-sink task', () => {
  const initial = createMobileKitchen();
  const candidate = baselineMobileCandidate(initial);
  const result = evaluate(candidate, initial);
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.taskAccepted, true);
  assert.equal(result.completedSteps, 5);
  assert.equal(result.completedPickups, 1);
  assert.equal(result.completedPlacements, 1);
  assert.ok(result.distanceTravelled >= 9.9);
  assert.deepEqual(result.candidate, candidate);
  assert.deepEqual(result.steps.map(step => step.kind), candidate.actions.map(action => action.skill));
  assert.ok(result.checks.every(check => check.passed));
  assert.equal(result.failureCategory, null);
  assert.equal(result.failureMessage, null);
  assert.equal(result.failureStepIndex, null);
  assert.equal(result.failedAction, null);
  assert.equal(result.error, undefined);
});

test('pickup-first is preserved and fails at the true docking guard without adding navigation', () => {
  const candidate = { actions: [handle('pickup', 'counter'), navigate('sink'), handle('place', 'sink')] };
  const result = evaluate(candidate);
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'docking');
  assert.equal(result.failureStepIndex, 0);
  assert.deepEqual(result.failedAction, candidate.actions[0]);
  assert.match(result.error ?? '', /not docked/);
  assert.equal(result.distanceTravelled, 0);
  assert.equal(result.completedPickups, 0);
  assert.deepEqual(result.candidate, candidate);
  assert.deepEqual(result.finalWorld.objects, result.initialWorld.objects);
});

test('wrong destination can complete its declared actions while failing the independent sink task', () => {
  const candidate = { actions: [navigate('counter'), handle('reach-check', 'counter'), handle('pickup', 'counter'), navigate('table'), handle('place', 'table')] };
  const result = evaluate(candidate);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedSteps, 5);
  assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'wrong-goal');
  assert.equal(result.error, undefined);
  assert.equal(result.failureStepIndex, 4);
  assert.deepEqual(result.failedAction, candidate.actions[4], 'identify the executed wrong placement without relabelling controller completion');
  assert.equal(result.finalWorld.objects.find(object => object.id === 'cup')?.station, 'table');
  assert.deepEqual(result.goal, { objectId: 'cup', stationId: 'sink' });
  assert.deepEqual(result.finalWorld.mission?.plan.goal, result.goal);
});

test('a missing placement is not silently appended and fails task acceptance with cargo retained', () => {
  const candidate = { actions: [navigate('counter'), handle('pickup', 'counter'), navigate('sink')] };
  const result = evaluate(candidate);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedSteps, 3);
  assert.equal(result.completedPlacements, 0);
  assert.equal(result.finalWorld.robot.cargoObjectId, 'cup');
  assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'incomplete');
  assert.equal(result.failureStepIndex, null);
  assert.equal(result.failedAction, null, 'a missing placement is not an executed failing action');
  assert.deepEqual(result.candidate, candidate);
});

test('moving an unrequested bowl rejects the task even when cup delivery and controller succeed', () => {
  const actions = [navigate('counter'), handle('pickup', 'counter', 'bowl'), navigate('table'), handle('place', 'table', 'bowl'),
    navigate('counter'), handle('pickup', 'counter'), navigate('sink'), handle('place', 'sink')];
  const result = evaluate({ actions });
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedPlacements, 2);
  assert.equal(result.checks.find(check => check.id === 'object-delivered')?.passed, true);
  assert.equal(result.checks.find(check => check.id === 'protected-bowl')?.passed, false);
  assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'protected-object');
  assert.equal(result.failureStepIndex, 1);
  assert.deepEqual(result.failedAction, actions[1]);
});

test('picking up and returning a protected bowl still fails even when its complete final state is restored', () => {
  const seed = createMobileKitchen();
  const goal = { objectId: 'bowl' as const, stationId: 'table' as const };
  const initial = evaluateMobileCandidate({ world: seed, candidate: baselineMobileCandidate(seed, goal), goal, source: 'human', label: 'Initial bowl placement' }).finalWorld;
  const candidate = baselineMobileCandidate(initial);
  candidate.actions.push(navigate('table'), handle('reach-check', 'table', 'bowl'), handle('pickup', 'table', 'bowl'), handle('place', 'table', 'bowl'), navigate('sink'));
  const result = evaluate(candidate, initial);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.completedPickups, 2);
  assert.equal(result.completedPlacements, 2);
  assert.deepEqual(result.finalWorld.objects.find(object => object.id === 'bowl'), initial.objects.find(object => object.id === 'bowl'));
  assert.equal(result.checks.find(check => check.id === 'object-delivered')?.passed, true);
  assert.equal(result.checks.find(check => check.id === 'protected-bowl')?.passed, false);
  assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'protected-object');
  assert.equal(result.failureStepIndex, 7, 'the first actual protected pickup is step8, even when a reach check ends in the same native tick');
  assert.deepEqual(result.failedAction, { skill: 'pickup', station: 'table', objectId: 'bowl' });
  assert.equal(result.error, undefined, 'task-rule violation does not invent a controller execution error');
  assert.deepEqual(result.protectedObjectPolicy, MOBILE_PROTECTED_POLICY);
  assert.equal(result.protectedViolations.length, 1, 'Only the first native violation per object is recorded');
  const violation = result.protectedViolations[0];
  assert.equal(violation.objectId, 'bowl');
  assert.equal(violation.stepIndex, 7);
  assert.equal(violation.worldTimeSeconds, initial.simTime + violation.timeSeconds);
  const firstChanged = result.trajectory.find(sample => mobileProtectedChange(initial.objects[1], sample.world.objects[1]).violated)!;
  assert.ok(firstChanged, 'The exact first native violation must be forced into replay, not inferred from a later 10 Hz sample');
  assert.equal(firstChanged.time, violation.timeSeconds);
  assert.equal(firstChanged.world.simTime, violation.worldTimeSeconds);
  const bowl = firstChanged.world.objects[1];
  assert.deepEqual(violation.position, [bowl.position[0], bowl.height + 0.09, bowl.position[1]]);
  const recomputed = mobileProtectedChange(initial.objects[1], bowl);
  assert.equal(violation.displacementMeters, recomputed.displacementMeters);
  assert.deepEqual(violation.changedFields, recomputed.changedFields);
  assert.equal(mobileProtectedChange(initial.objects[1], result.finalWorld.objects[1]).violated, false, 'Identical final state cannot erase the latched native violation');
});

test('a protected-object reach inspection without movement remains allowed and invents no violating action', () => {
  const world = createMobileKitchen();
  world.objects[1] = { ...world.objects[1], position: [1.14, 0], height: 0.85, station: 'table', status: 'delivered' };
  const candidate = baselineMobileCandidate(world);
  candidate.actions.push(navigate('table'), handle('reach-check', 'table', 'bowl'), navigate('sink'));
  const result = evaluate(candidate, world);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.taskAccepted, true);
  assert.equal(result.failureCategory, null);
  assert.equal(result.failureStepIndex, null);
  assert.equal(result.failedAction, null);
  assert.deepEqual(result.finalWorld.objects[1], world.objects[1]);
  assert.deepEqual(result.protectedViolations, []);
  assert.equal(result.protectedObjectPolicy.positionToleranceMeters, 0);
});

test('a blocked map refuses a declared route without fabricated movement or successful counts', () => {
  const initial = createMobileKitchen();
  initial.obstacles.push({ id: 'wall', label: 'Partition', minX: -0.1, maxX: 0.1, minZ: -3.5, maxZ: 3.5 });
  const candidate = baselineMobileCandidate(initial);
  const result = evaluate(candidate, initial);
  assert.equal(result.planValid, true);
  assert.equal(result.outcome, 'refused');
  assert.equal(result.failureCategory, 'no-route');
  assert.equal(result.failureStepIndex, 3);
  assert.deepEqual(result.failedAction, candidate.actions[3]);
  assert.equal(result.completedSteps, 0);
  assert.equal(result.distanceTravelled, 0);
  assert.equal(result.ticks, 0);
  assert.deepEqual(result.trajectory, [{ time: 0, world: initial }]);
  assert.deepEqual(result.finalWorld, initial);
});

test('out-of-reach object fails the submitted reach check after actual travel with correct action attribution', () => {
  const world = createMobileKitchen();
  world.objects[0].position = [-3.2, -3.3];
  const candidate = baselineMobileCandidate(world);
  const result = evaluate(candidate, world);
  assert.equal(result.outcome, 'failed');
  assert.equal(result.failureCategory, 'reach');
  assert.equal(result.failureStepIndex, 1);
  assert.deepEqual(result.failedAction, candidate.actions[1]);
  assert.equal(result.completedSteps, 1);
  assert.equal(result.completedPickups, 0);
  assert.ok(result.distanceTravelled >= 3.9);
  assert.equal(result.taskAccepted, false);
});

test('human occupancy is an actual blocked attempt at zero travel and clock, with paused replay state', () => {
  const initial = createMobileKitchen();
  const world = setMobileHuman(initial, [...initial.robot.position]);
  const result = evaluate(baselineMobileCandidate(world), world);
  assert.equal(result.outcome, 'blocked');
  assert.equal(result.failureCategory, 'human-blocked');
  assert.equal(result.failureStepIndex, 0);
  assert.equal(result.distanceTravelled, 0);
  assert.equal(result.simulatedSeconds, 0);
  assert.equal(result.finalWorld.robot.mode, 'paused');
  assert.deepEqual(result.finalWorld.objects, world.objects);
  assert.equal(result.trajectory[0].world.robot.mode, 'idle');
  assert.equal(result.trajectory.at(-1)?.world.robot.mode, 'paused');
  assert.equal(result.taskAccepted, false);
});

test('strict candidate validation rejects aliases, extras, malformed primitives and action count bounds', () => {
  const world = createMobileKitchen();
  const invalid = [null, [], {}, { actions: [] }, { actions: Array(13).fill(navigate('counter')) },
    { actions: [navigate('counter')], goal: { objectId: 'cup', stationId: 'sink' } },
    { actions: [{ skill: 'navigate', station: 'counter', objectId: null }] },
    { actions: [{ skill: 'navigate', station: 'Counter' }] },
    { actions: [{ skill: 'move', station: 'sink' }] },
    { actions: [{ skill: 'pickup', station: 'counter', objectId: 'Cup' }] },
    { actions: [{ skill: 'pickup', station: 'counter', objectId: 'fork' }] },
    { actions: [{ skill: 'pickup', station: 'counter', objectId: 'cup', score: 1 }] },
    { actions: ['navigate counter'] }];
  for (const payload of invalid) {
    assert.equal(validateMobileCandidate(payload, world).valid, false, JSON.stringify(payload));
    const result = evaluate(payload, world);
    assert.equal(result.outcome, 'invalid');
    assert.equal(result.failureCategory, 'invalid-plan');
    assert.equal(result.completedSteps, 0);
    assert.equal(result.ticks, 0);
    assert.equal(result.trajectory.length, 1);
    assert.deepEqual(result.finalWorld, world);
  }
});

test('non-JSON executable values are rejected without invocation or a structured-clone exception', () => {
  let invoked = false;
  const candidate = { actions: [{ skill: 'navigate', station: 'counter', execute: () => { invoked = true; } }] };
  const result = evaluate(candidate);
  assert.equal(result.outcome, 'invalid');
  assert.equal(result.completedSteps, 0);
  assert.equal(invoked, false);
});

test('the seed, submitted payload, replay samples and output snapshots remain independent copies', () => {
  const world = createMobileKitchen(3);
  const candidate = baselineMobileCandidate(world);
  const snapshot = structuredClone({ world, candidate });
  const result = evaluate(candidate, world);
  assert.deepEqual({ world, candidate }, snapshot);
  assert.equal(result.taskAccepted, true);
  result.finalWorld.objects[0].position[0] = 99;
  assert.deepEqual(result.initialWorld, world);
  assert.notEqual(result.trajectory.at(-1)?.world.objects[0].position[0], 99);
  assert.deepEqual(candidate, snapshot.candidate);
});

test('replay uses bounded chronological actual samples, original clock offset and continuous carrier motion', () => {
  const world = createMobileKitchen();
  world.simTime = 42;
  const result = evaluate(baselineMobileCandidate(world), world);
  assert.equal(result.trajectory[0].time, 0);
  assert.equal(result.trajectory[0].world.simTime, 42);
  assert.deepEqual(result.trajectory.at(-1)?.world, result.finalWorld);
  assert.ok(result.trajectory.length > 100 && result.trajectory.length <= result.executionBudget.maxSamples);
  assert.ok(result.ticks <= 6000);
  let sawCarriedTravel = false;
  for (const [index, sample] of result.trajectory.entries()) {
    assert.ok(Number.isFinite(sample.time));
    assert.ok(Math.abs(sample.world.simTime - 42 - sample.time) < 1e-8);
    if (index) assert.ok(sample.time >= result.trajectory[index - 1].time);
    const cup = sample.world.objects.find(object => object.id === 'cup')!;
    if (cup.status === 'carried') {
      assert.deepEqual(cup.position, sample.world.robot.position);
      sawCarriedTravel ||= sample.world.distanceTravelled > 4.1;
    }
  }
  assert.ok(sawCarriedTravel);
  assert.ok(Number.isFinite(result.evaluationDurationMs));
});

test('old completed candidate missions cannot leak completed action counts into a refused or invalid new attempt', () => {
  const previous = evaluate(baselineMobileCandidate(createMobileKitchen())).finalWorld;
  assert.equal(previous.mission?.completedSteps, 5);
  const invalid = evaluate({ actions: [] }, previous);
  assert.equal(invalid.completedSteps, 0);
  assert.equal(invalid.completedPickups, 0);
  const blocked = structuredClone(previous);
  blocked.obstacles.push({ id: 'wall', label: 'Partition', minX: -0.1, maxX: 0.1, minZ: -3.5, maxZ: 3.5 });
  const refusal = evaluate({ actions: [navigate('counter')] }, blocked);
  assert.equal(refusal.outcome, 'refused');
  assert.equal(refusal.completedSteps, 0);
});

test('model provenance is retained, measured request duration stays separate, and passing candidates receive no invented failures', () => {
  const world = createMobileKitchen();
  const result = evaluateMobileCandidate({ world, candidate: baselineMobileCandidate(world), source: 'llm', label: 'Model attempt',
    model: 'test-model', requestDurationMs: 1234.5, instruction: 'Deliver the cup to the sink.' });
  assert.equal(result.model, 'test-model');
  assert.equal(result.source, 'llm');
  assert.equal(result.requestDurationMs, 1234.5);
  assert.equal(result.instruction, 'Deliver the cup to the sink.');
  assert.equal(result.taskAccepted, true);
  assert.equal(result.failureCategory, null);
  const loaded = JSON.parse(JSON.stringify(result));
  assert.deepEqual(loaded.goal, result.goal);
  assert.deepEqual(loaded.trajectory.at(-1).world, result.finalWorld);
});

test('candidate-specified task overrides are rejected and the independently supplied alternate task is supported', () => {
  const world = createMobileKitchen();
  const goal = { objectId: 'bowl' as const, stationId: 'table' as const };
  const candidate = baselineMobileCandidate(world, goal);
  const result = evaluateMobileCandidate({ world, candidate, goal, source: 'human', label: 'Bowl task' });
  assert.equal(result.taskAccepted, true);
  assert.equal(result.finalWorld.objects.find(object => object.id === 'bowl')?.station, 'table');
  assert.deepEqual(result.finalWorld.objects.find(object => object.id === 'cup'), world.objects.find(object => object.id === 'cup'));
  assert.equal(evaluate({ ...candidate, goal }).outcome, 'invalid');
});

test('unsettled and invalid finite scene state is rejected before executing candidate actions', () => {
  for (const mutate of [
    (world: MobileWorld) => { world.robot.mode = 'running'; },
    (world: MobileWorld) => { world.robot.position[0] = NaN; },
    (world: MobileWorld) => { world.objects[0].position[0] = Infinity; },
    (world: MobileWorld) => { world.cellSize = 0.01; },
    (world: MobileWorld) => { world.robot.cargoObjectId = 'cup'; },
  ]) {
    const world = createMobileKitchen(); mutate(world);
    const result = evaluate({ actions: [navigate('counter')] }, world);
    assert.equal(result.outcome, 'invalid');
    assert.equal(result.ticks, 0);
    assert.equal(result.completedSteps, 0);
  }
});

// Compile-time contract: external planners may emit any primitive order, never executable functions.
const typedCandidate: MobileCandidate = { actions: [navigate('home')] };
void typedCandidate;
