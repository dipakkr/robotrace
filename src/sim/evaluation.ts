import { ENVIRONMENTS, getEnvironment } from './environments';
import type { EnvironmentId } from './environments';
import { runScenarioHeadless } from './scenarios';
import type { ScenarioCheck, ScenarioOutcome } from './scenarios';
import type { ActionStep, WorldState } from './engine';

export type EvaluationPerturbation = 'nominal' | 'source-layout' | 'out-of-reach';

export interface EvaluationCase {
  id: string;
  environmentId: EnvironmentId;
  name: string;
  perturbation: EvaluationPerturbation;
  seed: number;
  instruction: string;
  expectedOutcome: ScenarioOutcome;
  expectedError?: string;
  initialWorld: WorldState;
}

export interface EvaluationCaseResult extends EvaluationCase {
  actualOutcome: ScenarioOutcome;
  passed: boolean;
  completedActions: number;
  simulatedDuration: number;
  checks: ScenarioCheck[];
  error?: string;
  finalWorld: WorldState;
  steps: ActionStep[];
}

export interface EvaluationCampaign {
  schema: 'teachtrace.evaluation.v1';
  generatedAt: string;
  controller: 'teachtrace-kinematic-v1';
  simulation: {
    type: 'kinematic';
    grasp: 'idealized attachment';
    physicalContactValidated: false;
    policyTrained: false;
    limitations: string[];
  };
  cases: EvaluationCaseResult[];
  summary: { total: number; passed: number; failed: number; taskCompletions: number; expectedRejections: number };
}

function randomForSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Fixed seeds and retained input scenes make this controller regression campaign reproducible. */
export function createEvaluationCases(): EvaluationCase[] {
  return ENVIRONMENTS.flatMap((environment, environmentIndex) => {
    const seed = 4200 + environmentIndex;
    return (['nominal', 'source-layout', 'out-of-reach'] as const).map(perturbation => {
      const world = environment.world();
      const movableIds = new Set(environment.targets.filter(target => !target.unchanged).map(target => target.objectId));
      if (perturbation === 'source-layout') {
        const random = randomForSeed(seed);
        for (const object of world.objects) {
          if (!movableIds.has(object.id)) continue;
          // Small bounded planar offsets preserve the existing separated,
          // reachable fixture layouts. Protected references never move.
          object.position[0] += (random() < 0.5 ? -1 : 1) * (0.08 + random() * 0.04);
          object.position[2] += (random() < 0.5 ? -1 : 1) * (0.06 + random() * 0.04);
        }
      } else if (perturbation === 'out-of-reach') {
        const object = world.objects.find(item => movableIds.has(item.id))!;
        object.position = [1.92, object.position[1], -0.95];
      }
      const descriptions = {
        nominal: 'Nominal assignment',
        'source-layout': 'Changed source layout',
        'out-of-reach': 'Requested object outside reach',
      };
      return {
        id: `${environment.id}-${perturbation}`, environmentId: environment.id,
        name: `${environment.name} · ${descriptions[perturbation]}`, perturbation, seed,
        instruction: environment.instruction, expectedOutcome: perturbation === 'out-of-reach' ? 'failed' : 'completed',
        ...(perturbation === 'out-of-reach' ? { expectedError: 'outside the configured workcell reach' } : {}),
        initialWorld: world,
      };
    });
  });
}

/** Executes the same bounded planner/controller used by the console, without a learned policy. */
export function runEvaluationCase(evaluation: EvaluationCase): EvaluationCaseResult {
  const definition = getEnvironment(evaluation.environmentId);
  const initialWorld = structuredClone(evaluation.initialWorld);
  const run = runScenarioHeadless({
    id: evaluation.id, name: evaluation.name, description: evaluation.perturbation,
    instruction: evaluation.instruction, expectedOutcome: evaluation.expectedOutcome,
    expectedError: evaluation.expectedError, world: () => structuredClone(initialWorld),
  });
  const checks = [...run.checks];
  if (evaluation.expectedOutcome === 'completed') {
    checks.push(...definition.successChecks(run.finalWorld).map(check => ({
      name: check.name, passed: check.passed, detail: check.detail,
    })));
  }
  for (const protectedTarget of definition.targets.filter(target => target.unchanged)) {
    const original = initialWorld.objects.find(object => object.id === protectedTarget.objectId);
    const final = run.finalWorld.objects.find(object => object.id === protectedTarget.objectId);
    checks.push({
      name: `${original?.label ?? protectedTarget.objectId} preserved across the attempt`,
      passed: Boolean(original && final && JSON.stringify(original) === JSON.stringify(final)),
      detail: 'The protected object must retain its full initial recorded state, including pose and location.',
    });
  }
  return {
    ...evaluation, initialWorld: run.initialWorld, finalWorld: run.finalWorld,
    actualOutcome: run.actualOutcome, passed: checks.every(check => check.passed),
    completedActions: run.completedActions, simulatedDuration: run.simulatedSeconds,
    checks, steps: run.steps, ...(run.error ? { error: run.error } : {}),
  };
}

export function runEvaluationCampaign(): EvaluationCampaign {
  const cases = createEvaluationCases().map(runEvaluationCase);
  return {
    schema: 'teachtrace.evaluation.v1', generatedAt: new Date().toISOString(), controller: 'teachtrace-kinematic-v1',
    simulation: {
      type: 'kinematic', grasp: 'idealized attachment', physicalContactValidated: false, policyTrained: false,
      limitations: [
        'Deterministic command-planner and kinematic-controller regression checks, not a learned-policy benchmark.',
        'No contact dynamics, sensor noise, grasp-force measurement, or real-world deployment validation.',
        'Expected reach refusals count as passing regression cases, never as completed collection tasks.',
      ],
    },
    cases,
    summary: {
      total: cases.length, passed: cases.filter(result => result.passed).length, failed: cases.filter(result => !result.passed).length,
      taskCompletions: cases.filter(result => result.passed && result.expectedOutcome === 'completed' && result.actualOutcome === 'completed').length,
      expectedRejections: cases.filter(result => result.passed && result.expectedOutcome === 'failed' && result.actualOutcome === 'failed').length,
    },
  };
}
