import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_SAMPLES = 20000;
const EPS = 0.00001;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
const vector = (value, size = 3) => Array.isArray(value) && value.length === size && value.every(number);
const near = (a, b) => number(a) && number(b) && Math.abs(a - b) <= EPS;
const pointNear = (a, b) => vector(a) && vector(b) && a.every((value, index) => near(value, b[index]));
const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const require = (condition, message) => { if (!condition) throw new Error(message); };
const hash = value => createHash('sha256').update(value).digest('hex');

/** Independent implementation of the documented workcell canonical JSON format. */
export function canonicalJSON(value, depth = 0) {
  require(depth <= 100, 'Evidence nesting exceeds the consumer bound.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (number(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalJSON(item, depth + 1)).join(',')}]`;
  require(record(value), 'Evidence contains a nonfinite or unsupported JSON value.');
  return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key], depth + 1)}`).join(',')}}`;
}

function checkForwardKinematics({ joints, angles, lengths, yaw, mobile }) {
  require(vector(lengths, 2) && lengths.every(length => length > 0 && length <= 5), 'Recorded arm link lengths are invalid.');
  require(vector(joints.shoulder) && vector(joints.elbow) && vector(joints.wrist), 'Recorded arm joint positions are invalid.');
  require(vector(angles, 2) && number(yaw), 'Recorded joint angles must be finite radians.');
  const [shoulder, elbow] = angles;
  const radial = [mobile ? Math.sin(yaw) : Math.cos(yaw), mobile ? Math.cos(yaw) : Math.sin(yaw)];
  const fk = (r, y) => [joints.shoulder[0] + radial[0] * r, joints.shoulder[1] + y, joints.shoulder[2] + radial[1] * r];
  const expectedElbow = fk(lengths[0] * Math.cos(shoulder), lengths[0] * Math.sin(shoulder));
  const expectedWrist = fk(lengths[0] * Math.cos(shoulder) + lengths[1] * Math.cos(shoulder + elbow), lengths[0] * Math.sin(shoulder) + lengths[1] * Math.sin(shoulder + elbow));
  require(pointNear(expectedElbow, joints.elbow) && pointNear(expectedWrist, joints.wrist), 'Recorded joint angles fail independent additive forward kinematics.');
  require(near(distance(joints.shoulder, joints.elbow), lengths[0]) && near(distance(joints.elbow, joints.wrist), lengths[1]), 'Recorded arm geometry stretches a link.');
}

function objectRecords(world, mobile) {
  require(Array.isArray(world?.objects) && world.objects.length <= 6, 'Evidence needs a bounded object inventory.');
  const ids = new Set();
  return world.objects.map(object => {
    require(record(object) && typeof object.id === 'string' && object.id.length <= 128 && !ids.has(object.id), 'Object identities must be unique bounded strings.');
    ids.add(object.id);
    const position = mobile ? [object.position?.[0], object.height + 0.09, object.position?.[1]] : object.position;
    require(vector(position), 'Object coordinates must be finite.');
    return { id: object.id, positionMeters: [...position], location: mobile ? object.station : object.location, status: object.status,
      ...(mobile ? { supportHeightMeters: object.height } : {}) };
  });
}

