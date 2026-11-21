/** Locally authored sample collection procedures, not customer or external enterprise records. */
const source = 'RoboTrace demo collection SOP';
const revision = '1.0';
const boundaries = 'This is an idealized kinematic simulator with idealized attachment grasps. It records simulated motion, not measured contact forces, a trained robot policy, or real-world deployment evidence. Never claim physical robustness, physical safety certification, or policy learning.';
const commonAcceptance = [
  'Each requested object occupies its assigned destination within the simulated destination bounds',
  'Unrequested objects retain their original pose and state',
  'The controller is idle, with no active motion and no object held',
  'No motion, reach, or placement occupancy validation error occurred',
];
const reviewInstructions = 'Retrieve the current scene and ground object IDs before acting. In the current immediate local simulation console, a supported requested task starts without approval or a countdown. The activity terminal reports the plan, execution, checks and errors. Pause, resume, stop and requested reset remain available. Record outcomes and use a direct save or export action; saved evidence remains unreviewed unless a separate real review is recorded. A running receipt is not completion: retrieve fresh state and use verified outcome checks.';

const assignment = (objectId, objectLabel, destination, destinationLabel, unchanged = false) => ({
  objectId, objectLabel, destination, destinationLabel, unchanged,
});

const guides = new Map([
  ['workbench', {
    id: 'TT-REPAIR-001', environmentId: 'workbench', title: 'Repair kit collection demonstration',
    command: 'Prepare repair kit',
    instructions: `Use “Prepare repair kit” to place Red block and Green block in Repair kit, and Blue block in Spare parts. ${reviewInstructions}`,
    assignments: [
      assignment('part-red', 'Red block', 'tray-a', 'Repair kit'),
      assignment('part-blue', 'Blue block', 'tray-b', 'Spare parts'),
      assignment('part-green', 'Green block', 'tray-a', 'Repair kit'),
    ],
    acceptance: ['Red block and Green block are in Repair kit', 'Blue block is in Spare parts', ...commonAcceptance],
  }],
  ['kitchen', {
    id: 'TT-KITCHEN-001', environmentId: 'kitchen', title: 'Counter clearing collection demonstration',
    command: 'Clear the counter',
    instructions: `Use “Clear the counter” to place Cup and Utensil case in Serving tray, and Bowl in Storage tray. Move only these rigid simulated objects; the named command is a fixed collection assignment. ${reviewInstructions}`,
    assignments: [
      assignment('part-red', 'Utensil case', 'tray-a', 'Serving tray'),
      assignment('part-blue', 'Cup', 'tray-a', 'Serving tray'),
      assignment('part-green', 'Bowl', 'tray-b', 'Storage tray'),
    ],
    acceptance: ['Cup and Utensil case are in Serving tray', 'Bowl is in Storage tray', 'No task object remains on Kitchen counter', ...commonAcceptance],
  }],
  ['lab', {
    id: 'TT-LAB-001', environmentId: 'lab', title: 'Sample routing collection demonstration',
    command: 'Route the samples',
    instructions: `Use “Route the samples” to place Sample alpha in Rack A and Sample beta in Rack B. Leave Reference sample untouched on Sample bench: do not pick it, move it, or change its state. These are rigid simulated sample carriers. ${reviewInstructions}`,
    assignments: [
      assignment('part-red', 'Sample alpha', 'tray-a', 'Rack A'),
      assignment('part-blue', 'Sample beta', 'tray-b', 'Rack B'),
      assignment('part-green', 'Reference sample', 'table', 'Sample bench', true),
    ],
    acceptance: ['Sample alpha is in Rack A', 'Sample beta is in Rack B', 'Reference sample retains its original Sample bench pose and state', ...commonAcceptance],
  }],
]);

const fallback = {
  id: 'TT-PICK-001', environmentId: 'custom', title: 'Rigid-object sorting demonstration',
  command: null,
  instructions: `Move requested objects into the explicitly named destination. Leave unrequested objects unchanged. Do not apply a workplace-specific assignment to an unknown or custom scene. Ask which visible object or destination the operator means when a reference is ambiguous. ${reviewInstructions}`,
  assignments: [],
  acceptance: [...commonAcceptance],
};

