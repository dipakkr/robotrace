import { advanceMobileWorld, mobileGoalChecks, mobileSegmentIsClear, findMobileRoute, startMobilePlan } from './mobile-navigation';
import type { MobileGoalCheck, MobilePlan, MobileStationId, MobileStep, MobileWorld } from './mobile-navigation';
import { MOBILE_PROTECTED_POLICY, mobileProtectedChange } from '../data/mobile-protected-policy.mjs';

export type MobileCandidateAction =
  | { skill: 'navigate'; station: MobileStationId }
  | { skill: 'reach-check' | 'pickup' | 'place'; objectId: 'cup' | 'bowl'; station: MobileStationId };
export interface MobileCandidate { actions: MobileCandidateAction[] }
export interface MobileCandidateGoal { objectId: 'cup' | 'bowl'; stationId: MobileStationId }
export interface MobileCandidateValidation { valid: boolean; errors: string[]; candidate?: MobileCandidate }
export type MobileCandidateSource = 'human' | 'llm' | 'baseline';
export type MobileFailureCategory = 'invalid-plan' | 'no-route' | 'reach' | 'docking' | 'object-state'
  | 'wrong-goal' | 'protected-object' | 'human-blocked' | 'incomplete' | 'execution-error';
export interface MobileCandidateInput {
  world: MobileWorld;
  candidate: unknown;
  goal?: MobileCandidateGoal;
  source: MobileCandidateSource;
  label: string;
  model?: string;
  requestDurationMs?: number;
  instruction?: string;
}
export interface MobileCandidateResult {
  schema: 'teachtrace.mobile-candidate-result.v1';
  id: string;
  source: MobileCandidateSource;
  label: string;
  model?: string;
  instruction?: string;
  requestDurationMs?: number;
  goal: MobileCandidateGoal;
  candidate: MobileCandidate | null;
  submittedCandidate: unknown;
  planValid: boolean;
  planErrors: string[];
  outcome: 'invalid' | 'refused' | 'failed' | 'blocked' | 'completed';
  taskAccepted: boolean;
  failureCategory: MobileFailureCategory | null;
  failureMessage: string | null;
  failureStepIndex: number | null;
  failedAction: MobileCandidateAction | null;
  error?: string;
  steps: MobileStep[];
  completedSteps: number;
  completedPickups: number;
  completedPlacements: number;
  distanceTravelled: number;
  simulatedSeconds: number;
  evaluationDurationMs: number;
  ticks: number;
  checks: MobileGoalCheck[];
  initialWorld: MobileWorld;
  finalWorld: MobileWorld;
  trajectory: { time: number; world: MobileWorld }[];
  protectedObjectPolicy: typeof MOBILE_PROTECTED_POLICY;
  protectedViolations: MobileProtectedViolation[];
  executionBudget: { maxTicks: number; dt: number; maxSamples: number };
  limitations: string[];
}
export interface MobileProtectedViolation {
  objectId: string;
  timeSeconds: number;
  worldTimeSeconds: number;
  stepIndex: number;
  position: [number, number, number] | null;
  displacementMeters: number | null;
  changedFields: string[];
}

export const DEFAULT_MOBILE_CANDIDATE_GOAL: Readonly<MobileCandidateGoal> = Object.freeze({ objectId: 'cup', stationId: 'sink' });
const STATIONS: MobileStationId[] = ['counter', 'table', 'sink', 'home'];
const MAX_ACTIONS = 12;
const MAX_TICKS = 6000;
const DT = 1 / 30;
const MAX_SAMPLES = 2005;
const EPSILON = 1e-7;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(finite);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(value: T): T => structuredClone(value);

