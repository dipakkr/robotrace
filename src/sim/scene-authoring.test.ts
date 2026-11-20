import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialWorld, planCommand } from './engine';
import { draftSceneFromText, validateScene } from './scene-authoring';

test('word and numeric block counts produce the same bounded scene schema', () => {
  const words = draftSceneFromText('Create a sorting workcell with two red blocks and one blue block');
  const numbers = draftSceneFromText('Build a sorting workcell with 2 red blocks and 1 blue block');
  assert.equal(words.error, undefined);
  assert.deepEqual(words.world, numbers.world);
  assert.equal(words.world?.objects.length, 3);
  assert.deepEqual(words.world?.objects.map(object => object.id), ['part-red', 'part-red-2', 'part-blue']);
  assert.deepEqual(words.world?.objects.map(object => object.label), ['Red block 1', 'Red block 2', 'Blue block']);
  assert.equal(validateScene(words.world).valid, true);
});

test('shared trailing noun and an empty workcell are supported explicitly', () => {
  const three = draftSceneFromText('Set up a workcell with one red, one blue, and one green block.');
  assert.equal(three.error, undefined);
  assert.equal(three.world?.objects.length, 3);
  const empty = draftSceneFromText('Create an empty workcell');
  assert.equal(empty.error, undefined);
  assert.deepEqual(empty.world?.objects, []);
  assert.equal(validateScene(empty.world).valid, true);
});

test('six blocks occupy distinct valid tabletop slots', () => {
  const six = draftSceneFromText('Create a workcell with three red blocks and three blue blocks');
  assert.equal(six.error, undefined);
  assert.equal(six.world?.objects.length, 6);
  assert.equal(new Set(six.world?.objects.map(object => object.id)).size, 6);
  assert.equal(validateScene(six.world).valid, true);
});

test('unsupported objects, colors, shapes, and ambiguous counts are rejected', () => {
  for (const text of [
    'Create a workcell with a cloth and one red block',
    'Create a workcell with a humanoid',
    'Create a workcell with a yellow block',
    'Create a workcell with one red sphere',
    'Create a workcell with seven red blocks',
    'Create a workcell with four red and three blue blocks',
    'Create a workcell with -1 red block',
    'Create a workcell with 1.5 red blocks',
    'Create an empty workcell with one red block',
    'Create a workcell with a couple red blocks',
  ]) {
    const result = draftSceneFromText(text);
    assert.equal(result.world, null, text);
    assert.ok(result.error, text);
  }
});

test('named test drafts reuse visible scenario worlds', () => {
  const reach = draftSceneFromText('Create a reach-limit test');
  const occupied = draftSceneFromText('Create an occupied tray test');
  assert.equal(reach.error, undefined);
  assert.equal(occupied.error, undefined);
  assert.equal(reach.world?.objects[0].position[0], 1.92);
  assert.equal(occupied.world?.objects.filter(object => object.location === 'tray-a').length, 3);
  assert.equal(validateScene(occupied.world).valid, true);
  assert.equal(draftSceneFromText('Create a reach-limit test with a cloth').world, null);
});

test('scene validation rejects malformed structure and geometry', () => {
  assert.equal(validateScene(null).valid, false);
  assert.equal(validateScene({}).valid, false);
  const duplicate = createInitialWorld();
  duplicate.objects[1].id = duplicate.objects[0].id;
  assert.ok(validateScene(duplicate).errors.some(error => error.includes('Duplicate')));
  const nan = createInitialWorld();
  nan.objects[0].position[0] = NaN;
  assert.ok(validateScene(nan).errors.some(error => error.includes('finite position')));
  const overlap = createInitialWorld();
  overlap.objects[1].position = [...overlap.objects[0].position];
  assert.ok(validateScene(overlap).errors.some(error => error.includes('overlaps')));
  const unsupported = createInitialWorld();
  (unsupported.objects[0] as unknown as { kind: string }).kind = 'cloth';
  assert.ok(validateScene(unsupported).errors.some(error => error.includes('unsupported')));
  const tooMany = createInitialWorld();
  tooMany.objects = Array.from({ length: 7 }, (_, i) => ({ ...tooMany.objects[0], id: `part-${i}` }));
  assert.ok(validateScene(tooMany).errors.some(error => error.includes('at most 6')));
});

test('authoring creates a preview without mutating its source', () => {
  const source = createInitialWorld();
  const snapshot = JSON.stringify(source);
  const result = draftSceneFromText('Create an empty workcell', source);
  assert.equal(result.error, undefined);
  assert.equal(JSON.stringify(source), snapshot);
  assert.ok(result.changes.some(change => change.includes('Replace the current 3-object scene')));
});

test('duplicate-color commands clarify singular references and support explicit numbers', () => {
  const world = draftSceneFromText('Create a workcell with two red blocks and one blue block').world!;
  assert.ok(planCommand('Move the red block to tray A', world).error);
  const numbered = planCommand('Move red block 2 to tray A', world);
  assert.equal(numbered.error, undefined);
  assert.equal(numbered.steps.length, 1);
  assert.equal(numbered.steps[0].objectId, 'part-red-2');
  assert.equal(planCommand('Move all red blocks to tray A', world).steps.length, 2);
  assert.equal(planCommand('Move red blocks to tray A', world).steps.length, 2);
  assert.equal(planCommand('Move red block 1 and red block 2 to tray A', world).steps.length, 2);
  assert.ok(planCommand('Move red block 3 to tray A', world).error);
  assert.ok(planCommand('Move green to tray A', world).error);
});
