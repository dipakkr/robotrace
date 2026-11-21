import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, createInitialWorld, destinationPosition, TABLE_TOP, planCommand } from '../sim/engine';
import { evaluateCandidatePlan } from '../sim/candidate-plans';
import { getEnvironment } from '../sim/environments';
import type { EnvironmentId } from '../sim/environments';
import type { WorldState } from '../sim/engine';
import { buildEvidencePackage, sealEvidencePackage, validateEvidencePackage, verifyEvidencePackage } from './evidence';
import type { EvidenceEpisode } from './evidence';

const copy = <T>(value: T): T => structuredClone(value);

function referenceRoundTrip(): EvidenceEpisode {
  const initialWorld = getEnvironment('lab').world();
  initialWorld.environmentId = 'custom';
  initialWorld.objects[2].position = [...destinationPosition('table', 2)];
  initialWorld.objects[2].position[1] = TABLE_TOP + initialWorld.objects[2].size[1] / 2;
  initialWorld.customTask = { id: 'custom-11111111-1111-4111-8111-111111111111', title: 'Preserve reference', instruction: 'Route carriers and preserve reference', assignments: [
    { objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' },
    { objectId: 'part-green', destination: 'table', unchanged: true },
  ] };
  const samples: EvidenceEpisode['samples'] = [];
  const result = evaluateCandidatePlan({ world: initialWorld, steps: [
    { objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }, { objectId: 'part-green', destination: 'table' },
  ], source: 'llm', label: 'Round trip', onSample: (world, time) => samples.push({ time, world: copy(world) }) });
  return { id: 'reference-round-trip', title: 'Restored reference violation', createdAt: new Date().toISOString(), duration: result.simulatedDuration,
    status: 'review', outcome: 'completed', initialWorld, samples, completedActions: 3, command: initialWorld.customTask.instruction,
    events: [{ time: 0, kind: 'command', label: initialWorld.customTask.instruction }, ...result.steps.map(step => ({
      time: samples.find(sample => sample.world.lastCompletedStepId === step.id)!.time, kind: 'success' as const, label: step.label,
    }))] };
}

/** Capture real controller states and completion IDs, as the application's recorder does. */
function recordEpisode(environmentId: EnvironmentId, fail = false): EvidenceEpisode {
  const environment = getEnvironment(environmentId);
  let world = environment.world();
  if (fail) world.objects[0].position = [1.92, 0.9, -0.95];
  const initial = copy(world);
  const plan = planCommand(environment.instruction, world);
  assert.equal(plan.error, undefined);
  const samples: EvidenceEpisode['samples'] = [{ time: 0, world: copy(initial) }];
  const events: EvidenceEpisode['events'] = [{ time: 0, kind: 'command', label: environment.instruction }];
  let completedActions = 0;
  let outcome: EvidenceEpisode['outcome'] = 'completed';
  for (const step of plan.steps) {
    world = { ...world, robot: { ...world.robot, mode: 'running' } };
    for (let frame = 0; frame < 1000; frame++) {
      const result = advanceWorld(world, step, 1 / 30);
      world = result.world;
      if (frame % 3 === 0 || result.done) samples.push({ time: world.simTime, world: copy(world) });
      if (result.done) {
        if (result.error) {
          outcome = 'failed';
          events.push({ time: world.simTime, kind: 'error', label: result.error });
        } else {
          completedActions++;
          events.push({ time: world.simTime, kind: 'success', label: step.label });
        }
        break;
      }
      if (frame === 999) throw new Error('Fixture controller timed out.');
    }
    if (outcome === 'failed') break;
  }
  if (outcome === 'completed') events.push({ time: world.simTime, kind: 'success', label: 'Task completed and placement verified' });
  samples.push({ time: world.simTime, world: copy(world) }); // intentional duplicate final timestamp
  return { id: `evidence-${environmentId}`, title: environment.name, scenarioId: environmentId,
    createdAt: '2026-11-21T06:00:00.000Z', duration: world.simTime, status: 'review', outcome,
    initialWorld: initial, samples, events, completedActions, command: environment.instruction };
}

for (const environmentId of ['workbench', 'kitchen', 'lab'] as const) {
  test(`${environmentId}: real controller recording exports its own SOP, assignments and checks`, () => {
    const episode = recordEpisode(environmentId);
    const before = JSON.stringify(episode);
    const bundle = buildEvidencePackage(episode);
    assert.deepEqual(validateEvidencePackage(bundle), { valid: true, errors: [] });
    assert.equal(bundle.schema, 'teachtrace.evidence.v1');
    assert.equal(bundle.episode.schema, 'teachtrace.episode.v1');
    assert.equal(bundle.task?.id, environmentId);
    assert.deepEqual(bundle.task?.assignments, getEnvironment(environmentId).targets);
    assert.equal(bundle.metrics.taskAcceptancePassed, true);
    assert.equal(bundle.metrics.completedActions, environmentId === 'lab' ? 2 : 3);
    assert.equal(bundle.metrics.observedCompletionCount, bundle.metrics.completedActions);
    assert.equal(bundle.humanReview.approved, false);
    assert.equal(JSON.stringify(episode), before, 'builder must not mutate the recorder data');
    assert.deepEqual(buildEvidencePackage(episode), bundle, 'pure builder must be deterministic');
    bundle.scene.finalWorld.objects[0].position[0] = 99;
    assert.equal(JSON.stringify(episode), before, 'bundle world must not alias the original recording');
  });
}

test('consumer can JSON parse, verify integrity, and load native initial/final states', async () => {
  const episode = recordEpisode('lab');
  episode.status = 'approved';
  const report = { id: 'report-1', episodeId: episode.id, text: 'Two controller actions completed; reference unchanged.' };
  const sealed = await sealEvidencePackage(buildEvidencePackage(episode, report));
  const consumer = JSON.parse(JSON.stringify(sealed));
  assert.deepEqual(await verifyEvidencePackage(consumer), { valid: true, errors: [] });
  assert.equal(consumer.integrity.sha256.length, 64);
  assert.equal(consumer.humanReview.approved, true);
  assert.equal(consumer.humanReview.identityVerified, false);
  assert.deepEqual(consumer.scene.initialWorld, episode.initialWorld);
  assert.deepEqual(consumer.scene.finalWorld, episode.samples.at(-1)!.world);
  assert.deepEqual(consumer.report, report);
  const final: WorldState = consumer.episode.samples.at(-1).world;
  assert.ok(getEnvironment('lab').successChecks(final).every(check => check.passed));
  assert.deepEqual(sealed.episode.events, episode.events);
  assert.equal(sealed.manifest.simulationFidelity.policyTrained, false);
  assert.equal(sealed.manifest.simulationFidelity.physicalContactValidated, false);
  assert.equal(sealed.manifest.simulationFidelity.simToRealValidated, false);
});

test('native evidence retains protected history failures even when final object records match exactly', () => {
  const episode = referenceRoundTrip();
  assert.deepEqual(episode.samples.at(-1)!.world.objects[2], episode.initialWorld.objects[2]);
  const payload = buildEvidencePackage(episode);
  assert.equal(payload.metrics.taskAcceptancePassed, false);
  assert.equal(payload.checks.find(check => check.id === 'target-part-green')?.passed, false);
  assert.deepEqual(validateEvidencePackage(payload), { valid: true, errors: [] });
  const forged = copy(payload);
  forged.checks.find(check => check.id === 'target-part-green')!.passed = true;
  forged.metrics.taskAcceptancePassed = true;
  assert.equal(validateEvidencePackage(forged).valid, false);
});

test('canonical integrity survives pretty printing and JSON object key order changes', async () => {
  const sealed = await sealEvidencePackage(buildEvidencePackage(recordEpisode('workbench')));
  const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  assert.deepEqual(await verifyEvidencePackage(reorder(JSON.parse(JSON.stringify(sealed, null, 2)))), { valid: true, errors: [] });
});

test('integrity detects tampering even when remaining schema and simulator checks still agree', async () => {
  const sealed = await sealEvidencePackage(buildEvidencePackage(recordEpisode('kitchen'), { text: 'Original persisted report' }));
  sealed.report!.text = 'Changed after export';
  assert.equal(validateEvidencePackage(sealed).valid, true, 'a free-text report edit is structurally valid');
  const result = await verifyEvidencePackage(sealed);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /integrity mismatch/);
});

