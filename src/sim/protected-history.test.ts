import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnvironment } from './environments';
import { createProtectedHistory, mergeProtectedHistoryChecks } from './protected-history';

test('reference changes and handling remain violations after complete final restoration', () => {
  const initial = getEnvironment('lab').world();
  for (const perturb of [
    (world: typeof initial) => { world.objects[2].position[0] += 0.1; },
    (world: typeof initial) => { world.robot.heldObjectId = 'part-green'; },
    (world: typeof initial) => { world.motion = { objectId: 'part-green' } as typeof world.motion; },
    (world: typeof initial) => { world.objects[2].label = 'Changed identity'; },
  ]) {
    const history = createProtectedHistory(initial);
    const changed = structuredClone(initial); perturb(changed); history.observe(changed);
    history.observe(structuredClone(initial));
    assert.equal(history.checks()[0].passed, false);
    assert.match(history.checks()[0].detail, /restoring its final state/);
  }
});

test('unrelated motion and object key ordering preserve correct legacy check text', () => {
  const initial = getEnvironment('lab').world();
  const history = createProtectedHistory(initial);
  const world = structuredClone(initial);
  world.objects[0].position[0] += 0.1;
  world.objects[2] = Object.fromEntries(Object.entries(world.objects[2]).reverse()) as typeof world.objects[number];
  history.observe(world);
  const checks = [{ id: 'target-part-green', name: 'Reference', passed: true, detail: 'Legacy truthful check wording' }];
  assert.deepEqual(mergeProtectedHistoryChecks(checks, history.checks()), checks);
  assert.equal(history.checks()[0].passed, true);
});

test('history can tighten acceptance but never erase an existing failed predicate', () => {
  const initial = getEnvironment('lab').world();
  const history = createProtectedHistory(initial);
  const failed = [{ id: 'target-part-green', name: 'Reference', passed: false, detail: 'Existing geometry failure' }];
  assert.deepEqual(mergeProtectedHistoryChecks(failed, history.checks()), failed);
  assert.deepEqual(createProtectedHistory(getEnvironment('kitchen').world()).checks(), []);
});
