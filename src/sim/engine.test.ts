import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, ARM_LINKS, createInitialWorld, destinationPosition, planCommand, solveArmIK, TABLE_TOP } from './engine';
import type { ActionStep, WorldState } from './engine';

function execute(source: WorldState, step: ActionStep): WorldState {
  let world = { ...source, robot: { ...source.robot, mode: 'running' as const } };
  for (let i = 0; i < 500; i++) {
    const result = advanceWorld(world, step, 1 / 30);
    assert.equal(result.error, undefined);
    world = result.world as typeof world;
    if (result.done) return world;
  }
  throw new Error('Controller failed to complete the bounded motion');
}

test('pick and place commits verified object location and releases gripper', () => {
  const initial = createInitialWorld();
  const snapshot = JSON.stringify(initial);
  const plan = planCommand('Move the red block to tray A', initial);
  assert.equal(plan.error, undefined);
  assert.equal(plan.steps.length, 1);
  const final = execute(initial, plan.steps[0]);
  const object = final.objects.find(object => object.id === 'part-red')!;
  assert.equal(object.location, 'tray-a');
  assert.equal(object.status, 'placed');
  assert.equal(object.position[1], TABLE_TOP + 0.07 + object.size[1] / 2);
  assert.equal(final.robot.heldObjectId, null);
  assert.equal(final.robot.mode, 'idle');
  assert.equal(final.revision, 1);
  assert.equal(JSON.stringify(initial), snapshot, 'pure advancement must not mutate caller snapshots');
});

test('all three objects receive distinct non-overlapping slots in the same tray', () => {
  let world = createInitialWorld();
  const plan = planCommand('Move all parts to the left tray', world);
  assert.equal(plan.steps.length, 3);
  for (const step of plan.steps) world = execute(world, step);
  assert.ok(world.objects.every(object => object.location === 'tray-a'));
  const slots = new Set(world.objects.map(object => object.position[0]));
  assert.equal(slots.size, 3);
});

test('sort uses the documented red/green A and blue B assignment', () => {
  const plan = planCommand('Sort all parts', createInitialWorld());
  assert.deepEqual(plan.steps.map(step => [step.objectId, step.destination]), [['part-red', 'tray-a'], ['part-blue', 'tray-b'], ['part-green', 'tray-a']]);
});

test('ambiguous destinations and unknown objects cause no action', () => {
  const world = createInitialWorld();
  assert.equal(planCommand('Move red into the tray', world).steps.length, 0);
  assert.ok(planCommand('Move red into the tray', world).error);
  assert.equal(planCommand('Move the purple part to tray A', world).steps.length, 0);
  assert.ok(planCommand('Move the purple part to tray A', world).error);
  assert.ok(planCommand('Move purple and blue to tray A', world).error, 'known objects must not cause unknown references to be silently ignored');
  assert.ok(planCommand('Move red to tray A and blue to tray B', world).error, 'multi-target commands must not silently send everything to the first tray');
  assert.ok(planCommand('Clear the table', world).error, 'table mentioned as a source must not be inferred as a destination');
});

test('pause and stop freeze clock, end effector, and held object', () => {
  let world = createInitialWorld();
  const step = planCommand('Move red to tray A', world).steps[0];
  for (let i = 0; i < 65; i++) world = advanceWorld(world, step, 1 / 30).world;
  assert.equal(world.robot.heldObjectId, 'part-red');
  for (const mode of ['paused', 'stopped'] as const) {
    const held = { ...world, robot: { ...world.robot, mode } };
    const snapshot = JSON.stringify(held);
    const result = advanceWorld(held, step, 0.5);
    assert.equal(result.done, false);
    assert.equal(JSON.stringify(result.world), snapshot);
  }
  const resumed = execute({ ...world, robot: { ...world.robot, mode: 'running' } }, step);
  assert.equal(resumed.objects[0].location, 'tray-a');
});

test('unreachable targets fail before any simulated time or movement', () => {
  const world = createInitialWorld();
  world.objects[0].position = [8, 0.9, 0];
  const result = advanceWorld(world, planCommand('Move red to tray A', world).steps[0], 0.03);
  assert.match(result.error!, /outside/);
  assert.equal(result.world.simTime, 0);
  assert.deepEqual(result.world.robot.position, world.robot.position);
});

test('repeated completion callback is idempotent', () => {
  const world = createInitialWorld();
  const step = planCommand('Move red to tray A', world).steps[0];
  const final = execute(world, step);
  const repeated = advanceWorld(final, step, 0.5);
  assert.equal(repeated.done, true);
  assert.equal(repeated.world, final);
  assert.equal(repeated.world.revision, 1);
});

test('review tray requires confirmation and records rejected status', () => {
  const world = createInitialWorld();
  const plan = planCommand('Move the green block to review', world);
  assert.equal(plan.confirmationRequired, true);
  const final = execute(world, plan.steps[0]);
  assert.equal(final.objects[2].status, 'rejected');
  assert.equal(final.objects[2].location, 'reject');
});

test('invalid time inputs never corrupt simulator state', () => {
  const world = createInitialWorld();
  const step = planCommand('Move red to tray A', world).steps[0];
  for (const dt of [NaN, Infinity, -1, 0]) assert.equal(advanceWorld(world, step, dt).world, world);
});

test('inverse kinematics preserves arm link lengths at initial and tray poses', () => {
  const positions = [...createInitialWorld().objects.map(object => object.position), destinationPosition('tray-a'), destinationPosition('tray-b')];
  for (const position of positions) {
    const ik = solveArmIK(position);
    assert.equal(ik.reachable, true);
    assert.ok(Math.abs(Math.hypot(...ik.elbow.map((value, index) => value - ik.shoulder[index])) - ARM_LINKS[0]) < 1e-8);
    assert.ok(Math.abs(Math.hypot(...ik.wrist.map((value, index) => value - ik.elbow[index])) - ARM_LINKS[1]) < 1e-8);
  }
});
