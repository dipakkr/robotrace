import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJSON, consumeEvidence, runConsumer } from './consume-evidence.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function geometry(q, mobile = false, shoulder = [0, 1, 0], lengths = [1.2, 0.8]) {
  const [yaw, pitch, elbow] = q;
  const x = mobile ? Math.sin(yaw) : Math.cos(yaw), z = mobile ? Math.cos(yaw) : Math.sin(yaw);
  const point = (r, y) => [shoulder[0] + x * r, shoulder[1] + y, shoulder[2] + z * r];
  return { shoulder, elbow: point(lengths[0] * Math.cos(pitch), lengths[0] * Math.sin(pitch)),
    wrist: point(lengths[0] * Math.cos(pitch) + lengths[1] * Math.cos(pitch + elbow), lengths[0] * Math.sin(pitch) + lengths[1] * Math.sin(pitch + elbow)) };
}
function sealWorkcell(payload) {
  const { integrity: ignored, ...unsigned } = payload;
  return { ...unsigned, integrity: { algorithm: 'SHA-256', canonicalization: 'teachtrace.canonical-json.v1', sha256: hash(canonicalJSON(unsigned)) } };
}
function workcell() {
  const angles = [[0, 0.2, -0.4], [0, 0.2, -0.4], [0.1, 0.3, -0.5]];
  const times = [0, 0, 1];
  const trace = angles.map((q, i) => {
    const links = geometry(q), tcp = [links.wrist[0], links.wrist[1] - 0.24, links.wrist[2]];
    return { time: times[i], frame: 'simulator-world', units: { position: 'meters', angle: 'radians', time: 'simulated-seconds' },
      joints: { names: ['base_yaw', 'shoulder_pitch', 'elbow_pitch'], positionsRadians: q }, links,
      base: { position: [...links.shoulder], yaw: q[0] }, endEffector: { position: tcp, gripperOpenFraction: 1 },
      objects: [{ id: 'part', position: [0, 0.9, 1], location: 'table', status: 'ready' }] };
  });
  const samples = trace.map((t, i) => ({ time: t.time, world: { environmentId: 'lab', simTime: t.time, objects: structuredClone(t.objects),
    robot: { position: [...t.endEffector.position], gripperOpen: 1, mode: i === 1 ? 'paused' : 'idle', phase: 'Test' }, humanPresence: { state: i === 1 ? 'in-workspace' : 'clear', source: 'scenario-proxy' } } }));
  return sealWorkcell({ schema: 'teachtrace.evidence.v1', manifest: { simulationFidelity: { limitations: ['Synthetic test geometry.'] } },
    scene: { initialWorld: samples[0].world, finalWorld: samples.at(-1).world }, task: { assignments: [] },
    episode: { id: 'episode', initialWorld: samples[0].world, samples, status: 'approved', outcome: 'failed', command: 'Test motion', events: [{ time: 0, kind: 'control', label: 'Operator paused' }] },
    checks: [{ passed: false }], derivedArmTrace: { schema: 'teachtrace.arm-trace.v1', samples: trace } });
}
function mobile() {
  const trajectory = [0, 1].map(time => {
    const q = [0.1, 0.7 + time * 0.1, -1.3];
    const joints = geometry(q, true, [time, 0.94, 0], [0.82, 0.82]);
    const tcp = [joints.wrist[0], joints.wrist[1] - 0.16, joints.wrist[2]];
    return { time, world: { schema: 'teachtrace.mobile-kitchen.v1', simTime: time, seed: 0, bounds: {}, obstacles: [], stations: [], objects: [],
      robot: { position: [time, 0], yaw: 0, mode: 'idle' }, human: null, mission: { status: time ? 'stopped' : 'running', plan: { command: 'Test', goal: {} } }, events: [] },
    arm: { angleUnit: 'radians', tcpConvention: 'rendered-object-center', joints: { base: [time, 0.63, 0], ...joints, gripper: tcp },
      jointAngles: { baseYaw: q[0], shoulderPitch: q[1], elbowPitch: q[2], wristPitch: -Math.PI / 2 - q[1] - q[2] },
      baseHeading: 0, worldBaseYaw: q[0], linkLengths: [0.82, 0.82], objectTCP: tcp, gripperOpen: 1, targetObjectId: null } };
  });
  const payload = { schema: 'teachtrace.mobile-evaluation.v1', initialWorld: trajectory[0].world, finalWorld: trajectory.at(-1).world, trajectory, checks: [{ passed: false }], provenance: { limits: ['No physical validation.'] } };
  return { payload, integrity: { algorithm: 'SHA-256', encoding: 'UTF-8 JSON.stringify(payload)', digest: hash(JSON.stringify(payload)) } };
}

