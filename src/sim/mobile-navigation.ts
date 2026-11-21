export type MobilePoint = [number, number]; // Floor x/z, in simulated meters.
export type MobileStationId = 'counter' | 'table' | 'sink' | 'home';
export type MobileMode = 'idle' | 'running' | 'paused' | 'stopped' | 'error';
export interface MobileObstacle { id: string; label: string; minX: number; maxX: number; minZ: number; maxZ: number }
export interface MobileStation { id: MobileStationId; label: string; dock: MobilePoint; surface: MobilePoint; height: number }
export interface MobileObject {
  id: string; label: string; position: MobilePoint; height: number;
  station: MobileStationId | 'robot'; status: 'ready' | 'loading' | 'carried' | 'unloading' | 'delivered';
}
export type MobileStep =
  | { kind: 'navigate'; stationId: MobileStationId; label: string; path: MobilePoint[] }
  | { kind: 'reach-check' | 'pickup' | 'place'; stationId: MobileStationId; objectId: string; label: string };
export interface MobilePlan {
  id: string; worldRevision: number; command: string; summary: string; rationale: string[]; steps: MobileStep[]; confirmationRequired: boolean;
  goal?: { objectId?: string; stationId: MobileStationId }; error?: string; control?: 'pause' | 'resume' | 'stop' | 'reset';
}
export interface MobileWorld {
  schema: 'teachtrace.mobile-kitchen.v1'; seed: number; simTime: number; revision: number; distanceTravelled: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; cellSize: number;
  obstacles: MobileObstacle[]; stations: MobileStation[]; objects: MobileObject[];
  robot: { position: MobilePoint; yaw: number; radius: number; speed: number; armReach: number; mode: MobileMode; phase: string; cargoObjectId: string | null };
  human: { position: MobilePoint; radius: number; source: 'scenario-proxy' } | null;
  mission: { plan: MobilePlan; stepIndex: number; waypointIndex: number; phaseElapsed: number;
    handlingStart?: { position: MobilePoint; height: number }; completedSteps: number; status: 'running' | 'completed' | 'stopped' | 'failed' } | null;
  events: { time: number; kind: 'navigate' | 'reach-check' | 'pickup' | 'place' | 'control' | 'blocked' | 'goal'; message: string }[];
  simulation: { type: 'deterministic-floor-navigation'; contactDynamics: false; slam: false; learnedPolicy: false; limitations: string[] };
}
export interface MobileAdvanceResult { world: MobileWorld; done: boolean; error?: string; blocked?: string }
export interface MobileGoalCheck { id: string; name: string; passed: boolean; detail: string }

