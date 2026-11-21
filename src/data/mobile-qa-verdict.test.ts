import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedBehaviorVerdict } from './mobile-qa-verdict';
import { createMobileEvaluationCases } from '../sim/mobile-evaluation-cases';
import { baselineMobileCandidate, evaluateMobileCandidate } from '../sim/mobile-candidates';
import type { MobileCandidateAction } from '../sim/mobile-candidates';

const cases = createMobileEvaluationCases();
const run = (index: number, actions = baselineMobileCandidate(cases[index].world).actions) => evaluateMobileCandidate({ world: cases[index].world, candidate: { actions }, source: 'baseline', label: 'Verdict test' });

test('all real fixture outcomes match separately while only three tasks complete', () => {
  const results = cases.map((_, index) => run(index));
  assert.equal(results.filter(result => result.taskAccepted).length, 3);
  assert.deepEqual(results.map((result, index) => expectedBehaviorVerdict(cases[index].expected, result).status), Array(cases.length).fill('matched'));
  assert.match(expectedBehaviorVerdict(cases[1].expected, results[1]).label, /guard/);
  assert.equal(results[1].outcome === 'completed', false);
});

test('the actual wrong reason and an actual wrong destination are mismatches', () => {
  const docking = run(1, [{ skill: 'pickup', station: 'counter', objectId: 'cup' }]);
  assert.equal(docking.failureCategory, 'docking');
  assert.equal(expectedBehaviorVerdict('reach-refusal', docking).status, 'mismatch');
  const wrong = run(0, baselineMobileCandidate(cases[0].world).actions.map(action => action.station === 'sink' ? { ...action, station: 'table' } : action));
  assert.equal(wrong.outcome, 'completed');
  assert.equal(wrong.failureCategory, 'wrong-goal');
  assert.equal(expectedBehaviorVerdict('task-completion', wrong).status, 'mismatch');
  assert.equal(expectedBehaviorVerdict('protected-reference-preservation', wrong).status, 'mismatch');
});

test('the negative reference fixture requires its actual completed-but-rejected detector result', () => {
  const actions: MobileCandidateAction[] = [...baselineMobileCandidate(cases[4].world).actions,
    { skill: 'navigate', station: 'table' }, { skill: 'reach-check', station: 'table', objectId: 'bowl' },
    { skill: 'pickup', station: 'table', objectId: 'bowl' }, { skill: 'place', station: 'table', objectId: 'bowl' }, { skill: 'navigate', station: 'sink' }];
  const result = run(4, actions);
  assert.equal(result.outcome, 'completed'); assert.equal(result.taskAccepted, false);
  assert.deepEqual(result.finalWorld.objects[1], cases[4].world.objects[1]);
  assert.equal(expectedBehaviorVerdict('protected-reference-preservation', result).status, 'matched');
  assert.equal(expectedBehaviorVerdict('task-completion', result).status, 'mismatch');
  assert.equal(expectedBehaviorVerdict('protected-reference-preservation', run(4)).status, 'mismatch');
});

test('counts cannot contradict an expected refusal and unknown cases never become a match', () => {
  assert.equal(expectedBehaviorVerdict('route-refusal', { ...run(2), distanceTravelled: 0.001 }).status, 'mismatch');
  assert.equal(expectedBehaviorVerdict('reach-refusal', { ...run(1), completedPickups: 1 }).status, 'mismatch');
  assert.equal(expectedBehaviorVerdict('human-block', { ...run(3), completedPlacements: 1 }).status, 'mismatch');
  assert.equal(expectedBehaviorVerdict('task-completion', { ...run(0), checks: [] }).status, 'mismatch');
  for (const expected of [undefined, '', 'future-case']) assert.equal(expectedBehaviorVerdict(expected, run(0)).status, 'unscored');
});
