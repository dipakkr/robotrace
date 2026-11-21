import type { MobileWorld } from '../sim/mobile-navigation';

export interface SandboxTask { id: string; command: string }
export const SANDBOX_QUEUE_LIMIT = 12;
/** Queue instructions, not precomputed paths: dispatch must use the then-current scene. */
export function enqueueSandboxTask(tasks: SandboxTask[], command: string): SandboxTask[] {
  const text = command.trim();
  if (!text || text.length > 250) throw new Error('Use a task instruction between 1 and 250 characters.');
  if (tasks.length >= SANDBOX_QUEUE_LIMIT) throw new Error('The queue holds 12 pending tasks. Remove one or let the robot finish.');
  return [...tasks, { id: crypto.randomUUID(), command: text }];
}
export function reorderSandboxTask(tasks: SandboxTask[], id: string, direction: -1 | 1): SandboxTask[] {
  const index = tasks.findIndex(task => task.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= tasks.length) return tasks;
  const next = [...tasks]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export function sandboxTaskCommand(world: MobileWorld, objectId: string, stationId: string): string {
  const object = world.objects.find(item => item.id === objectId), station = world.stations.find(item => item.id === stationId);
  if (!object || !station || station.id === 'home') throw new Error('Choose a known object and delivery surface.');
  // Omit source because an earlier queued task may change it before dispatch.
  return `Take ${object.label} to ${station.label}`;
}