const CARRY_HEIGHT = 1.0;
const HANDLING_SECONDS = 1.2;
const EPSILON = 0.000001;
const distance = (a: MobilePoint, b: MobilePoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const copy = (world: MobileWorld): MobileWorld => structuredClone(world);
function event(world: MobileWorld, kind: MobileWorld['events'][number]['kind'], message: string) {
  world.events.push({ time: world.simTime, kind, message });
  world.events = world.events.slice(-100);
}

export function createMobileKitchen(seed = 0): MobileWorld {
  const selectedSeed = Number.isSafeInteger(seed) ? seed : 0;
  const offset = selectedSeed === 0 ? 0 : (((selectedSeed % 3 + 3) % 3) - 1) * 0.25;
  return {
    schema: 'teachtrace.mobile-kitchen.v1', seed: selectedSeed, simTime: 0, revision: 0, distanceTravelled: 0,
    bounds: { minX: -4.5, maxX: 4.5, minZ: -3.5, maxZ: 3.5 }, cellSize: 0.5,
    obstacles: [
      { id: 'counter-unit', label: 'Counter', minX: -4, maxX: -2, minZ: -3.2, maxZ: -2.2 },
      { id: 'table-island', label: 'Table', minX: offset, maxX: 2 + offset, minZ: -0.6, maxZ: 0.6 },
      { id: 'sink-unit', label: 'Sink', minX: 2, maxX: 4, minZ: -3.2, maxZ: -2.2 },
    ],
    stations: [
      { id: 'counter', label: 'Counter', dock: [-3, -1.5], surface: [-3, -2.65], height: 0.95 },
      { id: 'table', label: 'Table', dock: [1 + offset, 1.2], surface: [1 + offset, 0], height: 0.85 },
      { id: 'sink', label: 'Sink', dock: [3, -1.5], surface: [3, -2.65], height: 0.95 },
      { id: 'home', label: 'Home', dock: [-3, 2.5], surface: [-3, 2.5], height: 0 },
    ],
    objects: [
      { id: 'cup', label: 'Cup', position: [-3.2, -2.65], height: 0.95, station: 'counter', status: 'ready' },
      { id: 'bowl', label: 'Bowl', position: [-2.8, -2.65], height: 0.95, station: 'counter', status: 'ready' },
    ],
    robot: { position: [-3, 2.5], yaw: Math.PI, radius: 0.27, speed: 0.8, armReach: 1.35, mode: 'idle', phase: 'Ready at home', cargoObjectId: null },
    human: null, mission: null, events: [],
    simulation: { type: 'deterministic-floor-navigation', contactDynamics: false, slam: false, learnedPolicy: false,
      limitations: ['Known floor map and deterministic geometric routing; no SLAM or sensor perception.', 'Interpolated idealized station handoffs and attached cargo; no contact dynamics or grasp-force validation.', 'Human obstruction is an explicit software scenario, not human tracking or physical safety certification.'] },
  };
}

function pointAllowed(world: MobileWorld, point: MobilePoint): boolean {
  const { bounds: b, robot: r } = world;
  return point.every(Number.isFinite) && point[0] >= b.minX + r.radius && point[0] <= b.maxX - r.radius
    && point[1] >= b.minZ + r.radius && point[1] <= b.maxZ - r.radius;
}

function hitsRectangle(a: MobilePoint, b: MobilePoint, obstacle: MobileObstacle, clearance: number): boolean {
  let low = 0, high = 1;
  const minimum = [obstacle.minX - clearance, obstacle.minZ - clearance];
  const maximum = [obstacle.maxX + clearance, obstacle.maxZ + clearance];
  for (let axis = 0; axis < 2; axis++) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < EPSILON) { if (a[axis] < minimum[axis] || a[axis] > maximum[axis]) return false; }
    else {
      const first = (minimum[axis] - a[axis]) / delta, second = (maximum[axis] - a[axis]) / delta;
      low = Math.max(low, Math.min(first, second)); high = Math.min(high, Math.max(first, second));
      if (low > high) return false;
    }
  }
  return true;
}

export function mobileSegmentIsClear(world: MobileWorld, start: MobilePoint, end: MobilePoint): boolean {
  return pointAllowed(world, start) && pointAllowed(world, end)
    && !world.obstacles.some(obstacle => hitsRectangle(start, end, obstacle, world.robot.radius + 0.03));
}

