import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { analyzeProtectedInput, analysisCanonicalJSON, analysisSHA256 } from './protected-analysis-core.mjs';
import { renderTraceViewer } from './build-trace-viewer.mjs';
import { runConsumer } from './consume-evidence.mjs';
const { createMobileEvaluationCases } = await tsImport('../src/sim/mobile-evaluation-cases.ts', import.meta.url);
const { baselineMobileCandidate, evaluateMobileCandidate } = await tsImport('../src/sim/mobile-candidates.ts', import.meta.url);
const { buildMobileMatchedPair } = await tsImport('../src/data/mobile-matched-pair.ts', import.meta.url);
const world = createMobileEvaluationCases().find(item => item.id === 'protected-table').world;
const goal = { objectId: 'cup', stationId: 'sink' };
const baseline = baselineMobileCandidate(world, goal);
const correct = evaluateMobileCandidate({ world, candidate: baseline, goal, source: 'baseline', label: 'Preserve Bowl' });
const wrong = evaluateMobileCandidate({ world, goal, source: 'human', label: 'Authored protected round trip', candidate: { actions: [...baseline.actions,
  { skill: 'navigate', station: 'table' }, { skill: 'reach-check', station: 'table', objectId: 'bowl' }, { skill: 'pickup', station: 'table', objectId: 'bowl' },
  { skill: 'place', station: 'table', objectId: 'bowl' }, { skill: 'navigate', station: 'sink' }] } });
const pair = await buildMobileMatchedPair([correct, wrong]);
async function resign(input) { const { integrity, ...unsigned } = input; input.integrity.sha256 = await analysisSHA256(analysisCanonicalJSON(unsigned)); return input; }

test('independent consumer identifies actual protected excursion despite identical final record and delivered Cup in both plans', async () => {
  const report = await analyzeProtectedInput(pair);
  assert.equal(report.integrityVerified, true); assert.equal(report.pair.sameInitialScene, true);
  assert.equal(correct.finalWorld.objects.find(item => item.id === 'cup').station, 'sink');
  assert.equal(wrong.finalWorld.objects.find(item => item.id === 'cup').station, 'sink');
  assert.deepEqual(wrong.finalWorld.objects.find(item => item.id === 'bowl'), wrong.initialWorld.objects.find(item => item.id === 'bowl'));
  assert.equal(report.runs[0].protectedObjectsPassed, true); assert.equal(report.runs[1].protectedObjectsPassed, false);
  const bowl = report.runs[1].protectedObjects[0], native = wrong.protectedViolations[0];
  assert.equal(bowl.finalRecordRestored, true); assert.equal(bowl.finalDisplacementMeters, 0); assert.ok(bowl.peakDisplacementMeters > 0);
  assert.equal(bowl.firstRecordViolation.timeSeconds, native.timeSeconds);
  assert.deepEqual(bowl.firstRecordViolation.positionMeters, native.position);
  assert.equal(report.policy.positionToleranceMeters, 0); assert.equal(report.taskAcceptanceRecomputed, false);
  assert.equal(report.preference.reviewStatus, 'candidate-unreviewed'); assert.equal(report.preference.trainingBenefitMeasured, false);
});
test('metadata-only disturbances fail at zero displacement without inventing a visible motion', async () => {
  const run = structuredClone(correct); delete run.protectedViolations;
  run.trajectory[1].world.objects.find(item => item.id === 'bowl').status = 'loading';
  const report = await analyzeProtectedInput(run), bowl = report.runs[0].protectedObjects[0];
  assert.equal(bowl.independentlyPassed, false); assert.equal(bowl.firstRecordViolation.displacementMeters, 0);
  assert.equal(bowl.firstPositionViolation, null); assert.deepEqual(bowl.firstRecordViolation.changedFields, ['status']);
});
test('any exact coordinate change is detected with zero tolerance, including a submillimeter excursion', async () => {
  const run = structuredClone(correct); delete run.protectedViolations;
  run.trajectory[1].world.objects.find(item => item.id === 'bowl').position[0] += 1e-8;
  const bowl = (await analyzeProtectedInput(run)).runs[0].protectedObjects[0];
  assert.ok(bowl.firstPositionViolation.displacementMeters > 0); assert.ok(bowl.firstPositionViolation.displacementMeters < 1e-7);
});
test('modified traces fail integrity and re-signed mismatched scene/goal cannot become matched evidence', async () => {
  const corrupt = structuredClone(pair); corrupt.runs[1].label = 'changed';
  await assert.rejects(analyzeProtectedInput(corrupt), /integrity mismatch/);
  const changed = structuredClone(pair); changed.runs[1].initialWorld.seed++;
  await assert.rejects(analyzeProtectedInput(await resign(changed)), /same|exact initial/);
});
test('unequal human-intervention schedules and invented first native timing are rejected', async () => {
  const changed = structuredClone(pair); changed.runs[1].trajectory[1].world.human = { position: [0, 0], radius: .4, source: 'scenario-proxy' };
  await assert.rejects(analyzeProtectedInput(await resign(changed)), /intervention schedules differ/);
  const invented = structuredClone(pair); invented.runs[1].protectedViolations[0].timeSeconds = .123456;
  await assert.rejects(analyzeProtectedInput(await resign(invented)), /absent from the exported trajectory/);
});
test('standalone HTML safely embeds source text and preserves its JSON value without external scripts', async () => {
  const malicious = structuredClone(pair); malicious.instruction = '</script><img src=x onerror=alert(1)>';
  const html = await renderTraceViewer(await resign(malicious));
  assert.equal(html.includes('</script><img'), false);
  const data = html.match(/<script type="application\/json" id="initial-data">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(data).instruction, malicious.instruction);
  assert.equal(/<script[^>]+src=/.test(html), false);
});
test('CLI emits an independent report for the exact matched pair and refuses output replacement', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'teachtrace-protected-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'pair.json'), out = join(directory, 'report'); await writeFile(input, JSON.stringify(pair));
  assert.equal(await runConsumer({ args: [input, '--out', out], write: () => {} }), 0);
  const analysis = JSON.parse(await readFile(join(out, 'protected-analysis.json'), 'utf8'));
  assert.equal(analysis.pair.id, pair.id); assert.equal(analysis.runs[1].protectedObjectsPassed, false);
  assert.ok((await readFile(join(out, 'report.html'), 'utf8')).includes(pair.runs[1].id));
  assert.equal(await runConsumer({ args: [input, '--out', out], write: () => {} }), 1);
});
