import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, planCommand } from './engine';
import type { CommandPlan, WorldState } from './engine';
import { getEnvironment } from './environments';
import { WORKPLACE_CASES } from './workplace-cases';
import { taskForWorld } from './scene-spec';
import { worldForCommand } from './command-task';
function execute(initial: WorldState, plan: CommandPlan) {
  let world = initial;
  for (const step of plan.steps) {
    let done = false;
    for (let tick = 0; tick < 1000; tick++) { const result = advanceWorld(world, step, 0.1); assert.equal(result.error, undefined); world = result.world; if (result.done) { done = true; break; } }
    assert.equal(done, true);
  }
  return world;
}
test('after-meal follow-up freezes a fresh Cup Sink→Drying task with the actual protected Bowl', () => {
  const story = WORKPLACE_CASES.find(item => item.id === 'after-meal')!;
  const initial = story.world;
  const first = planCommand(story.instruction, initial);
  const originalId = initial.customTask!.id;
  assert.equal(worldForCommand(initial, first, story.instruction).customTask!.id, originalId);
  const collected = execute(initial, first), before = structuredClone(collected);
  const instruction = 'Move all cups from sink to drying rack';
  const plan = planCommand(instruction, collected);
  assert.equal(plan.error, undefined);
  const task = worldForCommand(collected, plan, instruction);
  assert.notEqual(task.customTask!.id, originalId);
  assert.match(task.customTask!.id!, /^custom-[a-f\d-]{36}$/);
  assert.equal(task.customTask!.instruction, instruction);
  assert.deepEqual(task.customTask!.assignments.map(item => [item.objectId, item.destination, item.unchanged]), [
    ['used-cup-red', 'tray-b', false], ['used-cup-blue', 'tray-b', false], ['reserved-bowl', 'table', true],
  ]);
  const final = execute(task, plan);
  assert.ok(taskForWorld(task)!.successChecks(final).every(check => check.passed));
  assert.deepEqual(final.objects[2], before.objects[2]);
  assert.deepEqual(collected, before);
  assert.notEqual(worldForCommand(collected, plan, instruction).customTask!.id, task.customTask!.id, 'A changed task cannot reuse an existing submitted identity');
});
test('named tasks retain identity and explicit tasks cannot erase a protected reference', () => {
  const lab = getEnvironment('lab').world();
  assert.equal(worldForCommand(lab, planCommand('Route the samples', lab), 'Route the samples').environmentId, 'lab');
  assert.throws(() => worldForCommand(lab, { steps: [{ id: 'bad', kind: 'pick_place', objectId: 'part-green', destination: 'tray-a', label: 'Bad reference move' }], summary: '', confirmationRequired: false }, 'Move reference to Rack A'), /protected/);
});

test('a partial follow-up preserves an unrequested cup already in Sink rack and Bowl on the table', () => {
  const story = WORKPLACE_CASES.find(item => item.id === 'after-meal')!;
  const initial = story.world;
  const collected = execute(initial, planCommand(story.instruction, initial));
  const command = 'Move the red cup from sink to drying rack';
  const plan = planCommand(command, collected);
  assert.equal(plan.error, undefined);
  const task = worldForCommand(collected, plan, command);
  assert.deepEqual(task.customTask!.assignments.map(target => [target.objectId, target.destination, target.unchanged]), [
    ['used-cup-red', 'tray-b', false], ['used-cup-blue', 'tray-a', true], ['reserved-bowl', 'table', true],
  ]);
  const final = execute(task, plan);
  assert.ok(taskForWorld(task)!.successChecks(final).every(check => check.passed));
  assert.deepEqual(final.objects[1], collected.objects[1]);
  assert.deepEqual(final.objects[2], collected.objects[2]);
});