/** Bounded deterministic A* over the known map, followed by collision-checked path shortening. */
export function findMobileRoute(world: MobileWorld, start: MobilePoint, goal: MobilePoint): MobilePoint[] | null {
  if (!mobileSegmentIsClear(world, start, start) || !mobileSegmentIsClear(world, goal, goal)) return null;
  if (mobileSegmentIsClear(world, start, goal)) return [[...start], [...goal]];
  const { bounds, cellSize } = world;
  if (!Number.isFinite(cellSize) || cellSize < 0.25 || cellSize > 1) return null;
  const width = Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1;
  const height = Math.floor((bounds.maxZ - bounds.minZ) / cellSize) + 1;
  if (width * height > 1600 || width < 1 || height < 1) return null;
  const points = Array.from({ length: width * height }, (_, id): MobilePoint => [bounds.minX + (id % width) * cellSize, bounds.minZ + Math.floor(id / width) * cellSize]);
  const free = points.map(point => mobileSegmentIsClear(world, point, point));
  const nearest = (point: MobilePoint) => points.map((candidate, id) => ({ id, d: distance(point, candidate) }))
    .filter(({ id }) => free[id] && mobileSegmentIsClear(world, point, points[id])).sort((a, b) => a.d - b.d || a.id - b.id)[0]?.id;
  const origin = nearest(start), target = nearest(goal);
  if (origin === undefined || target === undefined) return null;
  const open = new Set([origin]), closed = new Set<number>();
  const costs = new Map([[origin, 0]]), parents = new Map<number, number>();
  let found = false;
  while (open.size && closed.size <= 1600) {
    const current = [...open].sort((a, b) => ((costs.get(a) ?? Infinity) + distance(points[a], points[target])) - ((costs.get(b) ?? Infinity) + distance(points[b], points[target])) || a - b)[0];
    if (current === target) { found = true; break; }
    open.delete(current); closed.add(current);
    const x = current % width, z = Math.floor(current / width);
    const neighbors = [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].filter(([nx, nz]) => nx >= 0 && nx < width && nz >= 0 && nz < height).map(([nx, nz]) => nz * width + nx);
    for (const next of neighbors) {
      if (!free[next] || closed.has(next) || !mobileSegmentIsClear(world, points[current], points[next])) continue;
      const cost = (costs.get(current) ?? Infinity) + cellSize;
      if (cost < (costs.get(next) ?? Infinity)) { costs.set(next, cost); parents.set(next, current); open.add(next); }
    }
  }
  if (!found) return null;
  const ids = [target]; while (ids[0] !== origin) { const previous = parents.get(ids[0]); if (previous === undefined) return null; ids.unshift(previous); }
  const raw = [[...start] as MobilePoint, ...ids.map(id => points[id]), [...goal] as MobilePoint];
  const result: MobilePoint[] = [raw[0]];
  let index = 0;
  while (index < raw.length - 1) {
    let next = raw.length - 1;
    while (next > index + 1 && !mobileSegmentIsClear(world, raw[index], raw[next])) next--;
    result.push([...raw[next]]); index = next;
  }
  return result;
}

