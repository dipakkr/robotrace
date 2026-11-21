import test from 'node:test';
import assert from 'node:assert/strict';
import { runMobileComparison } from './mobile-comparison';
import { createMobileKitchen } from './mobile-navigation';

test('the same distant target fails stationary reach but succeeds through actual mobile navigation and delivery', () => {
  const initial = createMobileKitchen();
  const result = runMobileComparison(initial);
  assert.equal(result.fixedBase.outcome, 'failed');
  assert.equal(result.fixedBase.taskAccepted, false);
  assert.match(result.fixedBase.error ?? '', /beyond arm reach/);
  assert.equal(result.fixedBase.distanceTravelled, 0);
  assert.equal(result.fixedBase.simulatedSeconds, 0);
  assert.equal(result.fixedBase.completedPickups, 0);
  assert.deepEqual(result.fixedBase.finalWorld.robot.position, initial.robot.position);
  assert.deepEqual(result.fixedBase.finalWorld.objects, initial.objects);
  assert.equal(result.mobileBase.outcome, 'completed');
  assert.equal(result.mobileBase.taskAccepted, true);
  assert.equal(result.mobileBase.completedPickups, 1);
  assert.equal(result.mobileBase.completedPlacements, 1);
  assert.ok(result.mobileBase.distanceTravelled >= 9.9);
  assert.ok(result.mobileBase.simulatedSeconds > 10);
  assert.deepEqual(result.fixedBase.initialWorld, result.mobileBase.initialWorld);
  assert.deepEqual(result.initialWorld, initial);
  assert.equal(result.fixedBase.capabilities.armReach, result.mobileBase.capabilities.armReach);
});

test('mobility cannot fake success when the object remains beyond arm reach at its dock', () => {
  const world = createMobileKitchen();
  world.objects[0].position = [-3.2, -3.3];
  const result = runMobileComparison(world);
  assert.equal(result.fixedBase.taskAccepted, false);
  assert.equal(result.mobileBase.taskAccepted, false);
  assert.equal(result.mobileBase.outcome, 'failed');
  assert.ok(result.mobileBase.distanceTravelled >= 3.9);
  assert.equal(result.mobileBase.completedPickups, 0);
});

test('a blocked floor route is an explicit refusal rather than a completed task in either condition', () => {
  const world = createMobileKitchen();
  world.obstacles.push({ id: 'partition', label: 'Partition', minX: -0.1, maxX: 0.1, minZ: -3.5, maxZ: 3.5 });
  const result = runMobileComparison(world);
  for (const condition of result.results) {
    assert.equal(condition.outcome, 'refused');
    assert.equal(condition.taskAccepted, false);
    assert.equal(condition.completedPickups, 0);
    assert.equal(condition.distanceTravelled, 0);
    assert.match(condition.error ?? '', /no collision-free route/);
  }
});

test('comparison never mutates the shared seed and exposes bounded execution and simulation limits', () => {
  const world = createMobileKitchen(3);
  const before = structuredClone(world);
  const result = runMobileComparison(world, 'Bring bowl to table');
  assert.deepEqual(world, before);
  assert.equal(result.mobileBase.taskAccepted, true);
  assert.equal(result.executionBudget.maxTicksPerCapability, 6000);
  assert.ok(result.results.every(condition => condition.ticks <= 6000 && Number.isFinite(condition.evaluationDurationMs)));
  result.fixedBase.initialWorld.objects[0].position[0] = 99;
  assert.deepEqual(result.mobileBase.initialWorld, before);
  assert.deepEqual(world, before);
  assert.ok(result.limitations.some(limit => limit.includes('no SLAM')));
});
