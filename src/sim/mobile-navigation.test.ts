import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMobileWorld, applyMobileControl, createMobileKitchen, findMobileRoute, mobileGoalChecks, mobileHumanAheadPosition, mobileObjectReach, mobileSegmentAvoidsHuman, mobileSegmentIsClear, planMobileTask, setMobileHuman, startMobilePlan } from './mobile-navigation';
import type { MobileWorld } from './mobile-navigation';

test('a person ahead causes an actual longer detour while cargo and mission continue', () => {
  let world = start('Bring cup to sink');
  for (let tick=0;tick<1000&&world.robot.cargoObjectId!=='cup';tick++)world=advanceMobileWorld(world,.05).world;
  const time=world.simTime, missionId=world.mission!.plan.id;
  const point=mobileHumanAheadPosition(world);
  assert.ok(Math.hypot(point[0]-world.robot.position[0],point[1]-world.robot.position[1])>=1.1);
  world=setMobileHuman(world,point);
  let sawReroute=false;
  for(let tick=0;tick<5000;tick++){
    const prior=world;const result=advanceMobileWorld(world,.05);world=result.world;
    assert.equal(result.error,undefined);assert.equal(result.blocked,undefined);
    assert.equal(world.mission!.plan.id,missionId);
    assert.equal(mobileSegmentIsClear(world,prior.robot.position,world.robot.position),true);
    assert.equal(mobileSegmentAvoidsHuman(world,prior.robot.position,world.robot.position),true);
    if(world.robot.cargoObjectId){assert.equal(world.robot.cargoObjectId,'cup');const cup=world.objects[0];if(cup.status==='carried')assert.deepEqual(cup.position,world.robot.position);}
    sawReroute ||= world.events.some(event=>/Rerouted around the human/.test(event.message));
    if(result.done)break;
  }
  assert.ok(sawReroute);assert.ok(world.simTime>time);assert.ok(world.distanceTravelled>10);assert.ok(mobileGoalChecks(world).every(check=>check.passed));
});

test('moving the person again triggers another validated route', () => {
  let world=start('Bring cup to sink');world=setMobileHuman(world,mobileHumanAheadPosition(world));
  world=advanceMobileWorld(world,.1).world;
  assert.equal(world.robot.mode,'running');
  world=setMobileHuman(world,mobileHumanAheadPosition(world));
  const result=advanceMobileWorld(world,.1);assert.equal(result.error,undefined);assert.equal(result.blocked,undefined);
  assert.ok(result.world.events.filter(event=>/Rerouted around the human/.test(event.message)).length>=2);
});

function start(command: string, world = createMobileKitchen()): MobileWorld {
  const plan = planMobileTask(command, world);
  assert.equal(plan.error, undefined);
  const result = startMobilePlan(world, plan);
  assert.equal(result.error, undefined);
  return result.world;
}
function finish(source: MobileWorld): MobileWorld {
  let world = source;
  for (let tick = 0; tick < 5000; tick++) {
    const previous = world;
    const result = advanceMobileWorld(world, 0.05);
    assert.equal(result.error, undefined); assert.equal(result.blocked, undefined);
    world = result.world;
    assert.equal(mobileSegmentIsClear(world, previous.robot.position, world.robot.position), true);
    assert.equal(mobileSegmentAvoidsHuman(world, previous.robot.position, world.robot.position), true, 'Every traversed segment must preserve the conservative person clearance');
    if (result.done) return world;
  }
  throw new Error('Mobile task exceeded its bounded test budget');
}

