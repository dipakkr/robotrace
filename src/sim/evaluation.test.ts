import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationCases, runEvaluationCampaign, runEvaluationCase } from './evaluation';
import { solveArmIK } from './engine';
import { validateScene } from './scene-authoring';

test('campaign executes nine real cases and separates completed tasks from expected refusals', () => {
  const campaign = runEvaluationCampaign();
  assert.equal(campaign.schema, 'teachtrace.evaluation.v1');
  assert.equal(campaign.controller, 'teachtrace-kinematic-v1');
  assert.deepEqual(campaign.summary, { total: 9, passed: 9, failed: 0, taskCompletions: 6, expectedRejections: 3 });
  assert.equal(campaign.simulation.physicalContactValidated, false);
  assert.equal(campaign.simulation.policyTrained, false);
  for (const result of campaign.cases) {
    assert.ok(result.checks.every(check => check.passed), result.name);
    if (result.expectedOutcome === 'completed') {
      assert.equal(result.completedActions, result.environmentId === 'lab' ? 2 : 3);
      assert.ok(result.simulatedDuration > 0);
      assert.ok(result.checks.some(check => check.name === 'Controller settled with empty gripper'));
    } else {
      assert.equal(result.completedActions, 0);
      assert.equal(result.simulatedDuration, 0);
      assert.match(result.error ?? '', /outside the configured workcell reach/);
      assert.deepEqual(result.finalWorld.objects, result.initialWorld.objects);
    }
  }
});

test('seeded layout variants are valid, reachable, different, and independently reproducible', () => {
  const first = createEvaluationCases();
  const second = createEvaluationCases();
  assert.deepEqual(first, second);
  for (const changed of first.filter(item => item.perturbation === 'source-layout')) {
    const nominal = first.find(item => item.environmentId === changed.environmentId && item.perturbation === 'nominal')!;
    assert.notDeepEqual(changed.initialWorld.objects, nominal.initialWorld.objects);
    assert.equal(validateScene(changed.initialWorld).valid, true);
    assert.ok(changed.initialWorld.objects.every(object => solveArmIK(object.position).reachable));
    const a = runEvaluationCase(changed);
    const b = runEvaluationCase(changed);
    assert.deepEqual(a, b);
    assert.deepEqual(changed, second.find(item => item.id === changed.id), 'execution must not mutate the retained scene');
  }
});

test('lab reference remains at its original pose in every perturbation and outcome', () => {
  for (const result of runEvaluationCampaign().cases.filter(item => item.environmentId === 'lab')) {
    const initial = result.initialWorld.objects.find(object => object.id === 'part-green');
    const final = result.finalWorld.objects.find(object => object.id === 'part-green');
    assert.deepEqual(final, initial);
    assert.ok(result.checks.some(check => check.name === 'Reference sample preserved across the attempt' && check.passed));
  }
});

test('unexpected failures and wrong refusal reasons never pass the regression case', () => {
  const nominal = createEvaluationCases()[0];
  const invalid = runEvaluationCase({ ...nominal, instruction: 'Move the purple object to tray A' });
  assert.equal(invalid.actualOutcome, 'failed');
  assert.equal(invalid.passed, false);
  const refusal = createEvaluationCases().find(item => item.perturbation === 'out-of-reach')!;
  const wrongReason = runEvaluationCase({ ...refusal, instruction: 'Move the purple object to tray A' });
  assert.equal(wrongReason.actualOutcome, 'failed');
  assert.equal(wrongReason.passed, false);
  assert.equal(wrongReason.checks.find(check => check.name === 'Expected refusal reason observed')?.passed, false);
});
