import { mobileGoalChecks, mobileSegmentIsClear } from '../sim/mobile-navigation';
import type { MobileWorld } from '../sim/mobile-navigation';
import { solveMobileArm } from '../sim/mobile-arm';
export interface MobileSample { time:number;world:MobileWorld }
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const finite=(value:unknown):boolean=>typeof value==='number'?Number.isFinite(value):value===null||typeof value==='string'||typeof value==='boolean'||Array.isArray(value)?(Array.isArray(value)?value.every(finite):true):typeof value==='object'&&value!==null?Object.values(value).every(v=>v===undefined||finite(v)):false;
export function createMobileEvidence(initial:MobileWorld,samples:MobileSample[],final:MobileWorld,receipt:Record<string,unknown>|null){
 if(!samples.length)throw new Error('The mobile attempt needs recorded samples.');
 if(!finite(initial)||!finite(samples)||!finite(final))throw new Error('Mobile evidence must contain finite JSON state.');
 if(!equal(samples[0].world,initial))throw new Error('The first mobile sample must match the actual initial scene.');
 if(!equal(samples.at(-1)!.world,final))throw new Error('The final mobile sample must match the actual terminal state.');
 let previous=-Infinity;
 for(const sample of samples){
  const w=sample.world;if(w.schema!=='teachtrace.mobile-kitchen.v1'||sample.time<previous||Math.abs(sample.time-w.simTime)>1e-6)throw new Error('Mobile sample clocks must be chronological and agree with controller time.');
  previous=sample.time;
  for(const key of ['seed','bounds','obstacles','stations'] as const)if(!equal(w[key],initial[key]))throw new Error('A recorded mobile scene cannot silently change its layout.');
  if(!equal(w.objects.map(o=>o.id),initial.objects.map(o=>o.id)))throw new Error('Mobile object identities changed during the attempt.');
  if(!mobileSegmentIsClear(w,w.robot.position,w.robot.position))throw new Error('A recorded mobile base pose intersects the known static map.');
  if(w.robot.cargoObjectId){const cargo=w.objects.find(o=>o.id===w.robot.cargoObjectId);if(!cargo||cargo.station!=='robot'||!['carried','unloading'].includes(cargo.status))throw new Error('The recorded cargo identity or held state is inconsistent.');if(cargo.status==='carried'&&Math.hypot(cargo.position[0]-w.robot.position[0],cargo.position[1]-w.robot.position[1])>1e-6)throw new Error('The recorded cargo does not follow the mobile base.');if(cargo.status==='unloading'&&w.mission?.plan.steps[w.mission.stepIndex]?.kind!=='place')throw new Error('An unloading object requires an active placement step.');}
 }
 const checks=mobileGoalChecks(final);if(receipt?.status==='succeeded'&&(receipt.verified!==true||!checks.every(c=>c.passed)))throw new Error('A successful mobile receipt requires independently recomputed task checks.');
 return {schema:'teachtrace.mobile-evaluation.v1' as const,generatedAt:new Date().toISOString(),initialWorld:structuredClone(initial),finalWorld:structuredClone(final),trajectory:samples.map(sample=>({...structuredClone(sample),arm:solveMobileArm(sample.world)})),checks,receipt:receipt?structuredClone(receipt):null,provenance:{source:'simulated-mobile-controller',coordinateFrame:'simulator-world',positionUnit:'meters',angleUnit:'radians',timeUnit:'simulated-seconds',observationRate:'approximately 10 Hz plus control and terminal events',humanRecording:false,measuredMotorTelemetry:false,learnedPolicy:false,physicalTransferValidated:false,trainingAdapterValidated:false,limits:[...final.simulation.limitations,...solveMobileArm(final).limitations]}};
}
