export type Vec3 = [number, number, number];
export type DestinationId = 'table' | 'tray-a' | 'tray-b' | 'reject';
export type RobotMode = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface SceneObject {
  id: string;
  label: string;
  semanticType?: string;
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
  humanPresence?: { state: 'clear' | 'nearby' | 'in-workspace'; source: 'scenario-proxy' };
  environmentId?: string;
  baseEnvironmentId?: 'workbench' | 'kitchen' | 'lab';
  customTask?: {
    id?: string;
    title: string;
    instruction: string;
    assignments: { objectId: string; destination: DestinationId; unchanged?: boolean }[];
  };
  sceneProvenance?: { source: 'deterministic' | 'ai-draft' | 'import'; prompt?: string; model?: string; reviewRequired: boolean; reviewed?: boolean;
    derivation?: { parentSceneSha256: string; seed: number; index: number; kind: 'layout' | 'reach-challenge' | 'human-occupied'; basis: 'seeded-simulator-variation'; identityVerified: false };
    reference?: { kind: 'image' | 'selected-video-frame'; sha256: string; frameTimeSeconds?: number; calibrated: false; rightsVerified: false; basis: 'submitted-reference-frame' } };
  destinationLabels?: Record<DestinationId, string>;
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
  control?: 'pause' | 'resume' | 'stop' | 'reset' | 'human-nearby' | 'human-enter' | 'human-clear';
}

