import { validateSceneDerivation } from './scene-lineage';
import { validateReferenceFingerprint } from './reference-fingerprint';
import { createArmTrace } from './robot-trace';
import { taskForWorld } from '../sim/scene-spec';
import type { EnvironmentCheck, EnvironmentTarget } from '../sim/environments';
import type { WorldState } from '../sim/engine';
import { createProtectedHistory, mergeProtectedHistoryChecks } from '../sim/protected-history';

/** Structural input shared with the recorder. The existing episode v1 stays intact. */
export interface EvidenceEpisode {
  id: string;
  title: string;
  scenarioId?: string;
  createdAt: string;
  duration: number;
  status: 'review' | 'approved';
  outcome: 'completed' | 'stopped' | 'failed';
  initialWorld: WorldState;
  samples: { time: number; world: WorldState }[];
  events: { time: number; label: string; kind: 'command' | 'action' | 'success' | 'error' | 'control' }[];
  completedActions: number;
  command: string;
}

const EPISODE_SCHEMA = 'teachtrace.episode.v1' as const;
const SCHEMA = 'teachtrace.evidence.v1' as const;
const SECTIONS = ['scene', 'task', 'episode', 'metrics', 'checks', 'humanReview', 'report'] as const;
const FIDELITY = {
  type: 'kinematic', grasp: 'idealized attachment', physicalContactValidated: false,
  policyTrained: false, simToRealValidated: false,
  limitations: [
    'No contact dynamics, measured forces, or friction-based grasp validation.',
    'No complete swept-link or self-collision validation.',
    'No learned policy, robot training result, or demonstrated sim-to-real transfer.',
    'Native simulator evidence; not a LeRobot or RLDS training dataset.',
  ],
} as const;

export interface EvidenceTask {
  id: string;
  name: string;
  description: string;
  instruction: string;
  assignments: EnvironmentTarget[];
  destinationLabels: WorldState['destinationLabels'];
}
export interface EvidenceMetrics {
  durationSeconds: number;
  sampleCount: number;
  eventCount: number;
  completedActions: number;
  observedCompletionCount: number;
  errorEventCount: number;
  recordedOutcome: EvidenceEpisode['outcome'];
  taskAcceptancePassed: boolean | null;
}
export interface EvidenceIntegrity {
  algorithm: 'SHA-256';
  canonicalization: 'teachtrace.canonical-json.v1';
  sha256: string;
}
export interface EvidencePackage {
  schema: typeof SCHEMA;
  manifest: {
    producer: { name: 'RoboTrace Workcell Studio'; version: '0.1.0' };
    controller: 'teachtrace-kinematic-v1';
    episodeSchema: typeof EPISODE_SCHEMA;
    simulationFidelity: typeof FIDELITY;
    createdAt: string;
    sections: readonly string[];
  };
  scene: { environmentId: string | null; coordinates: 'world-space meters'; initialWorld: WorldState; finalWorld: WorldState };
  task: EvidenceTask | null;
  episode: EvidenceEpisode & { schema: typeof EPISODE_SCHEMA };
  metrics: EvidenceMetrics;
  checks: EnvironmentCheck[];
  humanReview: { status: EvidenceEpisode['status']; approved: boolean; identityVerified: false };
  report: Record<string, unknown> | null;
  derivedArmTrace?: ReturnType<typeof createArmTrace>;
  integrity?: EvidenceIntegrity;
}
export interface EvidenceValidation { valid: boolean; errors: string[] }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const vec3 = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every(finite);
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
const oneOf = (value: unknown, choices: string[]) => typeof value === 'string' && choices.includes(value);

/** Stable JSON object ordering; undefined object fields follow JSON's omission rule. */
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (finite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new Error('Evidence must contain only finite JSON values.');
}
function snapshot<T>(value: T): T { return JSON.parse(canonical(value)) as T; }
const same = (a: unknown, b: unknown) => a === undefined || b === undefined ? a === b : canonical(a) === canonical(b);

