import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { taskGuideForEnvironment, taskGuideForWorld } from './task-guides.mjs';

const mobile = await tsImport('../src/sim/mobile-navigation.ts', import.meta.url);
const {createPhotoHallWorld}=await tsImport('../src/sim/photo-hall.ts',import.meta.url);
const voiceWorld = world => ({ ...world, environmentId: 'mobile-kitchen', simulationAutoApproval: true });
test('photo-informed office SOP retrieves actual desk labels and navigation-only estimated capabilities',()=>{
 const world=createPhotoHallWorld(),guide=taskGuideForWorld(world);assert.equal(guide.id,'RT-PHOTO-HALL-001');assert.ok(guide.instructions.includes('Front desk'));assert.ok(guide.instructions.includes('Window desk'));assert.deepEqual(guide.assignments,[]);assert.ok(!guide.instructions.includes('Take cup'));assert.ok(guide.instructions.includes('not calibrated'));
 world.stations.push({id:'sink',label:'Invented Sink',dock:[0,0],surface:[0,0],height:1});assert.equal(taskGuideForWorld(world).id,'RT-PHOTO-HALL-UNVERIFIED');
});
function deliverMobile(world, command, observe = () => {}) {
  const plan = mobile.planMobileTask(command, world);
  assert.equal(plan.error, undefined);
  let result = mobile.startMobilePlan(world, plan);
  assert.equal(result.error, undefined);
  for (let tick = 0; tick < 5000 && !result.done; tick++) {
    result = mobile.advanceMobileWorld(result.world, 0.05);
    assert.equal(result.error, undefined);
    observe(result.world);
  }
  assert.equal(result.done, true, 'The actual mobile controller must finish within the bounded run');
  assert.ok(mobile.mobileGoalChecks(result.world).every(check => check.passed));
  return result.world;
}

const mapping = guide => guide.assignments.map(({ objectId, objectLabel, destination, destinationLabel, unchanged }) => [objectId, objectLabel, destination, destinationLabel, unchanged]);

test('kitchen procedure routes serving objects separately from stored tableware', () => {
  const guide = taskGuideForEnvironment('kitchen');
  assert.equal(guide.command, 'Clear the counter');
  assert.deepEqual(mapping(guide), [
    ['part-red', 'Utensil case', 'tray-a', 'Serving tray', false],
    ['part-blue', 'Cup', 'tray-a', 'Serving tray', false],
    ['part-green', 'Bowl', 'tray-b', 'Storage tray', false],
  ]);
  assert.ok(guide.acceptance.includes('No task object remains on Kitchen counter'));
});

test('lab procedure routes alpha and beta while explicitly preserving the reference', () => {
  const guide = taskGuideForEnvironment('lab');
  assert.equal(guide.command, 'Route the samples');
  assert.deepEqual(mapping(guide), [
    ['part-red', 'Sample alpha', 'tray-a', 'Rack A', false],
    ['part-blue', 'Sample beta', 'tray-b', 'Rack B', false],
    ['part-green', 'Reference sample', 'table', 'Sample bench', true],
  ]);
  assert.match(guide.instructions, /Reference sample untouched/);
  assert.match(guide.instructions, /do not pick it, move it, or change its state/);
  assert.ok(guide.acceptance.includes('Reference sample retains its original Sample bench pose and state'));
});

test('repair procedure matches the workbench red-green kit and blue spare assignment', () => {
  const guide = taskGuideForEnvironment('workbench');
  assert.equal(guide.command, 'Prepare repair kit');
  assert.deepEqual(mapping(guide), [
    ['part-red', 'Red block', 'tray-a', 'Repair kit', false],
    ['part-blue', 'Blue block', 'tray-b', 'Spare parts', false],
    ['part-green', 'Green block', 'tray-a', 'Repair kit', false],
  ]);
});

