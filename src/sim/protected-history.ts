import type { WorldState } from './engine';
import { ENVIRONMENTS } from './environments';
import type { EnvironmentCheck } from './environments';

const normalized = (value: unknown): unknown => Array.isArray(value) ? value.map(normalized)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalized(item)])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));

/** Latches observed reference changes: putting an object back never erases its history. */
export function createProtectedHistory(initial: WorldState) {
  const targets = initial.customTask?.assignments ?? ENVIRONMENTS.find(item => item.id === initial.environmentId)?.targets ?? [];
  const ids = [...new Set(Array.isArray(targets) ? targets.filter(target => target?.unchanged === true && typeof target.objectId === 'string').map(target => target.objectId) : [])];
  const originals = new Map(ids.map(id => [id, structuredClone(initial.objects.find(object => object.id === id))]));
  const disturbed = new Set<string>();
  const observe = (world: WorldState) => {
    for (const id of ids) {
      const original = originals.get(id);
      const current = world.objects.filter(object => object.id === id);
      if (!original || current.length !== 1 || !same(original, current[0])
        || world.motion?.objectId === id || world.robot.heldObjectId === id) disturbed.add(id);
    }
  };
  observe(initial);
  return {
    observe,
    checks: (): EnvironmentCheck[] => ids.map(id => ({
      id: `target-${id}`, name: `${originals.get(id)?.label ?? id} remains undisturbed`, passed: !disturbed.has(id),
      detail: disturbed.has(id)
        ? 'Recorded controller evidence handled or changed this protected object; restoring its final state does not undo the violation.'
        : 'The protected object retained its complete initial record and was never an observed motion target or held object.',
    })),
  };
}

/** Tighten existing final-state checks while preserving unchanged legacy check wording. */
export function mergeProtectedHistoryChecks(checks: EnvironmentCheck[], history: EnvironmentCheck[]): EnvironmentCheck[] {
  const result = checks.map(check => ({ ...check }));
  for (const observed of history) {
    const index = result.findIndex(check => check.id === observed.id);
    if (index < 0) result.push(observed);
    else if (!observed.passed && result[index].passed) result[index] = { ...result[index], passed: false, detail: observed.detail };
  }
  return result;
}
