import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {physicalReportForRecord,renderPhysicalReportHtml,renderPhysicalRouteSvg} from './physical-report.mjs';
import {createExperimentStore} from './experiment-store.mjs';
import {createApiServer} from './index.mjs';
const nav=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const {createMobileEvidence}=await tsImport('../src/data/mobile-evidence.ts',import.meta.url);
function fixture(){
 const initial=nav.createMobileKitchen();let world=initial;const samples=[{time:0,world:structuredClone(initial)}];
 world=nav.startMobilePlan(initial,nav.planMobileTask('Go straight 1 meter',initial),'immediate').world;
 for(let i=0;i<1000;i++){const result=nav.advanceMobileWorld(world,.1);world=result.world;samples.push({time:world.simTime,world:structuredClone(world)});if(result.done||result.blocked)break;}
 const startedAt=1700000000000;
 return {schema:'robotrace.voice-experiment.v1',id:randomUUID(),startedAt,endedAt:startedAt+20000,environmentId:'mobile-kitchen',initialWorld:initial,finalWorld:world,events:[],transcripts:[{id:'user:1',speaker:'user',text:'Go straight one meter',final:true,receivedAt:startedAt+100}],attempts:[{id:'attempt-1',command:'Go straight 1 meter',outcome:world.mission.status,payload:createMobileEvidence(initial,samples,world,null),metadata:{userTurnId:'user:1',startedAt:startedAt+200,endedAt:startedAt+10000}}],recording:{truncated:false,droppedEvents:0,droppedTranscripts:0,droppedAttempts:0}};
}
async function saved(t){const dir=await mkdtemp(join(tmpdir(),'robotrace-report-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=createExperimentStore({dataDirectory:dir}),receipt=await store.save({experiment:fixture()});return {dir,store,record:await store.get(receipt.id)};}
test('standalone analysis keeps the sealed historical grade and uses actual native routes without mutating source',async t=>{
 const {record}=await saved(t),before=structuredClone(record),report=await physicalReportForRecord(record);
 assert.deepEqual(record,before);assert.deepEqual(report.requests,record.report.rows);assert.deepEqual(report.requestSummary,record.report.counts);assert.equal(report.sourceRecord.integrity.sha256,record.integrity.sha256);
 assert.equal(report.attempts[0].taskAccepted,true);assert.equal(report.attempts[0].metrics.actualTravelMeters,1);assert.ok(report.attempts[0].routes.actual.length>2);assert.ok(report.attempts[0].routes.planned.length>=2);
 const html=renderPhysicalReportHtml(report);assert.match(html,/Print \/ Save PDF/);assert.match(html,/class="actual"/);assert.match(html,/class="planned"/);assert.match(html,/historical results/);assert.match(html,/No physical validation/);assert.doesNotMatch(html,/\[object Object\]/);
});
test('untrusted report text and SVG labels are escaped with no external assets or executable input',async t=>{
 const {record}=await saved(t),report=await physicalReportForRecord(record),attack='<img src=x onerror="alert(1)"><script>alert(1)</script>';
 report.title=attack;report.requests[0].source.text=attack;report.attempts[0].command=attack;report.attempts[0].routes.obstacles[0].label=attack;
 const html=renderPhysicalReportHtml(report);assert.doesNotMatch(html,/<img|<script|src="https?:|href="https?:/);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.match(html,/&quot;alert/);
 assert.equal(renderPhysicalRouteSvg({...report.attempts[0],routes:{...report.attempts[0].routes,bounds:{minX:0,maxX:0,minZ:0,maxZ:0}}}),'<p>Route bounds could not be established.</p>');
});
test('local report HTML and JSON reopen persisted evidence and download without any provider request',async t=>{
 const {dir,record,store}=await saved(t),server=createApiServer({env:{},dataDirectory:dir,fetchImpl:()=>assert.fail('No provider calls')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}/api/experiments/`;
 const response=await fetch(`${base}${record.id}/report.json`),report=await response.json();assert.equal(response.status,200);assert.equal(report.schema,'robotrace.physical-evaluation-report.v1');assert.equal(report.identity.experimentId,record.id);assert.deepEqual(report.requests,record.report.rows);
 const html=await fetch(`${base}${record.id}/report.html?download=1`);assert.equal(html.status,200);assert.match(html.headers.get('content-type'),/text\/html/);assert.match(html.headers.get('content-disposition'),/attachment; filename="robotrace-physical-evaluation/);assert.equal(html.headers.get('x-content-type-options'),'nosniff');assert.match(await html.text(),/<svg/);
 assert.equal((await fetch(`${base}${randomUUID()}/report.html`)).status,404);assert.deepEqual(await store.get(record.id),record);
});
