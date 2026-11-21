import test from 'node:test';import assert from 'node:assert/strict';
import {createPhotoHallWorld,createPhotoHallWorldFromSpec,planPhotoHallTask,PHOTO_HALL_PROVENANCE} from './photo-hall';
import type {PhotoRoomLayout} from './photo-hall';
import {advanceMobileWorld,startMobilePlan,mobileGoalChecks,mobileSegmentIsClear,findMobileRoute} from './mobile-navigation';
test('photo hall records estimated provenance and exposes only visible desk navigation, without invented kitchen inventory',()=>{
 const world=createPhotoHallWorld();assert.deepEqual(world.objects,[]);assert.deepEqual(world.stations.map(station=>station.label),['Home','Front desk','Window desk']);assert.ok(!world.stations.some(station=>station.id==='sink'));
 assert.equal(world.photoHallProvenance.calibrated,false);assert.equal(world.photoHallProvenance.estimated,true);assert.equal(world.photoHallProvenance.peopleReconstructed,false);assert.equal(world.photoHallProvenance.photosIncluded,false);assert.equal(world.bounds.maxX-world.bounds.minX,7);assert.equal(world.bounds.maxZ-world.bounds.minZ,8);
 assert.ok(world.obstacles.length<=16);assert.ok(world.obstacles.some(item=>item.label==='Black office chair'));assert.ok(world.obstacles.some(item=>item.label==='Wall bench'));assert.ok(PHOTO_HALL_PROVENANCE.referenceSha256.every(hash=>/^[a-f\d]{64}$/.test(hash)));
});
test('actual controller visits both desk docks and Home through collision-checked recorded paths',()=>{
 let world=createPhotoHallWorld();for(const command of['Go to front desk','Go to window desk','Go Home']){
  const plan=planPhotoHallTask(command,world);assert.equal(plan.error,undefined);assert.equal(plan.goal?.objectId,undefined);assert.ok(plan.steps.every(step=>step.kind==='navigate'));
  world=startMobilePlan(world,plan,'immediate').world as typeof world;let done=false;
  for(let tick=0;tick<2000;tick++){const next=advanceMobileWorld(world,.1);world=next.world as typeof world;assert.ok(mobileSegmentIsClear(world,world.robot.position,world.robot.position));assert.equal(world.robot.cargoObjectId,null);if(next.done){done=true;break;}}
  assert.ok(done);assert.equal(world.mission?.status,'completed');assert.ok(mobileGoalChecks(world).every(check=>check.passed));
 }assert.ok(world.distanceTravelled>8);assert.deepEqual(world.objects,[]);
});
test('furniture and chair footprints block actual routes while reachable coordinate and relative movement remain bounded',()=>{
 let world=createPhotoHallWorld();assert.equal(findMobileRoute(world,world.robot.position,[.4,1.05]),null);assert.equal(findMobileRoute(world,world.robot.position,[2.65,-1.8]),null);
 for(const command of['Go straight 1 meter','Go to x -2.2 z -2.8']){const plan=planPhotoHallTask(command,world);assert.equal(plan.error,undefined);world=startMobilePlan(world,plan,'immediate').world as typeof world;for(let tick=0;tick<2000;tick++){const next=advanceMobileWorld(world,.1);world=next.world as typeof world;if(next.done)break;}assert.ok(mobileGoalChecks(world).every(check=>check.passed));}
 assert.ok(planPhotoHallTask('Go to x 9 z 9',world).error);assert.ok(planPhotoHallTask('Go to sink',world).error);assert.ok(planPhotoHallTask('Pick up cup',world).error);
});
test('uploaded-room estimates apply actual normalized footprints and checked spawn/docks without reusing the fixed reference geometry',()=>{
 const spec:PhotoRoomLayout={schema:'robotrace.room-spec.v1',title:'Small office',widthMeters:6,depthMeters:7,fixtures:[{id:'hall-desk-1',kind:'desk',label:'Long desk',center:[.6,.4],size:[.5,.15]},{id:'hall-chair-2',kind:'chair',label:'Side chair',center:[.9,.4],size:[.08,.1]}],windows:['back'],tvWall:'none',assumptions:['Estimated dimensions, not measured.'],safeSpawn:[-2,2.5],calibrated:false,basis:'image-informed-estimated-office-layout'};
 let world=createPhotoHallWorldFromSpec(spec,{sha256:'a'.repeat(64)});assert.deepEqual(world.robot.position,spec.safeSpawn);assert.equal(world.obstacles.length,2);assert.equal(world.bounds.maxX-world.bounds.minX,6);assert.ok(Math.abs(world.obstacles[0].minX+.9)<1e-12);assert.deepEqual(world.photoHallProvenance.referenceSha256,['a'.repeat(64)]);assert.deepEqual(world.photoHallProvenance.features,{windows:['back'],tvWall:'none'});assert.ok(!world.stations.some(station=>station.label==='Window desk'));assert.equal(world.stations[2].label,'Open floor B');
 const plan=planPhotoHallTask('Go to Long desk',world);assert.equal(plan.error,undefined);world=startMobilePlan(world,plan,'immediate').world as typeof world;for(let tick=0;tick<2000;tick++){const next=advanceMobileWorld(world,.1);world=next.world as typeof world;if(next.done)break;}assert.ok(mobileGoalChecks(world).every(check=>check.passed));
 const forged=structuredClone(spec);forged.safeSpawn=[.6,-.7];assert.throws(()=>createPhotoHallWorldFromSpec(forged),/intersects/);
});
