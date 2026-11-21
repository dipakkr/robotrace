export const MOBILE_PROTECTED_POLICY: Readonly<{
  id: 'teachtrace.mobile-protected-record.v1';
  positionToleranceMeters: 0;
  positionCriterion: 'any-exact-coordinate-change';
  recordCriterion: 'complete-initial-object-record-unchanged';
  recordComparison: 'exact-JSON.stringify';
  coordinateFrame: 'simulator-world';
  positionUnit: 'meters';
  positionAnchor: 'rendered-object-center';
  heightOffsetMeters: 0.09;
  observationPolicy: 'every-native-controller-tick';
  firstViolationReplaySample: 'forced-at-first-observed-violation';
  violationLatches: true;
}>;
export interface MobileProtectedChange {
  violated: boolean;
  positionChanged: boolean;
  recordChanged: boolean;
  displacementMeters: number | null;
  changedFields: string[];
}
export function mobileProtectedChange(initialObject: unknown, currentObject: unknown): MobileProtectedChange;
