import test from 'node:test';
import assert from 'node:assert/strict';
import { createVariationBatch } from './data-variations';
import { WORKPLACE_CASES } from './workplace-cases';
test('one household seed yields repeatable varied scenes with actual successes and guarded refusals',()=>{
 const initial=WORKPLACE_CASES[0].world;const before=structuredClone(initial);
 const a=createVariationBatch(initial,WORKPLACE_CASES[0].instruction,10,42),b=createVariationBatch(initial,WORKPLACE_CASES[0].instruction,10,42);
 assert.deepEqual(a.summary,{total:10,completedTasks:6,refusals:4,unexpectedFailures:0,matchedExpectations:10});
 assert.deepEqual(a.cases.map(c=>c.result.initialWorld),b.cases.map(c=>c.result.initialWorld));assert.deepEqual(initial,before);
 assert.notDeepEqual(a.cases[0].result.initialWorld.objects,a.cases[1].result.initialWorld.objects);
 for(const c of a.cases){const protectedId=initial.customTask!.assignments.find(g=>g.unchanged)!.objectId;assert.deepEqual(c.result.finalWorld.objects.find(o=>o.id===protectedId),initial.objects.find(o=>o.id===protectedId));}
 assert.equal(a.provenance.realRecordingCount,0);
 assert.ok(a.cases[0].motionTrace.samples.length>10);
 assert.deepEqual(a.cases[0].motionTrace.samples.at(-1)!.objects.map(o=>o.position),a.cases[0].result.finalWorld.objects.map(o=>o.position));
 assert.equal(a.cases[4].motionTrace.samples.at(-1)!.time,0);
});
test('rejects invalid sample limits and active worlds',()=>{const s=WORKPLACE_CASES[0];assert.throws(()=>createVariationBatch(s.world,s.instruction,101,1));const w=s.world;w.robot.mode='running';assert.throws(()=>createVariationBatch(w,s.instruction,5,1));});
