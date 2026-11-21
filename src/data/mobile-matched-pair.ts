import type { MobileCandidateGoal, MobileCandidateResult } from '../sim/mobile-candidates';
import type { MobileWorld } from '../sim/mobile-navigation';

export interface MobileMatchedPair {
  schema: 'teachtrace.mobile-matched-pair.v1';
  id: string;
  generatedAt: string;
  instruction: string;
  goal: MobileCandidateGoal;
  seed: number;
  initialSceneSha256: string;
  provenance: {
    producer: 'TeachTrace';
    comparison: 'matched-symbolic-controller-evaluation';
    humanReviewPerformed: false;
    liveHumanRunIncluded: false;
    trainingValidated: false;
    physicalTransferValidated: false;
    interventionSchedule: 'none-recorded';
    sourceAttribution: string;
    limitations: string[];
  };
  runs: [MobileCandidateResult, MobileCandidateResult];
  preference?: {
    chosenRunId: string;
    rejectedRunId: string;
    reason: string;
    reviewStatus: 'candidate-unreviewed';
    trainingValidated: false;
  };
  integrity: { algorithm: 'SHA-256'; canonicalization: 'teachtrace.canonical-json.v1'; sha256: string };
}
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Sorted object keys, original array order, finite JSON primitives and UTF-8 encoding. */
export function canonicalMobilePairJSON(value: unknown): string {
  const ancestors = new Set<object>();
  const serialize = (item: unknown, depth: number): string => {
    if (depth > 80) throw new Error('Comparison nesting exceeds the supported bound.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null || ancestors.has(item)) throw new Error('Comparison must contain finite, non-circular JSON values.');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error('Comparison needs plain JSON objects.');
    ancestors.add(item);
    const text = Array.isArray(item) ? `[${item.map(child => serialize(child, depth + 1)).join(',')}]`
      : `{${Object.keys(item).filter(key => (item as Record<string, unknown>)[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${serialize((item as Record<string, unknown>)[key], depth + 1)}`).join(',')}}`;
    ancestors.delete(item); return text;
  };
  return serialize(value, 0);
}
const same = (a: unknown, b: unknown) => canonicalMobilePairJSON(a) === canonicalMobilePairJSON(b);
const clone = <T,>(value: T): T => { canonicalMobilePairJSON(value); return structuredClone(value); };
async function sha256(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Comparison hashing needs Web Crypto on localhost/HTTPS or supported Node.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalMobilePairJSON(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function hashMobilePairScene(initialWorld: MobileWorld, goal: MobileCandidateGoal): Promise<string> {
  return sha256({ initialWorld, goal });
}
function runErrors(run: MobileCandidateResult, index: number): string[] {
  const errors: string[] = [], prefix = `Run ${index + 1}`;
  if (!run || run.schema !== 'teachtrace.mobile-candidate-result.v1' || typeof run.id !== 'string' || !run.id.trim()
    || !run.initialWorld || !run.finalWorld || !Array.isArray(run.checks) || !run.goal) return [`${prefix} needs a complete native candidate result.`];
  if (!Array.isArray(run.trajectory) || !run.trajectory.length || run.trajectory.length > 2005) return [`${prefix} needs a bounded actual trajectory.`];
  if (!same(run.trajectory[0].world, run.initialWorld) || !same(run.trajectory.at(-1)!.world, run.finalWorld)) errors.push(`${prefix} recording endpoints disagree with its initial/final world.`);
  let previous = -Infinity;
  for (const sample of run.trajectory) {
    if (!sample || !Number.isFinite(sample.time) || sample.time < previous || !Number.isFinite(sample.world?.simTime)
      || Math.abs(sample.world.simTime - run.initialWorld.simTime - sample.time) > 1e-6) { errors.push(`${prefix} recording times must be finite, chronological and relative to its initial clock.`); break; }
    previous = sample.time;
    if (!same(sample.world.human, run.initialWorld.human)) { errors.push(`${prefix} includes an external human-scenario change; this pair format supports only no-intervention comparisons.`); break; }
    const extraControls = sample.world.events.filter(event => event.kind === 'control'
      && !run.initialWorld.events.some(original => same(original, event))
      && event.message !== 'Evaluation controller started the submitted candidate; no human approval is asserted.');
    if (extraControls.length) { errors.push(`${prefix} includes an external control intervention; keep live operator runs separate.`); break; }
  }
  if (run.trajectory[0].time !== 0) errors.push(`${prefix} must preserve its actual time-zero scene.`);
  if (run.taskAccepted && (run.outcome !== 'completed' || run.checks.length === 0 || !run.checks.every(check => check.passed === true)
    || run.failureCategory !== null || run.failureStepIndex !== null || run.failedAction !== null)) errors.push(`${prefix} accepted label disagrees with its recorded checks or outcome.`);
  if (run.outcome === 'completed' && run.candidate && (run.completedSteps !== run.candidate.actions.length || run.finalWorld.mission?.status !== 'completed')) errors.push(`${prefix} completed label disagrees with its recorded controller sequence.`);
  return errors;
}
function pairErrors(runs: readonly MobileCandidateResult[]): string[] {
  if (!Array.isArray(runs) || runs.length !== 2) return ['A comparison needs exactly two native candidate results.'];
  const errors = [...runErrors(runs[0], 0), ...runErrors(runs[1], 1)];
  if (errors.length) return errors;
  if (runs[0].id === runs[1].id) errors.push('Each attempt must keep its own distinct result ID.');
  if (!same(runs[0].initialWorld, runs[1].initialWorld)) errors.push('Matched attempts must have exactly the same frozen initial world.');
  if (!same(runs[0].goal, runs[1].goal)) errors.push('Matched attempts must have the same independently supplied task goal.');
  return errors;
}
/** Preserves actual outcomes; a preference is an unreviewed candidate, never a human label. */
export async function buildMobileMatchedPair(runs: readonly [MobileCandidateResult, MobileCandidateResult], options: { instruction?: string } = {}): Promise<MobileMatchedPair> {
  const snapshot = clone(runs) as [MobileCandidateResult, MobileCandidateResult];
  const errors = pairErrors(snapshot); if (errors.length) throw new Error(errors.join(' '));
  const goal = clone(snapshot[0].goal);
  const accepted = snapshot.filter(run => run.taskAccepted), rejected = snapshot.filter(run => !run.taskAccepted);
  const unsigned = {
    schema: 'teachtrace.mobile-matched-pair.v1' as const, id: crypto.randomUUID(), generatedAt: new Date().toISOString(),
    instruction: options.instruction ?? `Deliver ${goal.objectId} to ${goal.stationId}. Leave unrequested objects untouched.`,
    goal, seed: snapshot[0].initialWorld.seed, initialSceneSha256: await hashMobilePairScene(snapshot[0].initialWorld, goal),
    provenance: {
      producer: 'TeachTrace' as const, comparison: 'matched-symbolic-controller-evaluation' as const,
      humanReviewPerformed: false as const, liveHumanRunIncluded: false as const, trainingValidated: false as const, physicalTransferValidated: false as const, interventionSchedule: 'none-recorded' as const,
      sourceAttribution: 'Original result IDs, source/model labels and local-service metadata are preserved; labels are not authenticated provider attribution.',
      limitations: ['High-level symbolic plans and deterministic kinematic execution, not a VLA or motor-policy benchmark.', 'No measured encoders, contact dynamics, training-library adapter or physical transfer validation.', 'SHA-256 verifies package consistency, not authorship or physical truth.'] },
    runs: snapshot,
    ...(accepted.length === 1 && rejected.length === 1 ? { preference: {
      chosenRunId: accepted[0].id, rejectedRunId: rejected[0].id,
      reason: `The chosen run passed every frozen task check. The rejected run did not: ${rejected[0].failureMessage ?? rejected[0].failureCategory ?? rejected[0].outcome}.`,
      reviewStatus: 'candidate-unreviewed' as const, trainingValidated: false as const,
    } } : {}),
  };
  return { ...unsigned, integrity: { algorithm: 'SHA-256', canonicalization: 'teachtrace.canonical-json.v1', sha256: await sha256(unsigned) } };
}
export async function verifyMobileMatchedPair(payload: unknown): Promise<{ valid: boolean; errors: string[] }> {
  try {
    canonicalMobilePairJSON(payload);
    if (!isRecord(payload) || payload.schema !== 'teachtrace.mobile-matched-pair.v1' || !Array.isArray(payload.runs)) return { valid: false, errors: ['Unsupported matched comparison schema.'] };
    const pair = payload as unknown as MobileMatchedPair;
    const errors = pairErrors(pair.runs); if (errors.length) return { valid: false, errors };
    if (typeof pair.id !== 'string' || !pair.id.trim() || !Number.isFinite(Date.parse(pair.generatedAt)) || typeof pair.instruction !== 'string' || !pair.instruction.trim()) errors.push('Comparison identity, date and instruction are required.');
    if (pair.seed !== pair.runs[0].initialWorld.seed || !same(pair.goal, pair.runs[0].goal)) errors.push('Comparison seed/goal disagrees with its attempts.');
    if (pair.initialSceneSha256 !== await hashMobilePairScene(pair.runs[0].initialWorld, pair.goal)) errors.push('Frozen initial scene SHA-256 mismatch.');
    if (!pair.provenance || pair.provenance.humanReviewPerformed !== false || pair.provenance.liveHumanRunIncluded !== false || pair.provenance.trainingValidated !== false || pair.provenance.physicalTransferValidated !== false || pair.provenance.interventionSchedule !== 'none-recorded') errors.push('An exported comparison must preserve its unreviewed, no-intervention simulation provenance.');
    if (pair.preference) {
      const chosen = pair.runs.find(run => run.id === pair.preference!.chosenRunId), rejected = pair.runs.find(run => run.id === pair.preference!.rejectedRunId);
      if (!chosen?.taskAccepted || !rejected || rejected.taskAccepted || chosen.id === rejected.id || pair.preference.reviewStatus !== 'candidate-unreviewed' || pair.preference.trainingValidated !== false || typeof pair.preference.reason !== 'string' || !pair.preference.reason.trim()) errors.push('Preference must point to its accepted/rejected attempts and remain candidate-unreviewed.');
    }
    if (!pair.integrity || pair.integrity.algorithm !== 'SHA-256' || pair.integrity.canonicalization !== 'teachtrace.canonical-json.v1') errors.push('A comparison requires its full-package SHA-256 integrity metadata.');
    else {
      const { integrity: _integrity, ...unsigned } = pair;
      if (pair.integrity.sha256 !== await sha256(unsigned)) errors.push('Comparison SHA-256 mismatch: package content changed.');
    }
    return { valid: errors.length === 0, errors };
  } catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'Comparison validation failed.'] }; }
}
