import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, planCommand, TABLE_TOP } from './engine';
import type { ActionStep, WorldState } from './engine';
import { checkCustomTask, taskForWorld, validateSceneSpec, worldFromSceneSpec } from './scene-spec';
import type { SceneSpec } from './scene-spec';

const kitchen = (): SceneSpec => ({ version: 1, title: 'Two cups for service', baseEnvironmentId: 'kitchen', instruction: 'Prepare the two-cup serving setup',
  objects: [{ id: 'cup-red', label: 'Red cup', asset: 'cup', color: 'red', slot: 0 }, { id: 'cup-blue', label: 'Blue cup', asset: 'cup', color: 'blue', slot: 1 }, { id: 'bowl-green', label: 'Reference bowl', asset: 'bowl', color: 'green', slot: 3 }],
  assignments: [{ objectId: 'cup-red', destination: 'tray-a', unchanged: false }, { objectId: 'cup-blue', destination: 'tray-a', unchanged: false }, { objectId: 'bowl-green', destination: 'table', unchanged: true }] });

test('a supported AI scene becomes a grounded custom task with preserved provenance', () => {
  const spec = kitchen(); const world = worldFromSceneSpec(spec, { prompt: 'Two cups and a reference bowl', model: 'test-model' });
  assert.equal(world.environmentId, 'custom'); assert.equal(world.baseEnvironmentId, 'kitchen');
  assert.equal(world.objects[0].semanticType, 'cup'); assert.equal(world.customTask?.assignments.length, 3);
  assert.equal(world.sceneProvenance?.reviewRequired, true); assert.equal(world.sceneProvenance?.model, 'test-model');
  assert.equal(taskForWorld(world)?.name, spec.title);
});

test('approved authored instruction executes actual placements and preserves its reference', () => {
  let world = worldFromSceneSpec(kitchen()); const initial = structuredClone(world); const plan = planCommand(kitchen().instruction, world);
  assert.equal(plan.error, undefined); assert.equal(plan.steps.length, 2);
  for (const step of plan.steps) {
    world.robot.mode = 'running';
    for (let frame = 0; frame < 1000; frame++) { const next = advanceWorld(world, step, 0.08); world = next.world; assert.equal(next.error, undefined); if (next.done) break; }
  }
  assert.ok(checkCustomTask(initial, world).every(check => check.passed));
  assert.deepEqual(world.objects[2].position, initial.objects[2].position);
  assert.equal(planCommand('Complete scene task', initial).steps.length, 2);
});

test('scene drafts reject unsupported assets, duplicate IDs/slots and missing goals', () => {
  const spec = kitchen(); spec.objects[1].slot = spec.objects[0].slot; spec.objects[1].id = spec.objects[0].id; spec.assignments.pop();
  const validation = validateSceneSpec(spec); assert.equal(validation.valid, false); assert.ok(validation.errors.length >= 3);
  const bad = { ...kitchen(), objects: [{ ...kitchen().objects[0], asset: 'humanoid' }] };
  assert.equal(validateSceneSpec(bad).valid, false);
  assert.throws(() => worldFromSceneSpec(bad), /Unsupported object asset/);
});

test('unknown and oversubscribed goals never reach the controller', () => {
  const spec = kitchen(); spec.assignments[0].objectId = 'invisible-object'; assert.equal(validateSceneSpec(spec).valid, false);
  const many = kitchen(); many.objects = Array.from({ length: 4 }, (_, index) => ({ id: `object-${index}`, label: `Object ${index}`, asset: 'block', color: 'red', slot: index }));
  many.assignments = many.objects.map(item => ({ objectId: item.id, destination: 'tray-a', unchanged: false }));
  assert.equal(validateSceneSpec(many).valid, false); assert.throws(() => worldFromSceneSpec(many), /at most three/);
});

test('authored goal checks reject location strings and disturbed protected objects', () => {
  const initial = worldFromSceneSpec(kitchen()); const forged = structuredClone(initial);
  forged.objects[0].location = 'tray-a'; forged.objects[0].status = 'placed';
  assert.equal(checkCustomTask(initial, forged).find(check => check.id === 'target-cup-red')?.passed, false);
  forged.objects[2].position[0] += 0.1;
  assert.equal(checkCustomTask(initial, forged).find(check => check.id === 'target-bowl-green')?.passed, false);
});

function execute(world: WorldState, step: ActionStep): WorldState {
  for (let tick = 0; tick < 1000; tick++) {
    const result = advanceWorld(world, step, 1 / 30);
    assert.equal(result.error, undefined);
    world = result.world;
    if (result.done) return world;
  }
  throw new Error('Controller did not finish the test placement.');
}

test('a real return to the table satisfies its ready-state goal and supported footprint', () => {
  const spec = kitchen();
  spec.assignments[0].destination = 'table';
  const initial = worldFromSceneSpec(spec);
  let final = execute(structuredClone(initial), { id: 'cup-out', kind: 'pick_place', label: 'Out', objectId: 'cup-red', destination: 'tray-a' });
  final = execute(final, { id: 'cup-back', kind: 'pick_place', label: 'Return', objectId: 'cup-red', destination: 'table' });
  final = execute(final, { id: 'blue-place', kind: 'pick_place', label: 'Blue serving cup', objectId: 'cup-blue', destination: 'tray-a' });
  assert.equal(final.objects[0].status, 'ready');
  assert.equal(final.objects[0].position[1], TABLE_TOP + final.objects[0].size[1] / 2);
  assert.ok(checkCustomTask(initial, final).every(check => check.passed));
});

test('table acceptance rejects hovering, invalid coordinates and a footprint beyond the edge', () => {
  const spec = kitchen(); spec.assignments[0].destination = 'table';
  const initial = worldFromSceneSpec(spec);
  for (const position of [[2.09, initial.objects[0].position[1], 0], [0, 1.3, 0], [0, NaN, 0]]) {
    const final = structuredClone(initial);
    final.objects[0].position = position as [number, number, number];
    assert.equal(checkCustomTask(initial, final).find(check => check.id === 'target-cup-red')?.passed, false);
  }
});

test('unchanged references retain their complete record, including identity and geometry metadata', () => {
  const initial = worldFromSceneSpec(kitchen());
  for (const change of ['label', 'color', 'size', 'semanticType'] as const) {
    const final = structuredClone(initial);
    const reference = final.objects[2];
    if (change === 'size') reference.size[0] += 0.01;
    else reference[change] = 'changed';
    assert.equal(checkCustomTask(initial, final).find(check => check.id === 'target-bowl-green')?.passed, false, change);
  }
});

test('missing or duplicate authored goals cannot yield vacuous acceptance', () => {
  for (const assignments of [[], [kitchen().assignments[0], kitchen().assignments[0], kitchen().assignments[2]]]) {
    const initial = worldFromSceneSpec(kitchen());
    initial.customTask!.assignments = assignments;
    const checks = checkCustomTask(initial, structuredClone(initial));
    assert.equal(checks[0].id, 'task-defined');
    assert.equal(checks[0].passed, false);
  }
});