const mobileBoundaries = 'This is a locally authored mobile-kitchen simulation procedure. The base follows a known floor map with deterministic geometric routing; the arm uses idealized station handoffs and attached cargo. No SLAM, sensor perception, contact dynamics, washing, learned policy, physical safety certification or real-robot transfer is demonstrated. A human obstruction is a software scenario proxy.';
const mobileUnavailable = {
  id: 'TT-MOBILE-UNVERIFIED', environmentId: 'mobile-kitchen', title: 'Mobile kitchen context needs verification', command: null,
  instructions: 'The mobile scene did not provide a supported bounded Cup/Bowl inventory and Counter/Table/Sink/Home station map. Retrieve fresh context or ask the operator to reopen the mobile kitchen. Do not apply a tabletop tray procedure, invent labels, or assert delivery from this context.',
  assignments: [], acceptance: ['Refresh and validate the current mobile scene before preparing an executable task'],
};

/** Return an isolated procedure selected by exact environment ID; unknown scenes use generic rules. */
export function taskGuideForEnvironment(environmentId) {
  return structuredClone({
    ...(environmentId === 'mobile-kitchen' ? mobileUnavailable : guides.get(environmentId) ?? fallback),
    source, sourceKind: 'locally-authored-sample', revision, boundaries: environmentId === 'mobile-kitchen' ? mobileBoundaries : boundaries,
  });
}

const customId = /^custom-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, limit) => typeof value === 'string' && Boolean(value.trim()) && value.length <= limit;
const objectId = value => typeof value === 'string' && /^[a-z][a-z\d-]{0,39}$/.test(value);
const destinationIds = ['tray-a', 'tray-b', 'reject', 'table'];

