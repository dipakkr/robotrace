import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tsImport} from 'tsx/esm/api';
import {generateSpeechTestCases,speechCaseContext,validateProposedSpeechCases,MAX_SPEECH_TEST_CASES,validateConversationReviews} from './speech-test-cases.mjs';
import {createExperimentStore} from './experiment-store.mjs';
import {createApiServer} from './index.mjs';
const {createMobileKitchen}=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const env={LLM_API_KEY:'test-private-evaluator-key',LLM_MODEL:'gpt-4o-mini'};
function fixture(){const world=createMobileKitchen(),startedAt=1700000000000;return {schema:'robotrace.voice-experiment.v1',id:randomUUID(),startedAt,endedAt:startedAt+20000,environmentId:'mobile-kitchen',initialWorld:world,finalWorld:structuredClone(world),events:[],attempts:[],transcripts:[{id:'user:1',speaker:'user',text:'Table के पास जाओ.',final:true,receivedAt:startedAt+1000}],recording:{truncated:false,droppedEvents:0,droppedTranscripts:0,droppedAttempts:0}};}
const candidate=()=>({sourceTurnId:'user:1',intent:'Navigate the robot to Table.',expectedBehavior:'execute',expectedSummary:'The base reaches Table.',predicates:[{type:'base-at-station',stationId:'table'}]});
const mock=(value,inspect=()=>{})=>async(url,options)=>{inspect(JSON.parse(options.body),options);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));};
test('context uses only final user turns and preceding recorded state without exposing future execution',()=>{
 const experiment=fixture(),past=structuredClone(experiment.initialWorld),future=structuredClone(past);past.objects[0].station='sink';future.objects[0].station='table';
 experiment.events=[{id:'past',type:'world-sample',at:experiment.startedAt+500,simTime:0,data:{world:past}},{id:'future',type:'world-sample',at:experiment.startedAt+1500,simTime:0,data:{world:future}}];
 experiment.transcripts.push({id:'assistant:1',speaker:'assistant',text:'I will move.',final:true,receivedAt:experiment.startedAt+1200},{id:'user:partial',speaker:'user',text:'unfinished',final:false,receivedAt:experiment.startedAt+1400});
 const context=speechCaseContext(experiment);assert.equal(context.length,1);assert.equal(context[0].precedingWorld.objects[0].station,'sink');assert.equal(context[0].conversationBefore.length,0);const kettle=context[0].precedingWorld.sceneInventory.items.find(item=>item.id==='visual-kettle');assert.equal(kettle.label,'Steel kettle');assert.equal(kettle.manipulable,false);assert.equal(context[0].precedingWorld.sceneInventory.items.find(item=>item.id==='cup').manipulable,true);
});
test('strict predicates reject hallucinated sources/entities, extra fields and clarification handling goals',()=>{
 const context=speechCaseContext(fixture());
 for(const change of [item=>item.sourceTurnId='unknown',item=>item.predicates=[{type:'base-at-station',stationId:'stove'}],item=>item.predicates=[{type:'object-held',objectId:'pan'}],item=>item.predicates=[{type:'object-held',objectId:'cup',code:'run'}],item=>item.expectedBehavior='clarify']){const item=candidate();change(item);assert.throws(()=>validateProposedSpeechCases({cases:[item]},context),error=>error.status===502);}
 assert.throws(()=>validateProposedSpeechCases({cases:[candidate(),candidate()]},context),error=>error.status===502);
});
test('one explicit model call proposes expectations then verifies no execution as failed without modifying source',async()=>{
 const experiment=fixture(),before=structuredClone(experiment);let calls=0;
 const result=await generateSpeechTestCases({env,experiment,fetchImpl:mock({cases:[candidate()]},(body,options)=>{calls++;assert.equal(options.redirect,'error');assert.equal(body.response_format.type,'json_schema');const branches=body.response_format.json_schema.schema.properties.cases.items.anyOf;assert.equal(branches.length,3);const clarify=branches.find(branch=>branch.properties.expectedBehavior.enum.includes('clarify'));assert.deepEqual(clarify.properties.predicates.items.anyOf.map(predicate=>predicate.properties.type.enum[0]),['no-new-motion']);const stop=branches.find(branch=>branch.properties.expectedBehavior.enum.includes('stop'));assert.deepEqual(stop.properties.predicates.items.anyOf.map(predicate=>predicate.properties.type.enum[0]).sort(),['no-new-motion','stopped']);assert.match(body.messages[0].content,/delivered/i);assert.equal(JSON.parse(body.messages[1].content).turns[0].sourceTurnId,'user:1');})});
 assert.equal(calls,1);assert.deepEqual(experiment,before);assert.equal(result.proposed,true);assert.equal(result.executionPerformed,false);assert.equal(result.cases[0].verification.status,'failed');assert.equal(result.model,'gpt-4o-mini');assert.ok(Number.isFinite(result.requestDurationMs));
});
test('bounded errors never leak provider bodies or secrets and invalid model makes zero calls',async()=>{
 await assert.rejects(generateSpeechTestCases({env,experiment:fixture(),input:{model:'foreign-model'},fetchImpl:()=>assert.fail('No provider')}),error=>error.status===400);
 for(const fetchImpl of [async()=>new Response('private-provider-body',{status:401}),async()=>{throw Object.assign(Error(env.LLM_API_KEY),{name:'TimeoutError'});},mock({cases:[{...candidate(),intent:env.LLM_API_KEY}]}),async()=>new Response('not-json')])await assert.rejects(generateSpeechTestCases({env,experiment:fixture(),fetchImpl}),error=>[502,504].includes(error.status)&&!error.message.includes(env.LLM_API_KEY)&&!error.message.includes('private-provider-body'));
});
test('real HTTP endpoint reads saved experiment, returns proposed current analysis and preserves immutable original',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'robotrace-speech-cases-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=createExperimentStore({dataDirectory:directory}),saved=await store.save({experiment:fixture()}),path=join(directory,'.experiments',`${saved.id}.json`),original=await readFile(path,'utf8');let calls=0;
 const server=createApiServer({env,dataDirectory:directory,fetchImpl:mock({cases:[candidate()]},()=>calls++)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(`${base}/api/experiments/${saved.id}/test-cases`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.cases[0].verification.status,'failed');assert.equal(result.sourceExperimentId,saved.id);assert.equal(calls,1);assert.equal(await readFile(path,'utf8'),original);
 const cached=await(await fetch(`${base}/api/experiments/${saved.id}/test-cases`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();assert.equal(cached.cached,true);assert.equal(calls,1);
 const reopened=await(await fetch(`${base}/api/experiments/${saved.id}/test-cases`)).json();assert.equal(reopened.analysis.sourceExperimentId,saved.id);
 const report=await(await fetch(`${base}/api/experiments/${saved.id}/report.json`)).json();assert.equal(report.llmQA.sourceExperimentId,saved.id);assert.equal(report.llmQA.cases[0].verification.status,'failed');
 assert.equal((await fetch(`${base}/api/experiments/${randomUUID()}/test-cases`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);assert.equal(calls,1);
});
test('optional second model reviews false capability replies separately and never changes measured verdicts',async()=>{
 const experiment=fixture();experiment.transcripts[0].text='Sink को खाली कर दो';experiment.transcripts.push({id:'assistant:1',speaker:'assistant',text:'The Cup at Sink cannot be removed because it was delivered.',final:true,receivedAt:experiment.startedAt+2000});
 const proposed={...candidate(),expectedBehavior:'clarify',expectedSummary:'Ask where the movable Cup should be relocated.',predicates:[{type:'no-new-motion'}]};let calls=0;
 const result=await generateSpeechTestCases({env,experiment,input:{reviewReplies:true},fetchImpl:async(url,options)=>{calls++;const body=JSON.parse(options.body);if(calls===1){assert.doesNotMatch(JSON.stringify(body),/cannot be removed/);return mock({cases:[proposed]})(url,options);}assert.match(JSON.stringify(body),/cannot be removed/);return mock({reviews:[{sourceTurnId:'user:1',status:'issue',reason:'It wrongly claims a movable delivered Cup cannot be removed.',evidenceReplyIds:['assistant:1']}]})(url,options);}});
 assert.equal(calls,2);assert.equal(result.modelCalls,2);assert.equal(result.cases[0].conversationReview.status,'issue');assert.equal(result.cases[0].conversationReview.proposed,true);assert.equal(result.cases[0].verification.status,'not-evaluated');assert.equal(result.coverage.coveredUserRequests,1);
});
test('failed or invented optional reply review retains completed deterministic analysis without leaking errors',async()=>{
 const experiment=fixture();let calls=0;
 const result=await generateSpeechTestCases({env,experiment,input:{reviewReplies:true},fetchImpl:async(url,options)=>{if(++calls===1)return mock({cases:[candidate()]})(url,options);return new Response('private-provider-error',{status:500});}});
 assert.equal(calls,2);assert.equal(result.cases[0].verification.status,'failed');assert.equal(result.cases[0].conversationReview.status,'unavailable');assert.doesNotMatch(JSON.stringify(result),/private-provider-error/);
});

test('missing credentials reject new model generation before any provider request',async()=>{await assert.rejects(generateSpeechTestCases({env:{},experiment:fixture(),fetchImpl:()=>assert.fail('No provider call')}),error=>error.status===503);});

test('all seventeen final turns are retained chronologically with preceding worlds and no future assistant outcomes',async()=>{
 const experiment=fixture();experiment.transcripts=Array.from({length:17},(_,i)=>({id:`user:${i+1}`,speaker:'user',text:`Request ${i+1}`,final:true,receivedAt:experiment.startedAt+(i+1)*1000}));experiment.transcripts.push({id:'assistant:future',speaker:'assistant',text:'FUTURE EXECUTION OUTCOME',final:true,receivedAt:experiment.endedAt});
 const context=speechCaseContext(experiment);assert.equal(MAX_SPEECH_TEST_CASES,40);assert.equal(context.length,17);assert.deepEqual(context.map(item=>item.sourceTurnId),experiment.transcripts.slice(0,17).map(item=>item.id));assert.doesNotMatch(JSON.stringify(context),/FUTURE EXECUTION OUTCOME/);
 const cases=context.map(source=>({...candidate(),sourceTurnId:source.sourceTurnId})),result=await generateSpeechTestCases({env,experiment,fetchImpl:mock({cases})});assert.equal(result.coverage.totalUserRequests,17);assert.equal(result.coverage.coveredUserRequests,17);assert.equal(result.coverage.complete,true);assert.deepEqual(result.coverage.uncoveredSourceTurnIds,[]);
 const incomplete=await generateSpeechTestCases({env,experiment,fetchImpl:mock({cases:cases.slice(0,16)})});assert.equal(incomplete.coverage.complete,false);assert.deepEqual(incomplete.coverage.uncoveredSourceTurnIds,['user:17']);
});
test('forty-turn context cap keeps the first forty and reports all later turn IDs as uncovered',async()=>{
 const experiment=fixture();experiment.transcripts=Array.from({length:43},(_,i)=>({id:`user:${i+1}`,speaker:'user',text:'Navigate Table',final:true,receivedAt:experiment.startedAt+i*100}));const context=speechCaseContext(experiment);assert.equal(context.length,40);assert.equal(context[0].sourceTurnId,'user:1');assert.equal(context[39].sourceTurnId,'user:40');const result=await generateSpeechTestCases({env,experiment,fetchImpl:mock({cases:context.map(source=>({...candidate(),sourceTurnId:source.sourceTurnId}))})});assert.equal(result.coverage.complete,false);assert.equal(result.coverage.maxCases,40);assert.deepEqual(result.coverage.uncoveredSourceTurnIds,['user:41','user:42','user:43']);
});

test('conversation review retains a valid cited issue when another case has an unsupported citation',()=>{
 const cases=[{sourceTurnId:'user:1',verification:{assistantReplies:[{id:'assistant:1',text:'Cup cannot move.'}]}},{sourceTurnId:'user:2',verification:{assistantReplies:[{id:'assistant:2',text:'Where should it go?'}]}}];
 const value={reviews:[{sourceTurnId:'user:1',status:'issue',reason:'False immovable-cup capability claim.',evidenceReplyIds:['assistant:1']},{sourceTurnId:'user:2',status:'no-issue',reason:'Invented evidence.',evidenceReplyIds:['assistant:foreign']}]},before=structuredClone(value),reviews=validateConversationReviews(value,cases);
 assert.equal(reviews[0].status,'issue');assert.deepEqual(reviews[0].evidenceReplyIds,['assistant:1']);assert.equal(reviews[1].status,'unavailable');assert.deepEqual(reviews[1].evidenceReplyIds,[]);assert.deepEqual(value,before);
});
test('duplicate or missing review source IDs affect only those cases; no-reply no-issue never becomes accepted',()=>{
 const cases=[{sourceTurnId:'user:1',verification:{assistantReplies:[{id:'assistant:1'}]}},{sourceTurnId:'user:2',verification:{assistantReplies:[]}},{sourceTurnId:'user:3',verification:{assistantReplies:[]}}],valid={sourceTurnId:'user:1',status:'issue',reason:'Cited issue.',evidenceReplyIds:['assistant:1']};
 let reviews=validateConversationReviews({reviews:[valid,{sourceTurnId:'user:2',status:'no-issue',reason:'No reply.',evidenceReplyIds:[]},{sourceTurnId:'foreign',status:'uncertain',reason:'Unknown source.',evidenceReplyIds:[]}]},cases);assert.equal(reviews[0].status,'issue');assert.equal(reviews[1].status,'unavailable');assert.equal(reviews[2].status,'unavailable');
 reviews=validateConversationReviews({reviews:[valid,valid,{sourceTurnId:'user:2',status:'uncertain',reason:'No assistant reply recorded.',evidenceReplyIds:[]}]},cases);assert.equal(reviews[0].status,'unavailable');assert.equal(reviews[1].status,'uncertain');assert.equal(reviews[2].status,'unavailable');assert.throws(()=>validateConversationReviews({reviews:'bad'},cases),error=>error.status===502);
});