export function planMobileTask(text: string, world: MobileWorld): MobilePlan {
  const command = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  const base: MobilePlan = { id: `mobile-${world.revision}-${command.replace(/\W+/g, '-').slice(0, 80)}`, worldRevision: world.revision, command: text, summary: '', rationale: [], steps: [], confirmationRequired: false };
  const controls = { pause: 'pause', resume: 'resume', continue: 'resume', stop: 'stop', abort: 'stop', reset: 'reset' } as const;
  if (Object.hasOwn(controls, command)) return { ...base, summary: `${command} mobile mission`, control: controls[command as keyof typeof controls], confirmationRequired: command === 'reset' };
  const destinationMatches = [...command.matchAll(/\b(?:to|into|onto)\s+(?:the\s+)?(counter|table|sink|home|dock)\b/g)].map(match => match[1] === 'dock' ? 'home' : match[1]);
  if (/^(?:return|go|navigate)(?: to)? home$/.test(command)) destinationMatches.push('home');
  const destinations = [...new Set(destinationMatches)];
  if (destinations.length !== 1) return { ...base, summary: 'Choose one destination.', error: 'Name one destination: counter, table, sink, or home.' };
  const destination = world.stations.find(station => station.id === destinations[0]);
  if (!destination) return { ...base, summary: 'Unknown station.', error: 'The destination station is not available.' };
  const objects = world.objects.filter(object => new RegExp(`\\b${object.id}\\b`, 'i').test(command) || new RegExp(`\\b${object.label}\\b`, 'i').test(command));
  const remainder = command.replace(/\b(take|bring|carry|deliver|move|transport|pick|up|place|put|go|navigate|drive|return|please|the|a|an|robot|mobile|kitchen|from|to|into|onto|counter|table|sink|home|dock|cup|bowl)\b/g, '').replace(/[\s,]/g, '');
  if (remainder || objects.length > 1) return { ...base, summary: 'Clarify the mobile task.', error: 'Use one known object at a time and one named station, for example “Take cup from counter to sink”.' };
  const steps: MobileStep[] = [];
  let position: MobilePoint = [...world.robot.position];
  const navigate = (station: MobileStation) => {
    const path = findMobileRoute(world, position, station.dock);
    if (!path) return false;
    steps.push({ kind: 'navigate', stationId: station.id, label: `Navigate to ${station.label}`, path }); position = [...station.dock]; return true;
  };
  const object = objects[0];
  if (object) {
    const reach = mobileObjectReach(world, object.id);
    base.rationale.push(reach.reachable ? `${object.label} is currently within the ${reach.armReach.toFixed(2)} m arm reach.`
      : `${object.label} is ${reach.distance.toFixed(2)} m away, beyond the ${reach.armReach.toFixed(2)} m stationary arm reach.`);
    base.rationale.push(world.robot.cargoObjectId === object.id ? 'The object is already on the carrier; route directly to the delivery dock and place it on the requested surface.'
      : 'Route the mobile base to the pickup dock, recheck actual arm reach, then collect and carry the object to the requested surface.');
    if (destination.id === 'home') return { ...base, summary: 'Choose a delivery surface.', error: 'Deliver objects to counter, table, or sink; home is a robot parking station.' };
    if (world.robot.cargoObjectId && world.robot.cargoObjectId !== object.id) return { ...base, summary: 'Another object is on the carrier.', error: 'Deliver the currently carried object before collecting another.' };
    if (object.station === destination.id && !world.robot.cargoObjectId) return { ...base, summary: 'Object already delivered.', error: `${object.label} is already at ${destination.label}.` };
    const source = world.stations.find(station => station.id === object.station);
    const explicitSource = command.match(/\bfrom\s+(?:the\s+)?(counter|table|sink)\b/)?.[1];
    if (explicitSource && source?.id !== explicitSource) return { ...base, summary: 'The stated source does not match the scene.', error: `${object.label} is currently at ${source?.label ?? 'the robot carrier'}.` };
    if (!world.robot.cargoObjectId) {
      if (!source || !navigate(source)) return { ...base, summary: 'No clear route to the object.', error: 'The known floor map has no collision-free route to the pickup station.' };
      steps.push({ kind: 'reach-check', stationId: source.id, objectId: object.id, label: `Recheck ${object.label} within arm reach` });
      steps.push({ kind: 'pickup', stationId: source.id, objectId: object.id, label: `Collect ${object.label} at ${source.label}` });
    }
    if (!navigate(destination)) return { ...base, summary: 'No clear delivery route.', error: 'The known floor map has no collision-free route to the delivery station.' };
    steps.push({ kind: 'place', stationId: destination.id, objectId: object.id, label: `Deliver ${object.label} to ${destination.label}` });
  } else {
    if (!/^(?:please )?(?:(?:go|navigate|drive|return|move) to (?:the )?(?:counter|table|sink|home|dock)|(?:return|go|navigate)(?: to)? home)$/.test(command)) return { ...base, summary: 'Name an object to carry.', error: 'Choose Cup or Bowl, or ask the robot to navigate to a station.' };
    if (!navigate(destination)) return { ...base, summary: 'No clear route.', error: 'The known floor map has no collision-free route to the station.' };
  }
  return { ...base, summary: steps.map(step => step.label).join(' → '), steps, goal: { ...(object ? { objectId: object.id } : {}), stationId: destination.id } };
}

export function mobileObjectReach(world: MobileWorld, objectId: string): { distance: number; armReach: number; reachable: boolean } {
  const object = world.objects.find(item => item.id === objectId);
  const measured = object ? Math.hypot(distance(world.robot.position, object.position), CARRY_HEIGHT - object.height) : Infinity;
  return { distance: measured, armReach: world.robot.armReach, reachable: measured <= world.robot.armReach };
}

