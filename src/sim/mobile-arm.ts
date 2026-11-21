import type { MobileWorld } from './mobile-navigation';

export type MobileArmPoint = [number, number, number];
export interface MobileArmPose {
  joints: { base: MobileArmPoint; shoulder: MobileArmPoint; elbow: MobileArmPoint; wrist: MobileArmPoint; gripper: MobileArmPoint };
  jointAngles: { baseYaw: number; shoulderPitch: number; elbowPitch: number; wristPitch: number };
  angleUnit: 'radians'; baseHeading: number; worldBaseYaw: number;
  tcpConvention: 'rendered-object-center';
  linkLengths: [number, number]; gripperOpen: number; objectTCP: MobileArmPoint;
  requestedTCP: MobileArmPoint; requestedWrist: MobileArmPoint; targetObjectId: string | null;
  requestedDistance: number; maxReach: number; reachable: boolean; clamped: boolean; inputValid: boolean;
  basis: 'simulated-analytic-kinematics'; limitations: string[]; error?: string;
}

export const MOBILE_ARM_LINKS: [number, number] = [0.82, 0.82];
export const MOBILE_GRIPPER_TCP_OFFSET = 0.16;
export const MOBILE_OBJECT_TCP_HEIGHT_OFFSET = 0.09;
const SHOULDER_HEIGHT = 0.94;
const BASE_HEIGHT = 0.63;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const normalizedAngle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

/** The exact analytic pose shared by the renderer and export, never measured motor telemetry. */
export function solveMobileArm(world: MobileWorld): MobileArmPose {
  const robotPositionValid = Array.isArray(world.robot.position) && world.robot.position.length === 2 && world.robot.position.every(Number.isFinite);
  const x = robotPositionValid ? world.robot.position[0] : 0;
  const z = robotPositionValid ? world.robot.position[1] : 0;
  const headingValid = Number.isFinite(world.robot.yaw);
  const baseHeading = headingValid ? normalizedAngle(world.robot.yaw) : 0;
  const base: MobileArmPoint = [x, BASE_HEIGHT, z];
  const shoulder: MobileArmPoint = [x, SHOULDER_HEIGHT, z];
  const step = world.mission?.plan.steps[world.mission.stepIndex];
  const objectId = step && step.kind !== 'navigate' ? step.objectId : world.robot.cargoObjectId;
  const object = objectId ? world.objects.find(item => item.id === objectId) : undefined;
  const objectValid = Boolean(object && Array.isArray(object.position) && object.position.length === 2 && object.position.every(Number.isFinite) && Number.isFinite(object.height));
  const inputValid = robotPositionValid && headingValid && (!objectId || objectValid);
  const requestedWrist: MobileArmPoint = object && objectValid
    ? [object.position[0], object.height + MOBILE_OBJECT_TCP_HEIGHT_OFFSET + MOBILE_GRIPPER_TCP_OFFSET, object.position[1]]
    : [x, 1.12, z + 0.3];
  const requestedTCP: MobileArmPoint = [requestedWrist[0], requestedWrist[1] - MOBILE_GRIPPER_TCP_OFFSET, requestedWrist[2]];
  const dx = requestedWrist[0] - shoulder[0], dy = requestedWrist[1] - shoulder[1], dz = requestedWrist[2] - shoulder[2];
  const horizontal = Math.hypot(dx, dz);
  const requestedDistance = Math.hypot(horizontal, dy);
  const [upper, lower] = MOBILE_ARM_LINKS;
  const maxReach = upper + lower;
  const solvedDistance = Math.min(requestedDistance, maxReach);
  const directionPitch = Math.atan2(dy, horizontal);
  const worldBaseYaw = horizontal > 0.000000001 ? Math.atan2(dx, dz) : baseHeading;
  // Equal links allow the zero-distance fold without dividing by distance.
  const shoulderOffset = Math.acos(clamp(solvedDistance / (2 * upper), -1, 1));
  const shoulderPitch = directionPitch + shoulderOffset;
  const elbowPitch = -2 * shoulderOffset;
  const wristPitch = -Math.PI / 2 - shoulderPitch - elbowPitch;
  const elbow: MobileArmPoint = [
    x + Math.sin(worldBaseYaw) * upper * Math.cos(shoulderPitch),
    SHOULDER_HEIGHT + upper * Math.sin(shoulderPitch),
    z + Math.cos(worldBaseYaw) * upper * Math.cos(shoulderPitch),
  ];
  const wrist: MobileArmPoint = [
    elbow[0] + Math.sin(worldBaseYaw) * lower * Math.cos(shoulderPitch + elbowPitch),
    elbow[1] + lower * Math.sin(shoulderPitch + elbowPitch),
    elbow[2] + Math.cos(worldBaseYaw) * lower * Math.cos(shoulderPitch + elbowPitch),
  ];
  const objectTCP: MobileArmPoint = [wrist[0], wrist[1] - MOBILE_GRIPPER_TCP_OFFSET, wrist[2]];
  const reachable = inputValid && requestedDistance <= maxReach + 0.000001;
  const gripperOpen = object?.status === 'loading' || world.robot.cargoObjectId !== null ? 0 : 1;
  return {
    joints: { base, shoulder, elbow, wrist, gripper: [...objectTCP] },
    jointAngles: { baseYaw: normalizedAngle(worldBaseYaw - baseHeading), shoulderPitch, elbowPitch, wristPitch },
    angleUnit: 'radians', tcpConvention: 'rendered-object-center', baseHeading, worldBaseYaw, linkLengths: [...MOBILE_ARM_LINKS], gripperOpen,
    objectTCP, requestedTCP, requestedWrist, targetObjectId: object && objectValid ? object.id : null,
    requestedDistance, maxReach, reachable, clamped: requestedDistance > maxReach, inputValid,
    basis: 'simulated-analytic-kinematics',
    limitations: [
      'Analytic kinematic coordinates of the rendered arm; no measured encoders, motor efforts or contact forces.',
      'A known target is selected from current simulated object state; no perception or learned robot policy.',
      'The active/transported object TCP is its rendered center at support height + 0.09 m; the wrist is 0.16 m above that point.',
      'Unreachable wrist targets are geometrically clamped and explicitly flagged; link lengths are never stretched.',
      'The task planner uses its separate conservative armReach limit; the geometric two-link span is 1.64 m.',
      'No swept-volume collision, joint-limit, dynamics, physical safety or real-world calibration validation.',
      'Station target changes may change the analytic pose between states; no continuous joint trajectory is claimed.',
    ],
    ...(!inputValid ? { error: 'An arm input or active object target is invalid; a finite folded fallback pose is reported.' } : {}),
  };
}
