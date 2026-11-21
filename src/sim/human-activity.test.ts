import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, createInitialWorld, planCommand } from './engine';
import type { ActionStep, WorldState } from './engine';
import { getEnvironment } from './environments';

const targetStep = (world: WorldState) => planCommand('Move red to tray A', world).steps[0];

function transferState(): { world: WorldState; step: ActionStep } {
  let world = createInitialWorld();
  const step = targetStep(world);
  for (let tick = 0; tick < 500; tick++) {
    world = advanceWorld(world, step, 1 / 60).world;
    if (world.robot.phase === 'Transferring part' && world.robot.heldObjectId === 'part-red') return { world, step };
  }
  throw new Error('The controller did not reach its held-object transfer phase.');
}

test('entering the workspace during transfer freezes the clock, held object and active motion exactly', () => {
  const { world: source, step } = transferState();
  const occupied: WorldState = { ...source, humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } };
  const snapshot = structuredClone(occupied);
  const result = advanceWorld(occupied, step, 0.5);
  assert.equal(result.done, false);
  assert.equal(result.error, undefined);
  assert.match(result.blocked!, /Clear the scenario.*resume/);
  assert.equal(result.world.robot.mode, 'paused');
  assert.equal(result.world.robot.phase, 'Human workspace scenario: awaiting clearance');
  assert.equal(result.world.simTime, occupied.simTime);
  assert.equal(result.world.revision, occupied.revision);
  assert.deepEqual(result.world.objects, occupied.objects);
  assert.deepEqual(result.world.motion, occupied.motion);
  assert.deepEqual(result.world.robot.position, occupied.robot.position);
  assert.equal(result.world.robot.gripperOpen, occupied.robot.gripperOpen);
  assert.equal(result.world.robot.heldObjectId, 'part-red');
  assert.deepEqual(occupied, snapshot, 'the input snapshot must never be mutated');
  assert.deepEqual(result.world, { ...snapshot, robot: { ...snapshot.robot, mode: 'paused', phase: 'Human workspace scenario: awaiting clearance' } });
});

test('nearby and clear scenario states do not block supported motion', () => {
  for (const state of ['nearby', 'clear'] as const) {
    let world: WorldState = { ...createInitialWorld(), humanPresence: { state, source: 'scenario-proxy' } };
    const step = targetStep(world);
    let finished = false;
    for (let tick = 0; tick < 500; tick++) {
      const result = advanceWorld(world, step, 1 / 30);
      assert.equal(result.blocked, undefined);
      assert.equal(result.error, undefined);
      world = result.world;
      if (result.done) { finished = true; break; }
    }
    assert.equal(finished, true);
    assert.equal(world.objects[0].location, 'tray-a');
    assert.equal(world.humanPresence?.state, state);
  }
});

test('clearing the human scenario leaves the robot paused until an operator resumes', () => {
  const transfer = transferState();
  const blocked = advanceWorld({ ...transfer.world, humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } }, transfer.step, 1 / 30).world;
  const cleared: WorldState = { ...blocked, humanPresence: { state: 'clear', source: 'scenario-proxy' } };
  const stillPaused = advanceWorld(cleared, transfer.step, 1);
  assert.equal(stillPaused.world, cleared);
  assert.equal(stillPaused.done, false);
  assert.equal(stillPaused.world.robot.mode, 'paused');
  let resumed: WorldState = { ...cleared, robot: { ...cleared.robot, mode: 'running' } };
  let finished = false;
  for (let tick = 0; tick < 500; tick++) {
    const result = advanceWorld(resumed, transfer.step, 1 / 30);
    assert.equal(result.error, undefined);
    assert.equal(result.blocked, undefined);
    resumed = result.world;
    if (result.done) { finished = true; break; }
  }
  assert.equal(finished, true);
  assert.equal(resumed.objects[0].location, 'tray-a');
  assert.equal(resumed.robot.heldObjectId, null);
});

test('an attempted resume while the workspace is still occupied blocks before any movement', () => {
  const { world, step } = transferState();
  const occupied: WorldState = { ...world, humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } };
  const paused = advanceWorld(occupied, step, 0.2).world;
  const result = advanceWorld({ ...paused, robot: { ...paused.robot, mode: 'running' } }, step, 0.2);
  assert.ok(result.blocked);
  assert.equal(result.world.robot.mode, 'paused');
  assert.equal(result.world.simTime, occupied.simTime);
  assert.deepEqual(result.world.objects, occupied.objects);
});

test('an occupied workspace also blocks the first idle-to-running tick', () => {
  const world: WorldState = { ...createInitialWorld(), humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } };
  const result = advanceWorld(world, targetStep(world), 1 / 30);
  assert.ok(result.blocked);
  assert.equal(result.world.simTime, 0);
  assert.equal(result.world.motion, null);
  assert.deepEqual(result.world.robot.position, world.robot.position);
  assert.deepEqual(result.world.objects, world.objects);
});

test('ordinary paused, stopped and error worlds retain their existing hold behavior', () => {
  for (const mode of ['paused', 'stopped', 'error'] as const) {
    const world: WorldState = { ...createInitialWorld(), humanPresence: { state: 'in-workspace', source: 'scenario-proxy' } };
    world.robot = { ...world.robot, mode, phase: 'Existing operator hold' };
    const result = advanceWorld(world, targetStep(world), 1 / 30);
    assert.equal(result.world, world);
    assert.equal(result.blocked, undefined);
    assert.equal(result.world.robot.phase, 'Existing operator hold');
  }
});

test('human activity commands use explicit bounded phrases without dispatching object motion', () => {
  const world = createInitialWorld();
  const snapshot = structuredClone(world);
  const cases = [
    ['Simulate a person nearby', 'human-nearby'],
    ['Please simulate a human nearby.', 'human-nearby'],
    ['A person is nearby', 'human-nearby'],
    ['Simulate a person entering workspace', 'human-enter'],
    ['Human enters', 'human-enter'],
    ['Person enters the workspace', 'human-enter'],
    ['Clear the human workspace scenario', 'human-clear'],
    ['Human leaves', 'human-clear'],
    ['The person left the workspace', 'human-clear'],
  ] as const;
  for (const [command, control] of cases) {
    const plan = planCommand(command, world);
    assert.equal(plan.control, control, command);
    assert.deepEqual(plan.steps, []);
    assert.equal(plan.error, undefined);
  }
  assert.deepEqual(world, snapshot);
});

test('normal robot and environment commands keep their original meanings', () => {
  const world = createInitialWorld();
  assert.equal(planCommand('Move red to tray A', world).steps[0].objectId, 'part-red');
  assert.equal(planCommand('Clear the counter', getEnvironment('kitchen').world()).steps.length, 3);
  assert.equal(planCommand('Pause', world).control, 'pause');
  assert.equal(planCommand('Resume', world).control, 'resume');
  assert.equal(planCommand('Clear the table', world).control, undefined);
  assert.equal(planCommand('Move red to tray A after a person enters', world).control, undefined);
});
