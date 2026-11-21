import { advanceWorld } from './engine';
import type { ActionStep, DestinationId, WorldState } from './engine';
import { ENVIRONMENTS } from './environments';
import type { EnvironmentCheck } from './environments';
import { checkCustomTask } from './scene-spec';
import { createProtectedHistory, mergeProtectedHistoryChecks } from './protected-history';

export type CandidatePlanSource = 'human' | 'llm' | 'baseline';
export interface CandidatePlanValidation { valid: boolean; errors: string[]; steps: ActionStep[] }
export interface CandidatePlanInput {
  world: WorldState;
  steps: unknown;
  source: CandidatePlanSource;
  label: string;
  instruction?: string;
  requestDurationMs?: number;
  onSample?: (world: WorldState, relativeTime: number) => void;
}
export interface CandidatePlanResult {
  id: string;
  label: string;
  source: CandidatePlanSource;
  instruction?: string;
  planValid: boolean;
  planErrors: string[];
  outcome: 'completed' | 'failed' | 'invalid';
  taskAccepted: boolean;
  completedActions: number;
  simulatedDuration: number;
  checks: EnvironmentCheck[];
  initialWorld: WorldState;
  finalWorld: WorldState;
  steps: ActionStep[];
  requestDurationMs?: number;
  error?: string;
}

const destinations: DestinationId[] = ['table', 'tray-a', 'tray-b', 'reject'];
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const maxSteps = 6;
const ticksPerAction = 3600;

/** Validate exact scene IDs and primitive destinations without repairing model output. */
export function validateCandidatePlan(input: unknown, world: WorldState): CandidatePlanValidation {
  const errors: string[] = [];
  const steps: ActionStep[] = [];
  if (!Array.isArray(input)) return { valid: false, errors: ['A candidate plan must be an array of {objectId, destination} assignments.'], steps: [] };
  if (input.length > maxSteps) return { valid: false, errors: [`A candidate plan supports at most ${maxSteps} assignments.`], steps: [] };
  const seen = new Set<string>();
  Array.from(input).forEach((assignment, index) => {
    const prefix = `Assignment ${index + 1}`;
    if (!isRecord(assignment)) { errors.push(`${prefix} must contain an exact objectId and destination.`); return; }
    if (Object.keys(assignment).some(key => key !== 'objectId' && key !== 'destination')) errors.push(`${prefix} contains unsupported fields; use only objectId and destination.`);
    const { objectId, destination } = assignment;
    if (typeof objectId !== 'string' || world.objects.filter(object => object.id === objectId).length !== 1) errors.push(`${prefix} needs one exact, unique object ID from this scene.`);
    if (typeof objectId === 'string') {
      if (seen.has(objectId)) errors.push(`${prefix} repeats ${objectId}; provide one destination per object or clarify the sequence.`);
      seen.add(objectId);
    }
    if (typeof destination !== 'string' || !destinations.includes(destination as DestinationId)) errors.push(`${prefix} has an unsupported destination; use table, tray-a, tray-b, or reject.`);
    if (typeof objectId === 'string' && typeof destination === 'string' && destinations.includes(destination as DestinationId)) {
      const object = world.objects.find(candidate => candidate.id === objectId);
      if (object) {
        let id = `candidate-${world.revision}-${index}-${objectId}-${destination}`;
        if (id === world.lastCompletedStepId) id += '-fresh';
        steps.push({ id, kind: 'pick_place', objectId, destination: destination as DestinationId,
          label: `Move ${object.label} to ${world.destinationLabels?.[destination as DestinationId] ?? destination}` });
      }
    }
  });
  return { valid: errors.length === 0, errors, steps: errors.length ? [] : steps };
}

function referenceCheck(initial: WorldState, final: WorldState, objectId: string): EnvironmentCheck {
  const original = initial.objects.find(object => object.id === objectId);
  const current = final.objects.find(object => object.id === objectId);
  const passed = Boolean(original && current && JSON.stringify(original) === JSON.stringify(current));
  return { id: `target-${objectId}`, name: `${original?.label ?? objectId} remains undisturbed`, passed,
    detail: passed ? 'The protected object retains its full supplied initial state.' : 'The protected object changed from the shared initial scene.' };
}

