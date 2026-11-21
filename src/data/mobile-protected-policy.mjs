/** Shared by controller evaluation and plain-JavaScript consumers; no simulator imports. */
export const MOBILE_PROTECTED_POLICY = Object.freeze({
  id: 'teachtrace.mobile-protected-record.v1',
  positionToleranceMeters: 0,
  positionCriterion: 'any-exact-coordinate-change',
  recordCriterion: 'complete-initial-object-record-unchanged',
  recordComparison: 'exact-JSON.stringify',
  coordinateFrame: 'simulator-world',
  positionUnit: 'meters',
  positionAnchor: 'rendered-object-center',
  heightOffsetMeters: 0.09,
  observationPolicy: 'every-native-controller-tick',
  firstViolationReplaySample: 'forced-at-first-observed-violation',
  violationLatches: true,
});

function position(object) {
  if (!object || !Array.isArray(object.position) || object.position.length !== 2
    || !object.position.every(Number.isFinite) || !Number.isFinite(object.height)) return null;
  return [object.position[0], object.height + MOBILE_PROTECTED_POLICY.heightOffsetMeters, object.position[1]];
}

/** Exact JSON semantics deliberately match the existing native evaluator, including record key order. */
export function mobileProtectedChange(initialObject, currentObject) {
  const initialPosition = position(initialObject), currentPosition = position(currentObject);
  const recordChanged = JSON.stringify(initialObject) !== JSON.stringify(currentObject);
  const positionChanged = !initialPosition || !currentPosition
    ? initialPosition !== currentPosition
    : initialPosition.some((coordinate, axis) => coordinate !== currentPosition[axis]);
  const fields = recordChanged ? [...new Set([...Object.keys(initialObject ?? {}), ...Object.keys(currentObject ?? {})])] : [];
  const changedFields = fields.filter(key => JSON.stringify(initialObject?.[key]) !== JSON.stringify(currentObject?.[key]));
  if (recordChanged && !changedFields.length) changedFields.push('$record-order');
  return {
    violated: recordChanged,
    positionChanged,
    recordChanged,
    displacementMeters: initialPosition && currentPosition ? Math.hypot(...initialPosition.map((coordinate, axis) => currentPosition[axis] - coordinate)) : null,
    changedFields,
  };
}