function workcellObservations(payload) {
  const episode = payload.episode, trace = payload.derivedArmTrace;
  require(record(episode) && Array.isArray(episode.samples) && episode.samples.length > 0 && episode.samples.length <= MAX_SAMPLES, 'Workcell evidence needs bounded native samples.');
  require(trace?.schema === 'teachtrace.arm-trace.v1' && Array.isArray(trace.samples) && trace.samples.length === episode.samples.length, 'Export a current workcell package containing a complete derivedArmTrace.');
  require(record(episode.initialWorld) && canonicalJSON(episode.samples[0].world) === canonicalJSON(episode.initialWorld), 'The recorded first world does not match the initial scene.');
  require(canonicalJSON(payload.scene?.initialWorld) === canonicalJSON(episode.initialWorld)
    && canonicalJSON(payload.scene?.finalWorld) === canonicalJSON(episode.samples.at(-1).world), 'Workcell scene snapshots disagree with the native recording.');
  let lengths, offset;
  return trace.samples.map((sample, index) => {
    const native = episode.samples[index], world = native.world;
    require(sample.frame === 'simulator-world' && sample.units?.position === 'meters' && sample.units?.angle === 'radians' && sample.units?.time === 'simulated-seconds', 'Unsupported workcell coordinate units or frame.');
    require(near(sample.time, native.time) && near(native.time, world.simTime - episode.initialWorld.simTime), 'Workcell sample clocks disagree.');
    require(canonicalJSON(sample.joints?.names) === canonicalJSON(['base_yaw', 'shoulder_pitch', 'elbow_pitch']) && vector(sample.joints?.positionsRadians), 'Workcell trace needs the declared signed joint ordering.');
    const links = sample.links;
    require(record(links) && vector(links.shoulder) && vector(links.elbow) && vector(links.wrist), 'Workcell link coordinates are missing.');
    lengths ??= [distance(links.shoulder, links.elbow), distance(links.elbow, links.wrist)];
    const [yaw, shoulder, elbow] = sample.joints.positionsRadians;
    checkForwardKinematics({ joints: links, angles: [shoulder, elbow], lengths, yaw, mobile: false });
    require(pointNear(sample.endEffector?.position, world.robot?.position) && near(sample.endEffector?.gripperOpenFraction, world.robot?.gripperOpen), 'Workcell trace disagrees with the recorded TCP or gripper.');
    require(vector(sample.base?.position) && pointNear(sample.base.position, links.shoulder) && near(sample.base?.yaw, yaw), 'Workcell shoulder-mount frame is inconsistent.');
    offset ??= links.wrist.map((value, axis) => value - sample.endEffector.position[axis]);
    require(pointNear(links.wrist, sample.endEffector.position.map((value, axis) => value + offset[axis])), 'Workcell wrist-to-TCP offset changed.');
    const objects = objectRecords(world, false);
    require(canonicalJSON(sample.objects) === canonicalJSON(world.objects.map(({ id, position, location, status }) => ({ id, position, location, status }))), 'Workcell object trace disagrees with the native world.');
    return { timestampSeconds: sample.time, jointNames: [...sample.joints.names], jointPositionsRadians: [...sample.joints.positionsRadians],
      basePositionMeters: [...sample.base.position], baseYawRadians: yaw, baseAnchor: 'fixed-shoulder-mount', tcpPositionMeters: [...sample.endEffector.position],
      gripperOpenFraction: sample.endEffector.gripperOpenFraction, objects, controller: world.robot.mode, humanScenario: world.humanPresence?.state ?? null };
  });
}