function taskFor(world: WorldState): EvidenceTask | null {
  const definition = taskForWorld(world);
  return definition ? {
    id: definition.id, name: definition.name, description: definition.description,
    instruction: definition.instruction, assignments: snapshot(definition.targets),
    destinationLabels: snapshot(world.destinationLabels),
  } : null;
}
function checksFor(initial: WorldState, final: WorldState, samples: EvidenceEpisode['samples']): EnvironmentCheck[] {
  const history = createProtectedHistory(initial);
  for (const sample of samples) history.observe(sample.world);
  return mergeProtectedHistoryChecks(taskForWorld(initial)?.successChecks(final) ?? [], history.checks());
}
function completionCount(episode: EvidenceEpisode): number {
  let previous = episode.initialWorld.lastCompletedStepId;
  let count = 0;
  for (const sample of episode.samples) {
    const next = sample.world.lastCompletedStepId;
    if (next && next !== previous) count++;
    previous = next;
  }
  return count;
}
function metricsFor(episode: EvidenceEpisode, checks: EnvironmentCheck[]): EvidenceMetrics {
  return {
    durationSeconds: episode.duration, sampleCount: episode.samples.length,
    eventCount: episode.events.length, completedActions: episode.completedActions,
    observedCompletionCount: completionCount(episode),
    errorEventCount: episode.events.filter(event => event.kind === 'error').length,
    recordedOutcome: episode.outcome,
    taskAcceptancePassed: checks.length ? checks.every(check => check.passed) : null,
  };
}

function worldErrors(value: unknown, path: string, errors: string[]): value is WorldState {
  const start = errors.length;
  if (!record(value)) { errors.push(`${path} must be a world object.`); return false; }
  if (!finite(value.simTime) || value.simTime < 0) errors.push(`${path}.simTime must be finite and nonnegative.`);
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) errors.push(`${path}.revision must be a nonnegative integer.`);
  if (value.environmentId !== undefined && !text(value.environmentId)) errors.push(`${path}.environmentId must be a nonempty string when present.`);
  if (value.lastCompletedStepId !== undefined && !text(value.lastCompletedStepId)) errors.push(`${path}.lastCompletedStepId must be nonempty when present.`);
  if (value.humanPresence !== undefined && (!record(value.humanPresence) || !oneOf(value.humanPresence.state,['clear','nearby','in-workspace']) || value.humanPresence.source !== 'scenario-proxy' || Object.keys(value.humanPresence).some(key=>!['state','source'].includes(key)))) errors.push(`${path}.humanPresence must be an explicit supported software scenario proxy.`);
  if (value.sceneProvenance !== undefined) {
    const provenance=value.sceneProvenance;
    if(!record(provenance)||!oneOf(provenance.source,['deterministic','ai-draft','import'])||(provenance.reviewRequired!==undefined&&typeof provenance.reviewRequired!=='boolean')||(provenance.reviewed!==undefined&&typeof provenance.reviewed!=='boolean')) errors.push(`${path}.sceneProvenance has invalid source or review metadata.`);
    else {
      if(provenance.reference!==undefined&&!validateReferenceFingerprint(provenance.reference)) errors.push(`${path}.sceneProvenance.reference must be a bounded uncalibrated reference fingerprint, without media or verified-rights claims.`);
      if(provenance.derivation!==undefined&&!validateSceneDerivation(provenance.derivation)) errors.push(`${path}.sceneProvenance.derivation must retain bounded declared parent lineage without verified-identity claims.`);
    }
  }

  if (value.destinationLabels !== undefined && (!record(value.destinationLabels) || !['table', 'tray-a', 'tray-b', 'reject'].every(key => text((value.destinationLabels as Record<string, unknown>)[key])))) errors.push(`${path}.destinationLabels must name every destination.`);
  const ids: string[] = [];
  if (!Array.isArray(value.objects)) errors.push(`${path}.objects must be an array.`);
  else if(value.objects.length>6)errors.push(`${path}.objects exceeds the supported six-object workcell.`);
  else for (const [index, object] of value.objects.entries()) {
    if (!record(object)) { errors.push(`${path}.objects[${index}] must be an object.`); continue; }
    if (!text(object.id) || ids.includes(object.id)) errors.push(`${path}.objects must have unique nonempty IDs.`);
    if (text(object.id)) ids.push(object.id);
    if (!text(object.label) || object.label.length>120 || typeof object.color!=='string' || !/^#[\da-f]{6}$/i.test(object.color) || !oneOf(object.status,['ready','in-transit','placed','rejected'])) errors.push(`${path}.objects[${index}] needs a bounded label, six-digit hex color, and supported controller status.`);
    if (!oneOf(object.kind, ['block', 'cube', 'cylinder'])) errors.push(`${path}.objects[${index}].kind is unsupported.`);
    if (object.semanticType !== undefined && !text(object.semanticType)) errors.push(`${path}.objects[${index}].semanticType is invalid.`);
    if (!vec3(object.position) || !vec3(object.size) || !(object.size as number[]).every(n => n > 0)) errors.push(`${path}.objects[${index}] needs finite position and positive size vectors.`);
    if (!oneOf(object.location, ['table', 'tray-a', 'tray-b', 'reject'])) errors.push(`${path}.objects[${index}].location is invalid.`);
  }
  if (!record(value.robot)) errors.push(`${path}.robot is required.`);
  else {
    const robot = value.robot;
    if (!vec3(robot.position) || !finite(robot.gripperOpen) || robot.gripperOpen < 0 || robot.gripperOpen > 1 || !finite(robot.speed) || robot.speed <= 0) errors.push(`${path}.robot has invalid finite pose/gripper/speed data.`);
    if (!oneOf(robot.mode, ['idle', 'running', 'paused', 'stopped', 'error']) || !text(robot.phase)) errors.push(`${path}.robot mode or phase is invalid.`);
    if (robot.heldObjectId !== null && (!text(robot.heldObjectId) || !ids.includes(robot.heldObjectId))) errors.push(`${path}.robot references an unknown held object.`);
  }
  if (value.motion !== null) {
    if (!record(value.motion) || !text(value.motion.stepId) || !Array.isArray(value.motion.phases) || !value.motion.phases.length
      || !Number.isInteger(value.motion.phaseIndex) || (value.motion.phaseIndex as number) < 0 || (value.motion.phaseIndex as number) >= value.motion.phases.length
      || !finite(value.motion.elapsed) || value.motion.elapsed < 0 || !vec3(value.motion.startPosition) || !finite(value.motion.startGripper)) errors.push(`${path}.motion is invalid.`);
    else {
      if (value.motion.objectId !== undefined && !ids.includes(String(value.motion.objectId))) errors.push(`${path}.motion references an unknown object.`);
      if (value.motion.destination !== undefined && !oneOf(value.motion.destination, ['table', 'tray-a', 'tray-b', 'reject'])) errors.push(`${path}.motion destination is invalid.`);
      for (const phase of value.motion.phases) if (!record(phase) || !text(phase.label) || !finite(phase.duration) || phase.duration <= 0 || !vec3(phase.position) || !finite(phase.gripperOpen)) errors.push(`${path}.motion has an invalid phase.`);
    }
  }
  return errors.length === start;
}

