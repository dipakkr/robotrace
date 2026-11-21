import test from 'node:test';import assert from 'node:assert/strict';
import { createMobileKitchen,planMobileTask,startMobilePlan,advanceMobileWorld,applyMobileControl } from '../sim/mobile-navigation';
import { createMobileEvidence } from './mobile-evidence';
function fixture(){const initial=createMobileKitchen();let w=startMobilePlan(initial,planMobileTask('Take cup from counter to sink',initial)).world;const samples=[{time:initial.simTime,world:structuredClone(initial)}];for(let i=0;i<3000;i++){const result=advanceMobileWorld(w,1/30);w=result.world;if(i%3===0||result.done)samples.push({time:w.simTime,world:structuredClone(w)});if(result.done)break;}return {initial,w,samples};}
test('mobile evidence exports shared rendered joints and recomputes actual delivery checks',()=>{const {initial,w,samples}=fixture();const data=createMobileEvidence(initial,samples,w,{status:'succeeded',verified:true});assert.ok(data.checks.every(c=>c.passed));assert.ok(data.trajectory.length>10);assert.equal(data.trajectory.at(-1)!.arm.basis,'simulated-analytic-kinematics');assert.equal(data.provenance.trainingAdapterValidated,false);});
test('terminal/control snapshots, chronology and success cannot be fabricated',()=>{const {initial,w,samples}=fixture();const stopped=applyMobileControl(w,'stop').world;assert.throws(()=>createMobileEvidence(initial,samples,stopped,null),/terminal/);const reversed=structuredClone(samples);[reversed[2],reversed[3]]=[reversed[3],reversed[2]];assert.throws(()=>createMobileEvidence(initial,reversed,w,null),/chronological/);assert.throws(()=>createMobileEvidence(initial,[{time:0,world:initial}],initial,{status:'succeeded',verified:true}),/recomputed/);});

import { setMobileFloorObstacle } from '../sim/mobile-navigation';
function liveFixture(start=createMobileKitchen(),command='Take cup from counter to sink'){
 let w=startMobilePlan(start,planMobileTask(command,start),'immediate').world;
 const samples=[{time:start.simTime,world:structuredClone(start)}];let edits=0;
 for(let tick=0;tick<1000;tick++){
  const next=advanceMobileWorld(w,.1);w=next.world;samples.push({time:w.simTime,world:structuredClone(w)});
  if(w.robot.cargoObjectId&&edits===0){const changed=setMobileFloorObstacle(w,[0,-1.5]);assert.equal(changed.error,undefined);w=changed.world;samples.push({time:w.simTime,world:structuredClone(w)});edits++;}
  else if(edits===1){w=setMobileFloorObstacle(w,[1.7,1.6]).world;samples.push({time:w.simTime,world:structuredClone(w)});edits++;}
  else if(edits===2){w=setMobileFloorObstacle(w,null).world;samples.push({time:w.simTime,world:structuredClone(w)});edits++;}
  if(next.done)break;
 }
 return {initial:start,w,samples};
}
test('actual live block additions moves and removal preserve native evidence with explicit intervention provenance',()=>{
 const {initial,w,samples}=liveFixture();const evidence=createMobileEvidence(initial,samples,w,null);
 assert.equal(w.mission?.status,'completed');assert.ok(evidence.checks.every(item=>item.passed));
 assert.deepEqual(evidence.provenance.layoutInterventions.map(item=>item.action),['placed','moved','removed']);
 assert.equal(evidence.provenance.sceneConditions,'live-operator-layout-interventions');assert.equal(evidence.provenance.matchedComparison,false);
});
test('rounded signed-zero control coordinates preserve a legitimate floor-click intervention',()=>{
 const {initial,w,samples}=liveFixture();
 for(const sample of samples)for(const event of sample.world.events)event.message=event.message.replace('placed at (0.00,','placed at (-0.00,');
 const evidence=createMobileEvidence(initial,samples,samples.at(-1)!.world,null);
 assert.equal(w.mission?.status,'completed');assert.equal(evidence.provenance.layoutInterventions.length,3);
});
test('live crate exception cannot hide furniture changes, missing control events or unsupported geometry',()=>{
 const fixture=liveFixture();
 for(const mutate of[
  (samples:typeof fixture.samples)=>{samples[2].world.obstacles[0].minX-=.1;},
  (samples:typeof fixture.samples)=>{for(const sample of samples)sample.world.events=sample.world.events.filter(event=>!event.message.startsWith('Sandbox floor block'));},
  (samples:typeof fixture.samples)=>{const item=samples.flatMap(s=>s.world.obstacles).find(item=>item.id==='sandbox-floor-block')!;item.label='Untracked furniture';},
  (samples:typeof fixture.samples)=>{const item=samples.flatMap(s=>s.world.obstacles).find(item=>item.id==='sandbox-floor-block')!;item.maxX+=.01;},
 ]){const samples=structuredClone(fixture.samples);mutate(samples);assert.throws(()=>createMobileEvidence(fixture.initial,samples,samples.at(-1)!.world,null),/layout|furniture|block|intervention/i);}
});
