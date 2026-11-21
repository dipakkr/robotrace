import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld } from './engine';
import type { ActionStep, WorldState } from './engine';
import { ENVIRONMENTS, getEnvironment } from './environments';
import type { EnvironmentDefinition } from './environments';
import { validateScene } from './scene-authoring';

function execute(source: WorldState, step: ActionStep): WorldState {
  let world: WorldState = { ...source, robot: { ...source.robot, mode: 'running' } };
  for (let frame = 0; frame < 500; frame++) {
    const result = advanceWorld(world, step, 1 / 30);
    assert.equal(result.error, undefined, `${step.label}: ${result.error}`);
    world = result.world;
    if (result.done) return world;
  }
  throw new Error('Controller did not complete the environment target.');
}

function complete(environment: EnvironmentDefinition): WorldState {
  let world = environment.world();
  for (const target of environment.targets.filter(target => !target.unchanged)) {
    world = execute(world, { id: `${environment.id}-${target.objectId}`, kind: 'pick_place',
      label: `Move ${target.objectId}`, objectId: target.objectId, destination: target.destination });
  }
  return world;
}

test('three task families have distinct geometry, semantics, and acceptance assignments', () => {
  assert.deepEqual(ENVIRONMENTS.map(environment => environment.id), ['workbench', 'kitchen', 'lab']);
  const worlds = ENVIRONMENTS.map(environment => environment.world());
  assert.equal(new Set(worlds.map(world => JSON.stringify(world.objects.map(object => object.position)))).size, 3);
  assert.equal(new Set(worlds.map(world => JSON.stringify(world.destinationLabels))).size, 3);
  assert.equal(worlds[1].objects.find(object => object.semanticType === 'cup')?.kind, 'cylinder');
  assert.equal(worlds[1].objects.find(object => object.semanticType === 'bowl')?.kind, 'cylinder');
  assert.deepEqual(getEnvironment('kitchen').targets.map(target => target.destination), ['tray-a', 'tray-a', 'tray-b']);
  assert.deepEqual(getEnvironment('lab').targets[2], { objectId: 'part-green', destination: 'table', unchanged: true });
});

test('every environment starts as valid independent controller data', () => {
  for (const environment of ENVIRONMENTS) {
    const original = environment.world();
    const another = environment.world();
    assert.deepEqual(validateScene(original), { valid: true, errors: [] });
    assert.equal(original.environmentId, environment.id);
    assert.ok(environment.successChecks(original).some(check => !check.passed));
    original.objects[0].position[0] = 99;
    original.objects[0].size[0] = 0.6;
    original.destinationLabels!['tray-a'] = 'Mutated label';
    assert.deepEqual(another, environment.world(), 'factory instances must not share mutable vectors or labels');
  }
});

for (const environment of ENVIRONMENTS) {
  test(`${environment.id} completes through real controller steps and task checks`, () => {
    const final = complete(environment);
    assert.ok(environment.successChecks(final).every(check => check.passed), JSON.stringify(environment.successChecks(final)));
    assert.equal(final.environmentId, environment.id);
    assert.deepEqual(final.destinationLabels, environment.world().destinationLabels);
    for (const object of final.objects) assert.equal(object.semanticType, environment.world().objects.find(candidate => candidate.id === object.id)?.semanticType);
  });
}

test('task checks reject forged placement strings without destination geometry', () => {
  const environment = getEnvironment('kitchen');
  const world = environment.world();
  for (const target of environment.targets) {
    const object = world.objects.find(candidate => candidate.id === target.objectId)!;
    object.location = target.destination;
    object.status = 'placed';
  }
  assert.ok(environment.successChecks(world).filter(check => check.id.startsWith('target-')).every(check => !check.passed));
  const final = complete(environment);
  final.objects[0].position[1] += 0.1;
  assert.equal(environment.successChecks(final).find(check => check.id === 'target-part-red')?.passed, false);
});

test('lab acceptance rejects a disturbed reference even if it remains on the bench', () => {
  const environment = getEnvironment('lab');
  const final = complete(environment);
  const reference = final.objects.find(object => object.id === 'part-green')!;
  reference.position[0] += 0.08;
  assert.equal(environment.successChecks(final).find(check => check.id === 'target-part-green')?.passed, false);
});

test('an unresolved controller or unaccounted object prevents task acceptance', () => {
  const environment = getEnvironment('workbench');
  const final = complete(environment);
  final.robot.mode = 'error';
  assert.equal(environment.successChecks(final).find(check => check.id === 'controller-settled')?.passed, false);
  final.robot.mode = 'idle';
  final.robot.heldObjectId = 'part-red';
  assert.equal(environment.successChecks(final).find(check => check.id === 'controller-settled')?.passed, false);
  final.objects.push({ ...final.objects[0], id: 'unassigned-object' });
  assert.equal(environment.successChecks(final).find(check => check.id === 'task-inventory')?.passed, false);
});

test('unknown environment IDs fail explicitly', () => {
  assert.throws(() => getEnvironment('unsupported'), /Unknown environment/);
});
