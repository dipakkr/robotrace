import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, link, rm, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { taskGuideForWorld } from './task-guides.mjs';

const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const MAX_BYTES = 1024 * 1024;
const fileSystem = { mkdir, readFile, writeFile, link, rm, readdir, stat };
const queues = new Map();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value, limit) => typeof value === 'string' && Boolean(value.trim()) && value.length <= limit;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const integer = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const fail = message => Object.assign(new Error(message), { status: 400 });
const normalized = value => Array.isArray(value) ? value.map(normalized) : record(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)])) : value;
const same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
const hash = value => createHash('sha256').update(value).digest('hex');
const boundary = 'Acceptance is independently recomputed from recorded simulator states. This does not authenticate the recording, execute/replay its motion, validate measured sensors or contact dynamics, approve physical deployment, or establish policy training or transfer.';
let modules;
const api = () => modules ??= Promise.all([
  tsImport('../src/data/mobile-evidence.ts', import.meta.url),
  tsImport('../src/sim/mobile-arm.ts', import.meta.url),
  tsImport('../src/sim/mobile-navigation.ts', import.meta.url),
]).then(parts => Object.assign({}, ...parts));

function finiteJSON(value, depth = 0) {
  if (depth > 40) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => finiteJSON(item, depth + 1));
  return record(value) && Object.values(value).every(item => finiteJSON(item, depth + 1));
}

function validGoal(goal) {
  return record(goal) && (exact(goal, ['stationId']) || exact(goal, ['objectId', 'stationId']))
    && ['counter', 'table', 'sink', 'home'].includes(goal.stationId)
    && (goal.objectId === undefined || ['cup', 'bowl'].includes(goal.objectId));
}

function validateWorld(world) {
  if (!record(world) || (world.environmentId !== undefined && world.environmentId !== 'mobile-kitchen')
    || taskGuideForWorld({ ...world, environmentId: 'mobile-kitchen' }).id !== 'TT-MOBILE-KITCHEN-001'
    || !Number.isSafeInteger(world.seed) || !text(world.robot.phase, 1000)
    || !Array.isArray(world.events) || world.events.length > 100
    || !world.events.every(event => record(event) && finite(event.time) && event.time >= 0 && event.time <= world.simTime + 1e-6
      && ['navigate', 'reach-check', 'pickup', 'place', 'control', 'blocked', 'goal'].includes(event.kind) && text(event.message, 1000))) {
    throw fail('Every recorded state must use the bounded native mobile-kitchen schema and supported inventory.');
  }
  const mission = world.mission;
  if (mission === null) return;
  if (!record(mission) || !record(mission.plan) || !text(mission.plan.id, 200) || !text(mission.plan.command, 500)
    || !integer(mission.plan.worldRevision, Number.MAX_SAFE_INTEGER) || !validGoal(mission.plan.goal)
    || !Array.isArray(mission.plan.steps) || mission.plan.steps.length < 1 || mission.plan.steps.length > 12
    || !['running', 'completed', 'stopped', 'failed'].includes(mission.status)
    || !integer(mission.stepIndex, mission.plan.steps.length) || !integer(mission.completedSteps, mission.plan.steps.length)
    || mission.completedSteps !== mission.stepIndex || !integer(mission.waypointIndex, 1600)
    || !finite(mission.phaseElapsed) || mission.phaseElapsed < 0 || mission.phaseElapsed > 10
    || (mission.status === 'completed' && (mission.stepIndex !== mission.plan.steps.length || world.robot.mode !== 'idle'))
    || (mission.status === 'running' && (!['running', 'paused'].includes(world.robot.mode) || mission.stepIndex >= mission.plan.steps.length))
    || (mission.status === 'stopped' && world.robot.mode !== 'stopped') || (mission.status === 'failed' && world.robot.mode !== 'error')) {
    throw fail('The recorded mobile mission and its completion counters are malformed.');
  }
  for (const step of mission.plan.steps) {
    const expectedKeys = step?.kind === 'navigate' ? ['kind', 'stationId', 'label', 'path'] : ['kind', 'stationId', 'objectId', 'label'];
    if (!exact(step, expectedKeys) || !['navigate', 'reach-check', 'pickup', 'place'].includes(step.kind)
      || !world.stations.some(station => station.id === step.stationId) || !text(step.label, 200)
      || (step.kind !== 'navigate' && !world.objects.some(object => object.id === step.objectId))
      || (step.kind === 'navigate' && (!Array.isArray(step.path) || step.path.length < 1 || step.path.length > 1600
        || !step.path.every(point => Array.isArray(point) && point.length === 2 && point.every(finite)
          && point[0] >= world.bounds.minX && point[0] <= world.bounds.maxX && point[1] >= world.bounds.minZ && point[1] <= world.bounds.maxZ)))) {
      throw fail('The recorded mobile plan contains an unsupported skill, station, object or route.');
    }
  }
}