export function startMobilePlan(source: MobileWorld, plan: MobilePlan, approvalSource: 'manual' | 'automatic' | 'evaluation' | 'immediate' = 'manual'): MobileAdvanceResult {
  if (plan.error || plan.control || !plan.goal || !plan.steps.length || plan.worldRevision !== source.revision
    || ['running', 'paused'].includes(source.robot.mode)) return { world: source, done: false, error: 'The mobile plan is invalid, stale, or another mission is active. Prepare a fresh plan before approval.' };
  const world = copy(source);
  world.mission = { plan: structuredClone(plan), stepIndex: 0, waypointIndex: 1, phaseElapsed: 0, completedSteps: 0, status: 'running' };
  world.robot.mode = 'running'; world.robot.phase = plan.steps[0].label;
  event(world, 'control', approvalSource === 'immediate' ? 'Operator command started immediate local simulation; no separate approval or cancellation window.' : approvalSource === 'automatic' ? 'Reversible simulation task automatically approved after the visible cancellation window.' : approvalSource === 'evaluation' ? 'Evaluation controller started the submitted candidate; no human approval is asserted.' : 'Operator explicitly approved the mobile task.');
  return { world, done: false };
}

function humanBlocks(world: MobileWorld, end: MobilePoint): boolean {
  const human = world.human;
  if (!human) return false;
  const start = world.robot.position, dx = end[0] - start[0], dz = end[1] - start[1];
  const squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((human.position[0] - start[0]) * dx + (human.position[1] - start[1]) * dz) / squared)) : 0;
  return distance(human.position, [start[0] + dx * t, start[1] + dz * t]) <= world.robot.radius + human.radius + 0.05;
}

