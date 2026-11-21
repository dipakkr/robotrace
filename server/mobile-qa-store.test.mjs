import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,readdir,stat,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {tsImport} from 'tsx/esm/api';
import {createMobileQaStore,validateMobileQaMetadata} from './mobile-qa-store.mjs';
import {evaluateMobilePlanOnServer} from './simulation.mjs';
import {createApiServer} from './index.mjs';
const {createMobileKitchen}=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const candidate={actions:[{skill:'navigate',station:'counter'},{skill:'reach-check',objectId:'cup',station:'counter'},{skill:'pickup',objectId:'cup',station:'counter'},{skill:'navigate',station:'sink'},{skill:'place',objectId:'cup',station:'sink'}]};
const input=()=>({world:createMobileKitchen(),candidate:structuredClone(candidate),goal:{objectId:'cup',stationId:'sink'},source:'baseline',label:'Actual controller QA fixture'});
const meta={caseId:'nominal',caseName:'Initial kitchen',expected:'task-completion',campaignId:'campaign-test'};
async function directory(t){const path=await mkdtemp(join(tmpdir(),'teachtrace-qa-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
async function result(){return evaluateMobilePlanOnServer(input());}
async function api(t,dataDirectory){const server=createApiServer({env:{},dataDirectory,fetchImpl:async()=>{throw Error('No provider call is allowed.');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});return `http://127.0.0.1:${server.address().port}`;}

test('actual evaluation persists privately and reloads as bounded truthful summary/detail',async t=>{
 const dataDirectory=await directory(t),store=createMobileQaStore({dataDirectory}),actual=await result();assert.equal(actual.taskAccepted,true);
 const saved=await store.save(actual,meta);assert.equal(saved.id,actual.id);assert.equal(saved.caseId,'nominal');assert.equal(saved.provenance,'client-declared-condition-labels');assert.deepEqual(saved.result,actual);
 assert.equal((await stat(join(dataDirectory,'.qa',`${actual.id}.json`))).mode&0o777,0o600);
 const reopened=createMobileQaStore({dataDirectory}),list=await reopened.list();assert.equal(list.runs.length,1);const summary=list.runs[0];
 assert.equal(summary.taskAccepted,true);assert.equal(summary.distanceTravelled,actual.distanceTravelled);assert.equal(summary.ticks,actual.ticks);assert.deepEqual(summary.checks,actual.checks);assert.equal(summary.protectedViolationCount,0);assert.equal(summary.result,undefined);assert.equal(summary.trajectory,undefined);
 assert.deepEqual(await reopened.get(saved.id),saved);
});
test('same result ID is idempotent but changed result/labels cannot overwrite it',async t=>{
 const dataDirectory=await directory(t),store=createMobileQaStore({dataDirectory}),actual=await result(),a=await store.save(actual,meta);
 assert.deepEqual(await store.save(actual,meta),a);assert.equal((await readdir(join(dataDirectory,'.qa'))).length,1);
 await assert.rejects(store.save({...actual,label:'Other run'},meta),e=>e.status===409);await assert.rejects(store.save(actual,{...meta,caseId:'other'}),e=>e.status===409);assert.deepEqual(await store.get(a.id),a);
});
test('metadata is bounded and client declared; unknown condition is never inferred as expected success',async t=>{
 const dataDirectory=await directory(t),store=createMobileQaStore({dataDirectory});
 for(const bad of[null,[],{caseId:''},{caseName:'x'.repeat(161)},{campaignId:'secret\nline'},{expected:true},{accepted:true},{caseId:'ok',world:{}}])assert.throws(()=>validateMobileQaMetadata(bad),e=>e.status===400);
 const saved=await store.save(await result());assert.equal(saved.caseId,'source-scene');assert.equal(saved.expected,'unspecified');assert.equal(saved.campaignId,null);
 for(const id of['../state','__proto__','not-a-uuid',undefined])assert.equal(await store.get(id),null);
});
test('only latest fifty are listed, while earlier native QA files stay on disk',async t=>{
 const dataDirectory=await directory(t),store=createMobileQaStore({dataDirectory}),actual=await result(),ids=[];
 for(let index=0;index<52;index++){const id=randomUUID();ids.push(id);await store.save({...actual,id},{...meta,caseId:`case-${index}`});}
 const list=await store.list();assert.equal(list.limit,50);assert.equal(list.runs.length,50);assert.equal((await readdir(join(dataDirectory,'.qa'))).filter(name=>name.endsWith('.json')).length,52);assert.equal((await store.get(ids[0])).id,ids[0]);
});
test('tampering and symbolic-link records are rejected and not shown as passing history',async t=>{
 const dataDirectory=await directory(t),store=createMobileQaStore({dataDirectory}),saved=await store.save(await result(),meta),path=join(dataDirectory,'.qa',`${saved.id}.json`);
 const changed=JSON.parse(await readFile(path,'utf8'));changed.result.taskAccepted=false;await writeFile(path,JSON.stringify(changed));await assert.rejects(store.get(saved.id),e=>e.status===422);
 const alias=randomUUID();await symlink(path,join(dataDirectory,'.qa',`${alias}.json`));await assert.rejects(store.get(alias),e=>e.status===422);const list=await store.list();assert.equal(list.runs.length,0);assert.equal(list.invalidRecordsSkipped,2);
});
test('API automatically stores every valid evaluation and retrieves it across server instances',async t=>{
 const dataDirectory=await directory(t),url=await api(t,dataDirectory);const response=await fetch(`${url}/api/evaluations/mobile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input(),qa:meta})});assert.equal(response.status,200);const actual=await response.json();assert.equal(actual.taskAccepted,true);assert.equal(actual.qaRecord.historySaved,true);assert.equal(actual.qaRecord.caseName,meta.caseName);
 const next=await api(t,dataDirectory),list=await(await fetch(`${next}/api/evaluations/mobile/history`)).json();assert.equal(list.runs.length,1);assert.equal(list.runs[0].id,actual.id);assert.equal(list.runs[0].trajectory,undefined);
 const detail=await(await fetch(`${next}/api/evaluations/mobile/history/${actual.id}`)).json();assert.deepEqual(detail.record.result.checks,actual.checks);assert.equal(detail.record.result.trajectory.length,actual.trajectory.length);assert.equal((await fetch(`${next}/api/evaluations/mobile/history/not-a-uuid`)).status,404);
 const invalid=await fetch(`${url}/api/evaluations/mobile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input(),qa:{taskAccepted:true}})});assert.equal(invalid.status,400);assert.equal((await(await fetch(`${url}/api/evaluations/mobile/history`)).json()).runs.length,1);
});
test('history write failure does not change actual evaluation or falsely claim persistence',async t=>{
 const parent=await directory(t),blocked=join(parent,'file-not-directory');await writeFile(blocked,'blocked');const url=await api(t,blocked);
 const response=await fetch(`${url}/api/evaluations/mobile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input())});assert.equal(response.status,200);const actual=await response.json();assert.equal(actual.outcome,'completed');assert.equal(actual.taskAccepted,true);assert.equal(actual.qaRecord.historySaved,false);assert.match(actual.qaRecord.warning,/could not be saved/);assert.ok(actual.trajectory.length>1);
});
