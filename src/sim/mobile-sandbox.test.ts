import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMobileWorld, applyMobileControl, createMobileKitchen, mobileGoalChecks, mobileSegmentIsClear, planMobileTask, setMobileFloorObstacle, setMobileHuman, startMobilePlan } from './mobile-navigation';
import type { MobileWorld } from './mobile-navigation';

function begin(world: MobileWorld, instruction: string): MobileWorld {
  const plan = planMobileTask(instruction, world);
  assert.equal(plan.error, undefined);
  const result = startMobilePlan(world, plan, 'immediate');
  assert.equal(result.error, undefined);
  return result.world;
}
function finish(source: MobileWorld, protectedId?: string): MobileWorld {
  let world = source;
  const protectedObject = structuredClone(world.objects.find(object => object.id === protectedId));
  for (let tick = 0; tick < 5000; tick++) {
    const before = world;
    const result = advanceMobileWorld(world, .05);
    world = result.world;
    assert.equal(result.error, undefined); assert.equal(result.blocked, undefined);
    assert.ok(mobileSegmentIsClear(world, before.robot.position, world.robot.position));
    if (protectedId) assert.deepEqual(world.objects.find(object => object.id === protectedId), protectedObject);
    if (result.done) { assert.ok(mobileGoalChecks(world).every(check => check.passed)); return world; }
  }
  throw new Error('Sandbox task exceeded bounded controller budget');
}
function carrying(): MobileWorld {
  let world = begin(createMobileKitchen(), 'Take cup from counter to sink');
  for (let tick = 0; tick < 1000 && world.robot.cargoObjectId !== 'cup'; tick++) world = advanceMobileWorld(world, .05).world;
  assert.equal(world.robot.cargoObjectId, 'cup');
  return world;
}

test('successive tasks use current object locations without resets across seeded kitchens', () => {
  for (const seed of [0, 1, 4]) {
    let world = createMobileKitchen(seed);
    for (const command of ['Take cup from counter to sink', 'Take cup from sink to table', 'Take cup from table to counter', 'Bring bowl to table', 'Take bowl from table to sink', 'Take bowl from sink to counter']) {
      const objectId = /cup/.test(command) ? 'cup' : 'bowl';
      const beforeTime = world.simTime, beforeDistance = world.distanceTravelled;
      world = finish(begin(world, command), objectId === 'cup' ? 'bowl' : 'cup');
      assert.ok(world.simTime > beforeTime); assert.ok(world.distanceTravelled > beforeDistance);
    }
    assert.equal(world.objects[0].station, 'counter'); assert.equal(world.objects[1].station, 'counter');
    assert.equal(planMobileTask('Take cup from sink to table', world).summary, 'The stated source does not match the scene.');
  }
});

test('live floor-block placement is bounded and never teleports robot or cargo', () => {
  const source = carrying(), snapshot = structuredClone(source);
  for (const point of [[NaN, 0], [4.4, 0], [-3, -2.65], source.robot.position] as [number, number][]) {
    const result = setMobileFloorObstacle(source, point);
    assert.ok(result.error); assert.equal(result.world, source);
  }
  const placed = setMobileFloorObstacle(source, [0, -1.5]);
  assert.equal(placed.error, undefined);
  assert.deepEqual(placed.world.robot, source.robot); assert.deepEqual(placed.world.objects, source.objects);
  assert.deepEqual(placed.world.mission, source.mission); assert.equal(placed.world.simTime, source.simTime);
  assert.match(placed.world.events.at(-1)!.message, /Sandbox floor block placed/);
  const human = setMobileHuman(source, [0, -1.5]);
  const overlapping = setMobileFloorObstacle(human, [0, -1.5]);
  assert.match(overlapping.error ?? '', /clear of the person/); assert.equal(overlapping.world, human);
  assert.deepEqual(source, snapshot);
});

test('a live block causes actual continuous rerouting while the same cup remains carried', () => {
  const source = carrying(), missionId = source.mission!.plan.id;
  let world = setMobileFloorObstacle(source, [0, -1.5]).world;
  world = advanceMobileWorld(world, .05).world;
  assert.equal(world.robot.mode, 'running'); assert.equal(world.mission!.plan.id, missionId);
  assert.equal(world.robot.cargoObjectId, 'cup');
  assert.ok(world.events.some(event => /Rerouted around the sandbox floor block/.test(event.message)));
  const final = finish(world, 'bowl');
  assert.ok(final.distanceTravelled > 10, 'detour adds real traversed distance');
  assert.equal(final.objects[0].station, 'sink');
});

test('a block covering the destination pauses with custody preserved and removal needs explicit resume', () => {
  const source = carrying();
  let world = setMobileFloorObstacle(source, [3, -1.5]).world;
  const before = structuredClone(world);
  const paused = advanceMobileWorld(world, .05);
  assert.match(paused.blocked ?? '', /Movable floor block/); assert.equal(paused.error, undefined);
  world = paused.world;
  assert.equal(world.robot.mode, 'paused'); assert.equal(world.mission!.status, 'running');
  assert.deepEqual(world.robot.position, before.robot.position); assert.deepEqual(world.objects, before.objects);
  assert.deepEqual(world.mission, before.mission); assert.equal(world.simTime, before.simTime);
  world = setMobileFloorObstacle(world, [0, 2.5]).world;
  assert.match(world.events.at(-1)!.message, /Sandbox floor block moved/);
  assert.equal(world.robot.mode, 'paused');
  world = setMobileFloorObstacle(world, null).world;
  assert.equal(world.robot.mode, 'paused'); assert.equal(advanceMobileWorld(world, 1).world, world);
  assert.equal(world.obstacles.length, source.obstacles.length);
  world = applyMobileControl(world, 'resume').world;
  assert.equal(finish(world, 'bowl').objects[0].station, 'sink');
});

test('an immutable floor partition still fails rather than becoming a recoverable sandbox block', () => {
  const world = carrying();
  world.obstacles.push({ id: 'static-wall', label: 'Closed partition', minX: -.1, maxX: .1, minZ: -3.5, maxZ: 3.5 });
  const result = advanceMobileWorld(world, .05);
  assert.match(result.error ?? '', /static obstacle/); assert.equal(result.world.robot.mode, 'error');
  assert.equal(result.world.mission!.status, 'failed'); assert.equal(result.blocked, undefined);
});
