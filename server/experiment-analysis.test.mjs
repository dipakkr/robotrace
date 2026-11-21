import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {createExperimentStore} from './experiment-store.mjs';
import {createApiServer} from './index.mjs';
const {createMobileKitchen}=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
function fixture(text){const initial=createMobileKitchen(),startedAt=1700000000000;return{schema:'robotrace.voice-experiment.v1',id:randomUUID(),startedAt,endedAt:startedAt+20000,environmentId:'mobile-kitchen',initialWorld:initial,finalWorld:structuredClone(initial),events:[],transcripts:[{id:'user:1',speaker:'user',text,final:true,receivedAt:startedAt+100}],attempts:[],recording:{truncated:false,droppedEvents:0,droppedTranscripts:0,droppedAttempts:0}};}
test('explicit HTTP reanalysis grades supported unexecuted Hindi navigation without rewriting the historical saved report',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'robotrace-reevaluation-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const store=createExperimentStore({dataDirectory:directory}),receipt=await store.save({experiment:fixture('Table के पास जाओ.')}),path=join(directory,'.experiments',`${receipt.id}.json`);
 // A sealed fixture from the preceding evaluator revision, which did not understand this wording.
 const historical=JSON.parse(await readFile(path,'utf8'));historical.report.evaluatorRevision='robotrace-request-eval.3';historical.report.status='unscored';historical.report.counts={passed:0,failed:0,unscored:1,'request-failed':0,cancelled:0};historical.report.rows[0].status='unscored';historical.report.rows[0].reason='Historical evaluator did not score this wording.';historical.report.rows[0].expected=null;
 const {integrity,...unsigned}=historical;integrity.sha256=createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');await writeFile(path,JSON.stringify({...unsigned,integrity}));const original=await readFile(path,'utf8');
 const server=createApiServer({env:{},dataDirectory:directory,fetchImpl:()=>assert.fail('Reanalysis must not call a provider or execute a new task')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(`${base}/api/experiments/${receipt.id}/reevaluate`),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.report.evaluatorRevision,'robotrace-request-eval.4');assert.equal(result.report.rows[0].status,'failed');assert.equal(result.report.rows[0].observed.pathDistanceMeters,0);assert.equal(result.report.rows[0].observed.attemptId,null);assert.equal(result.report.attemptCount,0);assert.deepEqual(result.savedReport,historical.report);assert.deepEqual(result.sourceRecord.integrity,integrity);assert.match(result.analysisProvenance,/no new execution/);assert.equal(await readFile(path,'utf8'),original);assert.deepEqual((await store.get(receipt.id)).report,historical.report);
 const garbled=await store.save({experiment:fixture('कब को उठाओ?')}),ambiguous=await(await fetch(`${base}/api/experiments/${garbled.id}/reevaluate`)).json();assert.equal(ambiguous.report.rows[0].status,'unscored');assert.equal(ambiguous.report.counts.passed,0);assert.equal((await fetch(`${base}/api/experiments/${randomUUID()}/reevaluate`)).status,404);
});