function mobileObservations(payload) {
  require(Array.isArray(payload.trajectory) && payload.trajectory.length > 0 && payload.trajectory.length <= MAX_SAMPLES, 'Mobile evidence needs bounded trajectory samples.');
  require(canonicalJSON(payload.trajectory[0].world) === canonicalJSON(payload.initialWorld)
    && canonicalJSON(payload.trajectory.at(-1).world) === canonicalJSON(payload.finalWorld), 'Mobile trajectory endpoints disagree with initial/final scenes.');
  return payload.trajectory.map(sample => {
    const { world, arm } = sample;
    require(world?.schema === 'teachtrace.mobile-kitchen.v1' && record(arm) && arm.angleUnit === 'radians' && arm.tcpConvention === 'rendered-object-center', 'Mobile joint frame or TCP convention is unsupported.');
    require(near(sample.time, world.simTime), 'Mobile sample clocks disagree.');
    const names = ['baseYaw', 'shoulderPitch', 'elbowPitch', 'wristPitch'];
    require(names.every(name => number(arm.jointAngles?.[name])) && number(arm.baseHeading), 'Mobile joint angles are missing or nonfinite.');
    const q = arm.jointAngles;
    checkForwardKinematics({ joints: arm.joints, angles: [q.shoulderPitch, q.elbowPitch], lengths: arm.linkLengths, yaw: arm.baseHeading + q.baseYaw, mobile: true });
    require(near(Math.sin(arm.worldBaseYaw), Math.sin(arm.baseHeading + q.baseYaw)) && near(Math.cos(arm.worldBaseYaw), Math.cos(arm.baseHeading + q.baseYaw)), 'Mobile base/arm yaw frames disagree.');
    require(near(q.shoulderPitch + q.elbowPitch + q.wristPitch, -Math.PI / 2), 'Mobile gripper orientation is not the declared downward pitch.');
    require(vector(world.robot?.position, 2) && vector(arm.joints.base) && near(arm.joints.base[0], world.robot.position[0]) && near(arm.joints.base[2], world.robot.position[1]), 'Mobile base coordinates disagree with the world.');
    require(near(Math.sin(world.robot.yaw), Math.sin(arm.baseHeading)) && near(Math.cos(world.robot.yaw), Math.cos(arm.baseHeading)), 'Mobile base heading disagrees with the world.');
    require(pointNear(arm.objectTCP, arm.joints.gripper) && pointNear(arm.objectTCP, [arm.joints.wrist[0], arm.joints.wrist[1] - 0.16, arm.joints.wrist[2]]), 'Mobile gripper/TCP offset is inconsistent.');
    require(number(arm.gripperOpen) && arm.gripperOpen >= 0 && arm.gripperOpen <= 1, 'Mobile gripper opening is invalid.');
    const objects = objectRecords(world, true);
    if (arm.targetObjectId !== null) {
      const target = objects.find(object => object.id === arm.targetObjectId);
      require(target && pointNear(arm.requestedTCP, target.positionMeters), 'Mobile target TCP does not match the rendered object center.');
      if (arm.reachable && !arm.clamped) require(pointNear(arm.objectTCP, target.positionMeters), 'A reachable mobile object is disconnected from its gripper TCP.');
    }
    return { timestampSeconds: sample.time, jointNames: ['base_yaw', 'shoulder_pitch', 'elbow_pitch', 'wrist_pitch'], jointPositionsRadians: names.map(name => q[name]),
      basePositionMeters: [...arm.joints.base], baseYawRadians: arm.baseHeading, baseAnchor: 'mobile-base-arm-mount', tcpPositionMeters: [...arm.objectTCP],
      gripperOpenFraction: arm.gripperOpen, objects, controller: world.robot.mode, humanScenario: world.human ? 'scenario-obstruction-present' : null };
  });
}

function frozenParent(payload, mobile) {
  const initial = structuredClone(mobile ? payload.initialWorld : payload.episode.initialWorld);
  for (const key of ['simTime', 'revision', 'events', 'mission', 'lastCompletedStepId', 'distanceTravelled', 'sceneProvenance']) delete initial[key];
  if (initial.customTask) delete initial.customTask.id;
  return { sourceSchema: payload.schema, initialScene: initial,
    task: mobile ? { command: payload.finalWorld.mission?.plan.command ?? null, goal: payload.finalWorld.mission?.plan.goal ?? null }
      : { command: payload.episode.command, assignments: payload.task?.assignments ?? null } };
}

function declaredDerivation(payload, mobile) {
  if (mobile) return null;
  const value = payload.episode.initialWorld.sceneProvenance?.derivation;
  if (value === undefined) return null;
  require(record(value) && Object.keys(value).every(key => ['parentSceneSha256', 'seed', 'index', 'kind', 'basis', 'identityVerified'].includes(key))
    && /^[a-f\d]{64}$/.test(value.parentSceneSha256 ?? '') && Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff
    && Number.isInteger(value.index) && value.index >= 0 && value.index < 100 && ['layout', 'reach-challenge', 'human-occupied'].includes(value.kind)
    && value.basis === 'seeded-simulator-variation' && value.identityVerified === false, 'Invalid declared parent-scene lineage.');
  require(payload.episode.samples.every(sample => canonicalJSON(sample.world.sceneProvenance?.derivation ?? null) === canonicalJSON(value)), 'Declared parent-scene lineage changed during the recording.');
  return structuredClone(value);
}