/** Goal checks compare every candidate with the same supplied initial snapshot. */
function taskChecks(initial: WorldState, final: WorldState): EnvironmentCheck[] {
  const customTask = initial.customTask;
  if (customTask !== undefined) {
    const goals = customTask?.assignments;
    const goalIds = Array.isArray(goals) ? goals.filter(isRecord).map(goal => goal.objectId) : [];
    const validGoals = Array.isArray(goals) && goals.length > 0 && goals.length <= maxSteps && goalIds.length === goals.length
      && new Set(goalIds).size === goals.length && goals.every(goal => isRecord(goal) && typeof goal.objectId === 'string'
        && initial.objects.filter(object => object.id === goal.objectId).length === 1
        && destinations.includes(goal.destination) && (goal.unchanged === undefined || typeof goal.unchanged === 'boolean'));
    if (!validGoals) return [{ id: 'task-defined', name: 'Custom task goals are valid', passed: false, detail: 'Define one to six explicit goals using existing object IDs and supported destinations.' }];
    return checkCustomTask(initial, final);
  }
  const environment = ENVIRONMENTS.find(candidate => candidate.id === initial.environmentId);
  if (!environment) return [{ id: 'task-defined', name: 'Task goals are configured', passed: false, detail: 'This scene has no known environment assignment or explicit custom task. Controller completion alone cannot establish task acceptance.' }];
  const checks = environment.successChecks(final);
  for (const target of environment.targets.filter(target => target.unchanged)) {
    const index = checks.findIndex(check => check.id === `target-${target.objectId}`);
    const check = referenceCheck(initial, final, target.objectId);
    if (index === -1) checks.push(check); else checks[index] = check;
  }
  return checks;
}

/** Runs grounded candidate plans through the actual kinematic controller, never a learned policy. */
export function evaluateCandidatePlan(input: CandidatePlanInput): CandidatePlanResult {
  const initialWorld = structuredClone(input.world);
  let finalWorld = structuredClone(initialWorld);
  const protectedHistory = createProtectedHistory(initialWorld);
  const validation = validateCandidatePlan(input.steps, initialWorld);
  if (initialWorld.motion !== null || initialWorld.robot.mode !== 'idle' || initialWorld.robot.heldObjectId !== null) {
    validation.valid = false;
    validation.errors.push('Freeze a settled scene with an idle controller and empty gripper before comparing candidates.');
    validation.steps = [];
  }
  let error: string | undefined;
  let completedActions = 0;
  let lastSampleTime = finalWorld.simTime;
  input.onSample?.(finalWorld, 0);
  if (validation.valid) {
    for (const step of validation.steps) {
      let finished = false;
      for (let tick = 0; tick < ticksPerAction; tick++) {
        const result = advanceWorld(finalWorld, step, 1 / 60);
        finalWorld = result.world;
        protectedHistory.observe(finalWorld);
        if (finalWorld.simTime - lastSampleTime >= 0.099 || result.done || result.error || result.blocked) { input.onSample?.(finalWorld, finalWorld.simTime - initialWorld.simTime); lastSampleTime = finalWorld.simTime; }
        if (result.blocked) { error = result.blocked; finished = true; break; }
        if (result.error) { error = result.error; finished = true; break; }
        if (result.done) { completedActions++; finished = true; break; }
      }
      if (!finished) error = `The controller exceeded ${ticksPerAction} bounded ticks for ${step.objectId}.`;
      if (error) break;
    }
  }
  const outcome = !validation.valid ? 'invalid' : error ? 'failed' : 'completed';
  const checks = mergeProtectedHistoryChecks(taskChecks(initialWorld, finalWorld), protectedHistory.checks());
  return {
    id: crypto.randomUUID(), label: input.label, source: input.source,
    ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
    planValid: validation.valid, planErrors: validation.errors, outcome,
    taskAccepted: outcome === 'completed' && checks.length > 0 && checks.every(check => check.passed),
    completedActions, simulatedDuration: finalWorld.simTime - initialWorld.simTime,
    checks, initialWorld, finalWorld, steps: validation.steps,
    ...(Number.isFinite(input.requestDurationMs) && input.requestDurationMs! >= 0 ? { requestDurationMs: input.requestDurationMs } : {}),
    ...(error ? { error } : {}),
  };
}
