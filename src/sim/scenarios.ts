import { advanceWorld, createInitialWorld, DESTINATIONS, destinationPosition, planCommand } from './engine';
import type { ActionStep, SceneObject, WorldState } from './engine';

export type ScenarioOutcome = 'completed' | 'failed';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  expectedOutcome: ScenarioOutcome;
  instruction: string;
  world: () => WorldState;
  /** Explicit failure text avoids treating any unexpected failure as a passing test. */
  expectedError?: string;
}

export interface ScenarioCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ScenarioRun {
  scenarioId: string;
  expectedOutcome: ScenarioOutcome;
  actualOutcome: ScenarioOutcome;
  passed: boolean;
  error?: string;
  checks: ScenarioCheck[];
  initialWorld: WorldState;
  finalWorld: WorldState;
  completedActions: number;
  steps: ActionStep[];
  simulatedSeconds: number;
}

function occupiedTrayWorld(): WorldState {
  const world = createInitialWorld();
  const blockers: SceneObject[] = [0, 1, 2].map(slot => ({
    id: `occupant-a-${slot + 1}`,
    label: `Tray A occupant ${slot + 1}`,
    color: '#7f8c96',
    kind: 'cube',
    position: destinationPosition('tray-a', slot),
    size: [0.24, 0.24, 0.24],
    location: 'tray-a',
    status: 'placed',
  }));
  world.objects.push(...blockers);
  return world;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'baseline-sort',
    name: 'Baseline sorting',
    description: 'Three available parts and empty trays. Verify the standard sorting assignment completes.',
    expectedOutcome: 'completed',
    instruction: 'Sort all parts',
    world: createInitialWorld,
  },
  {
    id: 'reach-limit',
    name: 'Target beyond reach',
    description: 'The red block is on the far side of the table, beyond the configured arm reach. Expect a refusal before motion.',
    expectedOutcome: 'failed',
    expectedError: 'outside the configured workcell reach',
    instruction: 'Move the red block to tray A',
    world: () => {
      const world = createInitialWorld();
      world.objects[0].position = [1.92, 0.9, -0.95];
      return world;
    },
  },
  {
    id: 'occupied-tray',
    name: 'Destination at capacity',
    description: 'Three visible neutral blocks occupy tray A. Verify another placement is refused without disturbing the scene.',
    expectedOutcome: 'failed',
    expectedError: 'destination tray is full',
    instruction: 'Move the red block to tray A',
    world: occupiedTrayWorld,
  },
  {
    id: 'layout-variation',
    name: 'Rearranged workcell',
    description: 'The same three parts start at different reachable positions. Verify actions use the current scene instead of a fixed recorded path.',
    expectedOutcome: 'completed',
    instruction: 'Sort all parts',
    world: () => {
      const world = createInitialWorld();
      world.objects[0].position = [0.20, 0.9, -0.05];
      world.objects[1].position = [-0.60, 0.9, -0.88];
      world.objects[2].position = [-0.25, 0.89, 0.62];
      return world;
    },
  },
];

function sameSceneObjects(a: WorldState, b: WorldState): boolean {
  return JSON.stringify(a.objects) === JSON.stringify(b.objects);
}

function placementCheck(world: WorldState, step: ActionStep): ScenarioCheck {
  if (step.kind !== 'pick_place') return { name: step.label, passed: true, detail: 'Non-placement action completed.' };
  const object = world.objects.find(item => item.id === step.objectId);
  const tray = DESTINATIONS.find(item => item.id === step.destination);
  const correctLocation = object?.location === step.destination;
  const contained = !!object && (!tray || (
    Math.abs(object.position[0] - tray.center[0]) + object.size[0] / 2 <= tray.size[0] / 2 + 0.001 &&
    Math.abs(object.position[2] - tray.center[2]) + object.size[2] / 2 <= tray.size[2] / 2 + 0.001
  ));
  return {
    name: step.label,
    passed: !!object && correctLocation && contained && object.status !== 'in-transit',
    detail: !object ? 'The object is missing from the resulting scene.' : correctLocation && contained
      ? `Observed ${object.id} inside ${step.destination}; the gripper released it.`
      : `Observed location ${object.location}; expected a contained placement in ${step.destination}.`,
  };
}