/** Verify a portable artifact and produce observed-state analysis, without any simulator imports. */
export function consumeEvidence(input) {
  const mobile = input?.payload?.schema === 'teachtrace.mobile-evaluation.v1';
  let payload, verifiedDigest;
  if (mobile) {
    require(input.integrity?.algorithm === 'SHA-256' && input.integrity?.encoding === 'UTF-8 JSON.stringify(payload)' && /^[a-f\d]{64}$/.test(input.integrity?.digest ?? ''), 'Unsupported mobile integrity metadata.');
    payload = input.payload;
    verifiedDigest = hash(JSON.stringify(payload));
    require(verifiedDigest === input.integrity.digest, 'Mobile SHA-256 integrity mismatch.');
  } else {
    require(input?.schema === 'teachtrace.evidence.v1' && input.integrity?.algorithm === 'SHA-256'
      && input.integrity?.canonicalization === 'teachtrace.canonical-json.v1' && /^[a-f\d]{64}$/.test(input.integrity?.sha256 ?? ''), 'Expected sealed workcell evidence or a sealed mobile envelope.');
    const { integrity, ...unsigned } = input;
    payload = input; verifiedDigest = hash(canonicalJSON(unsigned));
    require(verifiedDigest === integrity.sha256, 'Workcell SHA-256 integrity mismatch.');
  }
  canonicalJSON(payload); // Independently reject nonfinite/deep/non-JSON values for either format.
  const observations = mobile ? mobileObservations(payload) : workcellObservations(payload);
  const computedSceneSha256 = hash(canonicalJSON(frozenParent(payload, mobile)));
  const derivation = declaredDerivation(payload, mobile);
  const parentSceneDigest = derivation?.parentSceneSha256 ?? computedSceneSha256;
  const terminalOutcome = mobile ? payload.finalWorld.mission?.status ?? payload.receipt?.status ?? 'unknown' : payload.episode.outcome;
  const rows = [], sameClockTransitions = [];
  for (let index = 0; index < observations.length - 1; index++) {
    const current = observations[index], next = observations[index + 1];
    require(number(current.timestampSeconds) && number(next.timestampSeconds) && next.timestampSeconds >= current.timestampSeconds, 'Recorded clocks regress; split reset segments into separate evidence files.');
    const dt = next.timestampSeconds - current.timestampSeconds;
    if (dt === 0) { sameClockTransitions.push({ fromSampleIndex: index, toSampleIndex: index + 1, timestampSeconds: current.timestampSeconds, fromController: current.controller, toController: next.controller, fromHumanScenario: current.humanScenario, toHumanScenario: next.humanScenario }); continue; }
    rows.push({ schema: 'teachtrace.observed-state-pair.v1', sourceDigestSha256: verifiedDigest, frozenParentSceneSha256: parentSceneDigest, sampleIndex: index, observation: current, dtSeconds: dt,
      target: { kind: 'next-observed-state', nextJointPositionsRadians: next.jointPositionsRadians, jointDeltaRadians: next.jointPositionsRadians.map((value, joint) => value - current.jointPositionsRadians[joint]), nextTimestampSeconds: next.timestampSeconds },
      terminalOutcome, terminal: false });
  }
  const final = observations.at(-1);
  require(number(final.timestampSeconds), 'The terminal observation clock is invalid.');
  rows.push({ schema: 'teachtrace.observed-state-pair.v1', sourceDigestSha256: verifiedDigest, frozenParentSceneSha256: parentSceneDigest, sampleIndex: observations.length - 1, observation: final, dtSeconds: null, target: null, terminalOutcome, terminal: true });
  const sourceLimitations = mobile ? payload.provenance?.limits ?? [] : payload.manifest?.simulationFidelity?.limitations ?? [];
  require(Array.isArray(sourceLimitations) && sourceLimitations.every(value => typeof value === 'string'), 'Source simulation limitations must be an array of strings.');
  const manifest = {
    schema: 'teachtrace.state-analysis-manifest.v1', consumerVersion: 1, sourceSchema: payload.schema, sourceDigestSha256: verifiedDigest,
    integrityVerified: true, forwardKinematicsVerified: true, sourceTaskChecksRecomputed: false,
    coordinateFrame: 'simulator-world', positionUnit: 'meters', angleUnit: 'radians', timeUnit: 'simulated-seconds',
    timeOrigin: mobile ? 'Absolute simulated world clock preserved from the source.' : 'Relative to the recorded episode start.',
    targetContract: { kind: 'next-observed-state', requestedMotorCommands: false, velocityEstimated: false, resamplingPerformed: false, jointDeltaConvention: 'raw-next-minus-current; source angle wrapping is preserved' },
    jointConvention: mobile ? 'Base heading and relative base_yaw use +Z as zero, +X as positive yaw. Link pitches are signed additive; world arm yaw = base heading + base_yaw.'
      : 'base_yaw uses +X as zero, +Z as positive yaw. Link pitches are signed additive; lower-link pitch = shoulder_pitch + elbow_pitch.',
    basePositionAnchor: mobile ? 'mobile-base-arm-mount' : 'fixed-shoulder-mount', objectPositionAnchor: 'rendered/simulated-object-center',
    targets: { kind: 'next-observed-state', requestedMotorCommands: false, calibratedTrainingAdapter: false, velocityOrTorqueRecorded: false, deltaConvention: 'Raw next minus current recorded joint radians; no wrap correction, interpolation or resampling.' },
    counts: { recordedSamples: observations.length, positiveDtPairs: rows.length - 1, sameClockPairsExcluded: sameClockTransitions.length, terminalObservations: 1 },
    terminalOutcome, reviewStatus: mobile ? 'not-represented-as-workcell-review' : payload.episode.status,
    sourceChecksPassed: Array.isArray(payload.checks) && payload.checks.length ? payload.checks.every(check => check.passed === true) : null,
    sourceEvents: mobile ? payload.finalWorld.events ?? [] : payload.episode.events ?? [], sameClockTransitions,
    grouping: { frozenParentSceneSha256: parentSceneDigest, computedSceneSha256, groupingSource: derivation ? 'declared-parent-scene-lineage' : 'computed-initial-scene',
      declaredDerivation: derivation, upstreamLineageVerified: false, suggestedSplitUnit: 'whole-parent-scene-group', splitPerformed: false,
      definition: derivation ? 'Declared parent fingerprint carried by the sealed child recording; distinct descendant layouts share that group. Parent history and authorship are not authenticated.'
        : 'Computed initial scene and task contract, excluding clocks, run history, review provenance and generated custom task identity.',
      limitation: 'No train/test split is performed. Declared ancestry is unverified; related variants without lineage need a curator-supplied source-family group. This is not a leakage-free split guarantee.' },
    limitations: [...sourceLimitations, 'This is a portable state-analysis handoff, not robot training, policy evaluation, LeRobot/RLDS compatibility or recipient ingestion.',
      'Targets describe what was observed next, not what a controller requested or a physical motor executed.', 'SHA-256 checks unchanged content, not authorship or physical truth. Task acceptance remains the source system\'s reported result.'],
  };
  return { manifest, rows };
}

