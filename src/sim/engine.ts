export type Vec3 = [number, number, number];
export type DestinationId = 'table' | 'tray-a' | 'tray-b' | 'reject';
export type RobotMode = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface SceneObject {
  id: string;
  label: string;
  color: string;
  kind: 'cube' | 'cylinder' | 'block';
  position: Vec3;
  size: Vec3;
  location: DestinationId;
  status: string;
}

export interface RobotState {
  position: Vec3;
  gripperOpen: number;
  heldObjectId: string | null;
  mode: RobotMode;
  speed: number;
  phase: string;
}

interface MotionPhase {
  label: string;
  duration: number;
  position: Vec3;
  gripperOpen: number;
  event?: 'grasp' | 'release';
}

export interface MotionState {
  stepId: string;
  phases: MotionPhase[];
  phaseIndex: number;
  elapsed: number;
  startPosition: Vec3;
  startGripper: number;
  objectId?: string;
  destination?: DestinationId;
}

export interface WorldState {
  objects: SceneObject[];
  robot: RobotState;
  simTime: number;
  motion: MotionState | null;
  revision: number;
  lastCompletedStepId?: string;
}

export interface ActionStep {
  id: string;
  kind: 'pick_place' | 'home' | 'wait';
  label: string;
  objectId?: string;
  destination?: DestinationId;
  duration?: number;
}

export interface CommandPlan {
  summary: string;
  steps: ActionStep[];
  confirmationRequired: boolean;
  error?: string;
  control?: 'pause' | 'resume' | 'stop' | 'reset';
}

export interface AdvanceResult { world: WorldState; done: boolean; error?: string }

export const TABLE_TOP = 0.78;
export const ARM_BASE: Vec3 = [-1.47, 1.12, 0.32];
export const ARM_LINKS = [1.62, 1.58] as const;
export const HOME_POSITION: Vec3 = [-0.77, 1.7, 0.24];
export const DESTINATIONS: { id: DestinationId; label: string; center: Vec3; size: Vec3; capacity: number }[] = [
  { id: 'tray-a', label: 'TRAY A', center: [0.99, TABLE_TOP + 0.035, -0.65], size: [1.02, 0.07, 0.69], capacity: 3 },
  { id: 'tray-b', label: 'TRAY B', center: [0.99, TABLE_TOP + 0.035, 0.42], size: [1.02, 0.07, 0.69], capacity: 3 },
  { id: 'reject', label: 'REVIEW', center: [-0.30, TABLE_TOP + 0.035, 1.00], size: [0.90, 0.07, 0.38], capacity: 3 },
];

export function createInitialWorld(): WorldState {
  return {
    objects: [
      { id: 'part-red', label: 'Red block', color: '#e66c52', kind: 'block', position: [-0.43, 0.9, -0.56], size: [0.26, 0.24, 0.26], location: 'table', status: 'ready' },
      { id: 'part-blue', label: 'Blue block', color: '#5594c6', kind: 'cube', position: [-0.1, 0.9, 0.08], size: [0.23, 0.24, 0.23], location: 'table', status: 'ready' },
      { id: 'part-green', label: 'Green block', color: '#83a993', kind: 'cube', position: [-0.63, 0.89, 0.55], size: [0.24, 0.22, 0.24], location: 'table', status: 'ready' },
    ],
    robot: { position: [...HOME_POSITION], gripperOpen: 1, heldObjectId: null, mode: 'idle', speed: 1, phase: 'Ready' },
    simTime: 0,
    motion: null,
    revision: 0,
  };
}

export function destinationPosition(id: DestinationId, slot = 0): Vec3 {
  if (id === 'table') {
    return [[-0.43, 0.9, -0.56], [-0.1, 0.9, 0.08], [-0.63, 0.89, 0.55]][slot % 3] as Vec3;
  }
  const tray = DESTINATIONS.find(item => item.id === id)!;
  return [tray.center[0] + (slot - 1) * 0.29, TABLE_TOP + 0.07 + 0.12, tray.center[2]];
}