/**
 * Executes the same deterministic planner/controller used by the visible workcell.
 * A passing scenario means its specified task-logic expectation was observed.
 * It does not validate contact dynamics, learned-policy robustness, or physical deployment.
 */
export function runScenarioHeadless(scenarioOrId: Scenario | string): ScenarioRun {
  const scenario = typeof scenarioOrId === 'string' ? SCENARIOS.find(item => item.id === scenarioOrId) : scenarioOrId;
  if (!scenario) throw new Error(`Unknown scenario: ${String(scenarioOrId)}`);
  const initialWorld = structuredClone(scenario.world());
  const initialSnapshot = JSON.stringify(initialWorld);
  let world = structuredClone(initialWorld);
  const plan = planCommand(scenario.instruction, world);
  const checks: ScenarioCheck[] = [{
    name: 'Instruction resolved to supported actions',
    passed: !plan.error && !plan.control && plan.steps.length > 0,
    detail: plan.error ?? (plan.steps.length ? `${plan.steps.length} grounded action${plan.steps.length === 1 ? '' : 's'} planned.` : 'No executable task actions were produced.'),
  }];
  let error = plan.error;
  let completedActions = 0;
  let timedOut = false;
  if (!error && !plan.control && plan.steps.length) {
    for (const step of plan.steps) {
      world = { ...world, robot: { ...world.robot, mode: 'running' } };
      let finished = false;
      for (let tick = 0; tick < 900; tick++) {
        const result = advanceWorld(world, step, 1 / 60);
        world = result.world;
        if (result.error) { error = result.error; finished = true; break; }
        if (result.done) { completedActions++; finished = true; break; }
      }
      if (!finished) { timedOut = true; error = 'The action exceeded the bounded scenario execution budget.'; }
      if (error) break;
    }
  }
  const actualOutcome: ScenarioOutcome = !error && plan.steps.length > 0 && completedActions === plan.steps.length ? 'completed' : 'failed';
  checks.push({
    name: 'Execution completed within its budget',
    passed: !timedOut,
    detail: timedOut ? 'An action exceeded 900 simulator ticks.' : 'Every attempted action completed or returned a bounded refusal.',
  });
  checks.push({
    name: 'Expected task outcome observed',
    passed: actualOutcome === scenario.expectedOutcome,
    detail: `Expected ${scenario.expectedOutcome}; observed ${actualOutcome}.`,
  });
  if (scenario.expectedOutcome === 'completed') {
    checks.push(...plan.steps.map(step => placementCheck(world, step)));
    checks.push({
      name: 'Robot released the final object',
      passed: world.robot.heldObjectId === null && world.robot.mode === 'idle',
      detail: world.robot.heldObjectId ? `Still holding ${world.robot.heldObjectId}.` : `Gripper empty; controller ${world.robot.mode}.`,
    });
  } else {
    checks.push({
      name: 'Expected refusal reason observed',
      passed: !!scenario.expectedError && !!error?.toLowerCase().includes(scenario.expectedError.toLowerCase()),
      detail: error ?? 'The controller did not return a refusal reason.',
    });
    checks.push({
      name: 'Rejected task left objects unchanged',
      passed: sameSceneObjects(initialWorld, world) && completedActions === 0 && world.robot.heldObjectId === null,
      detail: sameSceneObjects(initialWorld, world) ? 'All initial object positions and locations were preserved.' : 'At least one object changed before the refusal.',
    });
  }
  checks.push({
    name: 'Initial scenario retained for reproducibility',
    passed: JSON.stringify(initialWorld) === initialSnapshot,
    detail: 'The initial world is an independent snapshot of the executed scenario.',
  });
  return {
    scenarioId: scenario.id,
    expectedOutcome: scenario.expectedOutcome,
    actualOutcome,
    passed: checks.every(check => check.passed),
    ...(error ? { error } : {}),
    checks,
    initialWorld,
    finalWorld: world,
    completedActions,
    steps: plan.steps,
    simulatedSeconds: world.simTime - initialWorld.simTime,
  };
}