export interface AdvanceResult { world: WorldState; done: boolean; error?: string; blocked?: string }

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
  const command = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const base = { steps: [] as ActionStep[], confirmationRequired: false };
  if (!command) return { ...base, summary: 'Enter a command.', error: 'A command is required.' };
  const scenarioCommand = command.replace(/^please /, '').replace(/[.!?]+$/, '');
  if (/^(?:simulate (?:a )?(?:person|human) nearby|(?:a )?(?:person|human) (?:is )?nearby)$/.test(scenarioCommand)) {
    return { ...base, summary: 'Simulate a person nearby. This scenario state does not block the controller.', control: 'human-nearby' };
  }
  if (/^(?:simulate (?:a )?(?:person|human) (?:entering|in) (?:the )?workspace|(?:a )?(?:person|human) (?:enters|entered|is entering)(?: (?:the )?workspace)?)$/.test(scenarioCommand)) {
    return { ...base, summary: 'Simulate a person in the workspace. The software scenario interlock holds attempted motion.', control: 'human-enter' };
  }
  if (/^(?:clear (?:the )?human workspace(?: scenario)?|(?:the )?(?:person|human) (?:leaves|left)(?: (?:the )?workspace)?)$/.test(scenarioCommand)) {
    return { ...base, summary: 'Clear the human workspace scenario. A paused robot still needs an explicit resume.', control: 'human-clear' };
  }
  if (/^(pause|hold|hold on|wait|freeze)\b/.test(command)) return { ...base, summary: 'Pause the current motion.', control: 'pause' };
  if (/^(resume|continue|carry on)\b/.test(command)) return { ...base, summary: 'Resume the paused motion.', control: 'resume' };
  if (/^(stop|emergency stop|abort|cancel)\b/.test(command)) return { ...base, summary: 'Stop motion and hold the current position.', control: 'stop' };
  if (/^(reset|restart|restore)\b/.test(command)) return { ...base, summary: 'Reset the workcell to its initial scene.', control: 'reset', confirmationRequired: true };
  if (/\b(home|park)\b/.test(command)) return { ...base, summary: 'Return the empty gripper to its home pose.', steps: [{ id: 'home', kind: 'home', label: 'Return to home pose' }] };

  const phrasePattern = (phrase: string) => new RegExp(`(?<![\\w-])${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g');
  const destinationName = (id: DestinationId) => world.destinationLabels?.[id] ?? (id === 'reject' ? 'review tray' : id.replace('-', ' '));
  const buildPlan = (assignments: { object: SceneObject; target: DestinationId }[], summary?: string): CommandPlan => {
    const moves = assignments.filter(({ object, target }) => object.location !== target);
    if (!moves.length) return { ...base, summary: 'The selected objects are already at the requested destination.', error: 'No motion needed. Choose another destination or reset the scene.' };
    const steps: ActionStep[] = moves.map(({ object, target }, index) => ({
      id: `pick-${world.revision}-${index}-${object.id}-${target}`, kind: 'pick_place',
      label: `Move ${object.label.toLowerCase()} to ${destinationName(target)}`, objectId: object.id, destination: target,
    }));
    return { summary: summary ?? `${steps.map(step => step.label).join('; ')}.`, steps, confirmationRequired: moves.some(({ target }) => target === 'reject') };
  };
  if (world.customTask && [world.customTask.instruction.toLowerCase().replace(/[.!?]+$/, ''), 'complete scene task', 'run scene task'].includes(command.replace(/^please /, '').replace(/[.!?]+$/, ''))) {
    const targets = world.customTask.assignments.filter(target => !target.unchanged);
    const assignments = targets.map(target => ({ object: world.objects.find(object => object.id === target.objectId), target: target.destination }));
    if (!assignments.length || assignments.some(({ object, target }) => !object || object.status === 'in-transit' || !['table', 'tray-a', 'tray-b', 'reject'].includes(target))) return { ...base, summary: 'The authored task cannot be grounded.', error: 'A task object or destination is unavailable. Review the scene draft.' };
    return buildPlan(assignments as { object: SceneObject; target: DestinationId }[]);
  }
  // These named assignments are explicit, scene-specific recipes, not generated robot skills.
  const namedTasks: { phrase: string; environment: string; targets: [string, DestinationId][] }[] = [
    { phrase: 'clear the counter', environment: 'kitchen', targets: [['part-red', 'tray-a'], ['part-blue', 'tray-a'], ['part-green', 'tray-b']] },
    { phrase: 'route the samples', environment: 'lab', targets: [['part-red', 'tray-a'], ['part-blue', 'tray-b']] },
    { phrase: 'prepare repair kit', environment: 'workbench', targets: [['part-red', 'tray-a'], ['part-blue', 'tray-b'], ['part-green', 'tray-a']] },
  ];
  const task = namedTasks.find(item => command.replace(/^please /, '').replace(/[.!?]+$/, '') === item.phrase);
  if (task) {
    if (world.environmentId !== task.environment) return { ...base, summary: 'Choose the matching environment first.', error: `This assignment belongs to the ${task.environment} environment.` };
    const assignments = task.targets.map(([id, target]) => ({ object: world.objects.find(object => object.id === id), target }));
    if (assignments.some(({ object }) => !object || object.status === 'in-transit')) return { ...base, summary: 'The assignment cannot be grounded in this scene.', error: 'A required object is missing or already in transit. Finish the current motion or reload this environment.' };
    return buildPlan(assignments as { object: SceneObject; target: DestinationId }[]);
  }

  const aliases = [...new Set(world.objects.flatMap(object => [object.id.toLowerCase(), object.label.toLowerCase()]))].sort((a, b) => b.length - a.length);
  let unnamedCommand = command;
  const namedObjects: SceneObject[] = [];
  for (const alias of aliases) {
    if (!phrasePattern(alias).test(unnamedCommand)) continue;
    const matching = world.objects.filter(object => object.id.toLowerCase() === alias || object.label.toLowerCase() === alias);
    if (matching.length > 1) return { ...base, summary: 'Please identify the object.', error: `More than one object is named “${alias}”. Use its exact object ID.` };
    namedObjects.push(...matching);
    unnamedCommand = unnamedCommand.replace(phrasePattern(alias), ' ');
  }

  const colorNames = ['red', 'blue', 'green'];
  const hasColor = (object: SceneObject, color: string) => object.color.toLowerCase() === ({ red: '#e66c52', blue: '#5594c6', green: '#83a993' }[color]);
  const unsupportedColor = unnamedCommand.match(/\b(purple|yellow|orange|pink|black|white|brown|grey|gray|violet)\b/);
  if (unsupportedColor) return { ...base, summary: 'That object is not available in this scene.', error: `There is no ${unsupportedColor[1]} part in this workcell. The available parts are red, blue, and green.` };
  const requestedColors = colorNames.filter(color => new RegExp(`\\b${color}\\b`).test(unnamedCommand));
  const isSort = /\bsort\b/.test(command);
  const allRequested = /\b(all|everything|every|prepare|pack|collect|clear)\b/.test(command) || isSort;
  const available = world.objects.filter(object => object.status !== 'in-transit');
  let selected: SceneObject[] = namedObjects.filter(object => object.status !== 'in-transit');
  if (requestedColors.length) {
    for (const color of requestedColors) {
      const matching = available.filter(object => hasColor(object, color));
      if (!matching.length) return { ...base, summary: 'That object is not available in the current scene.', error: `There is no available ${color} block in the current scene.` };
      const numbered = [...command.matchAll(new RegExp(`\\b${color}\\s+(?:block|part|cube)\\s*(?:number\\s*)?(\\d+)\\b`, 'g'))].map(match => Number(match[1]));
      if (numbered.length) {
        if (numbered.some(ordinal => ordinal < 1 || ordinal > matching.length)) return { ...base, summary: 'That numbered object is not available.', error: `The current scene has ${matching.length} ${color} block${matching.length === 1 ? '' : 's'}. Choose an existing block number.` };
        selected.push(...[...new Set(numbered)].map(ordinal => matching[ordinal - 1]));
      } else {
        const pluralReference = new RegExp(`\\b${color}\\s+(?:blocks|parts|cubes)\\b`).test(command);
        if (matching.length > 1 && !allRequested && !pluralReference) return { ...base, summary: 'Please identify the object.', error: `There are ${matching.length} ${color} blocks. Say “${color} block 1”, “${color} block 2”, or “all ${color} blocks”.` };
        selected.push(...matching);
      }
    }
  } else if (allRequested && !namedObjects.length) selected = available;
  selected = [...new Map(selected.map(object => [object.id, object])).values()];
  // Leaving an explicitly mentioned object is supported without guessing.
  const leaveMatch = command.match(/\b(?:leave|except|excluding|skip)\s+(?:the\s+)?(red|blue|green)\b/);
  if (leaveMatch) selected = (allRequested ? available : selected).filter(object => !hasColor(object, leaveMatch[1]));
  if (!selected.length) return { ...base, summary: 'I need a known object to plan the motion.', error: `Choose an object in this scene: ${available.map(object => object.label).join(', ')}. You can also ask to sort all parts.` };

  let destination: DestinationId | undefined;
  const destinationPatterns: [DestinationId, RegExp][] = [
    ['tray-a', /\b(left|tray\s*a|bin\s*a|container\s*a|tray\s*1)\b/g],
    ['tray-b', /\b(right|tray\s*b|bin\s*b|container\s*b|tray\s*2)\b/g],
    ['reject', /\b(reject|review|quarantine|damaged)\b/g],
    ['table', /\b(?:to|onto|on|back\s+to)\s+(?:the\s+)?(?:table|worktable|original)\b/g],
  ];
  for (const [id, label] of Object.entries(world.destinationLabels ?? {})) {
    // A tabletop label can also describe the source; require a placement preposition.
    const pattern = id === 'table' ? new RegExp(`\\b(?:to|onto|on|back to)\\s+(?:the\\s+)?${label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g') : phrasePattern(label);
    destinationPatterns.push([id as DestinationId, pattern]);
  }
  const destinations = [...new Set(destinationPatterns.filter(([, pattern]) => pattern.test(command)).map(([id]) => id))];
  if (destinations.length > 1) return { ...base, summary: 'Please clarify the object-to-destination assignment.', error: 'This command names multiple destinations. Give one destination per command, or use the environment’s named assignment.' };
  destination = destinations[0];
  if (!destination && !isSort) return { ...base, summary: 'Please choose a destination.', error: `Which destination: ${destinationName('tray-a')}, ${destinationName('tray-b')}, or ${destinationName('reject')}?` };

  // Refuse unknown nouns even when a second, known object appears in the request.
  let ungrounded = unnamedCommand;
  for (const [, pattern] of destinationPatterns) { pattern.lastIndex = 0; ungrounded = ungrounded.replace(pattern, ' '); }
  ungrounded = ungrounded.replace(/\b(red|blue|green)(?:\s+(?:blocks?|parts?|cubes?)(?:\s+\d+)?)?\b/g, ' ')
    .replace(/\b(move|put|place|transfer|take|bring|send|return|sort|prepare|pack|collect|clear|all|everything|every|parts?|objects?|blocks?|cubes?|the|a|an|and|to|into|onto|on|in|from|back|please|can|could|you|robot|tray|table|worktable|counter|leave|except|excluding|skip)\b/g, ' ')
    .replace(/[\s,.!?;:]/g, '');
  if (ungrounded) return { ...base, summary: 'The request contains an unknown object or action.', error: 'Use the object labels and destination labels visible in this scene, or its named assignment. No partial action was planned.' };

  return buildPlan(selected.map(object => ({ object, target: destination ?? (hasColor(object, 'blue') ? 'tray-b' : 'tray-a') })));
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
  // Explicit scenario interlock only: no tracked human, contact model or safety certification.
  if (source.humanPresence?.state === 'in-workspace') return {
    world: { ...source, robot: { ...source.robot, mode: 'paused', phase: 'Human workspace scenario: awaiting clearance' } },
    done: false,
    blocked: 'Human workspace scenario is occupied. Clear the scenario, then explicitly resume.',
  };
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
