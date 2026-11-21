import type { CommandPlan, DestinationId, WorldState } from './engine';
import { ENVIRONMENTS } from './environments';

const normalize = (text: string) => text.toLowerCase().trim().replace(/^please\s+/, '').replace(/[.!?]+$/, '').replace(/\s+/g, ' ');

/** Freeze the explicit command's goals before recording; never replace a task after execution. */
export function worldForCommand(world: WorldState, plan: CommandPlan, instruction: string): WorldState {
  const snapshot = structuredClone(world);
  if (plan.error || plan.control || !plan.steps.length || plan.steps.some(step => step.kind !== 'pick_place')) return snapshot;
  const normalized = normalize(instruction);
  if (snapshot.customTask && [normalize(snapshot.customTask.instruction), 'complete scene task', 'run scene task'].includes(normalized)) return snapshot;
  const environment = ENVIRONMENTS.find(item => item.id === world.environmentId);
  if (!snapshot.customTask && environment && normalize(environment.instruction) === normalized) return snapshot;
  if (!instruction.trim() || instruction.length > 500) throw new Error('Use a task instruction of at most 500 characters.');
  const protectedIds = new Set((snapshot.customTask?.assignments ?? environment?.targets ?? []).filter(target => target.unchanged).map(target => target.objectId));
  const destinations = new Map<string, DestinationId>();
  for (const step of plan.steps) {
    if (!step.objectId || !step.destination || !snapshot.objects.some(object => object.id === step.objectId) || destinations.has(step.objectId)) throw new Error('The command needs one grounded destination per moved object.');
    if (protectedIds.has(step.objectId)) throw new Error('This command targets a protected reference. Change the task explicitly before moving it.');
    destinations.set(step.objectId, step.destination);
  }
  const baseEnvironmentId = snapshot.baseEnvironmentId ?? environment?.id;
  snapshot.environmentId = 'custom';
  if (baseEnvironmentId) snapshot.baseEnvironmentId = baseEnvironmentId;
  snapshot.customTask = {
    id: `custom-${crypto.randomUUID()}`, title: instruction.trim().slice(0, 80), instruction: instruction.trim(),
    assignments: snapshot.objects.map(object => ({ objectId: object.id, destination: destinations.get(object.id) ?? object.location, unchanged: !destinations.has(object.id) })),
  };
  return snapshot;
}
