import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, runScenarioHeadless } from './scenarios';

test('all defined scenarios observe their real controller expectations', () => {
  assert.equal(SCENARIOS.length, 4);
  for (const scenario of SCENARIOS) {
    const result = runScenarioHeadless(scenario);
    assert.equal(result.passed, true, JSON.stringify({ scenario: scenario.id, checks: result.checks }));
    assert.equal(result.actualOutcome, scenario.expectedOutcome);
    assert.ok(result.checks.length >= 5);
  }
});

test('out-of-reach scenario refuses before movement or action completion', () => {
  const result = runScenarioHeadless('reach-limit');
  assert.equal(result.actualOutcome, 'failed');
  assert.equal(result.completedActions, 0);
  assert.equal(result.simulatedSeconds, 0);
  assert.match(result.error!, /outside the configured workcell reach/);
  assert.deepEqual(result.finalWorld.objects, result.initialWorld.objects);
  assert.deepEqual(result.finalWorld.robot.position, result.initialWorld.robot.position);
});

test('occupied tray contains three visible rigid bodies and refuses another placement', () => {
  const result = runScenarioHeadless('occupied-tray');
  const occupants = result.initialWorld.objects.filter(object => object.location === 'tray-a');
  assert.equal(occupants.length, 3);
  assert.equal(new Set(occupants.map(object => object.position[0])).size, 3);
  assert.ok(occupants.every(object => object.size.every(dimension => dimension > 0)));
  assert.match(result.error!, /destination tray is full/);
  assert.deepEqual(result.finalWorld.objects, result.initialWorld.objects);
});

test('rearranged scene completes from changed initial positions', () => {
  const baseline = runScenarioHeadless('baseline-sort');
  const variation = runScenarioHeadless('layout-variation');
  assert.notDeepEqual(variation.initialWorld.objects.map(object => object.position), baseline.initialWorld.objects.map(object => object.position));
  assert.equal(variation.completedActions, 3);
  assert.equal(variation.actualOutcome, 'completed');
  assert.deepEqual(variation.finalWorld.objects.map(object => object.location), ['tray-a', 'tray-b', 'tray-a']);
  assert.ok(variation.simulatedSeconds > 0);
});

test('world factories create independent scenes and repeated runs are reproducible', () => {
  for (const scenario of SCENARIOS) {
    const a = scenario.world();
    const b = scenario.world();
    a.objects[0].position[0] = 999;
    assert.notEqual(b.objects[0].position[0], 999);
    assert.deepEqual(runScenarioHeadless(scenario), runScenarioHeadless(scenario));
  }
});

test('an unexpected failure is not mislabelled a passing rejection scenario', () => {
  const reach = SCENARIOS.find(scenario => scenario.id === 'reach-limit')!;
  const invalidInstruction = runScenarioHeadless({ ...reach, instruction: 'Move the purple object to tray A' });
  assert.equal(invalidInstruction.actualOutcome, 'failed');
  assert.equal(invalidInstruction.passed, false);
  assert.equal(invalidInstruction.checks.find(check => check.name === 'Instruction resolved to supported actions')?.passed, false);
  const wrongFailure = runScenarioHeadless({ ...reach, world: SCENARIOS.find(scenario => scenario.id === 'occupied-tray')!.world });
  assert.equal(wrongFailure.passed, false);
  assert.equal(wrongFailure.checks.find(check => check.name === 'Expected refusal reason observed')?.passed, false);
});

test('unknown scenario IDs are rejected explicitly', () => {
  assert.throws(() => runScenarioHeadless('not-a-scenario'), /Unknown scenario/);
});
