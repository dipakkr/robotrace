import type { MobileCandidateResult } from '../sim/mobile-candidates';

export type MobileQaResult = Pick<MobileCandidateResult,
  'outcome' | 'taskAccepted' | 'failureCategory' | 'completedPickups' | 'completedPlacements' | 'distanceTravelled' | 'checks'>;
export interface QaVerdict { status: 'matched' | 'mismatch' | 'unscored'; label: string; detail: string }

/** Expectations grade the specific observed behavior; a refusal is never a delivery. */
export function expectedBehaviorVerdict(expected: string | undefined, result: MobileQaResult): QaVerdict {
  let matched: boolean;
  let label: string;
  let requirement: string;
  switch (expected) {
    case 'task-completion':
      matched = result.outcome === 'completed' && result.taskAccepted === true && result.checks.length > 0 && result.checks.every(check => check.passed === true);
      label = 'Completed as expected'; requirement = 'Completed execution and all frozen task checks must pass.'; break;
    case 'reach-refusal':
      matched = ['failed', 'refused'].includes(result.outcome) && !result.taskAccepted && result.failureCategory === 'reach' && result.completedPickups === 0;
      label = 'Reach guard matched'; requirement = 'A reach failure/refusal must prevent pickup.'; break;
    case 'route-refusal':
      matched = result.outcome === 'refused' && !result.taskAccepted && result.failureCategory === 'no-route' && result.distanceTravelled === 0 && result.completedPickups === 0;
      label = 'Route refusal matched'; requirement = 'No-route refusal must occur with zero travel and zero pickups.'; break;
    case 'human-block':
      matched = result.outcome === 'blocked' && !result.taskAccepted && result.failureCategory === 'human-blocked' && result.completedPlacements === 0;
      label = 'Human block matched'; requirement = 'The explicit human scenario must block, without completing a placement.'; break;
    case 'protected-reference-preservation':
      matched = result.outcome === 'completed' && !result.taskAccepted && result.failureCategory === 'protected-object'
        && result.checks.some(check => check.id.startsWith('protected-') && check.passed === false);
      label = 'Violation detected'; requirement = 'This negative fixture must finish its declared actions but reject the protected-object violation.'; break;
    default:
      return { status: 'unscored', label: 'Not scored', detail: 'No known expected behavior is attached; this does not count as a match.' };
  }
  const observed = `Observed ${result.outcome}; task ${result.taskAccepted ? 'accepted' : 'not accepted'}; category ${result.failureCategory ?? 'none'}; ${result.completedPickups} pickups, ${result.completedPlacements} placements, ${result.distanceTravelled} m travel.`;
  return { status: matched ? 'matched' : 'mismatch', label: matched ? label : 'Unexpected outcome', detail: `${requirement} ${observed}` };
}
