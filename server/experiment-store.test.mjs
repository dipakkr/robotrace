import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm,readFile,writeFile,readdir,stat,mkdir,link,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {createExperimentStore} from './experiment-store.mjs';
import {createApiServer} from './index.mjs';
const nav=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const {createMobileEvidence}=await tsImport('../src/data/mobile-evidence.ts',import.meta.url);
const {buildVoiceExperimentReport}=await tsImport('../src/data/voice-experiment.ts',import.meta.url);
const fileSystem={mkdir,readFile,writeFile,rm,readdir,link,lstat};
async function directory(t){const path=await mkdtemp(join(tmpdir(),'robotrace-experiments-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
function fixture({actual='Go straight 1 meter',requested='Go straight one meter',attempt=true,voice=true}={}){
 const initial=nav.createMobileKitchen();let current=initial;const samples=[{time:initial.simTime,world:structuredClone(initial)}];
 if(attempt){current=nav.startMobilePlan(initial,nav.planMobileTask(actual,initial),'immediate').world;for(let tick=0;tick<1000;tick++){const result=nav.advanceMobileWorld(current,.1);current=result.world;samples.push({time:current.simTime,world:structuredClone(current)});if(result.done||result.blocked)break;}}
 const startedAt=1700000000000,endedAt=startedAt+20000;
 const transcript={id:'user:1',speaker:'user',text:requested,final:true,receivedAt:startedAt+100};
 const event={id:'command-1',type:'operator-command',at:startedAt+100,simTime:0,data:{command:requested}};
 return {schema:'robotrace.voice-experiment.v1',id:randomUUID(),startedAt,endedAt,environmentId:'mobile-kitchen',initialWorld:initial,finalWorld:current,
  events:voice?[]:[event],transcripts:voice?[transcript]:[],attempts:attempt?[{id:'attempt-1',command:actual,outcome:current.mission.status,payload:createMobileEvidence(initial,samples,current,null),metadata:{...(voice?{userTurnId:transcript.id}:{commandEventId:event.id}),startedAt:startedAt+200,endedAt:startedAt+10000}}]:[],
  recording:{truncated:false,droppedEvents:0,droppedTranscripts:0,droppedAttempts:0}};
}
test('actual fulfilled relative motion saves privately, restarts and exports recomputed requested-vs-observed JSONL',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory}),experiment=fixture(),original=structuredClone(experiment);
 const saved=await store.save({experiment});assert.deepEqual(experiment,original);assert.equal(saved.report.counts.passed,1);assert.equal(saved.report.counts.failed,0);assert.equal(saved.report.rows[0].observed.pathDistanceMeters,1);
 assert.deepEqual(saved.report,buildVoiceExperimentReport(experiment));assert.equal((await stat(join(dataDirectory,'.experiments',`${saved.id}.json`))).mode&0o777,0o600);
 const restarted=createExperimentStore({dataDirectory}),loaded=await restarted.get(saved.id);assert.equal(loaded.id,saved.id);assert.deepEqual(loaded.report,saved.report);assert.equal(JSON.stringify(loaded.experiment),JSON.stringify(experiment));assert.deepEqual((await restarted.list()).experiments.map(row=>row.id),[saved.id]);
 const rows=(await restarted.jsonl(saved.id)).trim().split('\n').map(line=>JSON.parse(line));assert.ok(rows.some(row=>row.type==='transcript'));assert.ok(rows.some(row=>row.type==='native-attempt'));assert.equal(rows.find(row=>row.type==='requested-vs-observed').row.status,'passed');assert.equal(rows.at(-1).type,'report');
});
test('a successful wrong action with zero travel remains failed against the requested one meter; refusals do not become passes',async t=>{
 const store=createExperimentStore({dataDirectory:await directory(t)});
 const wrong=await store.save({experiment:fixture({actual:'Go Home'})});assert.equal(wrong.report.nativeAttempts[0].accepted,true);assert.equal(wrong.report.counts.failed,1);assert.equal(wrong.report.counts.passed,0);assert.equal(wrong.report.rows[0].observed.pathDistanceMeters,0);assert.equal(wrong.report.rows[0].expected.meters,1);
 const refused=await store.save({experiment:fixture({attempt:false,voice:false})});assert.equal(refused.report.counts.failed,1);assert.equal(refused.report.rows[0].observed.attemptId,null);
 const ambiguous=await store.save({experiment:fixture({requested:'कब को उठाओ?',attempt:false})});assert.equal(ambiguous.report.counts.unscored,1);assert.equal(ambiguous.report.counts.passed,0);assert.equal(ambiguous.report.rows[0].expected,null);
});
test('posted grades, malformed clocks, changed arm evidence and excessive events are refused before writes',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory});
 await assert.rejects(store.save({experiment:fixture(),report:{counts:{passed:99}}}),error=>error.status===400);
 for(const mutate of [value=>value.endedAt=value.startedAt-1,value=>value.attempts[0].payload.trajectory[1].arm.jointAngles.shoulderPitch+=.1,value=>value.events=Array.from({length:6001},(_,i)=>({id:String(i),type:'context',at:value.startedAt,simTime:0,data:{}}))]){const value=fixture();mutate(value);await assert.rejects(store.save({experiment:value}),error=>error.status===400);}
 assert.equal((await store.list()).experiments.length,0);assert.equal(await store.get('../../outside'),null);
});
test('identical saves are idempotent while UUID replacement and tampered stored reports are rejected',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory}),experiment=fixture(),saved=await store.save({experiment});assert.deepEqual(await store.save({experiment}),saved);
 const changed=structuredClone(experiment);changed.transcripts[0].text='Go straight two meters';await assert.rejects(store.save({experiment:changed}),error=>error.status===409);
 const path=join(dataDirectory,'.experiments',`${saved.id}.json`),tampered=JSON.parse(await readFile(path,'utf8'));tampered.report.counts.passed=100;await writeFile(path,JSON.stringify(tampered));await assert.rejects(store.get(saved.id),error=>error.status===422);
 const {integrity,...unsigned}=tampered;integrity.sha256=createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');await writeFile(path,JSON.stringify({...unsigned,integrity}));await assert.rejects(store.get(saved.id),error=>error.status===422);
 assert.equal((await store.list()).invalidRecordsSkipped,1);
});
test('failed persistence never returns a success receipt or leaves a partial final record',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory,fs:{...fileSystem,link:async()=>{throw Object.assign(new Error('Disk unavailable'),{code:'EIO'});}}});
 await assert.rejects(store.save({experiment:fixture()}),/Disk unavailable/);assert.deepEqual(await readdir(join(dataDirectory,'.experiments')),[]);
});
test('real local HTTP routes persist and reopen full experiments plus downloadable JSONL without provider calls',async t=>{
 const server=createApiServer({env:{},dataDirectory:await directory(t),fetchImpl:()=>assert.fail('No provider requests')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(`${base}/api/experiments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({experiment:fixture()})});const receipt=await response.json();assert.equal(response.status,201,JSON.stringify(receipt));assert.equal(receipt.saved,true);
 const listed=await (await fetch(`${base}/api/experiments`)).json();assert.equal(listed.experiments[0].id,receipt.id);
 const detail=await (await fetch(`${base}/api/experiments/${receipt.id}`)).json();assert.deepEqual(detail.record.report,receipt.report);
 const exported=await fetch(`${base}/api/experiments/${receipt.id}/export.jsonl`);assert.equal(exported.status,200);assert.match(exported.headers.get('content-type'),/ndjson/);assert.ok((await exported.text()).includes('requested-vs-observed'));
 assert.equal((await fetch(`${base}/api/experiments/${randomUUID()}`)).status,404);
});

// Container-prefix fixture exercises storage/integrity only; not a playable-audio test.
const audioBytes=Buffer.from([0x1a,0x45,0xdf,0xa3,0,1,2,3,4,5,6,7]);
const audioMetadata=()=>({direction:'user',startedAt:1700000000000,endedAt:1700000001000});
test('audio attaches privately without changing the experiment seal and survives restart with its actual byte digest',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory}),saved=await store.save({experiment:fixture()}),before=await store.get(saved.id),clipId=randomUUID();
 const receipt=await store.saveAudio(saved.id,clipId,audioMetadata(),'audio/webm;codecs=opus',audioBytes);assert.equal(receipt.saved,true);assert.equal(receipt.clip.bytes,audioBytes.length);assert.equal(receipt.clip.sha256,createHash('sha256').update(audioBytes).digest('hex'));
 assert.deepEqual(await store.get(saved.id),before);assert.equal((await stat(join(dataDirectory,'.experiments',`${saved.id}.audio`,`${clipId}.bin`))).mode&0o777,0o600);
 const restarted=createExperimentStore({dataDirectory}),opened=await restarted.audio(saved.id,clipId);assert.deepEqual(opened.bytes,audioBytes);assert.deepEqual((await restarted.audioManifest(saved.id)).map(item=>item.id),[clipId]);
 assert.deepEqual(await restarted.saveAudio(saved.id,clipId,audioMetadata(),'audio/webm;codecs=opus',audioBytes),receipt);
 const rows=(await restarted.jsonl(saved.id)).trim().split('\n').map(line=>JSON.parse(line));assert.equal(rows.at(-1).type,'audio-manifest');assert.equal(rows.at(-1).clip.sha256,receipt.clip.sha256);
});
test('audio refuses foreign IDs, changed clip identity, invalid metadata, corrupt containers and oversized payloads',async t=>{
 const store=createExperimentStore({dataDirectory:await directory(t)}),saved=await store.save({experiment:fixture()}),clipId=randomUUID();
 await assert.rejects(store.saveAudio(randomUUID(),clipId,audioMetadata(),'audio/webm',audioBytes),error=>error.status===404);
 for(const meta of [{...audioMetadata(),direction:'system'},{...audioMetadata(),extra:true},{...audioMetadata(),endedAt:1},{...audioMetadata(),startedAt:1700009000000,endedAt:1700009001000}])await assert.rejects(store.saveAudio(saved.id,clipId,meta,'audio/webm',audioBytes),error=>error.status===400);
 await assert.rejects(store.saveAudio(saved.id,clipId,audioMetadata(),'text/html',audioBytes),error=>error.status===400);
 await assert.rejects(store.saveAudio(saved.id,clipId,audioMetadata(),'audio/wav',audioBytes),error=>error.status===400);
 await assert.rejects(store.saveAudio(saved.id,clipId,audioMetadata(),'audio/webm',Buffer.alloc(16*1024*1024+1)),error=>error.status===413);
 await store.saveAudio(saved.id,clipId,audioMetadata(),'audio/webm',audioBytes);
 await assert.rejects(store.saveAudio(saved.id,clipId,{...audioMetadata(),direction:'assistant'},'audio/webm',audioBytes),error=>error.status===409);
});
test('audio binary tampering is refused and failed manifest commit rolls back its new binary',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory}),saved=await store.save({experiment:fixture()}),clipId=randomUUID();await store.saveAudio(saved.id,clipId,audioMetadata(),'audio/webm',audioBytes);
 const path=join(dataDirectory,'.experiments',`${saved.id}.audio`,`${clipId}.bin`);await writeFile(path,Buffer.alloc(audioBytes.length));await assert.rejects(store.audio(saved.id,clipId),error=>error.status===422);
 const otherDirectory=await directory(t),good=createExperimentStore({dataDirectory:otherDirectory}),other=await good.save({experiment:fixture()});
 let links=0;const broken=createExperimentStore({dataDirectory:otherDirectory,fs:{...fileSystem,link:async(...args)=>{if(++links===2)throw Error('Manifest commit unavailable');return link(...args);}}});
 await assert.rejects(broken.saveAudio(other.id,randomUUID(),audioMetadata(),'audio/webm',audioBytes),/Manifest commit unavailable/);assert.deepEqual(await readdir(join(otherDirectory,'.experiments',`${other.id}.audio`)),[]);
});
test('local HTTP audio routes retain exact bytes and expose a separate portable clip manifest',async t=>{
 const server=createApiServer({env:{},dataDirectory:await directory(t),fetchImpl:()=>assert.fail('No provider')});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const saved=await (await fetch(`${base}/api/experiments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({experiment:fixture()})})).json(),clipId=randomUUID();
 const route=`${base}/api/experiments/${saved.id}/audio/${clipId}`,response=await fetch(route,{method:'POST',headers:{'Content-Type':'audio/webm','X-RoboTrace-Audio-Metadata':JSON.stringify(audioMetadata())},body:audioBytes});assert.equal(response.status,201,await response.text());
 const download=await fetch(route);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'audio/webm');assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await download.arrayBuffer()),audioBytes);
 const detail=await(await fetch(`${base}/api/experiments/${saved.id}`)).json();assert.equal(detail.audioManifest[0].id,clipId);assert.deepEqual(detail.record.integrity,saved.integrity);
});

test('sealed historical evaluator results survive a grading revision without silently rewriting the original verdict',async t=>{
 const dataDirectory=await directory(t),store=createExperimentStore({dataDirectory}),saved=await store.save({experiment:fixture()}),path=join(dataDirectory,'.experiments',`${saved.id}.json`);
 const historical=JSON.parse(await readFile(path,'utf8'));delete historical.report.evaluatorRevision;historical.report.counts.passed=0;historical.report.counts.unscored=1;historical.report.rows[0].status='unscored';historical.report.rows[0].reason='Historical evaluator did not score this wording.';
 const {integrity,...unsigned}=historical;integrity.sha256=createHash('sha256').update(JSON.stringify(unsigned)).digest('hex');await writeFile(path,JSON.stringify({...unsigned,integrity}));
 const reopened=await store.get(saved.id);assert.equal(reopened.report.rows[0].status,'unscored');assert.deepEqual(reopened.report,historical.report);assert.equal(buildVoiceExperimentReport(reopened.experiment).rows[0].status,'passed');
});