function episodeErrors(value: unknown, errors: string[]): value is EvidenceEpisode {
  const start = errors.length;
  if (!record(value)) { errors.push('episode must be an object.'); return false; }
  if (!text(value.id) || !text(value.title) || typeof value.command !== 'string') errors.push('episode needs id, title, and command strings.');
  if (value.scenarioId !== undefined && !text(value.scenarioId)) errors.push('episode.scenarioId must be a nonempty string when present.');
  if (!finite(value.duration) || value.duration < 0) errors.push('episode.duration must be finite and nonnegative.');
  if (!oneOf(value.status, ['review', 'approved']) || !oneOf(value.outcome, ['completed', 'stopped', 'failed'])) errors.push('episode review status or outcome is invalid.');
  if (!text(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt))) errors.push('episode.createdAt must be a valid date.');
  if (!Number.isInteger(value.completedActions) || (value.completedActions as number) < 0) errors.push('episode.completedActions must be a nonnegative integer.');
  if (!text(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt))) errors.push('episode.createdAt must be a valid timestamp.');
  const initialValid = worldErrors(value.initialWorld, 'episode.initialWorld', errors);
  const initial = value.initialWorld as WorldState;
  let previousTime = -Infinity;
  let allWorldsValid = initialValid;
  if (!Array.isArray(value.samples) || !value.samples.length) errors.push('episode.samples must be nonempty.');
  else for (const [index, sample] of value.samples.entries()) {
    if (!record(sample)) { errors.push(`sample[${index}] must be an object.`); allWorldsValid = false; continue; }
    if (!finite(sample.time) || sample.time < 0 || sample.time < previousTime) errors.push(`sample[${index}] time must be finite, nonnegative, and chronological.`);
    if (finite(sample.time)) previousTime = sample.time;
    const valid = worldErrors(sample.world, `sample[${index}].world`, errors);
    allWorldsValid = allWorldsValid && valid;
    if (valid && initialValid) {
      const world = sample.world as unknown as WorldState;
      if (!near(world.simTime - initial.simTime, sample.time as number)) errors.push(`sample[${index}] time disagrees with its world clock.`);
      if (world.environmentId !== initial.environmentId || world.baseEnvironmentId !== initial.baseEnvironmentId || !same(world.customTask, initial.customTask) || !same(world.sceneProvenance, initial.sceneProvenance) || !same(world.destinationLabels, initial.destinationLabels)) errors.push(`sample[${index}] changed environment identity or destinations.`);
      const inventory = (world: WorldState) => world.objects.map(({ id, label, kind, size, color, semanticType }) => ({ id, label, kind, size, color, semanticType })).sort((a, b) => a.id.localeCompare(b.id));
      if (!same(inventory(world), inventory(initial))) errors.push(`sample[${index}] changed known object IDs or immutable object metadata.`);
    }
  }
  if (Array.isArray(value.samples) && value.samples.length && initialValid && allWorldsValid) {
    const samples = value.samples as EvidenceEpisode['samples'];
    if (samples[0].time !== 0 || !same(samples[0].world, initial)) errors.push('The first sample must be the actual initial world at time zero.');
    if (!near(samples.at(-1)!.time, value.duration as number)) errors.push('episode.duration must match the final sample time.');
  }
  previousTime = -Infinity;
  if (!Array.isArray(value.events)) errors.push('episode.events must be an array.');
  else for (const [index, event] of value.events.entries()) {
    if (!record(event) || !finite(event.time) || event.time < 0 || event.time < previousTime || event.time > (value.duration as number) + 1e-6 || !text(event.label) || !oneOf(event.kind, ['command', 'action', 'success', 'error', 'control'])) errors.push(`event[${index}] must have a chronological time within the episode, a label, and a known kind.`);
    if (record(event) && finite(event.time)) previousTime = event.time;
  }
  if (errors.length !== start) return false;
  const episode = value as unknown as EvidenceEpisode;
  const final = episode.samples.at(-1)!.world;
  if (completionCount(episode) !== episode.completedActions) errors.push('Completed actions must match observed controller completion transitions; counts cannot be invented.');
  if (episode.events.filter(event => event.kind === 'success').length < episode.completedActions) errors.push('Completed actions require matching recorded success evidence.');
  if (episode.outcome === 'completed' && (final.robot.mode !== 'idle' || final.motion !== null || final.robot.heldObjectId !== null || episode.events.some(event => event.kind === 'error'))) errors.push('A completed outcome requires a settled controller, empty gripper, and no recorded error.');
  if (episode.outcome === 'failed' && final.robot.mode !== 'error' && !episode.events.some(event => event.kind === 'error')) errors.push('A failed outcome requires a controller error or recorded error event.');
  // Legacy reset recordings can end while running; retain their stopped label,
  // rather than relabeling an interrupted recording as a successful task.
  if (episode.outcome === 'stopped' && final.robot.mode === 'idle' && final.motion === null && !episode.events.some(event => event.kind === 'control')) errors.push('A stopped outcome requires interruption evidence.');
  return errors.length === start;
}

