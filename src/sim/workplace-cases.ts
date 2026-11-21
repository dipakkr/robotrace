import { worldFromSceneSpec } from './scene-spec';
import type { SceneSpec } from './scene-spec';
import type { DestinationId, WorldState } from './engine';

export interface WorkplaceCase {
  id: string;
  name: string;
  description: string;
  brief: string;
  instruction: string;
  /** Reading this property creates a fresh scene compatible with EnvironmentSpec. */
  readonly world: WorldState;
  interruption?: { trigger: 'during-transfer'; command: string; clearCommand: string; resumeCommand: string; description: string };
}

function defineCase(
  identity: Omit<WorkplaceCase, 'world' | 'instruction'>,
  taskId: string,
  spec: SceneSpec,
  labels: Record<DestinationId, string>,
): WorkplaceCase {
  return {
    ...identity,
    instruction: spec.instruction,
    get world() {
      const world = worldFromSceneSpec(spec);
      world.customTask!.id = taskId;
      world.destinationLabels = { ...labels };
      world.sceneProvenance = { source: 'deterministic', reviewRequired: true, reviewed: false };
      world.humanPresence = { state: identity.interruption ? 'nearby' : 'clear', source: 'scenario-proxy' };
      for (const object of world.objects) if (object.id.includes('utensil-case')) object.semanticType = 'utensil-case';
      return world;
    },
  };
}

/** Household work briefs use supported rigid-object routing; no washing, food or fabric dynamics. */
export const WORKPLACE_CASES: WorkplaceCase[] = [
  defineCase({
    id: 'after-meal', name: 'After-meal counter reset',
    description: 'Move two empty used cups into the sink-side rack while preserving a reserved serving bowl.',
    brief: 'A household helper clears the counter after a meal. Load the two used cups into the Sink rack; keep the reserved bowl exactly where it is. The robot loads a rack—it does not wash dishes.',
  }, 'custom-a1000000-0000-4000-8000-000000000001', {
    version: 1, title: 'After-meal counter reset', baseEnvironmentId: 'kitchen', instruction: 'Clear the after-meal counter',
    objects: [
      { id: 'used-cup-red', label: 'Used red cup', asset: 'cup', color: 'red', slot: 0 },
      { id: 'used-cup-blue', label: 'Used blue cup', asset: 'cup', color: 'blue', slot: 4 },
      { id: 'reserved-bowl', label: 'Reserved serving bowl', asset: 'bowl', color: 'green', slot: 1 },
    ],
    assignments: [
      { objectId: 'used-cup-red', destination: 'tray-a', unchanged: false },
      { objectId: 'used-cup-blue', destination: 'tray-a', unchanged: false },
      { objectId: 'reserved-bowl', destination: 'table', unchanged: true },
    ],
  }, { table: 'After-meal counter', 'tray-a': 'Sink rack', 'tray-b': 'Drying rack', reject: 'Review area' }),
  defineCase({
    id: 'meal-service', name: 'Meal-service preparation',
    description: 'Prepare a serving tray and return the spare bowl to storage using two distinct destinations.',
    brief: 'Prepare the next place setting: move the serving cup and closed utensil case onto the Serving tray, then put the spare bowl in the Storage tray. This demonstrates item staging, not food preparation or liquid handling.',
  }, 'custom-a1000000-0000-4000-8000-000000000002', {
    version: 1, title: 'Meal-service preparation', baseEnvironmentId: 'kitchen', instruction: 'Prepare the family meal service',
    objects: [
      { id: 'serving-cup', label: 'Serving cup', asset: 'cup', color: 'blue', slot: 1 },
      { id: 'service-utensil-case', label: 'Closed utensil case', asset: 'block', color: 'red', slot: 3 },
      { id: 'spare-bowl', label: 'Spare bowl', asset: 'bowl', color: 'green', slot: 0 },
    ],
    assignments: [
      { objectId: 'serving-cup', destination: 'tray-a', unchanged: false },
      { objectId: 'service-utensil-case', destination: 'tray-a', unchanged: false },
      { objectId: 'spare-bowl', destination: 'tray-b', unchanged: false },
    ],
  }, { table: 'Service counter', 'tray-a': 'Serving tray', 'tray-b': 'Storage tray', reject: 'Review area' }),
  defineCase({
    id: 'careful-tidying', name: 'Tidying a shared kitchen',
    description: 'Return items to storage and drying areas without disturbing a prepared cup; rehearse a human interruption.',
    brief: 'A person is nearby while the helper tidies. Put the used cup in the Drying rack and the bowl plus closed utensil case in the Storage tray. Preserve the reserved place-setting cup. During a transfer, explicitly introduce the person into the workspace; clear the scenario and resume to finish.',
    interruption: {
      trigger: 'during-transfer', command: 'Simulate a person entering workspace',
      clearCommand: 'Clear the human workspace scenario', resumeCommand: 'Resume',
      description: 'Operator-triggered person proxy. Motion pauses at the software interlock; clearance alone never resumes it.',
    },
  }, 'custom-a1000000-0000-4000-8000-000000000003', {
    version: 1, title: 'Tidying a shared kitchen', baseEnvironmentId: 'kitchen', instruction: 'Tidy the shared kitchen counter',
    objects: [
      { id: 'tidy-used-cup', label: 'Used drinking cup', asset: 'cup', color: 'blue', slot: 0 },
      { id: 'tidy-bowl', label: 'Storage bowl', asset: 'bowl', color: 'green', slot: 1 },
      { id: 'tidy-utensil-case', label: 'Closed utensil case', asset: 'block', color: 'red', slot: 3 },
      { id: 'reserved-place-cup', label: 'Reserved place-setting cup', asset: 'cup', color: 'red', slot: 2 },
    ],
    assignments: [
      { objectId: 'tidy-used-cup', destination: 'tray-b', unchanged: false },
      { objectId: 'tidy-bowl', destination: 'tray-a', unchanged: false },
      { objectId: 'tidy-utensil-case', destination: 'tray-a', unchanged: false },
      { objectId: 'reserved-place-cup', destination: 'table', unchanged: true },
    ],
  }, { table: 'Shared kitchen counter', 'tray-a': 'Storage tray', 'tray-b': 'Drying rack', reject: 'Review area' }),
];