test('unsealed evidence is structurally valid but not verified as a sealed package', async () => {
  const bundle = buildEvidencePackage(recordEpisode('lab'));
  assert.equal(validateEvidencePackage(bundle).valid, true);
  assert.equal((await verifyEvidencePackage(bundle)).valid, false);
  const sealed = await sealEvidencePackage(bundle);
  const invalid = { ...sealed, integrity: { ...sealed.integrity, algorithm: 'MD5' } };
  assert.equal((await verifyEvidencePackage(invalid)).valid, false);
});

test('chronological samples allow an identical final timestamp but reject reversal or empty input', () => {
  const bundle = buildEvidencePackage(recordEpisode('lab'));
  assert.equal(bundle.episode.samples.at(-1)!.time, bundle.episode.samples.at(-2)!.time);
  assert.equal(validateEvidencePackage(bundle).valid, true);
  const reversed = copy(bundle);
  reversed.episode.samples[2].time = reversed.episode.samples[1].time - 0.01;
  assert.match(validateEvidencePackage(reversed).errors.join(' '), /chronological/);
  const empty = copy(bundle);
  empty.episode.samples = [];
  assert.equal(validateEvidencePackage(empty).valid, false);
});

test('nonfinite state and inconsistent sample/world clocks are rejected', () => {
  const bundle = buildEvidencePackage(recordEpisode('workbench'));
  bundle.episode.samples[1].world.robot.position[0] = Infinity;
  assert.equal(validateEvidencePackage(bundle).valid, false);
  bundle.episode.samples[1].world.robot.position[0] = 0;
  bundle.episode.samples[1].world.simTime += 1;
  assert.match(validateEvidencePackage(bundle).errors.join(' '), /clock/);
});

