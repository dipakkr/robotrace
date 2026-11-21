import { createInitialWorld, DESTINATIONS, TABLE_TOP } from './engine';
import type { DestinationId, SceneObject, Vec3, WorldState } from './engine';
import { ENVIRONMENTS } from './environments';
import type { EnvironmentCheck, EnvironmentTarget } from './environments';
import { validateScene } from './scene-authoring';

export interface SceneSpec {
  version: 1;
  title: string;
  baseEnvironmentId: 'workbench' | 'kitchen' | 'lab';
  instruction: string;
  objects: { id: string; label: string; asset: 'block' | 'cylinder' | 'cup' | 'bowl' | 'sample'; color: 'red' | 'blue' | 'green'; slot: number }[];
  assignments: { objectId: string; destination: DestinationId; unchanged: boolean }[];
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const colors = { red: '#e66c52', blue: '#5594c6', green: '#83a993' };
const slots: [number, number][] = [[-0.65, -0.64], [-0.12, -0.64], [0.35, -0.64], [-0.65, 0.34], [-0.12, 0.34], [0.35, 0.34]];
const dimensions: Record<SceneSpec['objects'][number]['asset'], Vec3> = { block: [0.24, 0.20, 0.24], cylinder: [0.20, 0.24, 0.20], cup: [0.20, 0.26, 0.20], bowl: [0.26, 0.12, 0.26], sample: [0.22, 0.24, 0.22] };

/** No model-produced code, coordinates or physics properties enter the controller. */
export function validateSceneSpec(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!record(value)) return { valid: false, errors: ['The scene draft must be a structured object.'] };
  if (value.version !== 1) errors.push('Unsupported scene specification version.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 80) errors.push('Use a scene title of 1–80 characters.');
  if (!['workbench', 'kitchen', 'lab'].includes(String(value.baseEnvironmentId))) errors.push('Choose a supported workplace template.');
  if (typeof value.instruction !== 'string' || !value.instruction.trim() || value.instruction.length > 500) errors.push('Use an explicit task instruction of 1–500 characters.');
  if (typeof value.instruction === 'string' && (/^(?:pause|resume|stop|reset|yes|approve|approve and run|run plan|execute plan|go ahead)[.!\s]*$/i.test(value.instruction.trim()) || /^(?:create|build|set up|setup|make|generate)\b/i.test(value.instruction.trim()))) errors.push('Use a task instruction distinct from approval, control and scene-creation commands.');
  const objects = Array.isArray(value.objects) ? value.objects : [];
  if (!objects.length || objects.length > 6) errors.push('An AI scene needs one to six supported objects.');
  const ids = new Set<string>(), labels = new Set<string>(), usedSlots = new Set<number>();
  for (const object of objects) {
    if (!record(object)) { errors.push('Each object must be structured.'); continue; }
    if (typeof object.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(object.id) || ids.has(object.id)) errors.push('Object IDs must be unique lowercase names.');
    else ids.add(object.id);
    if (typeof object.label !== 'string' || !object.label.trim() || object.label.length > 60 || labels.has(object.label.toLowerCase())) errors.push('Visible object names must be unique and at most 60 characters.');
    else labels.add(object.label.toLowerCase());
    if (!['block', 'cylinder', 'cup', 'bowl', 'sample'].includes(String(object.asset))) errors.push('Unsupported object asset.');
    if (!Object.keys(colors).includes(String(object.color))) errors.push('Use a supported object color.');
    if (!Number.isInteger(object.slot) || Number(object.slot) < 0 || Number(object.slot) > 5 || usedSlots.has(Number(object.slot))) errors.push('Objects need distinct supported slots from zero to five.');
    else usedSlots.add(Number(object.slot));
  }
  const assignments = Array.isArray(value.assignments) ? value.assignments : [];
  const assigned = new Set<string>();
  const capacity = new Map<string, number>();
  for (const target of assignments) {
    if (!record(target) || typeof target.objectId !== 'string' || !ids.has(target.objectId) || assigned.has(target.objectId)) { errors.push('Every goal must name one unique visible object.'); continue; }
    assigned.add(target.objectId);
    if (!['table', 'tray-a', 'tray-b', 'reject'].includes(String(target.destination))) errors.push('A goal names an unknown destination.');
    if (typeof target.unchanged !== 'boolean') errors.push('Each goal must explicitly say whether the object stays unchanged.');
    if (target.unchanged && target.destination !== 'table') errors.push('An unchanged object must remain at its initial table location.');
    if (!target.unchanged && target.destination !== 'table') capacity.set(String(target.destination), (capacity.get(String(target.destination)) ?? 0) + 1);
  }
  if (assigned.size !== objects.length) errors.push('Assign a destination or an unchanged reference goal to every object.');
  if (Array.from(capacity.values()).some(count => count > 3)) errors.push('A tray can receive at most three objects.');
  if (!assignments.some(target => record(target) && !target.unchanged && target.destination !== 'table')) errors.push('The task needs at least one meaningful placement.');
  return { valid: !errors.length, errors };
}

export function worldFromSceneSpec(value: unknown, provenance?: { prompt?: string; model?: string; reference?: NonNullable<WorldState['sceneProvenance']>['reference'] }): WorldState {
  const validation = validateSceneSpec(value);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const spec = value as SceneSpec;
  const template = ENVIRONMENTS.find(item => item.id === spec.baseEnvironmentId)!;
  const initial = createInitialWorld();
  const objects: SceneObject[] = spec.objects.map(object => {
    const size = [...dimensions[object.asset]] as Vec3;
    const [x, z] = slots[object.slot];
    return { id: object.id, label: object.label, color: colors[object.color], kind: ['cylinder', 'cup', 'bowl'].includes(object.asset) ? 'cylinder' : 'block',
      semanticType: object.asset === 'sample' ? (spec.assignments.find(target => target.objectId === object.id)?.unchanged ? 'reference-sample' : 'sample-alpha') : object.asset,
      size, position: [x, TABLE_TOP + size[1] / 2, z], location: 'table', status: 'ready' };
  });
  const world: WorldState = { ...initial, objects, environmentId: 'custom', baseEnvironmentId: spec.baseEnvironmentId,
    destinationLabels: template.world().destinationLabels,
    customTask: { id: `custom-${crypto.randomUUID()}`, title: spec.title, instruction: spec.instruction, assignments: structuredClone(spec.assignments) },
    sceneProvenance: { source: 'ai-draft', ...provenance, reviewRequired: true } };
  const sceneValidation = validateScene(world);
  if (!sceneValidation.valid) throw new Error(sceneValidation.errors.join(' '));
  return world;
}

/** Evaluate authored goals against the exact recorded starting scene. */
export function checkCustomTask(initial: WorldState, current: WorldState): EnvironmentCheck[] {
  if (!initial.customTask) return [];
  const targets = initial.customTask.assignments;
  const validGoals = Array.isArray(targets) && targets.length > 0 && targets.length <= 6
    && targets.length === initial.objects.length && new Set(targets.map(target => record(target) ? target.objectId : undefined)).size === targets.length
    && targets.every(target => record(target) && typeof target.objectId === 'string'
      && initial.objects.filter(object => object.id === target.objectId).length === 1
      && ['table', 'tray-a', 'tray-b', 'reject'].includes(target.destination)
      && (target.unchanged === undefined || typeof target.unchanged === 'boolean'));
  if (!validGoals) return [{ id: 'task-defined', name: 'Custom task goals are valid', passed: false,
    detail: 'Assign one supported destination or unchanged-reference goal to every initial object, using unique exact object IDs.' }];
  const checks: EnvironmentCheck[] = [{ id: 'task-inventory', name: 'Task inventory accounted for',
    passed: current.objects.length === initial.objects.length && initial.objects.every(item => current.objects.filter(candidate => candidate.id === item.id).length === 1), detail: 'Every original object must remain present exactly once.' }];
  for (const target of targets) {
    const object = current.objects.find(item => item.id === target.objectId), original = initial.objects.find(item => item.id === target.objectId);
    const tray = DESTINATIONS.find(item => item.id === target.destination);
    const geometryValid = Boolean(object && object.position.length === 3 && object.size.length === 3
      && object.position.every(Number.isFinite) && object.size.every(value => Number.isFinite(value) && value > 0));
    const contained = Boolean(object && geometryValid && (tray ? [0, 2].every(axis => Math.abs(object.position[axis] - tray.center[axis]) + object.size[axis] / 2 <= tray.size[axis] / 2 + 0.005)
      && Math.abs(object.position[1] - (TABLE_TOP + tray.size[1] + object.size[1] / 2)) <= 0.005
      : Math.abs(object.position[0]) + object.size[0] / 2 <= 2.175 + 0.005
        && Math.abs(object.position[2]) + object.size[2] / 2 <= 1.4 + 0.005
        && Math.abs(object.position[1] - object.size[1] / 2 - TABLE_TOP) <= 0.005));
    const unchanged = Boolean(original && object && geometryValid && target.destination === original.location
      && Object.keys(original).length === Object.keys(object).length
      && Object.entries(original).every(([key, value]) => JSON.stringify(value) === JSON.stringify((object as unknown as Record<string, unknown>)[key])));
    const expectedStatus = target.destination === 'table' ? 'ready' : target.destination === 'reject' ? 'rejected' : 'placed';
    checks.push({ id: `target-${target.objectId}`, name: target.unchanged ? `${original?.label ?? target.objectId} remains undisturbed` : `${original?.label ?? target.objectId} in ${initial.destinationLabels?.[target.destination] ?? target.destination}`,
      passed: target.unchanged ? unchanged : Boolean(object && object.location === target.destination && object.status === expectedStatus && contained),
      detail: target.unchanged ? 'The full reference object record must match its supplied initial state.' : 'Destination, expected release state, full footprint and support height must agree.' });
  }
  checks.push({ id: 'controller-settled', name: 'Controller settled with empty gripper', passed: current.robot.mode === 'idle' && !current.motion && !current.robot.heldObjectId, detail: 'No active motion or held object remains.' });
  return checks;
}

export function taskForWorld(initial: WorldState): { id: string; name: string; description: string; instruction: string; targets: EnvironmentTarget[]; successChecks: (world: WorldState) => EnvironmentCheck[] } | null {
  if (initial.customTask) return { id: initial.customTask.id ?? 'custom', name: initial.customTask.title, description: 'Operator-reviewed authored rigid-object task.', instruction: initial.customTask.instruction, targets: initial.customTask.assignments, successChecks: current => checkCustomTask(initial, current) };
  return ENVIRONMENTS.find(item => item.id === initial.environmentId) ?? null;
}