test('canonical JSON independently preserves array order and sorts object keys', () => {
  assert.equal(canonicalJSON({ z: 3, a: { z: [2, 1], a: true } }), '{"a":{"a":true,"z":[2,1]},"z":3}');
  assert.throws(() => canonicalJSON({ value: Infinity }), /nonfinite/);
});

test('workcell consumption verifies signed FK, retains failures and excludes zero-clock target pairs', () => {
  const { manifest, rows } = consumeEvidence(workcell());
  assert.equal(manifest.integrityVerified, true);
  assert.equal(manifest.forwardKinematicsVerified, true);
  assert.deepEqual(manifest.counts, { recordedSamples: 3, positiveDtPairs: 1, sameClockPairsExcluded: 1, terminalObservations: 1 });
  assert.equal(manifest.terminalOutcome, 'failed');
  assert.equal(manifest.sourceEvents[0].kind, 'control');
  assert.equal(rows[0].sampleIndex, 1);
  assert.equal(rows[0].target.kind, 'next-observed-state');
  assert.equal(rows[0].dtSeconds, 1);
  assert.ok(rows[0].target.jointDeltaRadians.every(Number.isFinite));
  assert.equal(rows.at(-1).target, null);
  assert.match(manifest.jointConvention, /\+X/);
  assert.equal(manifest.grouping.splitPerformed, false);
  assert.equal(rows[0].requestedMotorCommand, undefined);
  assert.equal(rows[0].frozenParentSceneSha256, manifest.grouping.frozenParentSceneSha256);
  assert.equal(manifest.targetContract.requestedMotorCommands, false);
});

test('an attempt with no positive-time action remains a terminal observation without invented targets', () => {
  const artifact = workcell();
  artifact.episode.samples = [artifact.episode.samples[0]];
  artifact.scene.finalWorld = artifact.episode.samples[0].world;
  artifact.derivedArmTrace.samples = [artifact.derivedArmTrace.samples[0]];
  const result = consumeEvidence(sealWorkcell(artifact));
  assert.equal(result.manifest.counts.positiveDtPairs, 0);
  assert.equal(result.manifest.terminalOutcome, 'failed');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].target, null);
  assert.equal(result.rows[0].dtSeconds, null);
});

test('tampered hashes and re-signed corrupt joint angles both fail before producing analysis', () => {
  const tampered = workcell();
  tampered.episode.outcome = 'completed';
  assert.throws(() => consumeEvidence(tampered), /integrity mismatch/);
  const corrupt = workcell();
  corrupt.derivedArmTrace.samples[0].joints.positionsRadians[2] *= -1;
  assert.throws(() => consumeEvidence(sealWorkcell(corrupt)), /forward kinematics/);
  const wrongClock = workcell();
  wrongClock.derivedArmTrace.samples[2].time = -1;
  assert.throws(() => consumeEvidence(sealWorkcell(wrongClock)), /clocks/);
});

test('mobile envelope uses its own integrity convention and preserves stopped outcomes', () => {
  const artifact = mobile();
  const { manifest, rows } = consumeEvidence(artifact);
  assert.equal(manifest.sourceSchema, 'teachtrace.mobile-evaluation.v1');
  assert.equal(manifest.terminalOutcome, 'stopped');
  assert.match(manifest.jointConvention, /\+Z/);
  assert.equal(rows[0].observation.jointNames.length, 4);
  artifact.payload.trajectory[0].arm.jointAngles.shoulderPitch += 0.2;
  artifact.integrity.digest = hash(JSON.stringify(artifact.payload));
  assert.throws(() => consumeEvidence(artifact), /forward kinematics/);
});