/** Deterministic snapshot, not a claim of physical validity or training compatibility. */
export function buildEvidencePackage(episode: EvidenceEpisode, persistedReport?: Record<string, unknown> | null): EvidencePackage {
  const source = snapshot(episode);
  const errors: string[] = [];
  if (!episodeErrors(source, errors)) throw new Error(`Cannot package invalid episode: ${errors.join(' ')}`);
  if (persistedReport !== undefined && persistedReport !== null && !record(persistedReport)) throw new Error('The optional persisted report must be a JSON object.');
  const final = source.samples.at(-1)!.world;
  const checks = checksFor(source.initialWorld, final, source.samples);
  const payload: EvidencePackage = {
    schema: SCHEMA,
    manifest: { producer: { name: 'RoboTrace Workcell Studio', version: '0.1.0' }, controller: 'teachtrace-kinematic-v1', episodeSchema: EPISODE_SCHEMA, simulationFidelity: snapshot(FIDELITY), createdAt: source.createdAt, sections: [...SECTIONS, 'derivedArmTrace'] },
    scene: { environmentId: source.initialWorld.environmentId ?? null, coordinates: 'world-space meters', initialWorld: snapshot(source.initialWorld), finalWorld: snapshot(final) },
    task: taskFor(source.initialWorld), episode: { ...source, schema: EPISODE_SCHEMA },
    metrics: metricsFor(source, checks), checks, derivedArmTrace: createArmTrace(source.samples),
    humanReview: { status: source.status, approved: source.status === 'approved', identityVerified: false },
    report: persistedReport ? snapshot(persistedReport) : null,
  };
  return payload;
}