export function advanceMobileWorld(source: MobileWorld, dt: number): MobileAdvanceResult {
  if (source.mission?.status === 'completed') return { world: source, done: true };
  if (source.robot.mode !== 'running' || !source.mission || !Number.isFinite(dt) || dt <= 0) return { world: source, done: false };
  const world = copy(source), mission = world.mission!;
  let remaining = Math.min(dt, 1);
  for (let transitions = 0; remaining > EPSILON && transitions < 32; transitions++) {
    const step = mission.plan.steps[mission.stepIndex];
    if (!step) break;
    const station = world.stations.find(item => item.id === step.stationId)!;
    const fail = (error: string): MobileAdvanceResult => {
      world.robot.mode = 'error'; world.robot.phase = error; mission.status = 'failed'; event(world, 'blocked', error);
      return { world, done: true, error };
    };
    if (!station) return fail('The mobile station is missing. Replan from the current scene.');
    let next: MobilePoint = [...world.robot.position];
    let spent = 0, complete = false;
    if (step.kind === 'navigate') {
      let waypoint = step.path[mission.waypointIndex];
      if (!waypoint) { complete = true; }
      else {
        if (!mobileSegmentIsClear(world, world.robot.position, waypoint)) {
          const route = findMobileRoute(world, world.robot.position, station.dock);
          if (!route) return fail('The floor route is blocked by a static obstacle. No movement was applied to that segment.');
          step.path = route; mission.waypointIndex = 1; waypoint = route[1];
        }
        const length = distance(world.robot.position, waypoint);
        if (length <= EPSILON) { mission.waypointIndex++; continue; }
        const speed = Number.isFinite(world.robot.speed) ? Math.max(0.1, Math.min(world.robot.speed, 1.5)) : 0.8;
        const travel = Math.min(length, remaining * speed);
        next = [world.robot.position[0] + (waypoint[0] - world.robot.position[0]) * travel / length, world.robot.position[1] + (waypoint[1] - world.robot.position[1]) * travel / length];
        spent = travel / speed;
      }
    } else {
      if (station.id === 'home' && (step.kind === 'pickup' || step.kind === 'place')) return fail('Home is a robot parking station, not an object pickup or delivery surface.');
      if (step.kind !== 'reach-check' && distance(world.robot.position, station.dock) > 0.05) return fail('The robot is not docked at the handling station.');
      const object = world.objects.find(item => item.id === step.objectId);
      if (!object || (step.kind === 'pickup' && (world.robot.cargoObjectId || object.station !== station.id))
        || (step.kind === 'place' && world.robot.cargoObjectId !== object.id)) return fail('The object or carrier state changed. Replan the mobile task.');
      if ((step.kind === 'reach-check' || step.kind === 'pickup') && !mobileObjectReach(world, object.id).reachable) return fail('The pickup object is beyond arm reach at the current base pose. Reposition or change the scene before retrying.');
      const placementSlot = world.objects.findIndex(item => item.id === object.id);
      const placementTarget: MobilePoint = [station.surface[0] + (placementSlot === 0 ? -0.14 : 0.14), station.surface[1]];
      if (step.kind === 'place' && Math.hypot(distance(world.robot.position, placementTarget), CARRY_HEIGHT - station.height) > world.robot.armReach) return fail('The delivery surface remains beyond arm reach from this dock.');
      spent = Math.min(remaining, (step.kind === 'reach-check' ? 0.3 : HANDLING_SECONDS) - mission.phaseElapsed);
    }
    if (humanBlocks(world, next)) {
      world.robot.mode = 'paused'; world.robot.phase = 'Human scenario obstructs the route. Clear the scenario, then explicitly resume.';
      event(world, 'blocked', world.robot.phase);
      return { world, done: false, blocked: world.robot.phase };
    }
    world.robot.phase = step.label;
    if (step.kind === 'navigate') {
      const travelled = distance(world.robot.position, next);
      if (travelled > EPSILON) world.robot.yaw = Math.atan2(next[0] - world.robot.position[0], next[1] - world.robot.position[1]);
      world.robot.position = next; world.distanceTravelled += travelled;
      if (world.robot.cargoObjectId) {
        const cargo = world.objects.find(object => object.id === world.robot.cargoObjectId)!;
        cargo.position = [...next]; cargo.height = CARRY_HEIGHT;
      }
      const waypoint = step.path[mission.waypointIndex];
      if (waypoint && distance(next, waypoint) <= EPSILON) mission.waypointIndex++;
      complete = mission.waypointIndex >= step.path.length;
    } else if (step.kind === 'reach-check') {
      mission.phaseElapsed += spent; complete = mission.phaseElapsed >= 0.3;
    } else {
      const object = world.objects.find(item => item.id === step.objectId)!;
      mission.handlingStart ??= { position: [...object.position], height: object.height };
      mission.phaseElapsed += spent;
      const t = Math.min(1, mission.phaseElapsed / HANDLING_SECONDS);
      const offset = (world.objects.findIndex(item => item.id === object.id) - (world.objects.length - 1) / 2) * 0.28;
      const target: MobilePoint = step.kind === 'pickup' ? world.robot.position : [station.surface[0] + offset, station.surface[1]];
      const height = step.kind === 'pickup' ? CARRY_HEIGHT : station.height;
      object.position = mission.handlingStart.position.map((value, index) => value + (target[index] - value) * t) as MobilePoint;
      object.height = mission.handlingStart.height + (height - mission.handlingStart.height) * t;
      object.status = step.kind === 'pickup' ? 'loading' : 'unloading';
      complete = t >= 1;
      if (complete) {
        object.station = step.kind === 'pickup' ? 'robot' : station.id;
        object.status = step.kind === 'pickup' ? 'carried' : 'delivered';
        world.robot.cargoObjectId = step.kind === 'pickup' ? object.id : null;
      }
    }
    world.simTime += spent; remaining -= spent;
    if (!complete) continue;
    event(world, step.kind, step.label + ' verified.');
    mission.completedSteps++; mission.stepIndex++; mission.waypointIndex = 1; mission.phaseElapsed = 0; delete mission.handlingStart; world.revision++;
    if (mission.stepIndex === mission.plan.steps.length) {
      mission.status = 'completed'; world.robot.mode = 'idle'; world.robot.phase = 'Mobile task completed'; event(world, 'goal', mission.plan.goal?.objectId ? 'Route and delivery goal verified.' : 'Navigation docking goal verified.');
      return { world, done: true };
    }
  }
  return { world, done: false };
}