export async function runConsumer({ args = process.argv.slice(2), write = console.log } = {}) {
  if (!args.length || ![1, 3].includes(args.length) || (args.length === 3 && args[1] !== '--out')) { write('Usage: node scripts/consume-evidence.mjs INPUT [--out DIR]'); return 2; }
  try {
    const input = resolve(args[0]);
    const information = await stat(input);
    require(information.isFile() && information.size <= MAX_FILE_BYTES, 'Input must be a regular evidence file of at most 50 MiB.');
    const raw = await readFile(input, 'utf8');
    require(Buffer.byteLength(raw) <= MAX_FILE_BYTES, 'Input exceeds 50 MiB.');
    const result = consumeEvidence(JSON.parse(raw));
    if (args.length === 3) {
      const directory = resolve(args[2]); await mkdir(directory, { recursive: true, mode: 0o700 });
      const created = [];
      try {
        for (const [name, contents] of [['analysis.jsonl', result.rows.map(row => JSON.stringify(row)).join('\n') + '\n'], ['manifest.json', JSON.stringify(result.manifest, null, 2) + '\n']]) {
          const destination = resolve(directory, name); await writeFile(destination, contents, { flag: 'wx', mode: 0o600 }); created.push(destination);
        }
      } catch { await Promise.all(created.map(path => rm(path, { force: true }))); throw new Error('Output could not be written; use a writable directory without existing analysis.jsonl or manifest.json.'); }
    }
    write(`Verified ${result.manifest.sourceSchema}: ${result.manifest.counts.recordedSamples} observations, ${result.manifest.counts.positiveDtPairs} positive-dt pairs, ${result.manifest.counts.sameClockPairsExcluded} same-clock pairs excluded; outcome ${result.manifest.terminalOutcome}.`);
    write(args.length === 3 ? 'Wrote analysis.jsonl and manifest.json. No network or training operation was performed.' : 'Inspection only. Add --out DIR to write the state-analysis handoff.');
    return 0;
  } catch (error) {
    write(error instanceof SyntaxError ? 'Input is not valid evidence JSON.' : error?.code ? 'Evidence file access failed. Check the input path and permissions.' : error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runConsumer();