test('a sample cannot silently change environment, object IDs, or held-object identity', () => {
  const bundle = buildEvidencePackage(recordEpisode('lab'));
  const wrongEnvironment = copy(bundle);
  wrongEnvironment.episode.samples[1].world.environmentId = 'kitchen';
  assert.match(validateEvidencePackage(wrongEnvironment).errors.join(' '), /environment/);
  const wrongObject = copy(bundle);
  wrongObject.episode.samples[1].world.objects[0].id = 'unknown-sample';
  assert.equal(validateEvidencePackage(wrongObject).valid, false);
  const wrongHeld = copy(bundle);
  wrongHeld.episode.samples[1].world.robot.heldObjectId = 'unknown-sample';
  assert.match(validateEvidencePackage(wrongHeld).errors.join(' '), /unknown held object/);
});

test('initial and final scene snapshots cannot be substituted independently from the recording', () => {
  const bundle = buildEvidencePackage(recordEpisode('lab'));
  bundle.scene.finalWorld.objects[0].position[0] += 0.1;
  assert.match(validateEvidencePackage(bundle).errors.join(' '), /initial\/final/);
  const initial = buildEvidencePackage(recordEpisode('lab'));
  initial.episode.initialWorld.objects[0].position[0] += 0.1;
  assert.match(validateEvidencePackage(initial).errors.join(' '), /actual initial world/);
});

test('reference disturbance remains a failed task check despite controller completion', () => {
  const episode = recordEpisode('lab');
  // A modified final recording is deliberately not claimed to have passed its SOP.
  for (const sample of episode.samples.slice(-2)) sample.world.objects.find(object => object.id === 'part-green')!.position[0] += 0.08;
  const bundle = buildEvidencePackage(episode);
  assert.equal(bundle.episode.outcome, 'completed', 'controller outcome and task acceptance are separate facts');
  assert.equal(bundle.metrics.taskAcceptancePassed, false);
  assert.equal(bundle.checks.find(check => check.id === 'target-part-green')?.passed, false);
  assert.equal(validateEvidencePackage(bundle).valid, true);
  bundle.checks.find(check => check.id === 'target-part-green')!.passed = true;
  bundle.metrics.taskAcceptancePassed = true;
  assert.match(validateEvidencePackage(bundle).errors.join(' '), /recomputed/);
});

test('unreachable attempts preserve failed outcome, zero actions, and error evidence', async () => {
  const episode = recordEpisode('workbench', true);
  assert.equal(episode.outcome, 'failed');
  const bundle = buildEvidencePackage(episode);
  assert.equal(bundle.episode.outcome, 'failed');
  assert.equal(bundle.metrics.recordedOutcome, 'failed');
  assert.equal(bundle.metrics.completedActions, 0);
  assert.equal(bundle.metrics.taskAcceptancePassed, false);
  assert.ok(bundle.metrics.errorEventCount > 0);
  assert.equal((await verifyEvidencePackage(await sealEvidencePackage(bundle))).valid, true);
  bundle.episode.outcome = 'completed';
  assert.match(validateEvidencePackage(bundle).errors.join(' '), /completed outcome/);
});

test('invented completion counts, outcome metrics, and review approval are rejected', async () => {
  const bundle = buildEvidencePackage(recordEpisode('workbench'));
  const inventedActions = copy(bundle);
  inventedActions.episode.completedActions++;
  assert.match(validateEvidencePackage(inventedActions).errors.join(' '), /cannot be invented/);
  const forgedMetrics = copy(bundle);
  forgedMetrics.metrics.recordedOutcome = 'failed';
  assert.equal(validateEvidencePackage(forgedMetrics).valid, false);
  bundle.humanReview.approved = true;
  assert.match(validateEvidencePackage(bundle).errors.join(' '), /review/);
  await assert.rejects(() => sealEvidencePackage(bundle), /invalid evidence/);
});