test('a distant cup requires base travel, a real reach recheck, pickup, continuous carrying and verified delivery', () => {
  const initial = createMobileKitchen();
  const snapshot = structuredClone(initial);
  assert.ok(mobileObjectReach(initial, 'cup').distance > initial.robot.armReach);
  const plan = planMobileTask('Take cup from counter to sink', initial);
  assert.match(plan.rationale[0], /beyond/);
  assert.deepEqual(plan.steps.map(step => step.kind), ['navigate', 'reach-check', 'pickup', 'navigate', 'place']);
  let world = startMobilePlan(initial, plan).world;
  let sawReach = false, sawCargoTravel = false;
  for (let tick = 0; tick < 5000; tick++) {
    const before = world;
    const result = advanceMobileWorld(world, 0.05);
    assert.equal(result.error, undefined);
    world = result.world;
    assert.ok(Math.hypot(world.robot.position[0] - before.robot.position[0], world.robot.position[1] - before.robot.position[1]) <= 0.8 * 0.05 + 0.00001, 'base must advance continuously rather than teleport');
    if (world.mission?.plan.steps[world.mission.stepIndex]?.kind === 'reach-check') {
      sawReach = true; assert.ok(world.distanceTravelled >= 3.9); assert.equal(mobileObjectReach(world, 'cup').reachable, true);
    }
    if (world.robot.cargoObjectId === 'cup') {
      const cup = world.objects.find(object => object.id === 'cup')!;
      if (cup.status === 'carried') assert.deepEqual(cup.position, world.robot.position);
      assert.equal(cup.station, 'robot');
      if (before.robot.cargoObjectId === 'cup' && world.distanceTravelled > before.distanceTravelled) sawCargoTravel = true;
    }
    if (result.done) break;
  }
  assert.ok(sawReach); assert.ok(sawCargoTravel);
  assert.ok(mobileGoalChecks(world).every(check => check.passed));
  assert.equal(world.objects.find(object => object.id === 'cup')?.station, 'sink');
  assert.deepEqual(world.objects.find(object => object.id === 'bowl'), initial.objects.find(object => object.id === 'bowl'));
  assert.ok(world.distanceTravelled >= 9.9);
  assert.deepEqual(initial, snapshot, 'planner and controller must preserve the source snapshot');
});

test('A* routes around furniture with base clearance and refuses a floor-spanning wall', () => {
  const world = createMobileKitchen();
  const from: [number, number] = [-3, 0], to: [number, number] = [3, 0];
  assert.equal(mobileSegmentIsClear(world, from, to), false);
  const route = findMobileRoute(world, from, to)!;
  assert.ok(route.length > 2);
  for (let index = 1; index < route.length; index++) assert.equal(mobileSegmentIsClear(world, route[index - 1], route[index]), true);
  world.obstacles.push({ id: 'wall', label: 'Closed partition', minX: -0.1, maxX: 0.1, minZ: -3.5, maxZ: 3.5 });
  assert.equal(findMobileRoute(world, from, to), null);
  const blocked = planMobileTask('Bring cup to sink', world);
  assert.match(blocked.error ?? '', /no collision-free route/);
  assert.deepEqual(blocked.steps, []);
});

test('pickup is refused if the arm still cannot reach after the base docks', () => {
  const world = createMobileKitchen();
  world.objects[0].position = [-3.2, -3.3];
  let current = start('Take cup from counter to sink', world);
  let error = '';
  for (let tick = 0; tick < 300; tick++) {
    const result = advanceMobileWorld(current, 0.1); current = result.world;
    if (result.error) { error = result.error; break; }
  }
  assert.match(error, /beyond arm reach at the current base pose/);
  assert.equal(current.robot.mode, 'error');
  assert.equal(current.robot.cargoObjectId, null);
  assert.equal(current.objects[0].station, 'counter');
  assert.equal(mobileGoalChecks(current).every(check => check.passed), false);
});

test('human obstruction freezes movement and cargo until clearance and explicit resume', () => {
  let world = start('Bring cup to sink');
  for (let tick = 0; tick < 1000 && world.robot.cargoObjectId !== 'cup'; tick++) world = advanceMobileWorld(world, 0.05).world;
  assert.equal(world.robot.cargoObjectId, 'cup');
  world = setMobileHuman(world, [...world.robot.position]);
  const occupied = structuredClone(world);
  const blocked = advanceMobileWorld(world, 0.1);
  assert.ok(blocked.blocked); world = blocked.world;
  assert.equal(world.robot.mode, 'paused');
  assert.equal(world.simTime, occupied.simTime);
  assert.deepEqual(world.objects, occupied.objects);
  assert.ok(applyMobileControl(world, 'resume').blocked);
  world = setMobileHuman(world, null);
  const cleared = structuredClone(world);
  assert.deepEqual(advanceMobileWorld(world, 1).world, cleared, 'clearing the scenario must not resume motion automatically');
  world = applyMobileControl(world, 'resume').world;
  world = finish(world);
  assert.ok(mobileGoalChecks(world).every(check => check.passed));
});