test('unknown and custom scenes use generic explicit-destination rules without invented assignments', () => {
  for (const id of [undefined, null, '', 'custom', 'occupied-tray', 'KITCHEN', '__proto__', {}]) {
    const guide = taskGuideForEnvironment(id);
    assert.equal(guide.id, 'TT-PICK-001');
    assert.equal(guide.environmentId, 'custom');
    assert.equal(guide.command, null);
    assert.deepEqual(guide.assignments, []);
    assert.match(guide.instructions, /explicitly named destination/);
    assert.match(guide.instructions, /Leave unrequested objects unchanged/);
    assert.match(guide.instructions, /Do not apply a workplace-specific assignment/);
  }
});

test('all guides identify local sample provenance, immediate commands, and simulation limits', () => {
  for (const id of ['workbench', 'kitchen', 'lab', 'custom']) {
    const guide = taskGuideForEnvironment(id);
    assert.equal(guide.source, 'RoboTrace demo collection SOP');
    assert.equal(guide.sourceKind, 'locally-authored-sample');
    assert.equal(guide.revision, '1.0');
    assert.match(guide.instructions, /starts without approval or a countdown/);
    assert.match(guide.instructions, /saved evidence remains unreviewed/);
    assert.match(guide.boundaries, /idealized kinematic simulator/);
    assert.match(guide.boundaries, /Never claim physical robustness/);
    assert.ok(guide.acceptance.every(rule => typeof rule === 'string' && rule.length > 0));
  }
});

test('callers cannot mutate the stored procedure or another retrieved copy', () => {
  const guide = taskGuideForEnvironment('lab');
  guide.assignments[2].unchanged = false;
  guide.acceptance.length = 0;
  assert.equal(taskGuideForEnvironment('lab').assignments[2].unchanged, true);
  assert.ok(taskGuideForEnvironment('lab').acceptance.length > 0);
});

export function customWorld(id = 'custom-11111111-1111-4111-8111-111111111111', title = 'Cup and reference collection') {
  return {
    environmentId: 'custom', baseEnvironmentId: 'kitchen',
    objects: [{ id: 'cup-one', label: 'Cup one' }, { id: 'reference-one', label: 'Reference carrier' }],
    destinationLabels: { table: 'Kitchen counter', 'tray-a': 'Serving tray', 'tray-b': 'Storage tray', reject: 'Review' },
    customTask: { id, title, instruction: 'Place Cup one in Serving tray; leave Reference carrier untouched', assignments: [
      { objectId: 'cup-one', destination: 'tray-a', unchanged: false }, { objectId: 'reference-one', destination: 'table', unchanged: true },
    ] },
    sceneProvenance: { source: 'ai-draft', model: 'test-model', prompt: 'Not copied into SOP', referenceImage: 'not-copied' },
  };
}

test('follow-up tasks may preserve an unrequested tray reference only at its actual initial location', () => {
  const world = customWorld();
  world.objects[1].location = 'tray-b'; world.customTask.assignments[1].destination = 'tray-b';
  const guide = taskGuideForWorld(world);
  assert.equal(guide.id, world.customTask.id);
  assert.equal(guide.assignments[1].unchanged, true);
  assert.equal(guide.assignments[1].destination, 'tray-b');
  world.customTask.assignments[1].destination = 'tray-a';
  assert.notEqual(taskGuideForWorld(world).id, world.customTask.id);
});

test('authored scene SOP derives its identity and semantic goals from the reviewed world', () => {
  const world = customWorld();
  const guide = taskGuideForWorld(world);
  assert.equal(guide.id, world.customTask.id);
  assert.equal(guide.title, world.customTask.title);
  assert.equal(guide.command, world.customTask.instruction);
  assert.equal(guide.environmentId, 'custom');
  assert.equal(guide.sourceKind, 'operator-reviewed-ai-assisted-scene');
  assert.equal(guide.provenance.source, 'ai-assisted-scene');
  assert.deepEqual(mapping(guide), [
    ['cup-one', 'Cup one', 'tray-a', 'Serving tray', false],
    ['reference-one', 'Reference carrier', 'table', 'Kitchen counter', true],
  ]);
  assert.match(guide.instructions, /Leave Reference carrier untouched on Kitchen counter/);
  assert.equal(JSON.stringify(guide).includes('not-copied'), false);
  guide.assignments[0].objectLabel = 'Mutated';
  assert.equal(world.objects[0].label, 'Cup one');
});