function sameArm(provided, expected) {
  if (finite(expected)) return finite(provided) && Math.abs(provided - expected) <= 1e-9;
  if (Array.isArray(expected)) return Array.isArray(provided) && provided.length === expected.length && expected.every((item, index) => sameArm(provided[index], item));
  if (record(expected)) return record(provided) && Object.keys(provided).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => Object.hasOwn(provided, key) && sameArm(provided[key], item));
  return provided === expected;
}

async function verifyAndReport(envelope, review, id, savedAt) {
  const reviewed = exact(review, ['approved', 'identityVerified']) && review.approved === true && review.identityVerified === false;
  const operatorSave = exact(review, ['approved', 'identityVerified', 'source']) && review.approved === false && review.identityVerified === false && review.source === 'operator-save';
  if (!reviewed && !operatorSave) throw fail('Provide explicit review provenance or an unreviewed operator-save record; reviewer identity cannot be asserted.');
  const savedReview = reviewed ? { approved: true, identityVerified: false } : { approved: false, identityVerified: false, source: 'operator-save' };
  let raw;
  try { raw = JSON.stringify(envelope); } catch { throw fail('Provide a bounded JSON mobile evidence envelope.'); }
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BYTES || !finiteJSON(envelope)) throw fail('Mobile evidence must contain finite JSON of at most 1 MiB.');
  if (!exact(envelope, ['payload', 'integrity']) || !exact(envelope.integrity, ['algorithm', 'encoding', 'digest'])
    || envelope.integrity.algorithm !== 'SHA-256' || envelope.integrity.encoding !== 'UTF-8 JSON.stringify(payload)'
    || !/^[a-f\d]{64}$/.test(envelope.integrity.digest ?? '') || hash(JSON.stringify(envelope.payload)) !== envelope.integrity.digest) {
    throw fail('The mobile evidence SHA-256 seal is missing or does not match its payload.');
  }
  const evidence = JSON.parse(raw); // Freeze the reviewed source before asynchronous imports or writes.
  const payload = evidence.payload;
  if (!record(payload) || payload.schema !== 'teachtrace.mobile-evaluation.v1' || !text(payload.generatedAt, 100)
    || !Number.isFinite(Date.parse(payload.generatedAt)) || !Array.isArray(payload.trajectory)
    || payload.trajectory.length < 2 || payload.trajectory.length > 1500) throw fail('A native mobile evidence package with 2–1500 recorded states is required.');
  const shared = await api();
  validateWorld(payload.initialWorld); validateWorld(payload.finalWorld);
  const mission = payload.finalWorld.mission;
  if (!mission) throw fail('A recorded mobile task and its original command are required.');
  const declared = shared.planMobileTask(mission.plan.command, payload.initialWorld);
  if (declared.error || declared.control || !declared.goal || !same(declared.goal, mission.plan.goal)) {
    throw fail('The recorded final goal must match the original command interpreted against the initial scene.');
  }
  let observedPickups = 0, observedPlacements = 0;
  let previous = payload.initialWorld;
  const navigationCargoId = declared.goal.objectId === undefined ? payload.initialWorld.robot.cargoObjectId : null;
  const protectedIds = payload.initialWorld.objects.filter(object => object.id !== declared.goal.objectId && object.id !== navigationCargoId).map(object => object.id);
  let custodyPreserved = true;
  const disturbed = new Set();
  const samples = payload.trajectory.map(sample => {
    if (!exact(sample, ['time', 'world', 'arm']) || !finite(sample.time)) throw fail('Each mobile sample needs its timestamp, native world and derived arm pose.');
    const world = sample.world;
    validateWorld(world);
    if (world.distanceTravelled < previous.distanceTravelled || world.revision < previous.revision
      || world.cellSize !== payload.initialWorld.cellSize || !['radius', 'speed', 'armReach'].every(key => world.robot[key] === payload.initialWorld.robot[key])) {
      throw fail('Recorded travel/revision must not regress or silently change the declared robot/grid configuration.');
    }
    if (world.mission && world.mission.plan.id !== mission.plan.id && !same(world, payload.initialWorld)) throw fail('The recording cannot silently substitute a different mobile mission.');
    if (!sameArm(sample.arm, shared.solveMobileArm(world))) throw fail('A recorded arm pose does not match the exact analytic pose derived from its world.');
    const step = world.mission?.plan.steps[world.mission.stepIndex];
    if (navigationCargoId) {
      const cargo = world.objects.find(object => object.id === navigationCargoId);
      if (!cargo || world.robot.cargoObjectId !== navigationCargoId || cargo.station !== 'robot' || cargo.status !== 'carried'
        || Math.hypot(cargo.position[0] - world.robot.position[0], cargo.position[1] - world.robot.position[1]) > 1e-6 || Math.abs(cargo.height - 1) > 1e-6
        || (world.mission?.plan.id === mission.plan.id && step && ['pickup', 'place'].includes(step.kind) && step.objectId === navigationCargoId)) custodyPreserved = false;
    }
    for (const object of world.objects) {
      const prior = previous.objects.find(item => item.id === object.id);
      if (object.status === 'carried' && prior?.status !== 'carried') observedPickups++;
      if (object.status === 'delivered' && prior?.status !== 'delivered') observedPlacements++;
      if (protectedIds.includes(object.id) && (!same(object, payload.initialWorld.objects.find(item => item.id === object.id))
        || world.robot.cargoObjectId === object.id || (step && ['pickup', 'place'].includes(step.kind) && step.objectId === object.id))) disturbed.add(object.id);
    }
    previous = world;
    return { time: sample.time, world };
  });
  let reconstructed;
  try { reconstructed = shared.createMobileEvidence(payload.initialWorld, samples, payload.finalWorld, null); }
  catch { throw fail('The native mobile recording failed independent chronology, scene, cargo or endpoint validation.'); }
  const checks = reconstructed.checks.map(check => ({ ...check }));
  for (const objectId of protectedIds) {
    const object = payload.initialWorld.objects.find(item => item.id === objectId);
    checks.push({ id: `protected-${objectId}`, name: `${object.label} remains undisturbed`, passed: !disturbed.has(objectId),
      detail: 'Every recorded object state, active handling target and cargo identity must preserve each unrequested object; restoring its final state does not undo a recorded violation.' });
  }
  if (navigationCargoId) checks.push({ id: 'cargo-custody', name: `${payload.initialWorld.objects.find(object => object.id === navigationCargoId).label} remains on the carrier`, passed: custodyPreserved,
    detail: 'Navigation may move the initially held object with the base, but every recorded state must preserve its identity, carried state and aligned carrier position without unloading or reloading.' });
  const completed = mission.status === 'completed' && payload.finalWorld.robot.mode === 'idle';
  const accepted = completed && checks.length > 0 && checks.every(check => check.passed);
  const outcome = mission.status === 'completed' ? 'completed' : mission.status === 'failed' || payload.finalWorld.robot.mode === 'error' ? 'failed'
    : mission.status === 'stopped' || payload.finalWorld.robot.mode === 'stopped' ? 'stopped' : payload.finalWorld.robot.mode === 'paused' ? 'paused' : 'running';
  const distanceTravelled = payload.finalWorld.distanceTravelled - payload.initialWorld.distanceTravelled;
  const durationSeconds = payload.finalWorld.simTime - payload.initialWorld.simTime;
  if (distanceTravelled < 0 || durationSeconds < 0) throw fail('Recorded elapsed time and travel cannot regress.');
  const report = {
    schema: 'teachtrace.mobile-service-report.v1', id, episodeId: id, savedAt, createdAt: savedAt,
    assignmentId: 'TT-MOBILE-KITCHEN-001', title: `Mobile kitchen: ${mission.plan.command}`, command: mission.plan.command, goal: { ...declared.goal },
    accepted, taskAccepted: accepted, outcome, checks,
    summary: `${reviewed ? 'Reviewed' : 'Unreviewed'} mobile attempt saved. Recorded outcome: ${outcome}. Task acceptance: ${accepted ? 'passed' : 'not accepted'}. ${accepted ? declared.goal.objectId ? 'The recorded final station, delivery and protected-object checks passed.' : `The recorded navigation destination${navigationCargoId ? ', preserved cargo custody' : ''} and protected-object checks passed. No object delivery is asserted.` : 'Inspect the recorded attempt and failed checks before preparing a corrected task.'}`,
    metrics: { sampleCount: samples.length, distanceTravelled, durationSeconds, completedPickups: observedPickups, completedPlacements: observedPlacements, recordedCompletedSteps: mission.completedSteps },
    basis: 'independentlyrecomputed-recorded-simulator-state', independentlyRecomputed: true, motionReplayed: false,
    sourceHash: evidence.integrity.digest, sourceKind: 'locally-authored-mobile-simulation', review: savedReview,
    provenance: reconstructed.provenance, postedReceiptUsedForAcceptance: false, boundaries: boundary,
    followUp: accepted ? 'Inspect and export this native simulation record for the robotics QA team.' : 'Review the failure evidence and collect a corrected or completed attempt.',
  };
  return { schema: 'teachtrace.saved-mobile-evidence.v1', id, savedAt, title: report.title, review: savedReview, report, evidence };
}

