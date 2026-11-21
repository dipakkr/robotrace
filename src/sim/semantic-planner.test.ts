import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, planCommand } from './engine';
import type { ActionStep, WorldState } from './engine';
import { getEnvironment } from './environments';

function execute(source: WorldState, steps: ActionStep[]): WorldState {
  let world = source;
  for (const step of steps) {
    let complete = false;
    for (let frame = 0; frame < 500; frame++) {
      const result = advanceWorld(world, step, 1 / 30);
      assert.equal(result.error, undefined);
      world = result.world;
      if (result.done) { complete = true; break; }
    }
    assert.ok(complete, `Controller did not complete ${step.id}`);
  }
  return world;
}

test('kitchen labels ground distinct objects and semantic tray labels in the real controller', () => {
  let world = getEnvironment('kitchen').world();
  const cup = planCommand('Move the CUP to the Serving tray', world);
  assert.equal(cup.error, undefined);
  assert.deepEqual(cup.steps.map(step => [step.objectId, step.destination]), [['part-blue', 'tray-a']]);
  assert.match(cup.steps[0].label, /cup to Serving tray/);
  world = execute(world, cup.steps);
  assert.equal(world.objects.find(object => object.id === 'part-blue')?.location, 'tray-a');
  const bowl = planCommand('Place Bowl in Storage tray', world);
  assert.equal(bowl.error, undefined);
  world = execute(world, bowl.steps);
  assert.equal(world.objects.find(object => object.id === 'part-green')?.location, 'tray-b');
  const utensil = planCommand('Move Utensil case to Serving tray', world);
  assert.equal(utensil.error, undefined);
  world = execute(world, utensil.steps);
  assert.ok(getEnvironment('kitchen').successChecks(world).every(check => check.passed));
});

test('lab labels route samples and preserve the reference sample unchanged', () => {
  const environment = getEnvironment('lab');
  const initial = environment.world();
  const reference = structuredClone(initial.objects.find(object => object.id === 'part-green'));
  const alpha = planCommand('Move Sample alpha to Rack A', initial);
  assert.equal(alpha.error, undefined);
  let world = execute(initial, alpha.steps);
  const beta = planCommand('Move Sample beta to Rack B', world);
  assert.equal(beta.error, undefined);
  world = execute(world, beta.steps);
  assert.deepEqual(world.objects.find(object => object.id === 'part-green'), reference);
  assert.ok(environment.successChecks(world).every(check => check.passed));
});

test('named assignments complete each environment using bounded pick-and-place actions', () => {
  for (const [environmentId, command, count] of [
    ['workbench', 'Prepare repair kit', 3],
    ['kitchen', 'Please clear the counter.', 3],
    ['lab', 'Route the samples', 2],
  ] as const) {
    const environment = getEnvironment(environmentId);
    const world = environment.world();
    const snapshot = JSON.stringify(world);
    const plan = planCommand(command, world);
    assert.equal(plan.error, undefined, command);
    assert.equal(plan.steps.length, count);
    assert.ok(plan.steps.every(step => step.kind === 'pick_place'));
    const final = execute(world, plan.steps);
    assert.ok(environment.successChecks(final).every(check => check.passed), command);
    assert.equal(JSON.stringify(world), snapshot, 'planning and execution preserve the source snapshot');
  }
});

test('exact object IDs remain unambiguous and color commands remain supported', () => {
  const kitchen = getEnvironment('kitchen').world();
  kitchen.objects[0].label = 'Cup';
  assert.ok(planCommand('Move Cup to Serving tray', kitchen).error);
  const exact = planCommand('Move part-blue to Serving tray', kitchen);
  assert.equal(exact.error, undefined);
  assert.deepEqual(exact.steps.map(step => step.objectId), ['part-blue']);
  assert.equal(planCommand('Move blue to Serving tray', kitchen).steps[0]?.objectId, 'part-blue');
});

test('unknown, partial, wrong-environment, and multiple-destination requests produce no actions', () => {
  const kitchen = getEnvironment('kitchen').world();
  for (const command of [
    'Move Fork to Serving tray',
    'Move Cup and Fork to Serving tray',
    'Move Cupboard to Serving tray',
    'Move Cup to Rack A',
    'Move Cup to Serving tray and Bowl to Storage tray',
    'Move Cup to Serving tray and Review',
    'Route the samples',
    'Dance with Cup to Serving tray',
  ]) {
    const plan = planCommand(command, kitchen);
    assert.ok(plan.error, command);
    assert.deepEqual(plan.steps, [], command);
  }
  assert.ok(planCommand('Move Sample gamma and Sample alpha to Rack A', getEnvironment('lab').world()).error);
});

test('review confirmation survives semantic names and table labels are destinations only after prepositions', () => {
  const kitchen = getEnvironment('kitchen').world();
  const review = planCommand('Move Cup to Review', kitchen);
  assert.equal(review.error, undefined);
  assert.equal(review.confirmationRequired, true);
  assert.equal(review.steps[0].destination, 'reject');
  const final = execute(kitchen, review.steps);
  assert.equal(final.objects.find(object => object.id === 'part-blue')?.status, 'rejected');
  const back = planCommand('Move Cup to Kitchen counter', final);
  assert.equal(back.error, undefined);
  assert.equal(back.steps[0].destination, 'table');
  assert.ok(planCommand('Clear the Kitchen counter', kitchen).error);
});

test('color selection uses scene colors even when generated IDs have no color token', () => {
 const world=getEnvironment('kitchen').world();world.objects[0].id='cup-1';world.objects[1].id='cup-2';world.objects[2].id='reserved-vessel';
 const blue=planCommand('Move blue to Serving tray',world);assert.equal(blue.error,undefined);assert.deepEqual(blue.steps.map(s=>s.objectId),['cup-2']);
 const filtered=planCommand('Move all except green to Serving tray',world);assert.equal(filtered.error,undefined);assert.deepEqual(filtered.steps.map(s=>s.objectId),['cup-1','cup-2']);
});