/** Recognize only the supported mobile demo contract, never arbitrary client-provided SOP text. */
function mobileTaskGuide(world) {
  const reject = () => taskGuideForEnvironment('mobile-kitchen');
  if (!record(world) || world.schema !== 'teachtrace.mobile-kitchen.v1' || world.environmentId !== 'mobile-kitchen'
    || !record(world.bounds) || !record(world.robot) || !record(world.simulation)
    || world.simulation.type !== 'deterministic-floor-navigation' || world.simulation.contactDynamics !== false
    || world.simulation.slam !== false || world.simulation.learnedPolicy !== false) return reject();
  const b = world.bounds, robot = world.robot;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  if (![b.minX, b.maxX, b.minZ, b.maxZ].every(value => finite(value) && Math.abs(value) <= 10)
    || b.maxX - b.minX < 2 || b.maxX - b.minX > 12 || b.maxZ - b.minZ < 2 || b.maxZ - b.minZ > 12
    || !finite(world.cellSize) || world.cellSize < 0.25 || world.cellSize > 1
    || (Math.floor((b.maxX - b.minX) / world.cellSize) + 1) * (Math.floor((b.maxZ - b.minZ) / world.cellSize) + 1) > 1600
    || !finite(world.simTime) || world.simTime < 0 || !Number.isSafeInteger(world.revision) || world.revision < 0
    || !finite(world.distanceTravelled) || world.distanceTravelled < 0) return reject();
  const point = value => Array.isArray(value) && value.length === 2 && value.every(finite)
    && value[0] >= b.minX && value[0] <= b.maxX && value[1] >= b.minZ && value[1] <= b.maxZ;
  if (!point(robot.position) || !finite(robot.radius) || robot.radius < 0.1 || robot.radius > 0.6
    || robot.position[0] < b.minX + robot.radius || robot.position[0] > b.maxX - robot.radius
    || robot.position[1] < b.minZ + robot.radius || robot.position[1] > b.maxZ - robot.radius
    || !finite(robot.speed) || robot.speed <= 0 || robot.speed > 3 || !finite(robot.armReach) || robot.armReach < 0.3 || robot.armReach > 2
    || !finite(robot.yaw) || !['idle', 'running', 'paused', 'stopped', 'error'].includes(robot.mode)
    || ![null, 'cup', 'bowl'].includes(robot.cargoObjectId)) return reject();
  const stationLabels = { counter: 'Counter', table: 'Table', sink: 'Sink', home: 'Home' };
  if (!Array.isArray(world.stations) || world.stations.length !== 4 || new Set(world.stations.map(station => station?.id)).size !== 4
    || !world.stations.every(station => record(station) && Object.hasOwn(stationLabels, station.id) && station.label === stationLabels[station.id]
      && point(station.dock) && point(station.surface) && finite(station.height) && station.height >= 0 && station.height <= 1.5)) return reject();
  if (!Array.isArray(world.obstacles) || world.obstacles.length > 16 || !world.obstacles.every(obstacle => record(obstacle)
    && [obstacle.minX, obstacle.maxX, obstacle.minZ, obstacle.maxZ].every(finite)
    && obstacle.minX >= b.minX && obstacle.maxX <= b.maxX && obstacle.minZ >= b.minZ && obstacle.maxZ <= b.maxZ
    && obstacle.minX < obstacle.maxX && obstacle.minZ < obstacle.maxZ)) return reject();
  if (world.human !== null && (!record(world.human) || !point(world.human.position) || world.human.source !== 'scenario-proxy'
    || !finite(world.human.radius) || world.human.radius <= 0 || world.human.radius > 1)) return reject();
  const objectLabels = { cup: 'Cup', bowl: 'Bowl' };
  if (!Array.isArray(world.objects) || world.objects.length !== 2 || new Set(world.objects.map(object => object?.id)).size !== 2
    || !world.objects.every((object, index) => {
      if (!record(object) || !Object.hasOwn(objectLabels, object.id) || object.label !== objectLabels[object.id] || !point(object.position)
        || !finite(object.height) || object.height < 0 || object.height > 1.5
        || ![...Object.keys(stationLabels), 'robot'].includes(object.station)
        || !['ready', 'loading', 'carried', 'unloading', 'delivered'].includes(object.status)) return false;
      const station = world.stations.find(item => item.id === object.station);
      if (object.status === 'ready' || object.status === 'delivered') {
        if (!station || Math.abs(object.height - station.height) > 0.03) return false;
        const offset = object.status === 'delivered' ? (index - 0.5) * 0.28 : 0;
        if (Math.hypot(object.position[0] - station.surface[0] - offset, object.position[1] - station.surface[1]) > (object.status === 'delivered' ? 0.03 : 0.6)) return false;
      }
      if (object.status === 'carried' && (object.station !== 'robot' || robot.cargoObjectId !== object.id
        || Math.hypot(object.position[0] - robot.position[0], object.position[1] - robot.position[1]) > 0.03 || Math.abs(object.height - 1) > 0.03)) return false;
      if (object.status === 'loading' && (!station || robot.cargoObjectId !== null)) return false;
      if (object.status === 'unloading' && (object.station !== 'robot' || robot.cargoObjectId !== object.id)) return false;
      return object.station !== 'robot' || ['carried', 'unloading'].includes(object.status);
    }) || world.objects.filter(object => ['loading', 'carried', 'unloading'].includes(object.status)).length > 1
    || (robot.cargoObjectId !== null && !world.objects.some(object => object.id === robot.cargoObjectId && object.station === 'robot'))) return reject();
  if (world.sandboxMode === 'persistent') return {
    id: 'TT-MOBILE-KITCHEN-001', environmentId: 'mobile-kitchen', title: 'Persistent kitchen sandbox', command: null, assignments: [],
    instructions: 'There is no default collection assignment. Follow only the latest explicit user instruction using current object locations. Go to Sink/Table/Counter/Home is navigation only and never implies pickup or release. Pick up Cup holds it; Carry Cup to Sink keeps it held; Put Cup in Sink releases it. Do not replace navigation with a sample cup delivery. Stop immediately cancels motion and queued tasks while preserving cargo. Ask one clarification for ambiguous or unsupported actions; do not invent washing, cooking or opening cabinets. Report only fresh executionReceipt checks. A running task is not a completed delivery. Save/export remain unreviewed operator actions.',
    acceptance: ['The user-requested action alone determines the goal', 'Navigation does not collect or release objects', 'Pickup/carry preserves custody until an explicit placement', 'Unrequested objects remain unchanged', 'Stop halts current motion and clears queued work'],
    rationale: world.objects.map(object => `${object.label} is currently at ${stationLabels[object.station] ?? 'Robot carrier'}; ${Math.hypot(object.position[0] - robot.position[0], object.position[1] - robot.position[1], 1 - object.height).toFixed(2)} m from the arm origin with ${robot.armReach.toFixed(2)} m reach.`),
    reachContext: null,
    supportedCommands: ['Go to Sink', 'Go to Counter', 'Go to Table', 'Go Home', 'Pick up cup', 'Carry cup to sink', 'Put cup in sink', 'Take cup from counter to sink', 'Bring bowl to table', 'pause', 'resume', 'stop', 'human enter', 'human clear'],
    source: 'RoboTrace explicit-action sandbox procedure', sourceKind: 'locally-authored-sample', revision, boundaries: mobileBoundaries,
  };
  const cup = world.objects.find(object => object.id === 'cup'), bowl = world.objects.find(object => object.id === 'bowl');
  const cupDone = cup.station === 'sink' && cup.status === 'delivered';
  const bowlDone = bowl.station === 'table' && bowl.status === 'delivered';
  const selected = !cupDone && cup.station !== 'sink' ? cup : !bowlDone && bowl.station !== 'table' ? bowl : null;
  const target = selected?.id === 'cup' ? 'sink' : 'table';
  const command = !selected ? null : selected.id === 'cup'
    ? selected.station === 'counter' ? 'Take cup from counter to sink' : 'Take cup to sink'
    : 'Bring bowl to table';
  const measured = selected ? Math.hypot(selected.position[0] - robot.position[0], selected.position[1] - robot.position[1], 1 - selected.height) : null;
  const rationale = selected ? [
    `${selected.label} is ${measured.toFixed(2)} simulated meters from the modeled arm origin; the current geometric arm limit is ${robot.armReach.toFixed(2)} meters.`,
    measured > robot.armReach ? 'The current base pose is outside arm reach. Navigate to the pickup station before rechecking reach and collecting the object.' : 'The object is within the current geometric arm envelope; the actual planner still checks docking and pickup reach.',
    selected.station === 'robot' ? 'The selected object is already on the carrier. Follow the returned delivery route and release checks; do not collect it again.'
      : 'Use the planner-returned route, then recheck reach, pick up the object, navigate to the delivery station, and verify release and final docking.',
  ] : [cupDone && bowlDone ? 'Cup has been delivered to Sink and Bowl to Table in the supplied scene. Ask for a new explicit task; do not replay an already satisfied delivery.'
    : 'The sample objects already occupy their target stations, but this alone is not a verified execution receipt. Ask for a new explicit task instead of inventing another delivery.'];
  return {
    id: 'TT-MOBILE-KITCHEN-001', environmentId: 'mobile-kitchen', title: 'Mobile kitchen collection and delivery demonstration', command,
    instructions: `Use exact visible objects Cup and Bowl and stations Counter, Table, Sink, Home. ${command ? `The next demonstration command is “${command}”.` : 'No additional sample transport is requested from the current target stations; inspect a fresh receipt before claiming completion.'} ${rationale.join(' ')} Use Navigate → Recheck reach → Collect → Navigate → Deliver as applicable; do not use tabletop tray names. A running or paused mission must be handled before preparing another task. Explain the tool-returned reasoning and plannedActions, not a guessed route. Current local simulation tasks execute immediately without approval or a countdown. The activity terminal reports the actual plan rationale and events. A command can return completed:false with status:running; this does not verify delivery. Report completion only from a fresh executionReceipt with status:succeeded, verified:true and passed checks; summarize its actual placements. Requested reset is immediate. Saving and export are direct UI actions; saving does not assert human quality review.`,
    assignments: selected ? world.objects.map(object => assignment(object.id, object.label, object.id === selected.id ? target : object.station,
      object.id === selected.id ? stationLabels[target] : stationLabels[object.station] ?? 'Robot carrier', object.id !== selected.id)) : [],
    acceptance: [
      'The mobile base reaches the requested station dock in the supplied known floor map',
      'For a delivery, object station, final surface position and support height agree with the target',
      'The mobile controller is idle and its mission completed; delivery leaves the carrier empty',
      'Unrequested objects retain their initial pose and state',
      'A human-obstruction pause stays held until clearance and explicit Resume',
    ],
    rationale, reachContext: selected ? { objectId: selected.id, distance: measured, armReach: robot.armReach, reachable: measured <= robot.armReach, units: 'simulated meters' } : null,
    supportedCommands: ['Take cup from counter to sink', 'Bring bowl to table', 'Go to Counter', 'Go to Table', 'Go to Sink', 'Go Home', 'pause', 'resume', 'stop', 'reset', 'human enter', 'human clear'],
    source: 'RoboTrace demo mobile-kitchen SOP', sourceKind: 'locally-authored-sample', revision, boundaries: mobileBoundaries,
  };
}