/** Local records retain review provenance independently of recomputed task acceptance. */
export function createMobileEvidenceStore({ dataDirectory, fs = fileSystem } = {}) {
  if (!text(dataDirectory, 4096)) throw new Error('A local mobile evidence data directory is required.');
  const directory = resolve(dataDirectory, '.mobile');
  const receipt = saved => ({ saved: true, id: saved.id, savedAt: saved.savedAt, report: saved.report });
  function serialize(operation) {
    const next = (queues.get(directory) ?? Promise.resolve()).catch(() => {}).then(operation);
    queues.set(directory, next);
    return next.finally(() => { if (queues.get(directory) === next) queues.delete(directory); });
  }
  async function get(id) {
    if (typeof id !== 'string' || !UUID.test(id)) return null;
    const path = resolve(directory, `${id.toLowerCase()}.json`);
    try {
      const information = await fs.stat(path);
      if (!information.isFile() || information.size > 2 * MAX_BYTES) throw new Error('Invalid local mobile record.');
      const saved = JSON.parse(await fs.readFile(path, 'utf8'));
      if (saved.schema !== 'teachtrace.saved-mobile-evidence.v1' || saved.id !== id.toLowerCase() || saved.report?.id !== saved.id
        || saved.report?.sourceHash !== saved.evidence?.integrity?.digest || hash(JSON.stringify(saved.evidence?.payload)) !== saved.report.sourceHash) throw new Error('Invalid local mobile record.');
      return saved;
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function visitRecords(visitor) {
    let names;
    try { names = await fs.readdir(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const name of names.filter(name => UUID.test(name.replace(/\.json$/, '')) && name.endsWith('.json'))) {
      const item = await get(name.slice(0, -5));
      if (item) { const found = visitor(item); if (found !== undefined) return found; }
    }
  }
  return {
    async submit({ evidence, review } = {}) {
      const id = randomUUID(), savedAt = new Date().toISOString();
      const saved = await verifyAndReport(evidence, review, id, savedAt);
      return serialize(async () => {
        const existing = await visitRecords(item => item.report.sourceHash === saved.report.sourceHash ? item : undefined);
        if (existing) return receipt(existing);
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        const temporary = resolve(directory, `.${id}-${randomUUID()}.tmp`);
        try {
          await fs.writeFile(temporary, JSON.stringify(saved), { mode: 0o600, flag: 'wx' });
          await fs.link(temporary, resolve(directory, `${id}.json`)); // Atomic publication that cannot overwrite a prior record.
        } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
        return receipt(saved);
      });
    },
    get,
    async list() {
      await queues.get(directory)?.catch(() => {});
      const summaries = [];
      await visitRecords(saved => { summaries.push({ id: saved.id, title: saved.title, savedAt: saved.savedAt, outcome: saved.report.outcome, accepted: saved.report.accepted, report: saved.report }); });
      return summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
  };
}
