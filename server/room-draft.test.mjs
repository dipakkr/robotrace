import test from 'node:test';import assert from 'node:assert/strict';
import {draftPhotoRoom,normalizeRoomSpec} from './room-draft.mjs';import {createApiServer} from './index.mjs';
const env={LLM_API_KEY:'private-unit-test-key',LLM_MODEL:'gpt-4o-mini'},reference='data:image/jpeg;base64,/9j/2Q==';
const layout=()=>({title:'Office collaboration room',fixtures:[{kind:'desk',label:'Front desk',center:[.55,.55],size:[.5,.12]},{kind:'chair',label:'Office chair',center:[.86,.55],size:[.08,.10]},{kind:'bench',label:'Wall bench',center:[.95,.4],size:[.06,.6]}],windows:['back','left'],tvWall:'right',assumptions:['Dimensions are estimated; furniture behind the table may be occluded.']});
const input=()=>({image:{dataUrl:reference},roomWidth:7,roomDepth:8});
const provider=(value,inspect=()=>{})=>async(url,options)=>{inspect(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));};
test('one explicit vision call yields normalized safe-spawn office draft without retaining image bytes',async()=>{
 let calls=0;const result=await draftPhotoRoom({env,input:input(),fetchImpl:provider(layout(),body=>{calls++;assert.equal(body.messages[1].content[1].type,'image_url');assert.equal(body.messages[1].content[1].image_url.url,reference);assert.equal(body.response_format.type,'json_schema');})});
 assert.equal(calls,1);assert.equal(result.source,'llm-vision-room-draft');assert.equal(result.completed,false);assert.equal(result.calibrated,false);assert.equal(result.spec.fixtures.length,3);assert.equal(result.spec.widthMeters,7);assert.ok(Number.isFinite(result.requestDurationMs));assert.equal(JSON.stringify(result).includes(reference),false);
 const[x,z]=result.spec.safeSpawn;for(const item of result.spec.fixtures)assert.ok(Math.abs(x-(item.center[0]-.5)*7)>item.size[0]*7/2+.31||Math.abs(z-(item.center[1]-.5)*8)>item.size[1]*8/2+.31);
});
test('unsafe footprints, unknown fixture kinds, extra fields and fully occupied floor cannot become applied drafts',()=>{
 for(const mutate of [value=>value.fixtures[0].center=[1,1],value=>value.fixtures[0].kind='stove',value=>value.fixtures[0].code='run',value=>value.windows=['back','back'],value=>value.fixtures=[{kind:'desk',label:'Blocked room',center:[.5,.5],size:[.95,.95]}]]){const value=layout();mutate(value);assert.throws(()=>normalizeRoomSpec(value),error=>error.status===502);}
});
test('bad image MIME, malformed bytes, dimensions and nonallowlisted models fail before provider access',async()=>{
 for(const request of [{image:{dataUrl:'https://external.test/image.jpg'}},{image:{dataUrl:'data:image/png;base64,/9j/2Q=='}},{...input(),roomWidth:99},{...input(),model:'unknown'},{...input(),code:'execute'}])await assert.rejects(draftPhotoRoom({env,input:request,fetchImpl:()=>assert.fail('No provider call')}),error=>error.status===400);
});
test('provider failure, secret echo and timeout are sanitized without retry',async()=>{
 const unsafe=layout();unsafe.title=env.LLM_API_KEY;
 for(const fetchImpl of [async()=>new Response('private upstream body',{status:401}),provider(unsafe),async()=>{throw Object.assign(new Error(env.LLM_API_KEY),{name:'TimeoutError'});}])await assert.rejects(draftPhotoRoom({env,input:input(),fetchImpl}),error=>[502,504].includes(error.status)&&!error.message.includes(env.LLM_API_KEY)&&!error.message.includes('private upstream body'));
});
test('actual local room API returns an unapplied draft through the explicit provider boundary',async t=>{
 const server=createApiServer({env,fetchImpl:provider(layout())});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const response=await fetch(`http://127.0.0.1:${server.address().port}/api/rooms/draft`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input())});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.spec.schema,'robotrace.room-spec.v1');assert.equal(result.completed,false);
});

test('reasonable photo-edge rectangles are intersected with the floor and disclosed without inventing a replacement layout',()=>{
 const candidate=layout();candidate.fixtures[0].center=[.03,.5];candidate.fixtures[0].size=[.1,.2];const original=structuredClone(candidate);
 const spec=normalizeRoomSpec(candidate);assert.deepEqual(candidate,original);assert.equal(spec.normalization.basis,'estimated-floor-rectangle-intersection');assert.equal(spec.normalization.clippedFixtures.length,1);assert.equal(spec.fixtures[0].kind,'desk');assert.equal(spec.fixtures[0].center[0],.04);assert.equal(spec.fixtures[0].size[0],.08);assert.ok(spec.assumptions.some(text=>text.includes('bounded clipping, not measured geometry')));assert.equal(spec.calibrated,false);
});
test('edge normalization still rejects excessive, empty, nonfinite or unsupported estimates',()=>{
 for(const mutate of[value=>value.fixtures[0].center=[1.25,.5],value=>value.fixtures[0].center=[-.1,.5],value=>value.fixtures[0].size=[.02,.2],value=>value.fixtures[0].center=[NaN,.5],value=>value.fixtures[0].kind='person']){const candidate=layout();candidate.fixtures[0].center=[-.01,.5];mutate(candidate);assert.throws(()=>normalizeRoomSpec(candidate),error=>error.status===502);}
});