/** Validate task identity and goals before treating an authored scene as a collection assignment. */
export function taskGuideForWorld(world) {
  if (world?.environmentId === 'mobile-kitchen' || world?.schema === 'teachtrace.mobile-kitchen.v1') return mobileTaskGuide(world);
  const fallback = () => taskGuideForEnvironment(world?.environmentId);
  const task = world?.customTask;
  if (!record(world) || world.environmentId !== 'custom' || !record(task) || typeof task.id !== 'string' || !customId.test(task.id)
    || !bounded(task.title, 80) || !bounded(task.instruction, 500)
    || !Array.isArray(world.objects) || !world.objects.length || world.objects.length > 6
    || !Array.isArray(task.assignments) || task.assignments.length !== world.objects.length) return fallback();
  const ids = new Set(), labels = new Set(), goals = new Set(), capacity = new Map();
  for (const object of world.objects) {
    if (!record(object) || !objectId(object.id) || ids.has(object.id) || !bounded(object.label, 60) || labels.has(object.label.toLowerCase())) return fallback();
    ids.add(object.id); labels.add(object.label.toLowerCase());
  }
  for (const target of task.assignments) {
    if (!record(target) || !ids.has(target.objectId) || goals.has(target.objectId) || !destinationIds.includes(target.destination)
      || typeof target.unchanged !== 'boolean' || (target.unchanged && target.destination !== (world.objects.find(object => object.id === target.objectId)?.location ?? 'table'))) return fallback();
    goals.add(target.objectId);
    if (!target.unchanged && target.destination !== 'table') capacity.set(target.destination, (capacity.get(target.destination) ?? 0) + 1);
  }
  if ([...capacity.values()].some(count => count > 3) || !capacity.size) return fallback();
  const assignments = task.assignments.map(target => {
    const object = world.objects.find(item => item.id === target.objectId);
    const label = world.destinationLabels?.[target.destination];
    if (label !== undefined && !bounded(label, 80)) return null;
    return assignment(object.id, object.label, target.destination, label ?? target.destination, target.unchanged);
  });
  if (assignments.some(target => target === null)) return fallback();
  const aiAssisted = world.sceneProvenance?.source === 'ai-draft';
  const provenance = { source: aiAssisted ? 'ai-assisted-scene' : 'operator-authored-scene', review: 'operator-reviewed', baseEnvironmentId: ['workbench', 'kitchen', 'lab'].includes(world.baseEnvironmentId) ? world.baseEnvironmentId : null };
  if (aiAssisted && bounded(world.sceneProvenance?.model, 100)) provenance.model = world.sceneProvenance.model;
  const acceptance = assignments.map(target => target.unchanged
    ? `${target.objectLabel} retains its initial ${target.destinationLabel} pose and state`
    : `${target.objectLabel} occupies ${target.destinationLabel} with the expected release state and supported geometry`);
  return {
    id: task.id, environmentId: 'custom', title: task.title, command: task.instruction,
    instructions: `Use the exact reviewed scene task “${task.instruction}”. ${assignments.map(target => target.unchanged ? `Leave ${target.objectLabel} untouched on ${target.destinationLabel}.` : `Place ${target.objectLabel} in ${target.destinationLabel}.`).join(' ')} ${reviewInstructions}`,
    assignments, acceptance: [...acceptance, ...commonAcceptance], source: 'RoboTrace operator-reviewed scene SOP',
    sourceKind: aiAssisted ? 'operator-reviewed-ai-assisted-scene' : 'operator-reviewed-authored-scene', revision, boundaries, provenance,
  };
}
