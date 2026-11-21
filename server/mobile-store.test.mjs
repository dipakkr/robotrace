import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, stat, readdir, writeFile, readFile, mkdir, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { createMobileEvidenceStore } from './mobile-store.mjs';

const nav = await tsImport('../src/sim/mobile-navigation.ts', import.meta.url);
const { createMobileEvidence } = await tsImport('../src/data/mobile-evidence.ts', import.meta.url);
const { solveMobileArm } = await tsImport('../src/sim/mobile-arm.ts', import.meta.url);
const { evaluateMobileCandidate } = await tsImport('../src/sim/mobile-candidates.ts', import.meta.url);
const review = { approved: true, identityVerified: false };
const seal = payload => ({ payload, integrity: { algorithm: 'SHA-256', encoding: 'UTF-8 JSON.stringify(payload)', digest: createHash('sha256').update(JSON.stringify(payload)).digest('hex') } });
const badInput = error => error.status === 400;
const fs = { mkdir, readFile, writeFile, link, rm, readdir, stat };

function fixture({ deep = false, stop = false, human = false } = {}) {
  const initial = nav.createMobileKitchen();
  if (deep) initial.objects[0].position = [-3.2, -3.15];
  let result = nav.startMobilePlan(initial, nav.planMobileTask('Take cup from counter to sink', initial));
  let world = result.world;
  const samples = [{ time: initial.simTime, world: structuredClone(initial) }];
  if (human) { world = nav.setMobileHuman(world, [-3, 0]); samples.push({ time: world.simTime, world: structuredClone(world) }); }
  for (let tick = 0; tick < 3000; tick++) {
    result = nav.advanceMobileWorld(world, 0.1); world = result.world;
    if (tick % 2 === 0 || result.done || result.blocked) samples.push({ time: world.simTime, world: structuredClone(world) });
    if (stop && world.robot.cargoObjectId) {
      world = nav.applyMobileControl(world, 'stop').world;
      samples.push({ time: world.simTime, world: structuredClone(world) }); break;
    }
    if (result.done || result.blocked) break;
  }
  if (JSON.stringify(samples.at(-1).world) !== JSON.stringify(world)) samples.push({ time: world.simTime, world: structuredClone(world) });
  return seal(createMobileEvidence(initial, samples, world, null));
}

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'teachtrace-mobile-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('a reviewed actual delivery persists privately and reopens with independently recomputed report', async t => {
  const directory = await temporary(t), store = createMobileEvidenceStore({ dataDirectory: directory });
  const evidence = fixture(), before = structuredClone(evidence);
  const saved = await store.submit({ evidence, review });
  assert.equal(saved.saved, true);
  assert.match(saved.id, /^[a-f\d-]{36}$/);
  assert.equal(saved.report.accepted, true);
  assert.equal(saved.report.outcome, 'completed');
  assert.equal(saved.report.basis, 'independentlyrecomputed-recorded-simulator-state');
  assert.equal(saved.report.motionReplayed, false);
  assert.equal(saved.report.postedReceiptUsedForAcceptance, false);
  assert.equal(saved.report.metrics.sampleCount, evidence.payload.trajectory.length);
  assert.equal(saved.report.metrics.completedPickups, 1);
  assert.equal(saved.report.metrics.completedPlacements, 1);
  assert.ok(saved.report.metrics.distanceTravelled > 9.9);
  assert.ok(saved.report.checks.every(check => check.passed));
  assert.equal(saved.report.sourceHash, evidence.integrity.digest);
  assert.equal(saved.report.provenance.learnedPolicy, false);
  assert.equal(saved.report.review.identityVerified, false);
  assert.match(saved.report.boundaries, /does not authenticate.*execute\/replay/);
  assert.deepEqual(evidence, before);
  const restarted = createMobileEvidenceStore({ dataDirectory: directory });
  const loaded = await restarted.get(saved.id);
  assert.deepEqual(loaded.evidence, evidence);
  assert.deepEqual(loaded.report, saved.report);
  assert.equal((await stat(join(directory, '.mobile', `${saved.id}.json`))).mode & 0o777, 0o600);
  assert.deepEqual((await restarted.list()).map(item => item.id), [saved.id]);
});

test('explicit human review is required before any filesystem mutation', async () => {
  let mutations = 0;
  const store = createMobileEvidenceStore({ dataDirectory: '/unused/local', fs: { ...fs, mkdir: async () => { mutations++; } } });
  for (const supplied of [undefined, null, { approved: false, identityVerified: false }, { approved: true, identityVerified: true }, { approved: true }, { ...review, reviewer: 'fake' }]) {
    await assert.rejects(store.submit({ evidence: fixture(), review: supplied }), badInput);
  }
  assert.equal(mutations, 0);
});