/** JSON shape and current-scene references only; wrong order and wrong goals are not repaired. */
export function validateMobileCandidate(payload: unknown, world: MobileWorld): MobileCandidateValidation {
  const errors: string[] = [];
  if (!record(payload) || !exactKeys(payload, ['actions']) || !Array.isArray(payload.actions)) {
    return { valid: false, errors: ['Use exactly {actions: [...]} with declared mobile skills.'] };
  }
  if (payload.actions.length < 1 || payload.actions.length > MAX_ACTIONS) errors.push(`Declare between 1 and ${MAX_ACTIONS} actions.`);
  const actions: MobileCandidateAction[] = [];
  for (const [index, action] of payload.actions.entries()) {
    const previousErrors = errors.length;
    const prefix = `Action ${index + 1}`;
    if (!record(action)) { errors.push(`${prefix} must be a JSON object.`); continue; }
    const skill = action.skill;
    if (!['navigate', 'reach-check', 'pickup', 'place'].includes(String(skill)) || typeof skill !== 'string') {
      errors.push(`${prefix} has an unsupported skill.`); continue;
    }
    if (!exactKeys(action, skill === 'navigate' ? ['skill', 'station'] : ['skill', 'objectId', 'station'])) {
      errors.push(`${prefix} has missing or extra fields; navigation has no objectId.`);
    }
    if (typeof action.station !== 'string' || !STATIONS.includes(action.station as MobileStationId)
      || world?.stations?.filter(station => station.id === action.station).length !== 1) errors.push(`${prefix} must name one exact station in this scene.`);
    if (skill !== 'navigate' && (typeof action.objectId !== 'string' || !['cup', 'bowl'].includes(action.objectId)
      || world?.objects?.filter(object => object.id === action.objectId).length !== 1)) errors.push(`${prefix} must name Cup or Bowl by its exact scene object ID.`);
    if (errors.length === previousErrors) {
      // Construct only the already validated JSON primitive; never invoke or clone
      // extra submitted values while rejecting a malformed external candidate.
      actions.push(skill === 'navigate'
        ? { skill, station: action.station as MobileStationId }
        : { skill: skill as 'reach-check' | 'pickup' | 'place', station: action.station as MobileStationId, objectId: action.objectId as 'cup' | 'bowl' });
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, errors: [], candidate: { actions } };
}

function sceneErrors(world: MobileWorld): string[] {
  const errors: string[] = [];
  if (!world || world.schema !== 'teachtrace.mobile-kitchen.v1' || !Array.isArray(world.stations) || !Array.isArray(world.objects)
    || !Array.isArray(world.obstacles) || !Array.isArray(world.events) || !world.robot || !world.bounds) return ['A complete native mobile scene is required.'];
  if (!point(world.robot.position) || !finite(world.robot.yaw) || !finite(world.robot.radius) || world.robot.radius <= 0
    || !finite(world.robot.speed) || world.robot.speed <= 0 || !finite(world.robot.armReach) || world.robot.armReach <= 0) errors.push('The base pose, footprint, speed and arm reach must be finite and positive where applicable.');
  if (!['idle', 'stopped'].includes(world.robot.mode) || world.mission?.status === 'running') errors.push('Freeze a settled idle or stopped mobile scene before evaluating a candidate.');
  if (![world.bounds.minX, world.bounds.maxX, world.bounds.minZ, world.bounds.maxZ].every(finite)
    || world.bounds.minX >= world.bounds.maxX || world.bounds.minZ >= world.bounds.maxZ || !finite(world.cellSize) || world.cellSize < 0.25 || world.cellSize > 1) errors.push('The floor bounds and route grid must be valid and bounded.');
  if (!finite(world.simTime) || world.simTime < 0 || !finite(world.distanceTravelled) || world.distanceTravelled < 0 || !Number.isSafeInteger(world.revision)) errors.push('The initial simulation clock, travel and revision are invalid.');
  if (world.stations.length !== 4 || !STATIONS.every(id => world.stations.filter(station => station.id === id).length === 1)
    || world.stations.some(station => !point(station.dock) || !point(station.surface) || !finite(station.height) || station.height < 0)) errors.push('The scene needs four unique known stations with finite dock/surface coordinates.');
  if (world.objects.length < 1 || world.objects.length > 2 || new Set(world.objects.map(object => object.id)).size !== world.objects.length
    || world.objects.some(object => !['cup', 'bowl'].includes(object.id) || !point(object.position) || !finite(object.height)
      || ![...STATIONS, 'robot'].includes(object.station) || !['ready', 'loading', 'carried', 'unloading', 'delivered'].includes(object.status))) errors.push('The scene objects need unique known IDs and finite native state.');
  if (world.obstacles.length > 64 || world.obstacles.some(obstacle => ![obstacle.minX, obstacle.maxX, obstacle.minZ, obstacle.maxZ].every(finite)
    || obstacle.minX >= obstacle.maxX || obstacle.minZ >= obstacle.maxZ)) errors.push('The known obstacle map is invalid or too large.');
  if (world.human !== null && (!point(world.human.position) || !finite(world.human.radius) || world.human.radius <= 0 || world.human.source !== 'scenario-proxy')) errors.push('A human obstruction must be an explicit finite scenario proxy.');
  if (world.robot.cargoObjectId !== null) {
    const cargo = world.objects.find(object => object.id === world.robot.cargoObjectId);
    if (!cargo || cargo.station !== 'robot' || cargo.status !== 'carried'
      || !same(cargo.position, world.robot.position)) errors.push('Initial carried-object state must agree with the base and carrier.');
  } else if (world.objects.some(object => object.station === 'robot')) errors.push('An object on the carrier must match its held-object ID.');
  if (!errors.length && !mobileSegmentIsClear(world, world.robot.position, world.robot.position)) errors.push('The initial base footprint intersects the known static map.');
  return errors;
}

function goalErrors(goal: MobileCandidateGoal, world: MobileWorld): string[] {
  return !goal || !['cup', 'bowl'].includes(goal.objectId) || !['counter', 'table', 'sink'].includes(goal.stationId)
    || world.objects?.filter(object => object.id === goal.objectId).length !== 1 || world.stations?.filter(station => station.id === goal.stationId).length !== 1
    ? ['Choose one existing Cup/Bowl and one delivery surface: counter, table or sink. The task goal cannot come from the candidate.'] : [];
}

/** Clearly authored skill recipe. This does not insert or repair actions in model candidates. */
export function baselineMobileCandidate(world: MobileWorld, goal: MobileCandidateGoal = DEFAULT_MOBILE_CANDIDATE_GOAL): MobileCandidate {
  const errors = [...sceneErrors(world), ...goalErrors(goal, world)];
  if (errors.length) throw new Error(errors.join(' '));
  const object = world.objects.find(object => object.id === goal.objectId)!;
  if (world.robot.cargoObjectId === object.id) return { actions: [{ skill: 'navigate', station: goal.stationId }, { skill: 'place', objectId: goal.objectId, station: goal.stationId }] };
  if (!STATIONS.includes(object.station as MobileStationId)) throw new Error('The baseline object has no known pickup station.');
  const source = object.station as MobileStationId;
  return { actions: [
    { skill: 'navigate', station: source }, { skill: 'reach-check', objectId: goal.objectId, station: source },
    { skill: 'pickup', objectId: goal.objectId, station: source }, { skill: 'navigate', station: goal.stationId },
    { skill: 'place', objectId: goal.objectId, station: goal.stationId },
  ] };
}

function compile(candidate: MobileCandidate, world: MobileWorld): { steps: MobileStep[]; failureStepIndex: number | null; error?: string } {
  const steps: MobileStep[] = [];
  let position = [...world.robot.position] as [number, number];
  for (const [index, action] of candidate.actions.entries()) {
    const station = world.stations.find(item => item.id === action.station)!;
    if (action.skill === 'navigate') {
      const path = findMobileRoute(world, position, station.dock);
      if (!path) return { steps, failureStepIndex: index, error: `Action ${index + 1} cannot find a collision-free route to ${station.label} from the preceding declared position.` };
      steps.push({ kind: 'navigate', stationId: station.id, label: `Navigate to ${station.label}`, path });
      position = [...station.dock];
    } else {
      const object = world.objects.find(item => item.id === action.objectId)!;
      steps.push({ kind: action.skill, stationId: station.id, objectId: object.id,
        label: `${action.skill === 'reach-check' ? 'Recheck reach for' : action.skill === 'pickup' ? 'Collect' : 'Place'} ${object.label} at ${station.label}` });
    }
  }
  return { steps, failureStepIndex: null };
}

function classify(error: string): MobileFailureCategory {
  if (/human|obstruct/i.test(error)) return 'human-blocked';
  if (/reach/i.test(error)) return 'reach';
  if (/not docked/i.test(error)) return 'docking';
  if (/object|carrier|cargo/i.test(error)) return 'object-state';
  if (/route|collision-free|static obstacle/i.test(error)) return 'no-route';
  return 'execution-error';
}

/** Runs exactly the submitted skill order on a frozen scene; no model verbal score is used. */
export function evaluateMobileCandidate(input: MobileCandidateInput): MobileCandidateResult {
  const started = performance.now();
  const initialWorld = clone(input.world);
  let world = clone(initialWorld);
  const goal = clone(input.goal ?? DEFAULT_MOBILE_CANDIDATE_GOAL);
  const validation = validateMobileCandidate(input.candidate, initialWorld);
  const planErrors = [...sceneErrors(initialWorld), ...goalErrors(goal, initialWorld), ...validation.errors];
  const planValid = planErrors.length === 0;
  const candidate = validation.candidate ?? null;
  let submittedCandidate: unknown;
  try { submittedCandidate = clone(input.candidate); } catch { submittedCandidate = null; }
  let steps: MobileStep[] = [];
  let outcome: MobileCandidateResult['outcome'] = 'invalid';
  let error: string | undefined;
  let failureCategory: MobileFailureCategory | null = planValid ? null : 'invalid-plan';
  let failureMessage: string | null = planValid ? null : planErrors.join(' ');
  let failureStepIndex: number | null = null;
  let ticks = 0;
  let executedPlanId: string | null = null;
  const disturbedObjects = new Map<string, number>();
  const protectedViolations: MobileProtectedViolation[] = [];
  const trajectory: MobileCandidateResult['trajectory'] = [{ time: 0, world: clone(initialWorld) }];
  const reservedSamples = new Set([trajectory[0]]);
  let nextSample = 0.1;
  const sample = (force = false, preserve = false) => {
    const time = world.simTime - initialWorld.simTime;
    if (!force && time + EPSILON < nextSample) return;
    const previous = trajectory.at(-1)!;
    if (force && previous.time === time && same(previous.world, world)) { if (preserve) reservedSamples.add(previous); return; }
    const entry = { time, world: clone(world) };
    if (trajectory.length < MAX_SAMPLES) trajectory.push(entry);
    else if (force) {
      let replace = trajectory.length - 1;
      while (replace > 0 && reservedSamples.has(trajectory[replace])) replace--;
      trajectory.splice(replace, 1); trajectory.push(entry);
    }
    if (preserve) reservedSamples.add(entry);
    nextSample = Math.floor((time + EPSILON) * 10) / 10 + 0.1;
  };

  if (planValid && candidate) {
    const compiled = compile(candidate, initialWorld);
    steps = compiled.steps;
    if (compiled.error) {
      outcome = 'refused'; error = compiled.error; failureMessage = error; failureCategory = 'no-route'; failureStepIndex = compiled.failureStepIndex;
    } else {
      const plan: MobilePlan = { id: `candidate-${crypto.randomUUID()}`, worldRevision: initialWorld.revision,
        command: input.instruction ?? `Deliver ${goal.objectId} to ${goal.stationId}`, summary: input.label,
        rationale: ['Execute the submitted mobile skills in their original order against the independently supplied task goal.'],
        steps: clone(steps), confirmationRequired: true, goal: clone(goal) };
      const beginning = startMobilePlan(initialWorld, plan, 'evaluation');
      world = beginning.world;
      if (beginning.error) { outcome = 'failed'; error = beginning.error; failureCategory = 'execution-error'; failureMessage = error; }
      else {
        executedPlanId = plan.id;
        outcome = 'failed';
        for (; ticks < MAX_TICKS;) {
          const index = world.mission?.stepIndex ?? 0;
          const previousEvents = world.events.length;
          const result = advanceMobileWorld(world, DT);
          ticks++;
          world = result.world;
          let firstProtectedViolation = false;
          // Observe each native tick, including partial handling, rather than relying on
          // a final pose or the lower-frequency replay to prove an object stayed untouched.
          for (const object of initialWorld.objects.filter(object => object.id !== goal.objectId)) {
            if (disturbedObjects.has(object.id)) continue;
            const current = world.objects.find(current => current.id === object.id);
            const change = mobileProtectedChange(object, current);
            if (change.violated) {
              // One native tick can finish a reach check and begin a pickup. Attribute
              // that first actual state change to the handling action, not the prior check.
              const end = Math.min(world.mission?.stepIndex ?? index, candidate.actions.length - 1);
              let cause = index;
              for (let stepIndex = index; stepIndex <= end; stepIndex++) {
                const action = candidate.actions[stepIndex];
                if ((action.skill === 'pickup' || action.skill === 'place') && action.objectId === object.id) { cause = stepIndex; break; }
              }
              disturbedObjects.set(object.id, cause);
              protectedViolations.push({ objectId: object.id, timeSeconds: world.simTime - initialWorld.simTime, worldTimeSeconds: world.simTime, stepIndex: cause,
                position: current ? [current.position[0], current.height + MOBILE_PROTECTED_POLICY.heightOffsetMeters, current.position[1]] : null,
                displacementMeters: change.displacementMeters, changedFields: [...change.changedFields] });
              firstProtectedViolation = true;
            }
          }
          const newControl = world.events.slice(previousEvents).some(event => event.kind === 'control' || event.kind === 'blocked');
          sample(Boolean(firstProtectedViolation || result.done || result.error || result.blocked || newControl || world.mission?.stepIndex !== index), firstProtectedViolation);
          if (result.blocked || result.error) {
            outcome = result.blocked ? 'blocked' : 'failed';
            error = result.blocked ?? result.error;
            failureMessage = error!; failureCategory = classify(error!); failureStepIndex = world.mission?.stepIndex ?? index;
            break;
          }
          if (result.done) { outcome = 'completed'; break; }
        }
        if (ticks >= MAX_TICKS && outcome !== 'completed' && !error) {
          error = `The candidate exceeded ${MAX_TICKS} controller ticks without completing its declared actions.`;
          failureCategory = 'incomplete'; failureMessage = error; failureStepIndex = world.mission?.stepIndex ?? null;
          sample(true);
        }
      }
    }
  }

  // Goal checks are bound to the frozen task, never the candidate's final station.
  const checkingWorld = clone(world);
  if (checkingWorld.mission) checkingWorld.mission.plan.goal = clone(goal);
  const checks = mobileGoalChecks(checkingWorld);
  for (const object of initialWorld.objects.filter(object => object.id !== goal.objectId)) {
    const current = world.objects.find(item => item.id === object.id);
    checks.push({ id: `protected-${object.id}`, name: `${object.label} remains undisturbed`, passed: Boolean(current && !mobileProtectedChange(object, current).violated && !disturbedObjects.has(object.id)),
      detail: 'Every unrequested object must retain its complete frozen initial state throughout execution, including partial handling; returning it later does not erase a disturbance.' });
  }
  checks.push({ id: 'inventory-preserved', name: 'Known object inventory retained',
    passed: same(initialWorld.objects.map(object => object.id).sort(), world.objects.map(object => object.id).sort()),
    detail: 'No object may be added, removed or silently substituted by the plan.' });
  const taskAccepted = outcome === 'completed' && checks.length > 0 && checks.every(check => check.passed);
  if (outcome === 'completed' && !taskAccepted) {
    const protectedFailure = checks.find(check => check.id.startsWith('protected-') && !check.passed);
    const target = world.objects.find(object => object.id === goal.objectId);
    failureCategory = protectedFailure ? 'protected-object' : target?.status === 'delivered' && target.station !== goal.stationId ? 'wrong-goal' : 'incomplete';
    failureMessage = protectedFailure ? protectedFailure.name + ': the candidate disturbed an unrequested object.'
      : `Declared actions finished, but the frozen task failed: ${checks.filter(check => !check.passed).map(check => check.name).join('; ')}.`;
    if (protectedFailure) {
      failureStepIndex = disturbedObjects.get(protectedFailure.id.slice('protected-'.length)) ?? null;
    } else if (failureCategory === 'wrong-goal') {
      // Identify the actual completed placement that produced the wrong destination.
      // A missing placement remains an incomplete predicate with no invented action.
      for (let index = Math.min(world.mission?.completedSteps ?? 0, candidate?.actions.length ?? 0) - 1; index >= 0; index--) {
        const action = candidate!.actions[index];
        if (action.skill === 'place' && action.objectId === goal.objectId && action.station === target?.station) { failureStepIndex = index; break; }
      }
    }
  }
  const completedSteps = executedPlanId && world.mission?.plan.id === executedPlanId ? world.mission.completedSteps : 0;
  const completed = steps.slice(0, completedSteps);
  return {
    schema: 'teachtrace.mobile-candidate-result.v1', id: crypto.randomUUID(), source: input.source, label: input.label,
    ...(input.model ? { model: input.model } : {}), ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
    ...(finite(input.requestDurationMs) && input.requestDurationMs >= 0 ? { requestDurationMs: input.requestDurationMs } : {}),
    goal, candidate: candidate ? clone(candidate) : null, submittedCandidate, planValid, planErrors, outcome, taskAccepted,
    failureCategory, failureMessage, failureStepIndex,
    failedAction: failureStepIndex !== null && candidate ? clone(candidate.actions[failureStepIndex] ?? null) : null,
    ...(error ? { error } : {}), steps, completedSteps,
    completedPickups: completed.filter(step => step.kind === 'pickup').length,
    completedPlacements: completed.filter(step => step.kind === 'place').length,
    distanceTravelled: world.distanceTravelled - initialWorld.distanceTravelled,
    simulatedSeconds: world.simTime - initialWorld.simTime,
    evaluationDurationMs: Math.max(0, Math.round((performance.now() - started) * 100) / 100), ticks, checks,
    initialWorld, finalWorld: world, trajectory, protectedObjectPolicy: clone(MOBILE_PROTECTED_POLICY), protectedViolations,
    executionBudget: { maxTicks: MAX_TICKS, dt: DT, maxSamples: MAX_SAMPLES },
    limitations: [
      'High-level skill-order evaluation on a known simulated map, not a learned motor-policy benchmark.',
      'Only submitted navigation actions receive collision-checked paths; no missing action or task goal is repaired.',
      'Final acceptance requires the frozen target/dock, empty carrier and unchanged unrequested objects.',
      'Trajectory times are relative simulated seconds; world clocks retain their original offset.',
      'Approximately 10 Hz plus terminal/control states; no measured encoders, contact dynamics or physical transfer validation.',
    ],
  };
}
