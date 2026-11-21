import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtemp,readFile,rm,writeFile,stat} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createSpeechQaStore} from './speech-qa-store.mjs';
async function setup(t){const directory=await mkdtemp(join(tmpdir(),'robotrace-qa-cache-'));t.after(()=>rm(directory,{recursive:true,force:true}));const record={id:randomUUID(),savedAt:'2026-11-21T00:00:00Z',integrity:{algorithm:'SHA-256',sha256:'a'.repeat(64)},experiment:{id:'source'}};return {directory,record};}
const analysis=record=>({schema:'robotrace.speech-test-cases.v1',sourceExperimentId:record.id,proposed:true,cases:[],model:'fixture',executionPerformed:false});
test('concurrent automatic analyses deduplicate, persist privately and reopen without model calls',async t=>{
 const {directory,record}=await setup(t);let calls=0,release;const gate=new Promise(resolve=>release=resolve),store=createSpeechQaStore({dataDirectory:directory,generate:async()=>{calls++;await gate;return analysis(record);}});
 const first=store.create(record,{reviewReplies:true}),second=store.create(record,{reviewReplies:true});release();const results=await Promise.all([first,second]);assert.equal(calls,1);assert.equal(results[0].historySaved,true);assert.deepEqual(results[0],results[1]);
 const reopened=createSpeechQaStore({dataDirectory:directory,generate:()=>assert.fail('No provider on cache')});assert.equal((await reopened.create(record,{})).cached,true);assert.equal((await reopened.get(record)).sourceRecord.integrity.sha256,record.integrity.sha256);assert.equal((await stat(join(directory,'.speech-qa',`${record.id}.json`))).mode&0o777,0o600);
 assert.equal(await reopened.get({...record,integrity:{...record.integrity,sha256:'b'.repeat(64)}}),null);
});
test('explicit regenerate replaces only derived cache, tampering is refused and no original source is altered',async t=>{
 const {directory,record}=await setup(t);let calls=0;const before=structuredClone(record),store=createSpeechQaStore({dataDirectory:directory,generate:async()=>({...analysis(record),generation:++calls})});await store.create(record,{});await store.create(record,{});assert.equal(calls,1);const next=await store.create(record,{regenerate:true});assert.equal(calls,2);assert.equal(next.generation,2);assert.deepEqual(record,before);
 const path=join(directory,'.speech-qa',`${record.id}.json`),saved=JSON.parse(await readFile(path,'utf8'));saved.analysis.proposed=false;await writeFile(path,JSON.stringify(saved));await assert.rejects(store.get(record),error=>error.status===422);
});
test('cache write failure preserves completed analysis with explicit unsaved warning',async t=>{
 const {directory,record}=await setup(t),file=join(directory,'not-a-directory');await writeFile(file,'fixture');const store=createSpeechQaStore({dataDirectory:file,generate:async()=>analysis(record)});
 const result=await store.create(record,{regenerate:true});assert.equal(result.historySaved,false);assert.equal(result.sourceExperimentId,record.id);assert.match(result.warning,/could not be saved/);
});
