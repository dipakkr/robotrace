import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_PROTECTED_POLICY, mobileProtectedChange } from './mobile-protected-policy.mjs';

const object = () => ({ id: 'bowl', label: 'Bowl', position: [1.14, 0], height: 0.85, station: 'table', status: 'delivered' });

test('the shared protected-object policy declares exact zero-tolerance complete-record semantics', () => {
  assert.equal(MOBILE_PROTECTED_POLICY.id, 'teachtrace.mobile-protected-record.v1');
  assert.equal(MOBILE_PROTECTED_POLICY.positionToleranceMeters, 0);
  assert.equal(MOBILE_PROTECTED_POLICY.positionCriterion, 'any-exact-coordinate-change');
  assert.equal(MOBILE_PROTECTED_POLICY.recordCriterion, 'complete-initial-object-record-unchanged');
  assert.equal(Object.isFrozen(MOBILE_PROTECTED_POLICY), true);
  assert.deepEqual(mobileProtectedChange(object(), object()), { violated: false, positionChanged: false, recordChanged: false, displacementMeters: 0, changedFields: [] });
});

test('a position-only change has no hidden movement threshold and uses rendered world XYZ', () => {
  const initial = object(), current = object();
  current.position[0] += 1e-10;
  const tiny = mobileProtectedChange(initial, current);
  assert.equal(tiny.violated, true); assert.equal(tiny.positionChanged, true);
  assert.ok(tiny.displacementMeters! > 0 && tiny.displacementMeters! < 1e-9);
  assert.deepEqual(tiny.changedFields, ['position']);
  current.position = [initial.position[0] + 0.03, initial.position[1] + 0.04]; current.height += 0.12;
  assert.ok(Math.abs(mobileProtectedChange(initial, current).displacementMeters! - 0.13) < 1e-12);
});

test('status-only handling violates the complete record even at exactly zero displacement', () => {
  const initial = object(), current = { ...object(), status: 'loading' };
  assert.deepEqual(mobileProtectedChange(initial, current), { violated: true, positionChanged: false, recordChanged: true, displacementMeters: 0, changedFields: ['status'] });
  assert.deepEqual(mobileProtectedChange(initial, { ...object(), label: 'Renamed' }).changedFields, ['label']);
});

test('record key order and extra JSON metadata retain the original exact JSON comparison policy', () => {
  const initial = object(), reordered = Object.fromEntries(Object.entries(initial).reverse());
  const change = mobileProtectedChange(initial, reordered);
  assert.equal(change.violated, true); assert.equal(change.positionChanged, false);
  assert.deepEqual(change.changedFields, ['$record-order']);
  assert.deepEqual(mobileProtectedChange(initial, { ...initial, extra: true }).changedFields, ['extra']);
  assert.equal(mobileProtectedChange(initial, undefined).violated, true);
});