test('custom workcells remain native evidence without borrowing a named environment SOP', () => {
  const episode = recordEpisode('workbench', true);
  for (const world of [episode.initialWorld, ...episode.samples.map(sample => sample.world)]) {
    delete world.environmentId;
    delete world.destinationLabels;
  }
  episode.scenarioId = 'custom-workcell';
  const bundle = buildEvidencePackage(episode);
  assert.equal(bundle.task, null);
  assert.equal(bundle.scene.environmentId, null);
  assert.equal(bundle.metrics.taskAcceptancePassed, null);
  assert.deepEqual(bundle.checks, []);
  assert.equal(validateEvidencePackage(bundle).valid, true);
});

test('invalid payloads and schema values fail without throwing during consumer validation', async () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const payload of [null, [], {}, { schema: 'lerobot' }, cyclic, { schema: 'teachtrace.evidence.v1', episode: {} }]) {
    assert.equal(validateEvidencePackage(payload).valid, false);
    assert.equal((await verifyEvidencePackage(payload)).valid, false);
  }
  const initial = createInitialWorld();
  assert.throws(() => buildEvidencePackage({ ...recordEpisode('lab'), initialWorld: initial, samples: [] }), /invalid episode/);
});

test('derived arm coordinates are validated against recorded states and old packages remain readable',()=>{
 const payload=buildEvidencePackage(recordEpisode('workbench'));
 assert.ok(payload.derivedArmTrace?.samples.length);
 payload.derivedArmTrace!.samples[0].joints.positionsRadians[0]+=0.5;
 assert.ok(validateEvidencePackage(payload).errors.some(e=>e.includes('Derived arm telemetry')));
 const legacy=buildEvidencePackage(recordEpisode('workbench'));delete legacy.derivedArmTrace;legacy.manifest.sections=legacy.manifest.sections.filter(s=>s!=='derivedArmTrace');assert.equal(validateEvidencePackage(legacy).valid,true);
});

test('imported provenance cannot smuggle reference media or invent calibration and human sensing',()=>{
 const episode=recordEpisode('kitchen');const reference={kind:'image' as const,sha256:'a'.repeat(64),calibrated:false as const,rightsVerified:false as const,basis:'submitted-reference-frame' as const};
 for(const world of [episode.initialWorld,...episode.samples.map(s=>s.world)])world.sceneProvenance={source:'import',reviewRequired:true,reference:structuredClone(reference)};
 assert.equal(validateEvidencePackage(buildEvidencePackage(episode)).valid,true);
 const corrupt=copy(episode);for(const world of [corrupt.initialWorld,...corrupt.samples.map(s=>s.world)])Object.assign(world.sceneProvenance!.reference!,{calibrated:true,media:'data:image/jpeg;base64,not-native-metadata'});
 assert.throws(()=>buildEvidencePackage(corrupt),/reference fingerprint/);
 const human=copy(episode);Object.assign(human.initialWorld,{humanPresence:{state:'clear',source:'camera-tracking'}});assert.throws(()=>buildEvidencePackage(human),/scenario proxy/);
});

test('native imports bound renderable inventory and reject URL-style material colors',()=>{
 const oversized=recordEpisode('workbench');for(const world of [oversized.initialWorld,...oversized.samples.map(s=>s.world)])for(let i=0;i<4;i++)world.objects.push({...copy(world.objects[0]),id:`extra-${i}`});assert.throws(()=>buildEvidencePackage(oversized),/six-object/);
 const color=recordEpisode('workbench');for(const world of [color.initialWorld,...color.samples.map(s=>s.world)])world.objects[0].color='url(https://example.invalid/tracking)';assert.throws(()=>buildEvidencePackage(color),/hex color/);
});

test('native lineage retains bounded parent grouping but cannot assert an authenticated origin',()=>{
 const episode=recordEpisode('workbench');const derivation={parentSceneSha256:'b'.repeat(64),seed:42,index:1,kind:'layout' as const,basis:'seeded-simulator-variation' as const,identityVerified:false as const};for(const world of [episode.initialWorld,...episode.samples.map(s=>s.world)])world.sceneProvenance={source:'deterministic',reviewRequired:true,derivation:copy(derivation)};
 assert.equal(validateEvidencePackage(buildEvidencePackage(episode)).valid,true);for(const world of [episode.initialWorld,...episode.samples.map(s=>s.world)])Object.assign(world.sceneProvenance!.derivation!,{identityVerified:true});assert.throws(()=>buildEvidencePackage(episode),/declared parent lineage/);
});
