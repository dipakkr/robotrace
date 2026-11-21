import type { SceneLineage } from '../data/scene-lineage';
import { armTraceSample } from '../data/robot-trace';
import { planCommand } from './engine';
import type { WorldState } from './engine';
import { evaluateCandidatePlan } from './candidate-plans';
import type { CandidatePlanResult } from './candidate-plans';
export type VariationKind = 'layout' | 'reach-challenge' | 'human-occupied';
export interface DataVariation { id: string; seed: number; index: number; kind: VariationKind; expected: 'completion' | 'refusal'; result: CandidatePlanResult; matchedExpectation: boolean; motionTrace: { schema: 'teachtrace.arm-trace.v1'; measuredMotorTelemetry: false; samples: ReturnType<typeof armTraceSample>[] } }
export interface VariationBatch {
 schema: 'teachtrace.synthetic-evaluations.v1'; generatedAt: string; evaluationDurationMs: number; lineage?: SceneLineage; seed: number; parent: { instruction: string; initialWorld: WorldState };
 provenance: { source: 'seeded-kinematic-variation'; realRecordingCount: 0; robotPolicyTrained: false; physicalTransferValidated: false; limitations: string[] };
 telemetrySummary: { poseSamples: number; recordedJointsPerSample: 3; nominalSampleRateHz: 10; positionUnit: 'meters'; angleUnit: 'radians' };
 cases: DataVariation[]; summary: { total: number; completedTasks: number; refusals: number; unexpectedFailures: number; matchedExpectations: number };
}
export function createVariationBatch(initial: WorldState, instruction: string, count: number, seed: number): VariationBatch {
 const started = performance.now();
 if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Choose between 1 and 100 scene variations.');
 if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Use an unsigned 32-bit integer seed.');
 if (initial.robot.mode !== 'idle' || initial.motion || initial.robot.heldObjectId) throw new Error('Use a settled scene with an idle robot and empty gripper.');
 const planned=planCommand(instruction,initial); if (planned.error || !planned.steps.length || planned.control) throw new Error(planned.error || 'This task has no executable manipulation plan.');
 const movable=new Set(planned.steps.map(s=>s.objectId));
 let state=seed>>>0; const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const cases=Array.from({length:count},(_,index):DataVariation=>{
  const world=structuredClone(initial);world.humanPresence={state:'clear',source:'scenario-proxy'};
  const kind:VariationKind=index%5===3?'reach-challenge':index%5===4?'human-occupied':'layout';
  for(const object of world.objects) if(movable.has(object.id)&&object.location==='table') {object.position[0]+=(random()-.5)*.16;object.position[2]+=(random()-.5)*.12;}
  if(kind==='reach-challenge'){const object=world.objects.find(o=>movable.has(o.id));if(object)object.position=[1.92,object.position[1],-.95];}
  if(kind==='human-occupied')world.humanPresence={state:'in-workspace',source:'scenario-proxy'};
  const trace: ReturnType<typeof armTraceSample>[] = [];
  const result=evaluateCandidatePlan({onSample: (snapshot, time) => trace.push(armTraceSample(time, snapshot)),world,steps:planned.steps.filter(s=>s.kind==='pick_place').map(s=>({objectId:s.objectId,destination:s.destination})),source:'baseline',label:`Seed ${seed} · variation ${index+1}`,instruction});
  const expected=kind==='layout'?'completion':'refusal';
  const matchedExpectation=expected==='completion'?result.taskAccepted:result.outcome==='failed'&&!result.taskAccepted&&Boolean(result.error?.toLowerCase().includes(kind==='reach-challenge'?'outside the configured workcell reach':'human'));
  return {id:`variation-${seed}-${index}`,seed,index,kind,expected,result,matchedExpectation,motionTrace:{schema:'teachtrace.arm-trace.v1',measuredMotorTelemetry:false,samples:trace}};
 });
 return {schema:'teachtrace.synthetic-evaluations.v1',generatedAt:new Date().toISOString(),evaluationDurationMs:Math.round((performance.now()-started)*100)/100,seed,parent:{instruction,initialWorld:structuredClone(initial)},provenance:{source:'seeded-kinematic-variation',realRecordingCount:0,robotPolicyTrained:false,physicalTransferValidated:false,limitations:['Synthetic task and controller evaluation samples, not recorded human actions or calibrated robot training trajectories.','Deterministic planner and idealized attachment; no contact dynamics, perception noise or transfer performance measured.','Variations are correlated descendants of one scene; sample count does not measure independent real-world coverage.']},cases,telemetrySummary:{poseSamples:cases.reduce((sum,c)=>sum+c.motionTrace.samples.length,0),recordedJointsPerSample:3,nominalSampleRateHz:10,positionUnit:'meters',angleUnit:'radians'},summary:{total:cases.length,completedTasks:cases.filter(c=>c.result.taskAccepted).length,refusals:cases.filter(c=>c.expected==='refusal'&&c.matchedExpectation).length,unexpectedFailures:cases.filter(c=>!c.matchedExpectation).length,matchedExpectations:cases.filter(c=>c.matchedExpectation).length}};
}