/** An object-centric, bounded command planner. No ungrounded object creation. */
export function planCommand(text: string, world: WorldState): CommandPlan {
  const command = text.toLowerCase().trim();
  const base = { steps: [] as ActionStep[], confirmationRequired: false };
  if (!command) return { ...base, summary: 'Enter a command.', error: 'A command is required.' };
  if (/^(pause|hold|hold on|wait|freeze)\b/.test(command)) return { ...base, summary: 'Pause the current motion.', control: 'pause' };
  if (/^(resume|continue|carry on)\b/.test(command)) return { ...base, summary: 'Resume the paused motion.', control: 'resume' };
  if (/^(stop|emergency stop|abort|cancel)\b/.test(command)) return { ...base, summary: 'Stop motion and hold the current position.', control: 'stop' };
  if (/^(reset|restart|restore)\b/.test(command)) return { ...base, summary: 'Reset the workcell to its initial scene.', control: 'reset', confirmationRequired: true };
  if (/\b(home|park)\b/.test(command)) return { ...base, summary: 'Return the empty gripper to its home pose.', steps: [{ id: 'home', kind: 'home', label: 'Return to home pose' }] };

  const colorNames = ['red', 'blue', 'green'];
  const unsupportedColor = command.match(/\b(purple|yellow|orange|pink|black|white|brown|grey|gray|violet)\b/);
  if (unsupportedColor) return { ...base, summary: 'That object is not available in this scene.', error: `There is no ${unsupportedColor[1]} part in this workcell. The available parts are red, blue, and green.` };
  const requestedColors = colorNames.filter(color => new RegExp(`\\b${color}\\b`).test(command));
  const isSort = /\bsort\b/.test(command);
  const allRequested = /\b(all|everything|every|prepare|pack|collect|clear)\b/.test(command) || isSort;
  const available = world.objects.filter(object => object.status !== 'in-transit');
  let selected = requestedColors.length
    ? available.filter(object => requestedColors.some(color => object.id.includes(color)))
    : allRequested ? available : [];
  // Leaving an explicitly mentioned object is supported without guessing.
  const leaveMatch = command.match(/\b(?:leave|except|excluding|skip)\s+(?:the\s+)?(red|blue|green)\b/);
  if (leaveMatch) selected = (allRequested ? available : selected).filter(object => !object.id.includes(leaveMatch[1]));
  if (!selected.length) return { ...base, summary: 'I need a known object to plan the motion.', error: 'Choose the red, blue, or green part. You can also ask to sort all parts.' };

  let destination: DestinationId | undefined;
  const mentionsA = /\b(left|tray\s*a|bin\s*a|container\s*a|tray\s*1)\b/.test(command);
  const mentionsB = /\b(right|tray\s*b|bin\s*b|container\s*b|tray\s*2)\b/.test(command);
  if (mentionsA && mentionsB) return { ...base, summary: 'Please clarify the object-to-tray assignment.', error: 'This command names both trays. Give one destination per command, or use “Sort all parts” for the collection assignment.' };
  if (/\b(reject|review|quarantine|damaged)\b/.test(command)) destination = 'reject';
  else if (/\b(left|tray\s*a|bin\s*a|container\s*a|tray\s*1)\b/.test(command)) destination = 'tray-a';
  else if (/\b(right|tray\s*b|bin\s*b|container\s*b|tray\s*2)\b/.test(command)) destination = 'tray-b';
  else if (/\b(?:to|onto|on|back\s+to)\s+(?:the\s+)?(?:table|worktable|original)\b/.test(command)) destination = 'table';
  if (!destination && !isSort) return { ...base, summary: 'Please choose a destination.', error: 'Which destination: tray A, tray B, or the review tray?' };

  const steps: ActionStep[] = selected.filter(object => object.location !== (destination ?? (object.id.includes('blue') ? 'tray-b' : 'tray-a'))).map((object, index) => {
    const target = destination ?? (object.id.includes('blue') ? 'tray-b' : 'tray-a');
    return { id: `pick-${world.revision}-${index}-${object.id}-${target}`, kind: 'pick_place', label: `Move ${object.label.toLowerCase()} to ${target === 'reject' ? 'review tray' : target.replace('-', ' ')}`, objectId: object.id, destination: target };
  });
  if (!steps.length) return { ...base, summary: 'The selected parts are already at the requested destination.', error: 'No motion needed. Choose another destination or reset the scene.' };
  return {
    summary: isSort && !destination ? 'Sort red and green parts into tray A, and the blue part into tray B.' : `Move ${selected.map(object => object.label.toLowerCase()).join(' and ')} to ${destination === 'reject' ? 'the review tray' : destination?.replace('-', ' ')}.`,
    steps,
    confirmationRequired: destination === 'reject',
  };
}

function copyWorld(world: WorldState): WorldState {
  return {
    ...world,
    objects: world.objects.map(object => ({ ...object, position: [...object.position], size: [...object.size] })),
    robot: { ...world.robot, position: [...world.robot.position] },
    motion: world.motion ? { ...world.motion, startPosition: [...world.motion.startPosition] } : null,
  };
}