/** Validates consistency, not authenticity: SHA-256 is not an author signature. */
export function validateEvidencePackage(payload: unknown): EvidenceValidation {
  const errors: string[] = [];
  try {
    canonical(payload); // Reject NaN/Infinity, cycles, and non-JSON data before trusting casts.
    if (!record(payload) || payload.schema !== SCHEMA) return { valid: false, errors: ['Expected schema teachtrace.evidence.v1.'] };
    if (!episodeErrors(payload.episode, errors)) return { valid: false, errors };
    const episode = payload.episode as EvidencePackage['episode'];
    if (episode.schema !== EPISODE_SCHEMA) errors.push('The native episode must preserve schema teachtrace.episode.v1.');
    const final = episode.samples.at(-1)!.world;
    const checks = checksFor(episode.initialWorld, final, episode.samples);
    const expectedManifest = { producer: { name: 'RoboTrace Workcell Studio', version: '0.1.0' }, controller: 'teachtrace-kinematic-v1', episodeSchema: EPISODE_SCHEMA, simulationFidelity: FIDELITY, createdAt: episode.createdAt, sections: payload.derivedArmTrace === undefined ? SECTIONS : [...SECTIONS, 'derivedArmTrace'] };
    if (!same(payload.manifest, expectedManifest)) errors.push('Manifest producer/controller/fidelity/createdAt/sections do not match the native schema.');
    const expectedScene = { environmentId: episode.initialWorld.environmentId ?? null, coordinates: 'world-space meters', initialWorld: episode.initialWorld, finalWorld: final };
    if (payload.derivedArmTrace !== undefined && !same(payload.derivedArmTrace, createArmTrace(episode.samples))) errors.push('Derived arm telemetry must match the exact recorded kinematic states.');
    if (!same(payload.scene, expectedScene)) errors.push('Scene initial/final worlds must match the recorded first/last states.');
    if (!same(payload.task, taskFor(episode.initialWorld))) errors.push('Task SOP and assignments must match the recorded environment.');
    if (!same(payload.checks, checks)) errors.push('Task checks must be recomputed from recorded history and the final world, including protected references.');
    if (!same(payload.metrics, metricsFor(episode, checks))) errors.push('Metrics must preserve actual recorded outcomes and counts.');
    if (!same(payload.humanReview, { status: episode.status, approved: episode.status === 'approved', identityVerified: false })) errors.push('Human review must preserve the episode status without asserting reviewer identity.');
    if (payload.report !== null && !record(payload.report)) errors.push('report must be a JSON object or null.');
    if (payload.integrity !== undefined && (!record(payload.integrity) || payload.integrity.algorithm !== 'SHA-256' || payload.integrity.canonicalization !== 'teachtrace.canonical-json.v1' || typeof payload.integrity.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(payload.integrity.sha256))) errors.push('Integrity metadata must specify canonical JSON and a SHA-256 hex digest.');
  } catch {
    errors.push('Evidence contains invalid, nonfinite, cyclic, or missing JSON data.');
  }
  return { valid: errors.length === 0, errors };
}

async function digest(payload: EvidencePackage): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires Web Crypto in a secure browser context or supported Node runtime.');
  const { integrity: _integrity, ...unsigned } = payload;
  const bytes = new TextEncoder().encode(canonical(unsigned));
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
}

export async function sealEvidencePackage(payload: EvidencePackage): Promise<EvidencePackage & { integrity: EvidenceIntegrity }> {
  const copy = snapshot(payload);
  const validation = validateEvidencePackage(copy);
  if (!validation.valid) throw new Error(`Cannot seal invalid evidence: ${validation.errors.join(' ')}`);
  return { ...copy, integrity: { algorithm: 'SHA-256', canonicalization: 'teachtrace.canonical-json.v1', sha256: await digest(copy) } };
}

export async function verifyEvidencePackage(payload: unknown): Promise<EvidenceValidation> {
  const validation = validateEvidencePackage(payload);
  if (!validation.valid) return validation;
  const evidence = payload as EvidencePackage;
  if (!evidence.integrity) return { valid: false, errors: ['A sealed evidence package requires a SHA-256 integrity digest.'] };
  try {
    if (await digest(evidence) !== evidence.integrity.sha256) return { valid: false, errors: ['SHA-256 integrity mismatch: package content changed.'] };
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'SHA-256 verification failed.'] };
  }
}
