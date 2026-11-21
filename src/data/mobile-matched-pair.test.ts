import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileMatchedPair, canonicalMobilePairJSON, hashMobilePairScene, verifyMobileMatchedPair } from './mobile-matched-pair';
import { baselineMobileCandidate, evaluateMobileCandidate } from '../sim/mobile-candidates';
import { createMobileEvaluationCases } from '../sim/mobile-evaluation-cases';
function runs() {
 const world = createMobileEvaluationCases().find(item => item.id === 'protected-table')!.world;
 const good = baselineMobileCandidate(world), bad = structuredClone(good);
 bad.actions.push({ skill: 'navigate', station: 'table' }, { skill: 'reach-check', station: 'table', objectId: 'bowl' }, { skill: 'pickup', station: 'table', objectId: 'bowl' }, { skill: 'place', station: 'table', objectId: 'bowl' }, { skill: 'navigate', station: 'sink' });
 return [evaluateMobileCandidate({ world, candidate: good, source: 'baseline', label: 'Bounded recipe' }), evaluateMobileCandidate({ world, candidate: bad, source: 'baseline', label: 'Authored protected round trip' })] as const;
}
test('self-contained matched export preserves both Cup→Sink outcomes, original IDs and unreviewed preference', async () => {
 const values = runs(), initial = structuredClone(values);
 const pair = await buildMobileMatchedPair(values, { instruction: 'Deliver Cup to Sink. Leave Bowl untouched.' });
 assert.deepEqual(values, initial); assert.deepEqual(pair.runs.map(run => run.id), values.map(run => run.id));
 assert.ok(pair.runs.every(run => run.finalWorld.objects.find(object => object.id === 'cup')?.station === 'sink'));
 assert.equal(pair.runs[0].taskAccepted, true); assert.equal(pair.runs[1].taskAccepted, false); assert.equal(pair.runs[1].failureStepIndex, 7);
 assert.deepEqual(pair.runs[1].finalWorld.objects[1], pair.runs[1].initialWorld.objects[1]);
 assert.equal(pair.preference?.chosenRunId, values[0].id); assert.equal(pair.preference?.rejectedRunId, values[1].id);
 assert.equal(pair.preference?.reviewStatus, 'candidate-unreviewed'); assert.equal(pair.preference?.trainingValidated, false);
 assert.equal(pair.provenance.liveHumanRunIncluded, false); assert.deepEqual(await verifyMobileMatchedPair(JSON.parse(JSON.stringify(pair))), { valid: true, errors: [] });
});
test('reversed run order preserves IDs and chooses the actually accepted run', async () => {
 const [a, b] = runs(); const pair = await buildMobileMatchedPair([b, a]); assert.equal(pair.preference?.chosenRunId, a.id); assert.equal(pair.preference?.rejectedRunId, b.id);
});
test('different frozen worlds or goals cannot become a matched preference', async () => {
 const [a, b] = runs(); b.initialWorld.seed++; await assert.rejects(buildMobileMatchedPair([a, b]), /endpoints|initial world/);
 const [c, d] = runs(); d.goal.stationId = 'table'; await assert.rejects(buildMobileMatchedPair([c, d]), /same independently/);
});
test('full-package integrity detects modified trace and preference fields', async () => {
 const pair = await buildMobileMatchedPair(runs()); pair.runs[1].trajectory[3].world.robot.yaw += 0.1;
 assert.equal((await verifyMobileMatchedPair(pair)).valid, false);
 const other = await buildMobileMatchedPair(runs()); other.preference!.reviewStatus = 'human-reviewed' as 'candidate-unreviewed';
 assert.equal((await verifyMobileMatchedPair(other)).valid, false);
});
test('two accepted runs have no invented rejected preference and copies remain independent', async () => {
 const [a] = runs(); const b = structuredClone(a); b.id = crypto.randomUUID(); const pair = await buildMobileMatchedPair([a, b]);
 assert.equal(pair.preference, undefined); pair.runs[0].initialWorld.robot.position[0] = 99; assert.notEqual(a.initialWorld.robot.position[0], 99); assert.notEqual(pair.runs[1].initialWorld.robot.position[0], 99);
});
test('accepted labels cannot override failed checks and incomplete recordings cannot be exported', async () => {
 const [a, b] = runs(); b.taskAccepted = true; await assert.rejects(buildMobileMatchedPair([a, b]), /accepted label/);
 const [c, d] = runs(); d.trajectory.reverse(); await assert.rejects(buildMobileMatchedPair([c, d]), /endpoints|chronological/);
});
test('canonical scene digest sorts keys while retaining array order and rejects nonfinite values', async () => {
 assert.equal(canonicalMobilePairJSON({ b: 2, a: [1, 2] }), '{"a":[1,2],"b":2}');
 assert.notEqual(canonicalMobilePairJSON([1, 2]), canonicalMobilePairJSON([2, 1])); assert.throws(() => canonicalMobilePairJSON({ a: NaN }), /finite/);
 const [a] = runs(); assert.match(await hashMobilePairScene(a.initialWorld, a.goal), /^[a-f0-9]{64}$/);
});
test('export copying preserves source object-key order and recorded key-order-only protected changes', async () => {
 const values = runs(); const before = JSON.stringify(values);
 const sample = values[1].trajectory[1];
 assert.equal(canonicalMobilePairJSON(sample.world.objects[1]), canonicalMobilePairJSON(values[1].initialWorld.objects[1]));
 sample.world.objects[1] = Object.fromEntries(Object.entries(sample.world.objects[1]).reverse()) as typeof sample.world.objects[1];
 const originalOrder = Object.keys(sample.world.objects[1]);
 const pair = await buildMobileMatchedPair(values);
 const copied = pair.runs[1].trajectory[1];
 assert.deepEqual(Object.keys(copied.world.objects[1]), originalOrder);
 assert.equal(JSON.stringify(pair.runs), JSON.stringify(values));
 assert.notEqual(JSON.stringify(values), before, 'fixture has a real recorded key-order change');
 assert.equal(pair.runs[1].failureCategory, 'protected-object');
});
test('external human or operator interventions are not silently packaged as a no-intervention matched pair', async () => {
 const [a, b] = runs(); b.trajectory[3].world.human = { position: [0, 0], radius: 0.4, source: 'scenario-proxy' };
 await assert.rejects(buildMobileMatchedPair([a, b]), /external human/);
 const [c, d] = runs(); d.trajectory[3].world.events.push({ time: 0.1, kind: 'control', message: 'Operator pause applied.' });
 await assert.rejects(buildMobileMatchedPair([c, d]), /external control/);
});