test('stopped, failed and human-blocked recordings persist as nonaccepted despite forged posted scores', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  for (const [options, outcome] of [[{ stop: true }, 'stopped'], [{ deep: true }, 'failed'], [{ human: true }, 'paused']]) {
    const evidence = fixture(options);
    evidence.payload.checks = [{ id: 'invented', name: 'Everything passed', passed: true, detail: 'Not trusted' }];
    evidence.payload.receipt = { status: 'succeeded', verified: true };
    evidence.payload.provenance.learnedPolicy = true;
    const result = await store.submit({ evidence: seal(evidence.payload), review });
    assert.equal(result.report.accepted, false);
    assert.equal(result.report.outcome, outcome);
    assert.ok(result.report.checks.some(check => !check.passed));
    assert.equal(result.report.provenance.learnedPolicy, false, 'The report derives its own fidelity provenance');
    assert.equal(result.report.postedReceiptUsedForAcceptance, false);
  }
  assert.equal((await store.list()).length, 3);
});

test('tampered seals and re-signed corrupted arm coordinates are refused before saving', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  const invalidSeal = fixture(); invalidSeal.payload.trajectory[1].arm.joints.elbow[0] += 0.1;
  await assert.rejects(store.submit({ evidence: invalidSeal, review }), badInput);
  const corrupted = fixture(); corrupted.payload.trajectory[1].arm.joints.elbow[0] += 0.1;
  await assert.rejects(store.submit({ evidence: seal(corrupted.payload), review }), error => error.status === 400 && /arm pose/.test(error.message));
  assert.deepEqual(await store.list(), []);
});

test('a recorded command and its initial interpretation cannot acquire a different goal', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  const evidence = fixture(); evidence.payload.finalWorld.mission.plan.goal.stationId = 'table';
  evidence.payload.trajectory.at(-1).world = structuredClone(evidence.payload.finalWorld);
  evidence.payload.trajectory.at(-1).arm = solveMobileArm(evidence.payload.finalWorld);
  await assert.rejects(store.submit({ evidence: seal(evidence.payload), review }), error => error.status === 400 && /original command/.test(error.message));
});

test('the store rejects malformed worlds, chronology, terminal endpoints and oversized evidence', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  const changes = [
    payload => { payload.trajectory[2].world.stations[0].label = 'Injected station'; },
    payload => { payload.trajectory[2].time = -1; },
    payload => { payload.trajectory[2].world.obstacles[0].minX -= 0.1; },
    payload => { payload.trajectory[2].world.robot.armReach = 1.5; },
    payload => { payload.trajectory[2].world.mission.completedSteps = 99; },
    payload => { payload.trajectory.at(-1).world = structuredClone(payload.initialWorld); },
    payload => { payload.trajectory = Array.from({ length: 1501 }, () => payload.trajectory[0]); },
    payload => { payload.extra = 'x'.repeat(1024 * 1024); },
  ];
  for (const change of changes) {
    const evidence = fixture(); change(evidence.payload);
    await assert.rejects(store.submit({ evidence: seal(evidence.payload), review }), badInput);
  }
  assert.deepEqual(await store.list(), []);
});

test('picking and restoring an unrequested delivered object remains a failed reviewed report', async t => {
  const initialBowl = nav.createMobileKitchen();
  let result = nav.startMobilePlan(initialBowl, nav.planMobileTask('Bring bowl to table', initialBowl));
  for (let tick = 0; tick < 3000 && !result.done; tick++) result = nav.advanceMobileWorld(result.world, 0.1);
  const initial = result.world;
  const actions = [
    { skill: 'navigate', station: 'counter' }, { skill: 'reach-check', station: 'counter', objectId: 'cup' }, { skill: 'pickup', station: 'counter', objectId: 'cup' }, { skill: 'navigate', station: 'sink' }, { skill: 'place', station: 'sink', objectId: 'cup' },
    { skill: 'navigate', station: 'table' }, { skill: 'reach-check', station: 'table', objectId: 'bowl' }, { skill: 'pickup', station: 'table', objectId: 'bowl' }, { skill: 'place', station: 'table', objectId: 'bowl' }, { skill: 'navigate', station: 'sink' },
  ];
  const evaluated = evaluateMobileCandidate({ world: initial, candidate: { actions }, source: 'human', label: 'Reference round trip', instruction: 'Take cup from counter to sink' });
  const samples = evaluated.trajectory.filter((_, index) => index % 3 === 0 || index === evaluated.trajectory.length - 1).map(sample => ({ time: sample.world.simTime, world: sample.world }));
  const payload = createMobileEvidence(initial, samples, evaluated.finalWorld, null);
  assert.deepEqual(payload.finalWorld.objects[1], initial.objects[1]);
  const saved = await createMobileEvidenceStore({ dataDirectory: await temporary(t) }).submit({ evidence: seal(payload), review });
  assert.equal(saved.report.outcome, 'completed');
  assert.equal(saved.report.accepted, false);
  assert.equal(saved.report.checks.find(check => check.id === 'protected-bowl').passed, false);
});

test('snapshot freezing prevents changes after submit from replacing the reviewed source or digest', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  const evidence = fixture(), original = structuredClone(evidence);
  const pending = store.submit({ evidence, review });
  evidence.integrity.digest = '0'.repeat(64); evidence.payload.trajectory[0].arm.joints.elbow[0] += 9;
  const saved = await pending;
  assert.equal(saved.report.sourceHash, original.integrity.digest);
  assert.deepEqual((await store.get(saved.id)).evidence, original);
});