test('pause freezes the clock; stop retains cargo and a fresh approved plan can deliver it', () => {
  let world = start('Bring bowl to table');
  world = advanceMobileWorld(world, 1).world;
  world = applyMobileControl(world, 'pause').world;
  assert.deepEqual(advanceMobileWorld(world, 1).world, world);
  world = applyMobileControl(world, 'resume').world;
  for (let tick = 0; tick < 1000 && world.robot.cargoObjectId !== 'bowl'; tick++) world = advanceMobileWorld(world, 0.05).world;
  assert.equal(world.robot.cargoObjectId, 'bowl');
  world = applyMobileControl(world, 'stop').world;
  assert.deepEqual(advanceMobileWorld(world, 1).world, world);
  assert.equal(world.objects.find(object => object.id === 'bowl')?.station, 'robot');
  assert.ok(applyMobileControl(world, 'resume').error, 'stopped tasks require a new approved plan');
  const recovery = planMobileTask('Bring bowl to table', world);
  assert.deepEqual(recovery.steps.map(step => step.kind), ['navigate', 'place']);
  world = finish(startMobilePlan(world, recovery).world);
  assert.ok(mobileGoalChecks(world).every(check => check.passed));
});

test('a newly blocked route cannot report delivery or discard carried cargo', () => {
  let world = start('Bring cup to sink');
  for (let tick = 0; tick < 1000 && world.robot.cargoObjectId !== 'cup'; tick++) world = advanceMobileWorld(world, 0.05).world;
  world.obstacles.push({ id: 'partition', label: 'Closed partition', minX: -0.1, maxX: 0.1, minZ: -3.5, maxZ: 3.5 });
  const result = advanceMobileWorld(world, 0.1);
  assert.match(result.error ?? '', /floor route is blocked/);
  assert.equal(result.world.robot.cargoObjectId, 'cup');
  assert.equal(result.world.mission?.status, 'failed');
  assert.equal(mobileGoalChecks(result.world).every(check => check.passed), false);
});

test('navigation and seeded scenes are reproducible, bounded, and explicit about simulation limits', () => {
  for (const seed of [0, 2, 3]) {
    assert.deepEqual(createMobileKitchen(seed), createMobileKitchen(seed));
    const world = finish(start('Navigate to the table', createMobileKitchen(seed)));
    assert.ok(mobileGoalChecks(world).every(check => check.passed));
    assert.equal(world.simulation.slam, false); assert.equal(world.simulation.contactDynamics, false);
    assert.equal(world.simulation.learnedPolicy, false);
  }
  const world = createMobileKitchen();
  assert.ok(planMobileTask('Take fork to sink', world).error);
  assert.ok(planMobileTask('Move the counter to sink', world).error, 'furniture relocation must not be silently turned into robot navigation');
  assert.ok(planMobileTask('Take cup from table to sink', world).error);
  assert.ok(planMobileTask('Move cup to sink and table', world).error);
  const plan = planMobileTask('Bring cup to sink', world);
  const changed = setMobileHuman(world, [0, 2]);
  assert.ok(startMobilePlan(changed, plan).error, 'a stale scene needs a new reviewed plan');
});

test('approval events distinguish explicit operator approval, automatic simulation and headless evaluation',()=>{
 const source=createMobileKitchen();const plan=planMobileTask('Take cup from counter to sink',source);
 assert.equal(plan.confirmationRequired,false);
 assert.match(startMobilePlan(source,plan,'manual').world.events[0].message,/Operator explicitly approved/);
 assert.match(startMobilePlan(source,plan,'automatic').world.events[0].message,/automatically approved/);
 assert.match(startMobilePlan(source,plan,'evaluation').world.events[0].message,/no human approval is asserted/);
 assert.match(startMobilePlan(source,plan,'immediate').world.events[0].message,/Operator command started immediate local simulation/);
 assert.equal(planMobileTask('reset',source).confirmationRequired,true);
});