function distance(a: Vec3, b: Vec3): number { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function reachable(position: Vec3): boolean {
  const wrist: Vec3 = [position[0], position[1] + 0.24, position[2]];
  return distance(wrist, ARM_BASE) < ARM_LINKS[0] + ARM_LINKS[1] - 0.03 && position[1] >= TABLE_TOP && Math.abs(position[0]) < 2.05 && Math.abs(position[2]) < 1.25;
}

function startMotion(world: WorldState, step: ActionStep): MotionState | string {
  if (step.kind === 'wait') return { stepId: step.id, phaseIndex: 0, elapsed: 0, startPosition: [...world.robot.position], startGripper: world.robot.gripperOpen, phases: [{ label: 'Waiting', duration: step.duration ?? 1, position: [...world.robot.position], gripperOpen: world.robot.gripperOpen }] };
  if (step.kind === 'home') {
    if (world.robot.heldObjectId) return 'The gripper is holding a part. Finish or reset the interrupted transfer before returning home.';
    return { stepId: step.id, phaseIndex: 0, elapsed: 0, startPosition: [...world.robot.position], startGripper: world.robot.gripperOpen, phases: [{ label: 'Returning home', duration: 1.2, position: [...HOME_POSITION], gripperOpen: 1 }] };
  }
  const object = world.objects.find(item => item.id === step.objectId);
  if (!object) return 'The requested object does not exist in this scene.';
  if (world.robot.heldObjectId && world.robot.heldObjectId !== object.id) return 'The gripper is holding another part. Finish or reset that transfer first.';
  if (!step.destination) return 'The destination is missing.';
  const tray = DESTINATIONS.find(item => item.id === step.destination);
  const otherObjects = world.objects.filter(item => item.id !== object.id && item.location === step.destination);
  if (tray && otherObjects.length >= tray.capacity) return 'The destination tray is full.';
  let target: Vec3;
  if (step.destination === 'table') target = destinationPosition('table', world.objects.findIndex(item => item.id === object.id));
  else {
    const availableSlots = [0, 1, 2].filter(slot => !otherObjects.some(item => Math.abs(item.position[0] - destinationPosition(step.destination!, slot)[0]) < 0.17));
    target = destinationPosition(step.destination, availableSlots[0] ?? 0);
  }
  target[1] = TABLE_TOP + (step.destination === 'table' ? 0 : 0.07) + object.size[1] / 2;
  if (!reachable(object.position) || !reachable(target)) return 'This target is outside the configured workcell reach.';
  if (otherObjects.some(item => distance(item.position, target) < 0.22)) return 'The destination placement is occupied.';
  const high = 1.7;
  const atObject: Vec3 = [...object.position];
  return {
    stepId: step.id, phaseIndex: 0, elapsed: 0, startPosition: [...world.robot.position], startGripper: world.robot.gripperOpen, objectId: object.id, destination: step.destination,
    phases: [
      { label: 'Approaching part', duration: 0.85, position: [atObject[0], high, atObject[2]], gripperOpen: 1 },
      { label: 'Aligning gripper', duration: 0.65, position: atObject, gripperOpen: 1 },
      { label: 'Grasping part', duration: 0.35, position: atObject, gripperOpen: 0, event: 'grasp' },
      { label: 'Lifting part', duration: 0.6, position: [atObject[0], high, atObject[2]], gripperOpen: 0 },
      { label: 'Transferring part', duration: 1.0, position: [target[0], high, target[2]], gripperOpen: 0 },
      { label: 'Placing part', duration: 0.65, position: target, gripperOpen: 0 },
      { label: 'Releasing part', duration: 0.3, position: target, gripperOpen: 1, event: 'release' },
      { label: 'Verifying placement', duration: 0.65, position: [target[0], high, target[2]], gripperOpen: 1 },
    ],
  };
}

/** Pure, clock-driven kinematic advancement; paused or stopped worlds never advance. */
export function advanceWorld(source: WorldState, step: ActionStep, dt: number): AdvanceResult {
  if (source.lastCompletedStepId === step.id && !source.motion) return { world: source, done: true };
  if (source.robot.mode === 'paused' || source.robot.mode === 'stopped' || source.robot.mode === 'error') return { world: source, done: false };
  if (!Number.isFinite(dt) || dt <= 0) return { world: source, done: false };
  const world = copyWorld(source);
  if (!world.motion || world.motion.stepId !== step.id) {
    const motion = startMotion(world, step);
    if (typeof motion === 'string') {
      world.robot.mode = 'error'; world.robot.phase = motion;
      return { world, done: true, error: motion };
    }
    world.motion = motion;
  }
  world.robot.mode = 'running';
  const motion = world.motion;
  let remaining = Math.min(dt, 1) * Math.max(0.1, Math.min(world.robot.speed, 3));
  world.simTime += remaining;
  while (remaining > 0 && motion.phaseIndex < motion.phases.length) {
    const phase = motion.phases[motion.phaseIndex];
    world.robot.phase = phase.label;
    const advance = Math.min(remaining, phase.duration - motion.elapsed);
    motion.elapsed += advance;
    remaining -= advance;
    const t = Math.min(1, motion.elapsed / phase.duration);
    const eased = t * t * (3 - 2 * t);
    world.robot.position = phase.position.map((value, index) => motion.startPosition[index] + (value - motion.startPosition[index]) * eased) as Vec3;
    world.robot.gripperOpen = motion.startGripper + (phase.gripperOpen - motion.startGripper) * eased;
    if (world.robot.heldObjectId) {
      const held = world.objects.find(item => item.id === world.robot.heldObjectId)!;
      held.position = [...world.robot.position];
    }
    if (t >= 1) {
      if (phase.event === 'grasp' && motion.objectId) {
        const object = world.objects.find(item => item.id === motion.objectId)!;
        if (distance(object.position, world.robot.position) > 0.04) {
          world.robot.mode = 'error'; return { world, done: true, error: 'The part moved before grasp. Reset or replan from the current scene.' };
        }
        world.robot.heldObjectId = motion.objectId;
        object.status = 'in-transit';
      }
      if (phase.event === 'release' && motion.objectId) {
        const object = world.objects.find(item => item.id === motion.objectId)!;
        object.position = [...phase.position];
        object.location = motion.destination!;
        object.status = motion.destination === 'reject' ? 'rejected' : motion.destination === 'table' ? 'ready' : 'placed';
        world.robot.heldObjectId = null;
        world.revision += 1;
      }
      motion.phaseIndex += 1;
      motion.elapsed = 0;
      motion.startPosition = [...world.robot.position];
      motion.startGripper = world.robot.gripperOpen;
    }
  }
  if (motion.phaseIndex === motion.phases.length) {
    world.motion = null;
    world.robot.mode = 'idle';
    world.robot.phase = 'Ready';
    world.lastCompletedStepId = step.id;
    return { world, done: true };
  }
  return { world, done: false };
}

/** Analytic yaw + two-link elbow-up IK; wrist orientation remains vertical. */
export function solveArmIK(tcp: Vec3): { shoulder: Vec3; elbow: Vec3; wrist: Vec3; yaw: number; shoulderAngle: number; elbowAngle: number; reachable: boolean } {
  const wrist: Vec3 = [tcp[0], tcp[1] + 0.24, tcp[2]];
  const dx = wrist[0] - ARM_BASE[0], dz = wrist[2] - ARM_BASE[2];
  const horizontal = Math.hypot(dx, dz);
  const dy = wrist[1] - ARM_BASE[1];
  const rawDistance = Math.hypot(horizontal, dy);
  const d = Math.max(0.05, Math.min(rawDistance, ARM_LINKS[0] + ARM_LINKS[1] - 0.001));
  const elbowInternal = Math.acos(Math.max(-1, Math.min(1, (ARM_LINKS[0] ** 2 + ARM_LINKS[1] ** 2 - d ** 2) / (2 * ARM_LINKS[0] * ARM_LINKS[1]))));
  const alpha = Math.acos(Math.max(-1, Math.min(1, (ARM_LINKS[0] ** 2 + d ** 2 - ARM_LINKS[1] ** 2) / (2 * ARM_LINKS[0] * d))));
  const shoulderAngle = Math.atan2(dy, horizontal) + alpha;
  const yaw = Math.atan2(dz, dx);
  const elbow: Vec3 = [ARM_BASE[0] + Math.cos(yaw) * ARM_LINKS[0] * Math.cos(shoulderAngle), ARM_BASE[1] + ARM_LINKS[0] * Math.sin(shoulderAngle), ARM_BASE[2] + Math.sin(yaw) * ARM_LINKS[0] * Math.cos(shoulderAngle)];
  return { shoulder: [...ARM_BASE], elbow, wrist, yaw, shoulderAngle, elbowAngle: Math.PI - elbowInternal, reachable: rawDistance < ARM_LINKS[0] + ARM_LINKS[1] };
}
