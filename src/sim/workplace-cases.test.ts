import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, planCommand } from './engine';
import type { ActionStep, WorldState } from './engine';
import { validateScene } from './scene-authoring';
import { taskForWorld } from './scene-spec';
import { WORKPLACE_CASES } from './workplace-cases';

function execute(initial: WorldState, step: ActionStep): WorldState {
  let world = initial;
  for (let tick = 0; tick < 800; tick++) {
    const result = advanceWorld(world, step, 1 / 60);
    assert.equal(result.error, undefined);
    assert.equal(result.blocked, undefined);
    world = result.world;
    if (result.done) return world;
  }
  throw new Error('The household placement exceeded its bounded execution budget.');
}

test('household stories have stable separate identities, fresh worlds, and deterministic provenance', () => {
  assert.equal(WORKPLACE_CASES.length, 3);
  assert.equal(new Set(WORKPLACE_CASES.map(story => story.world.customTask?.id)).size, 3);
  for (const story of WORKPLACE_CASES) {
    const first = story.world, second = story.world;
    assert.deepEqual(validateScene(first), { valid: true, errors: [] });
    assert.deepEqual(first, second);
    assert.match(first.customTask!.id!, /^custom-[a-f\d-]{36}$/);
    assert.equal(first.sceneProvenance?.source, 'deterministic');
    assert.equal(first.baseEnvironmentId, 'kitchen');
    assert.equal(taskForWorld(first)?.instruction, story.instruction);
    first.objects[0].position[0] = 8;
    first.destinationLabels!['tray-a'] = 'Changed';
    first.customTask!.assignments[0].destination = 'reject';
    assert.deepEqual(second, story.world);
  }
});

for (const story of WORKPLACE_CASES) test(`${story.name} runs its real household routing and preserves declared references`, () => {
  const initial = story.world;
  const snapshot = structuredClone(initial);
  const task = taskForWorld(initial)!;
  const plan = planCommand(story.instruction, initial);
  assert.equal(plan.error, undefined);
  assert.equal(plan.control, undefined, 'A household task must not accidentally dispatch reset or another controller command.');
  assert.equal(plan.steps.length, initial.customTask!.assignments.filter(target => !target.unchanged).length);
  let final = initial;
  for (const step of plan.steps) final = execute(final, step);
  assert.ok(task.successChecks(final).every(check => check.passed), JSON.stringify(task.successChecks(final)));
  for (const target of initial.customTask!.assignments.filter(target => target.unchanged)) {
    assert.deepEqual(final.objects.find(object => object.id === target.objectId), snapshot.objects.find(object => object.id === target.objectId));
  }
  assert.deepEqual(initial, snapshot);
});

test('household assignments differ in destinations, protected object semantics, and human context', () => {
  const [clearance, service, shared] = WORKPLACE_CASES.map(story => story.world);
  assert.equal(clearance.destinationLabels!['tray-a'], 'Sink rack');
  assert.equal(clearance.customTask!.assignments.filter(target => target.unchanged).length, 1);
  assert.ok(clearance.objects.find(object => object.id === 'reserved-bowl'));
  assert.equal(service.destinationLabels!['tray-a'], 'Serving tray');
  assert.equal(service.customTask!.assignments.filter(target => target.unchanged).length, 0);
  assert.equal(shared.objects.length, 4);
  assert.equal(shared.humanPresence?.state, 'nearby');
  assert.ok(shared.customTask!.assignments.some(target => target.objectId === 'reserved-place-cup' && target.unchanged));
  assert.equal(WORKPLACE_CASES[2].interruption?.trigger, 'during-transfer');
});

test('shared-kitchen interruption freezes a held object, then requires clearance and explicit resume', () => {
  const story = WORKPLACE_CASES[2], initial = story.world;
  const steps = planCommand(story.instruction, initial).steps;
  let world = initial;
  for (let tick = 0; tick < 500 && world.robot.phase !== 'Transferring part'; tick++) world = advanceWorld(world, steps[0], 1 / 60).world;
  assert.equal(world.robot.heldObjectId, 'tidy-used-cup');
  world = { ...world, humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } };
  const occupied = structuredClone(world);
  const blocked = advanceWorld(world, steps[0], 0.5);
  assert.ok(blocked.blocked); assert.equal(blocked.world.robot.mode, 'paused');
  assert.equal(blocked.world.simTime, occupied.simTime);
  assert.deepEqual(blocked.world.objects, occupied.objects);
  const clear: WorldState = { ...blocked.world, humanPresence: { state: 'clear', source: 'scenario-proxy' } };
  assert.equal(advanceWorld(clear, steps[0], 1).world, clear);
  world = execute({ ...clear, robot: { ...clear.robot, mode: 'running' } }, steps[0]);
  for (const step of steps.slice(1)) world = execute(world, step);
  assert.ok(taskForWorld(initial)!.successChecks(world).every(check => check.passed));
});