test('Go Home is navigation with an empty or loaded carrier and never asserts a delivery', () => {
  for (const loaded of [false, true]) {
    let initial = createMobileKitchen();
    if (loaded) {
      initial = start('Bring cup to sink', initial);
      for (let tick = 0; tick < 1000 && initial.robot.cargoObjectId !== 'cup'; tick++) initial = advanceMobileWorld(initial, 0.05).world;
      initial = applyMobileControl(initial, 'stop').world;
      assert.equal(initial.robot.cargoObjectId, 'cup');
    }
    const final = finish(start('Go Home', initial));
    const checks = mobileGoalChecks(final);
    assert.ok(checks.every(check => check.passed));
    assert.equal(checks.some(check => check.id === 'object-delivered'), false);
    const settled = checks.find(check => check.id === 'controller-settled')!;
    assert.doesNotMatch(settled.name, /empty carrier/);
    assert.match(settled.detail, /no object release or delivery is asserted/);
    assert.equal(final.robot.cargoObjectId, loaded ? 'cup' : null);
    assert.equal(final.events.filter(event => event.kind === 'place').length, 0);
    assert.deepEqual(final.objects.find(object => object.id === 'bowl'), initial.objects.find(object => object.id === 'bowl'));
  }
});

test('raw handling primitives cannot place cargo on or pick an object up from the Home parking station', () => {
  let carried = start('Bring cup to sink');
  for (let tick = 0; tick < 1000 && carried.robot.cargoObjectId !== 'cup'; tick++) carried = advanceMobileWorld(carried, 0.05).world;
  carried = applyMobileControl(carried, 'stop').world;
  const plan = planMobileTask('Go Home', carried);
  plan.steps.push({ kind: 'place', stationId: 'home', objectId: 'cup', label: 'Invalid floor release at Home' });
  let world = startMobilePlan(carried, plan, 'evaluation').world;
  let error = '';
  for (let tick = 0; tick < 1000; tick++) {
    const result = advanceMobileWorld(world, 0.05); world = result.world;
    if (result.error) { error = result.error; break; }
  }
  assert.match(error, /Home is a robot parking station/);
  assert.equal(world.robot.cargoObjectId, 'cup');
  assert.equal(world.objects[0].station, 'robot');
  assert.equal(world.objects[0].status, 'carried');
  assert.equal(world.objects[0].height, 1);
  assert.equal(world.events.some(event => event.kind === 'place'), false);

  const floor = createMobileKitchen();
  Object.assign(floor.objects[0], { station: 'home', position: [...floor.stations.find(station => station.id === 'home')!.surface], height: 0 });
  const invalid = { ...planMobileTask('Go Home', floor), steps: [{ kind: 'pickup' as const, stationId: 'home' as const, objectId: 'cup', label: 'Invalid floor pickup' }] };
  const refused = advanceMobileWorld(startMobilePlan(floor, invalid, 'evaluation').world, 0.1);
  assert.match(refused.error ?? '', /Home is a robot parking station/);
  assert.equal(refused.world.robot.cargoObjectId, null);
  assert.deepEqual(refused.world.objects, floor.objects);
  const fabricated = structuredClone(floor);
  fabricated.objects[0].position[0] -= 0.14;
  fabricated.objects[0].status = 'delivered';
  fabricated.mission = { plan: { ...invalid, goal: { objectId: 'cup', stationId: 'home' } }, stepIndex: 1, completedSteps: 1, waypointIndex: 1, phaseElapsed: 0, status: 'completed' };
  assert.equal(mobileGoalChecks(fabricated).find(check => check.id === 'object-delivered')?.passed, false, 'Home cannot become an accepted delivery through station metadata alone');
});
