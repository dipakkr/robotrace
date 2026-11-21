import type {MobilePoint,MobileWorld} from '../sim/mobile-navigation';
import {mobileSegmentAvoidsHuman,mobileSegmentIsClear} from '../sim/mobile-navigation';
import type {VoiceExperiment,VoiceExperimentReport} from './voice-experiment';
import {compareMobileTestAttempt} from './mobile-test-comparison';
import {auditMobileRoute,mobileRouteLength} from './route-audit';
const clone=<T,>(value:T):T=>structuredClone(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Derive a shareable account of recorded kinematic tests. Never executes a new test
 * or replaces the immutable saved evaluator's ASR grades with current grades. */
export function buildPhysicalEvaluationReport(experiment:VoiceExperiment,savedReport:VoiceExperimentReport){
 if(savedReport.experimentId!==experiment.id)throw Error('The saved report must belong to this exact experiment.');
 const attempts=experiment.attempts.map(attempt=>{
  const {initialWorld:initial,finalWorld:final,trajectory}=attempt.payload;
  const analysis=compareMobileTestAttempt(attempt),missionId=final.mission?.plan.id;
  const firstActive=missionId?trajectory.find(sample=>sample.world.mission?.plan.id===missionId)?.world:undefined;
  const firstPlan=firstActive?.mission?.plan??final.mission?.plan;
  const plannedSegments=(firstPlan?.steps??[]).flatMap((step,index)=>step.kind==='navigate'?[{stepIndex:index,path:clone(step.path)}]:[]);
  const planned:MobilePoint[]=[];
  for(const segment of plannedSegments)for(const point of segment.path)if(!planned.length||!same(planned.at(-1),point))planned.push(clone(point));
  const actual=trajectory.map(sample=>clone(sample.world.robot.position));
  const humanPositions:{timeSeconds:number;position:MobilePoint;radius:number}[]=[];
  const routeChanges:{timeSeconds:number;stepIndex:number;path:MobilePoint[]}[]=[];
  const knownPaths=new Map(plannedSegments.map(segment=>[segment.stepIndex,JSON.stringify(segment.path)]));
  let priorHuman:MobileWorld['human']=null;
  for(const sample of trajectory){const world=sample.world;
   if(world.human&&!same(priorHuman,world.human))humanPositions.push({timeSeconds:world.simTime-initial.simTime,position:clone(world.human.position),radius:world.human.radius});
   priorHuman=world.human;
   if(world.mission&&world.mission.plan.id===missionId)world.mission.plan.steps.forEach((step,index)=>{if(step.kind!=='navigate')return;const key=JSON.stringify(step.path);if(knownPaths.get(index)!==key){routeChanges.push({timeSeconds:world.simTime-initial.simTime,stepIndex:index,path:clone(step.path)});knownPaths.set(index,key);}});
  }
  const plannedLengthMeters=plannedSegments.reduce((sum,segment)=>sum+mobileRouteLength(segment.path),0);
  const actualSampledPathMeters=mobileRouteLength(actual);
  const actualTravelMeters=analysis.metrics.distanceTravelled;
  const durationSeconds=analysis.metrics.durationSeconds;
  let movingSeconds=0,stationarySeconds=0,rotationSeconds=0,peakSampledMetersPerSimSecond=0;
  for(let index=1;index<trajectory.length;index++){
   const prior=trajectory[index-1].world,current=trajectory[index].world,dt=current.simTime-prior.simTime;
   if(dt<=0)continue;
   const moved=Math.hypot(current.robot.position[0]-prior.robot.position[0],current.robot.position[1]-prior.robot.position[1]);
   const turned=Math.abs(Math.atan2(Math.sin(current.robot.yaw-prior.robot.yaw),Math.cos(current.robot.yaw-prior.robot.yaw)));
   peakSampledMetersPerSimSecond=Math.max(peakSampledMetersPerSimSecond,moved/dt);
   if(moved>1e-6)movingSeconds+=dt;else{stationarySeconds+=dt;if(turned>1e-6)rotationSeconds+=dt;}
  }
  const speed={averageMetersPerSimSecond:durationSeconds>0?actualTravelMeters/durationSeconds:0,configuredMetersPerSimSecond:initial.robot.speed,movingSeconds,stationarySeconds,peakSampledMetersPerSimSecond,rotationSeconds,basis:'native-simulated-state-intervals; not motor telemetry or wall-clock speed' as const};

  const netDisplacementMeters=Math.hypot(final.robot.position[0]-initial.robot.position[0],final.robot.position[1]-initial.robot.position[1]);
  const conditionsChanged=analysis.interventions.humanChanges>0||analysis.interventions.floorBlockChanges>0;
  const originalPlanClear=plannedSegments.every(segment=>segment.path.slice(1).every((point,index)=>mobileSegmentIsClear(initial,segment.path[index],point)&&mobileSegmentAvoidsHuman(initial,segment.path[index],point)));
  const audit=firstActive?auditMobileRoute(firstActive,initial):null;
  const comparable=!conditionsChanged&&originalPlanClear&&analysis.outcome==='completed'&&plannedLengthMeters>0&&actualTravelMeters>0;
  const notes=[
   'Planned waypoints are the earliest recorded plan for this mission; actual route joins recorded base samples. Handovers can occur without base travel.',
   'Sampled polyline length may undercount bends between samples. Recorded odometer delta is reported separately.',
   conditionsChanged?'Person or floor-block conditions changed during this attempt; a planned/actual efficiency ratio is not reported.':'No person/floor-block change was observed within this attempt; this does not prove the absence of unrecorded changes.',
   originalPlanClear?'The original planned segments pass the initial map/person geometric checks.':'The original plan is not clear under the initial person/map conditions; its length is not used as an efficiency baseline.',
   'Initial bounded-A* lengths describe only the first active navigation target, not a global multi-step task optimum. Extra distance alone does not fail a task or establish a model bug, physical collision or safety defect.',
  ];
  const goal=final.mission?.plan.goal,station=final.stations.find(item=>item.id===goal?.stationId);
  const expectedYawRadians=station&&station.id!=='home'&&!goal?.position&&Math.hypot(station.surface[0]-station.dock[0],station.surface[1]-station.dock[1])>1e-6?Math.atan2(station.surface[0]-station.dock[0],station.surface[1]-station.dock[1]):null;
  const errorRadians=expectedYawRadians===null?null:Math.abs(Math.atan2(Math.sin(expectedYawRadians-final.robot.yaw),Math.cos(expectedYawRadians-final.robot.yaw)));
  const orientationAssessment={status:(errorRadians===null?'not-applicable':errorRadians<=.12?'aligned':'review') as 'aligned'|'review'|'not-applicable',expectedYawRadians,observedYawRadians:final.robot.yaw,errorRadians,toleranceRadians:.12,...(station?{stationLabel:station.label}:{}),basis:'station-surface-facing diagnostic, not historical acceptance rule' as const};
  return{id:attempt.id,command:attempt.command,outcome:analysis.outcome,taskAccepted:analysis.accepted,orientationAssessment,checks:clone(analysis.checks),requestIds:savedReport.rows.filter(row=>row.observed.attemptId===attempt.id).map(row=>row.id),
   routes:{bounds:clone(initial.bounds),obstacles:clone(initial.obstacles),planned,actual,humanPositions,start:clone(initial.robot.position),end:clone(final.robot.position),plannedSegments,routeChanges,floorBlockChanges:clone(analysis.interventions.layoutInterventions)},
   metrics:{plannedLengthMeters,actualSampledPathMeters,actualTravelMeters,netDisplacementMeters,durationSeconds,sampleCount:trajectory.length,speed,plannedToActualTravelRatio:comparable?plannedLengthMeters/actualTravelMeters:null},
   routeAssessment:{conditionsChanged,personChanges:analysis.interventions.humanChanges,blockChanges:analysis.interventions.floorBlockChanges,reroutes:analysis.interventions.reroutes,initialStaticBoundedRouteMeters:audit?.staticBoundedRouteMeters??null,initialHumanAwareBoundedRouteMeters:audit?.humanAwareBoundedRouteMeters??null,notes},
  };
 });
 const counts=clone(savedReport.counts),accepted=attempts.filter(attempt=>attempt.taskAccepted).length;
 const conclusions=[`${counts.passed} recorded requests passed, ${counts.failed+counts['request-failed']} failed, ${counts.unscored} remain unscored and ${counts.cancelled} were cancelled under the saved evaluator.`,`${accepted}/${attempts.length} recorded native attempts satisfy recomputed task-level state/history checks. Native task success is separate from fulfilling the original spoken request.`,...(attempts.length?[]:['No native attempt was recorded. No route, motion or task-completion success is invented.']),...(experiment.recording.truncated?['This recording is truncated and cannot establish an overall pass.']:[]),'These are individual recorded software tests, not a learned-policy benchmark, statistical improvement estimate or real-robot deployment approval.'];
 return{schema:'robotrace.physical-evaluation-report.v1' as const,title:'RoboTrace · Physical AI task-level evaluation',executiveSummary:`${attempts.length} recorded action attempts with planned/actual routes. ${counts.passed} requested outcomes passed; ${counts.failed+counts['request-failed']} failed and ${counts.unscored} were unscored.`,
  scope:{level:'task-level-kinematic-qa',learnedPolicy:false,measuredHardware:false,physicalTransferValidated:false,sourceIdentityVerified:false,basis:'Read-only derivation of recorded simulator states plus the immutable saved request report. No new execution or counterfactual run.'},
  identity:{experimentId:experiment.id,environmentId:experiment.environmentId,startedAt:experiment.startedAt,endedAt:experiment.endedAt,seed:experiment.initialWorld.seed,savedEvaluatorRevision:savedReport.evaluatorRevision??'historical-unversioned',initialStateIdentity:'Recorded state and seed; seed alone is not a scene hash or authentication proof.'},
  requestSummary:counts,requests:clone(savedReport.rows),attempts,conclusions,
  limits:['ASR is recorded recognition, not guaranteed original spoken words. Recorded explicit and temporal-only association confidence is preserved.','Saved evaluator grades and revision are preserved; current native checks are separately derived, not silently substituted for historical speech grades.','Floor X/Z coordinates and distances use simulated metres. Arm/TCP positions are analytic, not measured encoders.','No contact dynamics, swept-volume robot-arm collision, calibrated human tracking or validated sim-to-real transfer.','Route alternatives use bounded grid A* on one recorded snapshot; not continuous-space optimality, speed optimality or physical-safety proof.','The planned-to-recorded travel ratio, when present, is descriptive and not a model performance grade.'],
 };
}
export type PhysicalEvaluationReport=ReturnType<typeof buildPhysicalEvaluationReport>;
