import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
import {interpretMobileCommand} from './mobile-intent.mjs';
import {createApiServer} from './index.mjs';
const {createMobileKitchen,planMobileTask,startMobilePlan}=await tsImport('../src/sim/mobile-navigation.ts',import.meta.url);
const env={LLM_API_KEY:'test-private-llm-key',LLM_MODEL:'gpt-4o-mini'};
const input=(command='Could you take the cup over to the sink, please?')=>({world:createMobileKitchen(),command});
function mock(value,inspect=()=>{}){return async(url,options)=>{inspect(JSON.parse(options.body),options,url);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));};}
test('freeform interpretation makes one grounded model call and returns only unexecuted bounded tasks',async()=>{
 let calls=0;const before=input();const snapshot=structuredClone(before);
 const result=await interpretMobileCommand({env,input:before,fetchImpl:mock({tasks:[{objectId:'cup',stationId:'sink'}],reply:'I can move Cup to Sink.'},(body,options)=>{calls++;assert.equal(body.response_format.type,'json_schema');assert.equal(options.redirect,'error');const context=JSON.parse(body.messages[1].content);assert.equal(context.world.objects[0].station,'counter');assert.equal(context.world.robot.cargoObjectId,null);})});
 assert.equal(calls,1);assert.deepEqual(before,snapshot);assert.deepEqual(result.tasks,[{objectId:'cup',stationId:'sink'}]);assert.equal(result.completed,false);assert.equal(result.source,'llm-intent');assert.equal(result.model,'gpt-4o-mini');assert.ok(Number.isFinite(result.requestDurationMs));
});
test('empty tasks preserve clarification and navigation omits an optional object identity',async()=>{
 const clarify=await interpretMobileCommand({env,input:input('Clear the counter'),fetchImpl:mock({tasks:[],reply:'Where should Cup and Bowl go?'})});assert.deepEqual(clarify.tasks,[]);
 const nav=await interpretMobileCommand({env,input:input('Head home'),fetchImpl:mock({tasks:[{objectId:null,stationId:'home'}],reply:'Navigate Home.'})});assert.equal(nav.tasks[0].stationId,'home');
});
test('carry mode preserves pickup or transport without inventing a release, while navigation cannot acquire an object mode',async()=>{
 for(const [command,task] of [['Pick up the cup',{objectId:'cup',stationId:'counter',mode:'carry'}],['Pick up the cup and go to sink',{objectId:'cup',stationId:'sink',mode:'carry'}],['Place cup at sink',{objectId:'cup',stationId:'sink',mode:'deliver'}]]){
  const result=await interpretMobileCommand({env,input:input(command),fetchImpl:mock({tasks:[task],reply:'Task interpretation only.'})});assert.deepEqual(result.tasks,[{stationId:task.stationId,objectId:task.objectId,mode:task.mode}]);assert.equal(result.completed,false);
 }
 await assert.rejects(interpretMobileCommand({env,input:input('Go sink'),fetchImpl:mock({tasks:[{stationId:'sink',mode:'carry'}],reply:'Wrong mode'})}),error=>error.status===502);
 await assert.rejects(interpretMobileCommand({env,input:input('Pick up cup'),fetchImpl:mock({tasks:[{stationId:'counter',objectId:'cup',mode:'wash'}],reply:'Wrong mode'})}),error=>error.status===502);
});
test('Hindi and Hinglish inputs retain Unicode and current-world grounding in the semantic request',async()=>{
 for(const command of ['कप उठाकर सिंक पर जाओ, उसे रखना मत।','cup utha ke sink par jao, abhi neeche mat rakhna']){
  const result=await interpretMobileCommand({env,input:input(command),fetchImpl:mock({tasks:[{objectId:'cup',stationId:'sink',mode:'carry'}],reply:'Carry Cup to Sink without releasing it.'},body=>{assert.equal(JSON.parse(body.messages[1].content).command,command);assert.equal(JSON.parse(body.messages[1].content).world.objects[0].id,'cup');})});assert.deepEqual(result.tasks,[{stationId:'sink',objectId:'cup',mode:'carry'}]);assert.equal(result.completed,false);
 }
});
test('actual carried object and latest mission are supplied for resolving pronouns without invented state',async()=>{
 const scene=input('Put it on the table');scene.world=startMobilePlan(scene.world,planMobileTask('Take cup from counter to sink',scene.world),'immediate').world;scene.world.robot.cargoObjectId='cup';scene.world.objects[0].station='robot';scene.world.objects[0].status='carried';
 await interpretMobileCommand({env,input:scene,fetchImpl:mock({tasks:[{objectId:'cup',stationId:'table'}],reply:'Move the carried Cup to Table.'},body=>{const {world}=JSON.parse(body.messages[1].content);assert.equal(world.robot.cargoObjectId,'cup');assert.equal(world.currentMission.goal.objectId,'cup');assert.equal(world.currentMission.command,'Take cup from counter to sink');})});
});
test('unknown entities, geometry, extra fields, excessive tasks and unsupported destinations cannot become intents',async()=>{
 for(const tasks of [[{objectId:'pan',stationId:'sink'}],[{objectId:'cup',stationId:'stove'}],[{objectId:'cup',stationId:'sink',code:'run'}],Array.from({length:7},()=>({stationId:'table'})),[{objectId:'cup',stationId:'home'}]]){
  await assert.rejects(interpretMobileCommand({env,input:input(),fetchImpl:mock({tasks,reply:'Candidate'})}),error=>error.status===502);
 }
 await assert.rejects(interpretMobileCommand({env,input:input(),fetchImpl:mock({tasks:[],reply:'Candidate',completed:true})}),error=>error.status===502);
});
test('bad inputs and nonallowlisted models are rejected before provider access',async()=>{
 for(const value of [{...input(),command:'x'.repeat(1501)},{...input(),model:'arbitrary-model'},{...input(),extra:true},{...input(),world:{...createMobileKitchen(),objects:[{id:'pan'}]}}]){
  await assert.rejects(interpretMobileCommand({env,input:value,fetchImpl:()=>{assert.fail('No provider call allowed');}}),error=>error.status===400);
 }
});
test('provider errors, timeouts, malformed data and secret echoes are safely bounded without retries',async()=>{
 for(const fetchImpl of [async()=>new Response('secret-provider-body',{status:401}),async()=>new Response('bad-json'),mock({tasks:[],reply:env.LLM_API_KEY}),async()=>{throw Object.assign(new Error(env.LLM_API_KEY),{name:'TimeoutError'});}]){
  await assert.rejects(interpretMobileCommand({env,input:input(),fetchImpl}),error=>[502,504].includes(error.status)&&!error.message.includes(env.LLM_API_KEY)&&!error.message.includes('secret-provider-body'));
 }
});
test('HTTP interpretation route returns the actual model receipt without starting voice or running a task',async t=>{
 let calls=0;const server=createApiServer({env,fetchImpl:mock({tasks:[{objectId:'bowl',stationId:'table'}],reply:'Move Bowl to Table.'},()=>{calls++;})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/mobile/interpret`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input('Please take the bowl to the table'))});
 assert.equal(response.status,200);const receipt=await response.json();assert.deepEqual(receipt.tasks,[{stationId:'table',objectId:'bowl'}]);assert.equal(receipt.source,'llm-intent');assert.equal(receipt.completed,false);assert.equal(calls,1);
});
