import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_ARM_LINKS, MOBILE_GRIPPER_TCP_OFFSET, MOBILE_OBJECT_TCP_HEIGHT_OFFSET, solveMobileArm } from './mobile-arm';
import type { MobileArmPoint } from './mobile-arm';
import { advanceMobileWorld, createMobileKitchen, planMobileTask, startMobilePlan } from './mobile-navigation';
import type { MobileWorld } from './mobile-navigation';

const distance = (a: MobileArmPoint, b: MobileArmPoint) => Math.hypot(...a.map((value, index) => value - b[index]));
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);
function activeWorld(): MobileWorld {
  const world = createMobileKitchen();
  world.robot.position = [-3, -1.5];
  world.robot.yaw = 0.7;
  world.mission = { plan: { id: 'pose', worldRevision: 0, command: 'Collect cup', summary: 'Reach check', rationale: [], confirmationRequired: true,
    steps: [{ kind: 'reach-check', stationId: 'counter', objectId: 'cup', label: 'Reach cup' }], goal: { objectId: 'cup', stationId: 'sink' } },
    stepIndex: 0, waypointIndex: 0, phaseElapsed: 0, completedSteps: 0, status: 'running' };
  return world;
}

test('folded and active poses keep both physical link lengths and finite explicit joint angles', () => {
  for (const world of [createMobileKitchen(), activeWorld()]) {
    const pose = solveMobileArm(world);
    near(distance(pose.joints.shoulder, pose.joints.elbow), MOBILE_ARM_LINKS[0]);
    near(distance(pose.joints.elbow, pose.joints.wrist), MOBILE_ARM_LINKS[1]);
    assert.ok(Object.values(pose.jointAngles).every(Number.isFinite));
    assert.ok(Object.values(pose.joints).flat().every(Number.isFinite));
    assert.equal(pose.angleUnit, 'radians');
    assert.equal(pose.reachable, true);
    near(distance(pose.joints.wrist, pose.requestedWrist), 0);
    near(distance(pose.objectTCP, pose.requestedTCP), 0);
  }
});

test('exported radians reproduce wrist position through independent forward kinematics', () => {
  const world = activeWorld();
  const pose = solveMobileArm(world);
  const { baseYaw, shoulderPitch, elbowPitch, wristPitch } = pose.jointAngles;
  const yaw = pose.baseHeading + baseYaw;
  const radius = 0.82 * Math.cos(shoulderPitch) + 0.82 * Math.cos(shoulderPitch + elbowPitch);
  const height = 0.82 * Math.sin(shoulderPitch) + 0.82 * Math.sin(shoulderPitch + elbowPitch);
  const wrist: MobileArmPoint = [world.robot.position[0] + Math.sin(yaw) * radius, 0.94 + height, world.robot.position[1] + Math.cos(yaw) * radius];
  near(distance(wrist, pose.joints.wrist), 0);
  near(shoulderPitch + elbowPitch + wristPitch, -Math.PI / 2);
  near(pose.joints.wrist[1] - pose.objectTCP[1], MOBILE_GRIPPER_TCP_OFFSET);
  assert.deepEqual(pose.joints.gripper, pose.objectTCP);
});

test('an unreachable target is flagged and clamped instead of stretching the rendered arm', () => {
  const world = activeWorld();
  world.robot.position = [-3, 2.5];
  const pose = solveMobileArm(world);
  assert.equal(pose.reachable, false);
  assert.equal(pose.clamped, true);
  assert.ok(pose.requestedDistance > pose.maxReach);
  near(distance(pose.joints.shoulder, pose.joints.wrist), 1.64);
  near(distance(pose.joints.shoulder, pose.joints.elbow), 0.82);
  near(distance(pose.joints.elbow, pose.joints.wrist), 0.82);
  assert.ok(distance(pose.objectTCP, pose.requestedTCP) > 1);
});

test('joint export follows actual loading objects and gripper state without mutating the scene', () => {
  const world = activeWorld();
  const before = structuredClone(world);
  const open = solveMobileArm(world);
  assert.equal(open.gripperOpen, 1);
  assert.equal(open.targetObjectId, 'cup');
  world.objects[0].status = 'loading';
  world.objects[0].position = [-3.05, -1.8];
  const loading = solveMobileArm(world);
  assert.equal(loading.gripperOpen, 0);
  near(distance(loading.requestedTCP, [-3.05, 0.95 + MOBILE_OBJECT_TCP_HEIGHT_OFFSET, -1.8]), 0);
  assert.deepEqual(before.objects[0].position, [-3.2, -2.65]);
  assert.deepEqual(world.objects[0].position, [-3.05, -1.8]);
  assert.equal(loading.basis, 'simulated-analytic-kinematics');
});

test('reach and navigation carrying poses align the gripper TCP with the actual rendered object center', () => {
  let world = createMobileKitchen();
  world = startMobilePlan(world, planMobileTask('Take cup from counter to sink', world)).world;
  let reached = false, carriedSamples = 0;
  for (let tick = 0; tick < 1000; tick++) {
    const result = advanceMobileWorld(world, 0.05); world = result.world;
    assert.equal(result.error, undefined);
    const step = world.mission?.plan.steps[world.mission.stepIndex];
    const cup = world.objects.find(object => object.id === 'cup')!;
    if (step?.kind === 'reach-check' || (step?.kind === 'navigate' && world.robot.cargoObjectId === 'cup')) {
      const pose = solveMobileArm(world);
      const center: MobileArmPoint = [cup.position[0], cup.height + MOBILE_OBJECT_TCP_HEIGHT_OFFSET, cup.position[1]];
      assert.equal(pose.targetObjectId, 'cup');
      assert.equal(pose.tcpConvention, 'rendered-object-center');
      assert.equal(pose.reachable, true);
      near(distance(pose.objectTCP, center), 0);
      near(distance(pose.joints.gripper, center), 0);
      near(distance(pose.joints.shoulder, pose.joints.elbow), 0.82);
      near(distance(pose.joints.elbow, pose.joints.wrist), 0.82);
      if (step.kind === 'reach-check') reached = true;
      else { carriedSamples++; assert.equal(pose.gripperOpen, 0); }
    }
    if (result.done) break;
  }
  assert.ok(reached);
  assert.ok(carriedSamples > 10, 'alignment must hold across continuous carrying motion, not one artificial pose');
});

test('unknown active targets and nonfinite base inputs produce a finite flagged fallback', () => {
  const world = activeWorld();
  world.mission!.plan.steps[0] = { kind: 'reach-check', objectId: 'missing', stationId: 'counter', label: 'Unknown' };
  world.robot.position[0] = NaN;
  world.robot.yaw = Infinity;
  const pose = solveMobileArm(world);
  assert.equal(pose.inputValid, false);
  assert.equal(pose.reachable, false);
  assert.equal(pose.targetObjectId, null);
  assert.ok(pose.error);
  assert.ok(Object.values(pose.joints).flat().every(Number.isFinite));
  assert.ok(Object.values(pose.jointAngles).every(Number.isFinite));
});
