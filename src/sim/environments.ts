import { createInitialWorld, DESTINATIONS, TABLE_TOP } from './engine';
import type { DestinationId, SceneObject, WorldState } from './engine';

export type EnvironmentId = 'workbench' | 'kitchen' | 'lab';

export interface EnvironmentCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface EnvironmentTarget {
  objectId: string;
  destination: DestinationId;
  unchanged?: boolean;
}

export interface EnvironmentDefinition {
  id: EnvironmentId;
  name: string;
  description: string;
  instruction: string;
  world: () => WorldState;
  targets: EnvironmentTarget[];
  successChecks: (world: WorldState) => EnvironmentCheck[];
}

type ObjectSpec = Pick<SceneObject, 'id' | 'label' | 'semanticType' | 'kind' | 'size' | 'position'>;

/** Task fixtures reuse a kinematic arm; these checks are not physical safety certification. */
function defineEnvironment(
  definition: Omit<EnvironmentDefinition, 'world' | 'successChecks'>,
  destinationLabels: Record<DestinationId, string>,
  specs?: ObjectSpec[],
): EnvironmentDefinition {
  const world = (): WorldState => {
    const initial = createInitialWorld();
    if (specs) {
      initial.objects = specs.map(spec => {
        const original = initial.objects.find(object => object.id === spec.id)!;
        return { ...original, ...spec, size: [...spec.size], position: [...spec.position] };
      });
    }
    return { ...initial, environmentId: definition.id, destinationLabels: { ...destinationLabels } };
  };

  return {
    ...definition,
    world,
    successChecks(current) {
      const initial = world();
      const inventoryMatches = current.objects.length === definition.targets.length
        && definition.targets.every(target => current.objects.filter(object => object.id === target.objectId).length === 1);
      const checks: EnvironmentCheck[] = [{
        id: 'task-inventory',
        name: 'Task inventory accounted for',
        passed: inventoryMatches,
        detail: inventoryMatches ? 'Every task object is present exactly once.' : 'A task object is missing, duplicated, or an extra object needs a task assignment.',
      }];

      for (const target of definition.targets) {
        const object = current.objects.find(candidate => candidate.id === target.objectId);
        const original = initial.objects.find(candidate => candidate.id === target.objectId)!;
        const label = destinationLabels[target.destination];
        const passed = Boolean(object && (target.unchanged
          ? object.location === original.location && object.status === original.status
            && object.position.every((coordinate, index) => Number.isFinite(coordinate) && Math.abs(coordinate - original.position[index]) < 0.005)
          : object.location === target.destination && object.status === 'placed' && containedInDestination(object, target.destination)));
        checks.push({
          id: `target-${target.objectId}`,
          name: target.unchanged ? `${original.label} remains undisturbed` : `${original.label} in ${label}`,
          passed,
          detail: passed ? (target.unchanged ? 'The reference retains its initial pose and state.' : 'Placement state and simulated destination bounds agree.')
            : (target.unchanged ? 'Keep the reference in its original pose and state.' : `Place ${original.label.toLowerCase()} fully inside ${label.toLowerCase()}.`),
        });
      }

      const complete = current.robot.mode === 'idle' && current.motion === null && current.robot.heldObjectId === null;
      checks.push({ id: 'controller-settled', name: 'Controller settled with empty gripper', passed: complete,
        detail: complete ? 'No active motion or held object remains.' : 'Finish or resolve the active controller state before accepting the task.' });
      if (definition.id === 'kitchen') {
        const counterCleared = current.objects.length > 0 && current.objects.every(object => object.location !== 'table');
        checks.push({ id: 'counter-cleared', name: 'Counter cleared', passed: counterCleared,
          detail: counterCleared ? 'All countertop objects have a destination.' : 'At least one countertop object still needs to be moved.' });
      }
      return checks;
    },
  };
}

function containedInDestination(object: SceneObject, destination: DestinationId): boolean {
  const tray = DESTINATIONS.find(candidate => candidate.id === destination);
  if (!tray || !object.position.every(Number.isFinite) || !object.size.every(value => Number.isFinite(value) && value > 0)) return false;
  const tolerance = 0.005;
  return [0, 2].every(axis => Math.abs(object.position[axis] - tray.center[axis]) + object.size[axis] / 2 <= tray.size[axis] / 2 + tolerance)
    && Math.abs(object.position[1] - (TABLE_TOP + tray.size[1] + object.size[1] / 2)) <= tolerance;
}

export const ENVIRONMENTS: EnvironmentDefinition[] = [
  defineEnvironment({
    id: 'workbench', name: 'Repair workbench',
    description: 'Prepare a repair kit and separate the spare part on an equipment service bench.',
    instruction: 'Prepare repair kit',
    targets: [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }, { objectId: 'part-green', destination: 'tray-a' }],
  }, { table: 'Parts workbench', 'tray-a': 'Repair kit', 'tray-b': 'Spare parts', reject: 'Review' }),
  defineEnvironment({
    id: 'kitchen', name: 'Kitchen counter',
    description: 'Clear a service counter by separating serving items from stored tableware.',
    instruction: 'Clear the counter',
    targets: [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-a' }, { objectId: 'part-green', destination: 'tray-b' }],
  }, { table: 'Kitchen counter', 'tray-a': 'Serving tray', 'tray-b': 'Storage tray', reject: 'Review' }, [
    { id: 'part-red', label: 'Utensil case', semanticType: 'utensil-case', kind: 'block', size: [0.26, 0.14, 0.18], position: [-0.62, TABLE_TOP + 0.07, -0.68] },
    { id: 'part-blue', label: 'Cup', semanticType: 'cup', kind: 'cylinder', size: [0.20, 0.26, 0.20], position: [0.03, TABLE_TOP + 0.13, -0.12] },
    { id: 'part-green', label: 'Bowl', semanticType: 'bowl', kind: 'cylinder', size: [0.26, 0.12, 0.26], position: [-0.61, TABLE_TOP + 0.06, 0.44] },
  ]),
  defineEnvironment({
    id: 'lab', name: 'Sample preparation lab',
    description: 'Route two labelled rigid sample carriers while preserving the reference sample on the bench.',
    instruction: 'Route the samples',
    targets: [{ objectId: 'part-red', destination: 'tray-a' }, { objectId: 'part-blue', destination: 'tray-b' }, { objectId: 'part-green', destination: 'table', unchanged: true }],
  }, { table: 'Sample bench', 'tray-a': 'Rack A', 'tray-b': 'Rack B', reject: 'Review' }, [
    { id: 'part-red', label: 'Sample alpha', semanticType: 'sample-alpha', kind: 'block', size: [0.24, 0.22, 0.24], position: [-0.73, TABLE_TOP + 0.11, -0.45] },
    { id: 'part-blue', label: 'Sample beta', semanticType: 'sample-beta', kind: 'cylinder', size: [0.20, 0.26, 0.20], position: [-0.10, TABLE_TOP + 0.13, -0.58] },
    { id: 'part-green', label: 'Reference sample', semanticType: 'reference-sample', kind: 'block', size: [0.25, 0.20, 0.25], position: [-0.30, TABLE_TOP + 0.10, 0.40] },
  ]),
];

export function getEnvironment(id: string): EnvironmentDefinition {
  const environment = ENVIRONMENTS.find(candidate => candidate.id === id);
  if (!environment) throw new Error(`Unknown environment: ${id}`);
  return environment;
}