test('malformed IDs never become file paths and identical concurrent/retried submissions are idempotent', async t => {
  let reads = 0;
  const untouched = createMobileEvidenceStore({ dataDirectory: '/unused/local', fs: { ...fs, stat: async () => { reads++; } } });
  for (const id of ['../../secrets', '../mobile.json', 'not-a-uuid', null, '']) assert.equal(await untouched.get(id), null);
  assert.equal(reads, 0);
  const directory = await temporary(t), store = createMobileEvidenceStore({ dataDirectory: directory });
  const evidence = fixture();
  const saved = await Promise.all(Array.from({ length: 3 }, () => store.submit({ evidence, review })));
  assert.equal(new Set(saved.map(item => item.id)).size, 1);
  assert.equal((await store.list()).length, 1);
  const reopened = createMobileEvidenceStore({ dataDirectory: directory });
  assert.deepEqual(await reopened.submit({ evidence, review }), saved[0], 'A retry after a restart returns the original immutable receipt');
  assert.equal((await readdir(join(directory, '.mobile'))).length, 1);
});

test('write/publication failures cannot return a saved receipt and leave no published partial record', async t => {
  for (const operation of ['writeFile', 'link']) {
    const directory = await temporary(t);
    const store = createMobileEvidenceStore({ dataDirectory: directory, fs: { ...fs, [operation]: async () => { throw new Error('Simulated local storage failure'); } } });
    await assert.rejects(store.submit({ evidence: fixture(), review }), /local storage failure/);
    assert.deepEqual(await readdir(join(directory, '.mobile')), []);
  }
});

function recordedPlan(initial, plan) {
  let result = nav.startMobilePlan(initial, plan, 'evaluation');
  assert.equal(result.error, undefined);
  const samples = [{ time: initial.simTime, world: structuredClone(initial) }];
  for (let tick = 0; tick < 3000 && !result.done; tick++) {
    result = nav.advanceMobileWorld(result.world, 0.1);
    assert.equal(result.error, undefined);
    if (tick % 2 === 0 || result.done) samples.push({ time: result.world.simTime, world: structuredClone(result.world) });
  }
  assert.equal(result.done, true);
  return seal(createMobileEvidence(initial, samples, result.world, null));
}

test('navigation-only reviewed reports accept Go Home with empty or continuously held cargo and zero placements', async t => {
  const store = createMobileEvidenceStore({ dataDirectory: await temporary(t) });
  for (const loaded of [false, true]) {
    const initial = loaded ? fixture({ stop: true }).payload.finalWorld : nav.createMobileKitchen();
    const evidence = recordedPlan(initial, nav.planMobileTask('Go Home', initial));
    const saved = await store.submit({ evidence, review });
    assert.equal(saved.report.accepted, true);
    assert.equal(saved.report.outcome, 'completed');
    assert.equal(saved.report.metrics.completedPlacements, 0);
    assert.equal(saved.report.metrics.completedPickups, 0);
    assert.equal(saved.report.checks.some(check => check.id === 'object-delivered'), false);
    assert.match(saved.report.summary, /navigation destination.*No object delivery is asserted/);
    assert.equal(evidence.payload.finalWorld.robot.cargoObjectId, loaded ? 'cup' : null);
    if (loaded) assert.equal(saved.report.checks.find(check => check.id === 'cargo-custody').passed, true);
  }
});

test('a navigation-only mission cannot drop and reload its initially held payload to restore final custody', async t => {
  const initial = fixture({ stop: true }).payload.finalWorld;
  assert.equal(initial.robot.cargoObjectId, 'cup');
  const plan = nav.planMobileTask('Go Home', initial);
  plan.steps = [
    { kind: 'place', stationId: 'counter', objectId: 'cup', label: 'Unrequested payload unloading' },
    { kind: 'reach-check', stationId: 'counter', objectId: 'cup', label: 'Recheck released payload' },
    { kind: 'pickup', stationId: 'counter', objectId: 'cup', label: 'Reload original payload' },
    ...plan.steps,
  ];
  const evidence = recordedPlan(initial, plan);
  assert.equal(evidence.payload.finalWorld.robot.cargoObjectId, 'cup');
  assert.equal(evidence.payload.finalWorld.objects[0].status, 'carried');
  assert.ok(nav.mobileGoalChecks(evidence.payload.finalWorld).every(check => check.passed), 'Final docking alone cannot detect the custody violation');
  const saved = await createMobileEvidenceStore({ dataDirectory: await temporary(t) }).submit({ evidence, review });
  assert.equal(saved.report.outcome, 'completed');
  assert.equal(saved.report.accepted, false);
  assert.equal(saved.report.checks.find(check => check.id === 'cargo-custody').passed, false);
  assert.equal(saved.report.metrics.completedPlacements, 1);
  assert.equal(saved.report.metrics.completedPickups, 1);
});
