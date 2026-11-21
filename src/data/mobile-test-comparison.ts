import {mobileGoalChecks,planMobileTask} from '../sim/mobile-navigation';
import type {MobileWorld} from '../sim/mobile-navigation';
import {validateMobileLayoutHistory} from './mobile-evidence';
import type {createMobileEvidence} from './mobile-evidence';
import {mobileProtectedChange,MOBILE_PROTECTED_POLICY} from './mobile-protected-policy.mjs';

export interface MobileTestAttempt {id:string;command:string;outcome:string;payload:ReturnType<typeof createMobileEvidence>}
export interface MobileTestCheck {id:string;name:string;passed:boolean;detail:string}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const location=(world:MobileWorld,station:string)=>station==='robot'?'Held on carrier':world.stations.find(item=>item.id===station)?.label??station;
/** Read-only, same-recording comparison. Posted receipt/check scores are never acceptance inputs. */
export function compareMobileTestAttempt(attempt:MobileTestAttempt){
 const {initialWorld:initial,finalWorld:final,trajectory}=attempt.payload;
 const mission=final.mission,goal=mission?.plan.goal;
 const declared=planMobileTask(attempt.command,initial);
 const checks:MobileTestCheck[]=[...mobileGoalChecks(final)];
 const goalMatches=!!goal&&!!declared.goal&&Object.keys(goal).every(key=>['objectId','stationId','hold','position'].includes(key))&&goal.objectId===declared.goal.objectId&&goal.stationId===declared.goal.stationId&&goal.hold===declared.goal.hold&&equal(goal.position,declared.goal.position);
 const endpoints=trajectory.length>0&&equal(trajectory[0].world,initial)&&equal(trajectory.at(-1)!.world,final);
 let previousTime=-Infinity,chronological=true,identities=true;
 for(const sample of trajectory){if(!Number.isFinite(sample.time)||sample.time<previousTime||Math.abs(sample.time-sample.world.simTime)>1e-6)chronological=false;previousTime=sample.time;if(!equal(sample.world.objects.map(item=>item.id),initial.objects.map(item=>item.id)))identities=false;}
 checks.push({id:'record-endpoints',name:'Recorded endpoints and clocks agree',passed:endpoints&&chronological&&identities,detail:'Before and after must be the first and last chronological snapshots; object identities cannot change.'});
 checks.push({id:'requested-goal',name:'Executed goal matches the requested command',passed:!declared.error&&!declared.control&&goalMatches,detail:'Reparse the recorded instruction against its actual initial scene; never replace it with a successful final destination.'});
 let layoutInterventions:ReturnType<typeof validateMobileLayoutHistory>=[],layoutError='';
 try{layoutInterventions=validateMobileLayoutHistory(initial,trajectory);}catch(error){layoutError=error instanceof Error?error.message:'The recorded layout is inconsistent.';}
 checks.push({id:'recorded-layout',name:'Layout changes retain their intervention provenance',passed:!layoutError,detail:layoutError||'Fixed furniture is preserved; the reserved movable block requires its recorded control marker.'});
 const navigationCargoId=!goal?.objectId?initial.robot.cargoObjectId:null;
 let heldObjectPlaced=false;
 const protectedObjects=initial.objects.filter(object=>object.id!==goal?.objectId&&object.id!==navigationCargoId);
 const violations:{objectId:string;label:string;timeSeconds:number;worldTimeSeconds:number;changedFields:string[];reason:string}[]=[];
 let previous=initial,pickups=0,placements=0,humanChanges=0,custody=true;
 for(const sample of trajectory){const world=sample.world,step=world.mission?.plan.id===mission?.plan.id?world.mission?.plan.steps[world.mission.stepIndex]:undefined;
  if(goal?.hold&&step?.kind==='place'&&step.objectId===goal.objectId)heldObjectPlaced=true;
  if(!equal(previous.human,world.human))humanChanges++;
  for(const object of world.objects){const prior=previous.objects.find(item=>item.id===object.id);if(object.status==='carried'&&prior?.status!=='carried')pickups++;if(object.status==='delivered'&&prior?.status!=='delivered'){placements++;if(goal?.hold&&object.id===goal.objectId)heldObjectPlaced=true;}}
  for(const object of protectedObjects){if(violations.some(item=>item.objectId===object.id))continue;const current=world.objects.find(item=>item.id===object.id),change=mobileProtectedChange(object,current);const handled=!!step&&['pickup','place'].includes(step.kind)&&'objectId'in step&&step.objectId===object.id;const held=world.robot.cargoObjectId===object.id;
   if(change.violated||handled||held)violations.push({objectId:object.id,label:object.label,timeSeconds:world.simTime-initial.simTime,worldTimeSeconds:world.simTime,changedFields:change.changedFields,reason:change.violated?'Recorded object state changed':held?'Unrequested object became cargo':'Unrequested object is an active handling target'});
  }
  if(navigationCargoId){const cargo=world.objects.find(object=>object.id===navigationCargoId);if(!cargo||world.robot.cargoObjectId!==navigationCargoId||cargo.station!=='robot'||cargo.status!=='carried'||Math.hypot(cargo.position[0]-world.robot.position[0],cargo.position[1]-world.robot.position[1])>1e-6||Math.abs(cargo.height-1)>1e-6||(step&&['pickup','place'].includes(step.kind)&&'objectId'in step&&step.objectId===navigationCargoId))custody=false;}
  previous=world;
 }
 for(const object of protectedObjects)checks.push({id:`protected-${object.id}`,name:`${object.label} stayed untouched`,passed:!violations.some(item=>item.objectId===object.id),detail:'Every recorded sample, cargo identity and active handling target is checked. Returning an object to its original final state does not erase a violation.'});
 if(navigationCargoId)checks.push({id:'cargo-custody',name:'Navigation preserved the existing payload',passed:custody,detail:'The initially held object must remain carried and aligned with the base across every recorded state, without placing or reloading it.'});
 if(goal?.hold)checks.push({id:'hold-without-release',name:'Pickup or carry never placed the requested object',passed:!heldObjectPlaced,detail:'Every recorded active placement and delivered-state transition is checked; releasing and reloading the final held object does not satisfy a hold-only request.'});
 const elapsed=final.simTime-initial.simTime,distance=final.distanceTravelled-initial.distanceTravelled;
 checks.push({id:'recorded-metrics',name:'Recorded elapsed time and travel are valid',passed:Number.isFinite(elapsed)&&Number.isFinite(distance)&&elapsed>=0&&distance>=0,detail:'Report actual final-minus-initial counters; do not substitute predicted or cumulative session totals.'});
 const outcome=mission?.status==='completed'?'completed':mission?.status==='failed'||final.robot.mode==='error'?'failed':mission?.status==='stopped'||final.robot.mode==='stopped'?'stopped':final.robot.mode==='paused'?'paused':mission?'running':'not-started';
 const accepted=outcome==='completed'&&final.robot.mode==='idle'&&checks.every(check=>check.passed);
 const taskKind=goal?.hold?(mission?.plan.steps.at(-1)?.kind==='pickup'?'pickup':'carry'):goal?.objectId?'delivery':goal?'navigation':'undefined';
 const priorEvents=new Set(initial.events.map(event=>JSON.stringify(event))),observedEvents=new Map<string,MobileWorld['events'][number]>();
 for(const sample of trajectory)for(const event of sample.world.events){const key=JSON.stringify(event);if(!priorEvents.has(key))observedEvents.set(key,event);}
 return {id:attempt.id,command:attempt.command,reportedOutcome:attempt.outcome,outcome,taskKind,accepted,checks,requestedGoal:declared.goal??null,
  scope:'Recorded before / after from one attempt; not a matched candidate comparison or a counterfactual.',
  observationBasis:'Recorded snapshots and recorded active handling only; this view does not recover unrecorded between-sample motion.',protectedObjectPolicy:MOBILE_PROTECTED_POLICY,violations,
  metrics:{durationSeconds:elapsed,distanceTravelled:distance,sampleCount:trajectory.length,completedSteps:mission?.completedSteps??0,observedPickups:pickups,observedPlacements:placements},
  interventions:{humanChanges,floorBlockChanges:layoutInterventions.length,reroutes:[...observedEvents.values()].filter(event=>/^Rerouted around/.test(event.message)).length,layoutInterventions},
  objects:initial.objects.map(object=>{const after=final.objects.find(item=>item.id===object.id);return{id:object.id,label:object.label,requested:object.id===goal?.objectId,protected:protectedObjects.some(item=>item.id===object.id),before:{location:location(initial,object.station),status:object.status,position:[object.position[0],object.height+.09,object.position[1]]},after:after?{location:location(final,after.station),status:after.status,position:[after.position[0],after.height+.09,after.position[1]]}:null};}),
 };
}