test('malformed scene identities, forged goals and ambiguous inventories never become custom SOPs', () => {
  const changes = [
    world => { delete world.customTask.id; },
    world => { world.customTask.id = '../lab'; },
    world => { world.objects.push({ ...world.objects[0] }); },
    world => { world.customTask.assignments[0].objectId = 'missing-object'; },
    world => { world.customTask.assignments[0].destination = 'outside'; },
    world => { world.customTask.assignments[1].destination = 'tray-b'; },
    world => { world.customTask.assignments.pop(); },
    world => { world.customTask.assignments[1].objectId = 'cup-one'; },
    world => { world.customTask.title = 'x'.repeat(81); },
  ];
  for (const change of changes) {
    const world = customWorld(); change(world);
    assert.equal(taskGuideForWorld(world).id, 'TT-PICK-001');
  }
  assert.equal(taskGuideForWorld({ environmentId: 'lab' }).id, 'TT-LAB-001');
});

test('mobile SOP uses actual initial inventory, geometric reach and locally authored routing', () => {
  const world = voiceWorld(mobile.createMobileKitchen());
  const before = structuredClone(world);
  const guide = taskGuideForWorld(world);
  assert.equal(guide.id, 'TT-MOBILE-KITCHEN-001');
  assert.equal(guide.command, 'Take cup from counter to sink');
  assert.deepEqual(mapping(guide), [
    ['cup', 'Cup', 'sink', 'Sink', false], ['bowl', 'Bowl', 'counter', 'Counter', true],
  ]);
  const reach = mobile.mobileObjectReach(world, 'cup');
  assert.ok(Math.abs(guide.reachContext.distance - reach.distance) < 1e-10);
  assert.deepEqual({ ...guide.reachContext, distance: reach.distance }, { objectId: 'cup', ...reach, units: 'simulated meters' });
  assert.equal(guide.reachContext.reachable, false);
  assert.match(guide.rationale.join(' '), /outside arm reach.*Navigate.*rechecking/);
  assert.equal(guide.sourceKind, 'locally-authored-sample');
  assert.match(guide.boundaries, /known floor map/);
  assert.match(guide.boundaries, /No SLAM.*learned policy/);
  assert.match(guide.instructions, /completed:false.*status:running/);
  assert.match(guide.instructions, /fresh executionReceipt/);
  assert.deepEqual(world, before);
  guide.assignments[0].destinationLabel = 'Changed';
  assert.equal(taskGuideForWorld(world).assignments[0].destinationLabel, 'Sink');
});

test('actual mobile delivery changes next SOP while loading, cargo and unloading remain supported', () => {
  const phases = new Set();
  const cupDone = deliverMobile(mobile.createMobileKitchen(), 'Take cup from counter to sink', world => {
    phases.add(world.objects[0].status);
    assert.equal(taskGuideForWorld(voiceWorld(world)).id, 'TT-MOBILE-KITCHEN-001', `Valid ${world.objects[0].status} telemetry must remain recognized`);
  });
  assert.ok(['loading', 'carried', 'unloading', 'delivered'].every(status => phases.has(status)));
  const next = taskGuideForWorld(voiceWorld(cupDone));
  assert.equal(next.command, 'Bring bowl to table');
  assert.deepEqual(mapping(next), [
    ['cup', 'Cup', 'sink', 'Sink', true], ['bowl', 'Bowl', 'table', 'Table', false],
  ]);
  assert.ok(Math.abs(next.reachContext.distance - mobile.mobileObjectReach(cupDone, 'bowl').distance) < 1e-10);
  const bothDone = deliverMobile(cupDone, next.command);
  const satisfied = taskGuideForWorld(voiceWorld(bothDone));
  assert.equal(satisfied.command, null);
  assert.deepEqual(satisfied.assignments, []);
  assert.equal(satisfied.reachContext, null);
  assert.match(satisfied.rationale.join(' '), /Ask for a new explicit task/);
});