export function setMobileHuman(source: MobileWorld, position: MobilePoint | null): MobileWorld {
  const world = copy(source);
  world.human = position && position.length === 2 && position.every(Number.isFinite) ? { position: [...position], radius: 0.4, source: 'scenario-proxy' } : null;
  world.revision++; event(world, 'control', world.human ? 'Human obstruction scenario enabled.' : 'Human scenario cleared; paused motion still requires explicit resume.');
  return world;
}

export function applyMobileControl(source: MobileWorld, control: 'pause' | 'resume' | 'stop' | 'reset'): MobileAdvanceResult {
  if (control === 'reset') return { world: createMobileKitchen(source.seed), done: false };
  const world = copy(source);
  if (control === 'pause' && world.robot.mode === 'running') { world.robot.mode = 'paused'; world.robot.phase = 'Operator paused the mobile mission'; }
  else if (control === 'resume' && world.robot.mode === 'paused' && world.mission?.status === 'running') {
    if (humanBlocks(world, world.robot.position)) return { world: source, done: false, blocked: 'Clear the human obstruction before resuming.' };
    world.robot.mode = 'running'; world.robot.phase = world.mission.plan.steps[world.mission.stepIndex]?.label ?? 'Resuming mobile mission';
  } else if (control === 'stop') {
    world.robot.mode = 'stopped'; world.robot.phase = 'Mobile mission stopped; cargo retained'; if (world.mission) world.mission.status = 'stopped';
  } else return { world: source, done: false, error: 'That control is not available in the current mobile state.' };
  world.revision++; event(world, 'control', `Operator ${control} applied.`);
  return { world, done: false };
}

export function mobileGoalChecks(world: MobileWorld): MobileGoalCheck[] {
  const goal = world.mission?.plan.goal;
  if (!goal) return [{ id: 'task-defined', name: 'Mobile goal is defined', passed: false, detail: 'Approve a grounded mobile task first.' }];
  const station = world.stations.find(item => item.id === goal.stationId);
  const object = world.objects.find(item => item.id === goal.objectId);
  const offset = object ? (world.objects.findIndex(item => item.id === object.id) - (world.objects.length - 1) / 2) * 0.28 : 0;
  return [
    { id: 'station-reached', name: `Robot reached ${station?.label ?? goal.stationId}`, passed: Boolean(station && distance(world.robot.position, station.dock) <= 0.05), detail: 'The mobile base must reach the actual station docking pose.' },
    ...(goal.objectId ? [{ id: 'object-delivered', name: `${object?.label ?? goal.objectId} delivered to ${station?.label ?? goal.stationId}`,
      passed: Boolean(object && station && station.id !== 'home' && object.station === station.id && object.status === 'delivered' && distance(object.position, [station.surface[0] + offset, station.surface[1]]) < 0.02 && Math.abs(object.height - station.height) < 0.02),
      detail: 'A delivery requires Counter, Table or Sink; object station metadata, final surface position and support height must agree.' }] : []),
    { id: 'controller-settled', name: goal.objectId ? 'Mobile controller settled with empty carrier' : 'Mobile controller settled at navigation destination', passed: world.robot.mode === 'idle' && (!goal.objectId || world.robot.cargoObjectId === null) && world.mission?.status === 'completed', detail: goal.objectId ? 'A delivery requires a completed mission, settled base and empty carrier.' : 'Navigation requires a completed mission and settled base at its dock. Cargo may remain carried; no object release or delivery is asserted.' },
  ];
}