test('grouping keeps the same parent scene together despite episode identity or timing metadata', () => {
  const first = workcell(), second = workcell();
  second.episode.id = 'another-episode';
  second.episode.initialWorld.revision = 99;
  second.scene.initialWorld.revision = 99;
  const a = consumeEvidence(first).manifest.grouping.frozenParentSceneSha256;
  const b = consumeEvidence(sealWorkcell(second)).manifest.grouping.frozenParentSceneSha256;
  assert.equal(a, b);
});

test('CLI writes a portable analysis and manifest and refuses to overwrite an existing output', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'teachtrace-consumer-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'episode.teachtrace.json'), out = join(directory, 'analysis');
  await writeFile(file, JSON.stringify(workcell()));
  const output = [];
  assert.equal(await runConsumer({ args: [file, '--out', out], write: line => output.push(line) }), 0);
  const lines = (await readFile(join(out, 'analysis.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
  assert.equal(lines.length, 2);
  assert.equal(manifest.counts.positiveDtPairs, 1);
  assert.equal(await runConsumer({ args: [file, '--out', out], write: () => {} }), 1);
  assert.deepEqual(JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8')), manifest);
  assert.ok(output.every(line => !line.includes('private-key')));
});

function derivedChild(parentHash, index, shift) {
  const artifact=workcell();
  const derivation={parentSceneSha256:parentHash,seed:42,index,kind:'layout',basis:'seeded-simulator-variation',identityVerified:false};
  for(const sample of artifact.episode.samples){sample.world.sceneProvenance={source:'deterministic',reviewRequired:true,derivation:structuredClone(derivation)};sample.world.objects[0].position[0]+=shift;}
  artifact.episode.initialWorld=artifact.episode.samples[0].world;artifact.scene.initialWorld=artifact.episode.initialWorld;artifact.scene.finalWorld=artifact.episode.samples.at(-1).world;
  artifact.derivedArmTrace.samples.forEach((sample,i)=>{sample.objects=structuredClone(artifact.episode.samples[i].world.objects);});
  return sealWorkcell(artifact);
}
test('correlated child layouts share declared parent group while retaining independently computed child hashes',()=>{
  const a=consumeEvidence(derivedChild('a'.repeat(64),0,.01)),b=consumeEvidence(derivedChild('a'.repeat(64),1,.1)),unrelated=consumeEvidence(derivedChild('b'.repeat(64),0,.1));
  assert.equal(a.manifest.grouping.frozenParentSceneSha256,b.manifest.grouping.frozenParentSceneSha256);
  assert.notEqual(a.manifest.grouping.computedSceneSha256,b.manifest.grouping.computedSceneSha256);
  assert.notEqual(a.manifest.grouping.frozenParentSceneSha256,unrelated.manifest.grouping.frozenParentSceneSha256);
  assert.equal(a.manifest.grouping.groupingSource,'declared-parent-scene-lineage');assert.equal(a.manifest.grouping.upstreamLineageVerified,false);assert.equal(a.manifest.grouping.splitPerformed,false);
  assert.ok(a.rows.every(row=>row.frozenParentSceneSha256==='a'.repeat(64)));assert.equal(a.manifest.counts.sameClockPairsExcluded,1);
  assert.equal(consumeEvidence(workcell()).manifest.grouping.groupingSource,'computed-initial-scene');
});
test('invalid or temporally changed declared lineage is rejected even after content is re-signed',()=>{
  const invalid=derivedChild('a'.repeat(64),0,0);invalid.episode.initialWorld.sceneProvenance.derivation.identityVerified=true;
  assert.throws(()=>consumeEvidence(sealWorkcell(invalid)),/Invalid declared parent-scene lineage/);
  const changed=derivedChild('a'.repeat(64),0,0);changed.episode.samples[1].world.sceneProvenance.derivation.parentSceneSha256='b'.repeat(64);
  assert.throws(()=>consumeEvidence(sealWorkcell(changed)),/lineage changed/);
});