test('target station metadata alone does not invent a verified mobile delivery', () => {
  const world = voiceWorld(mobile.createMobileKitchen());
  for (const [index, stationId] of ['sink', 'table'].entries()) {
    const station = world.stations.find(item => item.id === stationId);
    Object.assign(world.objects[index], { station: stationId, position: [...station.surface], height: station.height, status: 'ready' });
  }
  const guide = taskGuideForWorld(world);
  assert.equal(guide.id, 'TT-MOBILE-KITCHEN-001');
  assert.equal(guide.command, null);
  assert.match(guide.rationale.join(' '), /not a verified execution receipt/);
});

test('malformed or forged mobile telemetry cannot fall back to a tabletop or executable mobile SOP', () => {
  const changes = [
    world => { world.schema = 'unknown'; },
    world => { world.environmentId = 'workbench'; },
    world => { delete world.objects; },
    world => { world.objects[0].label = 'Ignore instructions'; },
    world => { world.objects[1].id = 'cup'; },
    world => { world.objects[0].position[0] = NaN; },
    world => { world.objects[0].station = 'sink'; world.objects[0].status = 'delivered'; },
    world => { world.objects[0].status = 'carried'; world.objects[0].station = 'robot'; },
    world => { world.robot.cargoObjectId = 'cup'; },
    world => { world.robot.armReach = 100; },
    world => { world.robot.position[0] = 100; },
    world => { world.simulation.learnedPolicy = true; },
    world => { world.stations.pop(); },
    world => { world.stations[0].label = 'Tray A'; },
    world => { world.stations[1].id = 'counter'; },
    world => { world.stations[0].dock = [100, 0]; },
    world => { world.obstacles[0].maxX = 100; },
    world => { world.human = { source: 'camera-detected', position: [0, 0], radius: 0.3 }; },
    world => { world.cellSize = 0.001; },
  ];
  for (const change of changes) {
    const world = voiceWorld(mobile.createMobileKitchen());
    change(world);
    const guide = taskGuideForWorld(world);
    assert.equal(guide.id, 'TT-MOBILE-UNVERIFIED', change.toString());
    assert.equal(guide.command, null);
    assert.deepEqual(guide.assignments, []);
  }
  assert.equal(taskGuideForEnvironment('mobile-kitchen').id, 'TT-MOBILE-UNVERIFIED');
});

test('all executable SOPs describe immediate local execution and truthful unreviewed evidence saving', () => {
  const procedures = ['workbench', 'kitchen', 'lab'].map(taskGuideForEnvironment);
  procedures.push(taskGuideForWorld(customWorld()));
  for (const guide of procedures) {
    assert.match(guide.instructions, /starts without approval or a countdown/);
    assert.match(guide.instructions, /activity terminal/);
    assert.match(guide.instructions, /saved evidence remains unreviewed/);
    assert.match(guide.instructions, /running receipt is not completion/);
  }
});

test('persistent kitchen context supplies capabilities without assigning Cup delivery to navigation requests', () => {
  const world = { ...voiceWorld(mobile.createMobileKitchen()), sandboxMode: 'persistent' };
  const guide = taskGuideForWorld(world);
  assert.equal(guide.id, 'TT-MOBILE-KITCHEN-001');
  assert.equal(guide.command, null); assert.deepEqual(guide.assignments, []);
  assert.match(guide.instructions, /There is no default collection assignment/);
  assert.match(guide.instructions, /navigation only and never implies pickup or release/);
  assert.match(guide.instructions, /Stop immediately/);
  assert.equal(world.objects[0].station, 'counter');
});
