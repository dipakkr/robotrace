import { mobileGoalChecks, mobileSegmentIsClear, MOBILE_FLOOR_BLOCK_ID, MOBILE_FLOOR_BLOCK_LABEL, MOBILE_FLOOR_BLOCK_SIZE } from '../sim/mobile-navigation';
import type { MobileWorld, MobileObstacle } from '../sim/mobile-navigation';
import { solveMobileArm } from '../sim/mobile-arm';
export interface MobileSample { time:number;world:MobileWorld }
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const finite=(value:unknown):boolean=>typeof value==='number'?Number.isFinite(value):value===null||typeof value==='string'||typeof value==='boolean'||Array.isArray(value)?(Array.isArray(value)?value.every(finite):true):typeof value==='object'&&value!==null?Object.values(value).every(v=>v===undefined||finite(v)):false;
export interface MobileLayoutIntervention { time:number; action:'placed'|'moved'|'removed'; obstacle:MobileObstacle|null }
/** One reserved live block may change only with its actual same-clock control marker. */
export function validateMobileLayoutHistory(initial:MobileWorld,samples:MobileSample[]):MobileLayoutIntervention[]{
 const fixed=(world:MobileWorld)=>world.obstacles.filter(item=>item.id!==MOBILE_FLOOR_BLOCK_ID);
 const readBlock=(world:MobileWorld,placement=false)=>{
  if(!Array.isArray(world.obstacles)||new Set(world.obstacles.map(item=>item.id)).size!==world.obstacles.length)throw new Error('Recorded obstacle identities must remain unique.');
  const item=world.obstacles.find(item=>item.id===MOBILE_FLOOR_BLOCK_ID);if(!item)return null;
  const keys=['id','label','minX','maxX','minZ','maxZ'],b=world.bounds;
  if(Object.keys(item).length!==6||!keys.every(key=>Object.hasOwn(item,key))||item.label!==MOBILE_FLOOR_BLOCK_LABEL||![item.minX,item.maxX,item.minZ,item.maxZ].every(Number.isFinite)
   ||Math.abs(item.maxX-item.minX-MOBILE_FLOOR_BLOCK_SIZE)>1e-9||Math.abs(item.maxZ-item.minZ-MOBILE_FLOOR_BLOCK_SIZE)>1e-9||item.minX<b.minX||item.maxX>b.maxX||item.minZ<b.minZ||item.maxZ>b.maxZ)throw new Error('The reserved live block needs its bounded supported square geometry and label.');
  if(fixed(world).some(other=>item.minX<=other.maxX+.03&&item.maxX>=other.minX-.03&&item.minZ<=other.maxZ+.03&&item.maxZ>=other.minZ-.03))throw new Error('The live block cannot overlap fixed furniture.');
  if(placement){const hits=(point:number[],radius:number)=>point[0]>=item.minX-radius-.03&&point[0]<=item.maxX+radius+.03&&point[1]>=item.minZ-radius-.03&&point[1]<=item.maxZ+radius+.03;
   if(hits(world.robot.position,world.robot.radius)||(world.human&&hits(world.human.position,world.human.radius)))throw new Error('A placed live block must stay clear of the recorded base and person.');}
  return item;
 };
 let previous=initial,prior=readBlock(initial,true);const changes:MobileLayoutIntervention[]=[];
 for(const sample of samples){const world=sample.world;
  for(const key of ['seed','bounds','stations'] as const)if(!equal(world[key],initial[key]))throw new Error('A recorded mobile scene cannot silently change its layout.');
  if(!equal(fixed(world),fixed(initial)))throw new Error('Fixed furniture cannot change in a live mobile recording.');
  const current=readBlock(world);if(!equal(current,prior)){if(current)readBlock(world,true);
   const action=!current?'removed':!prior?'placed':'moved';const x=current?(current.minX+current.maxX)/2:0,z=current?(current.minZ+current.maxZ)/2:0;
   const marker=(event:MobileWorld['events'][number])=>{if(event.kind!=='control'||event.time!==world.simTime)return false;
    if(!current)return event.message==='Sandbox floor block removed; paused motion still requires explicit resume.';
    const match=event.message.match(/^Sandbox floor block (placed at|moved to) \((-?\d+\.\d{2}), (-?\d+\.\d{2})\)\.$/);
    return Boolean(match&&match[1]===(action==='placed'?'placed at':'moved to')&&Math.abs(Number(match[2])-x)<=.005000001&&Math.abs(Number(match[3])-z)<=.005000001);};
   if(world.revision<=previous.revision||world.events.filter(marker).length<=previous.events.filter(marker).length)throw new Error('A live block change needs its explicit same-clock control intervention.');
   changes.push({time:world.simTime,action,obstacle:current?structuredClone(current):null});
  }
  previous=world;prior=current;
 }
 return changes;
}
export function createMobileEvidence(initial:MobileWorld,samples:MobileSample[],final:MobileWorld,receipt:Record<string,unknown>|null){
 if(!samples.length)throw new Error('The mobile attempt needs recorded samples.');
 if(!finite(initial)||!finite(samples)||!finite(final))throw new Error('Mobile evidence must contain finite JSON state.');
 if(!equal(samples[0].world,initial))throw new Error('The first mobile sample must match the actual initial scene.');
 if(!equal(samples.at(-1)!.world,final))throw new Error('The final mobile sample must match the actual terminal state.');
 const layoutInterventions=validateMobileLayoutHistory(initial,samples);
 let previous=-Infinity;
 for(const sample of samples){
  const w=sample.world;if(w.schema!=='teachtrace.mobile-kitchen.v1'||sample.time<previous||Math.abs(sample.time-w.simTime)>1e-6)throw new Error('Mobile sample clocks must be chronological and agree with controller time.');
  previous=sample.time;
  if(!equal(w.objects.map(o=>o.id),initial.objects.map(o=>o.id)))throw new Error('Mobile object identities changed during the attempt.');
  if(!mobileSegmentIsClear(w,w.robot.position,w.robot.position))throw new Error('A recorded mobile base pose intersects the known static map.');
  if(w.robot.cargoObjectId){const cargo=w.objects.find(o=>o.id===w.robot.cargoObjectId);if(!cargo||cargo.station!=='robot'||!['carried','unloading'].includes(cargo.status))throw new Error('The recorded cargo identity or held state is inconsistent.');if(cargo.status==='carried'&&Math.hypot(cargo.position[0]-w.robot.position[0],cargo.position[1]-w.robot.position[1])>1e-6)throw new Error('The recorded cargo does not follow the mobile base.');if(cargo.status==='unloading'&&w.mission?.plan.steps[w.mission.stepIndex]?.kind!=='place')throw new Error('An unloading object requires an active placement step.');}
 }
 const checks=mobileGoalChecks(final);if(receipt?.status==='succeeded'&&(receipt.verified!==true||!checks.every(c=>c.passed)))throw new Error('A successful mobile receipt requires independently recomputed task checks.');
 return {schema:'teachtrace.mobile-evaluation.v1' as const,generatedAt:new Date().toISOString(),initialWorld:structuredClone(initial),finalWorld:structuredClone(final),trajectory:samples.map(sample=>({...structuredClone(sample),arm:solveMobileArm(sample.world)})),checks,receipt:receipt?structuredClone(receipt):null,provenance:{source:'simulated-mobile-controller',sceneConditions:layoutInterventions.length?'live-operator-layout-interventions':'fixed-recorded-layout',layoutInterventions,matchedComparison:false,coordinateFrame:'simulator-world',positionUnit:'meters',angleUnit:'radians',timeUnit:'simulated-seconds',observationRate:'approximately 10 Hz plus control and terminal events',humanRecording:false,measuredMotorTelemetry:false,learnedPolicy:false,physicalTransferValidated:false,trainingAdapterValidated:false,limits:[...final.simulation.limitations,...solveMobileArm(final).limitations]}};
}
