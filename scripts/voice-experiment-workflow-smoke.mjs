import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Real-provider mode requires an explicit per-run authorization. Offline mode
// replaces the adapter AND persistence; its synthetic transcript is never saved.
const offline = process.argv.includes('--offline');
if (!offline && process.env.VOICE_EXPERIMENT_AUTHORIZED !== 'yes') throw new Error('Set VOICE_EXPERIMENT_AUTHORIZED=yes only after the coordinated source freeze and authorized single-session rehearsal.');
const directory = resolve(process.env.EXPERIMENT_QA_OUTPUT || `.local/qa/voice-experiment-${offline ? 'offline' : 'live'}`);
await mkdir(directory, { recursive: true });
const result = { schema:'robotrace.voice-experiment-workflow-proof.v1', mode:offline?'intercepted-offline-ui':'actual-agora-murf-prerecorded-input', starts:0, errors:[], checks:[], http:[], uploads:[], snapshots:[], voiceStartResponses:[], limitation:'Prerecorded laptop microphone fixture; no human-microphone or synchronized audio/video claim.' };
let input;
if (!offline) {
  input=resolve(directory,'microphone-input.wav');
  const phrases=[['Please move forward one meter.',7],['Please go straight six meters.',20]];
  const args=['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=48000:cl=mono'];
  phrases.forEach(([text],index)=>{const file=resolve(directory,`request-${index}.aiff`);execFileSync('say',['-v','Samantha','-r','145','-o',file,text]);args.push('-i',file);});
  const filters=phrases.map(([,at],index)=>`[${index+1}:a]aresample=48000,adelay=${at*1000}:all=1[p${index}]`);
  filters.push(`[0:a]${phrases.map((_,i)=>`[p${i}]`).join('')}amix=inputs=${phrases.length+1}:duration=first:normalize=0[out]`);
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-t','85','-c:a','pcm_s16le',input);execFileSync('ffmpeg',args,{stdio:'pipe'});
}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',...(input?[`--use-file-for-fake-audio-capture=${input}`]:[]),'--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({baseURL:'http://127.0.0.1:5189',viewport:{width:1440,height:900},permissions:['microphone'],recordVideo:{dir:directory,size:{width:1440,height:900}}});
const page=await context.newPage();result.browserPageCreatedAt=Date.now();page.setDefaultTimeout(25000);
let voiceURL,deadline,mockSaved,mockReport; const uploadedBodies=new Map(), responseReads=[];
page.on('pageerror',error=>result.errors.push(error.message));
page.on('console',message=>{if(message.type()!=='error')return;const code=message.text().match(/AgoraRTCError\s+([A-Z][A-Z_0-9]+)/)?.[1];if(code)(result.rtcErrorCodes??=[]).push(code);});
page.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/api/voice/start')(result.voiceStartNetworkErrors??=[]).push(request.failure()?.errorText??'Unknown network error');});
page.on('response',response=>{const path=new URL(response.url()).pathname;if(path==='/src/integrations/voice.ts')voiceURL=response.url();if(path.startsWith('/api/experiments'))result.http.push({path,method:response.request().method(),status:response.status()});if(path==='/api/voice/start'){const record={status:response.status(),at:Date.now()};result.voiceStartResponses.push(record);if(response.status()>=400)responseReads.push(response.json().then(body=>{record.error=String(body.error??'Unspecified start failure').replace(/(?:Bearer\s+)[^\s]+/gi,'Bearer [redacted]').slice(0,1000);}).catch(()=>{record.error='Start failure response was not JSON';}));}});
await context.addInitScript(()=>{
 window.__experimentSnapshots=[];
 new MutationObserver(()=>{const rows=[...document.querySelectorAll('.voice-conversation-row')].map(row=>({speaker:row.classList.contains('voice-speaker-user')?'user':'assistant',text:row.querySelector('p')?.textContent,final:row.dataset.final==='true'}));const position=document.querySelector('.coordinates-values')?.textContent;const value={rows,position};if(JSON.stringify(value)!==JSON.stringify(window.__experimentSnapshots.at(-1)?.value))window.__experimentSnapshots.push({at:Date.now(),value});}).observe(document,{subtree:true,childList:true,characterData:true});
});
if(offline)await context.route('**/src/integrations/voice.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
 let options,command;export async function getIntegrationStatus(){return {available:true,configured:true,providers:{agora:true,murf:true,llm:true,publicCallback:true},missing:[],publicUrlValid:true,liveVerified:false,dataset:true};}
 export async function startVoiceSession(handler,opts){command=handler;options=opts;window.__offlineStarts=(window.__offlineStarts||0)+1;opts.onStatus('live');opts.onRecordingStatus?.({supported:true,state:'recording'});window.__offlineIssue=async(text)=>{let now=Date.now(),id=crypto.randomUUID();opts.onTranscript?.({id,speaker:'user',text,final:true,receivedAt:now});return handler(text,{source:'speech-control',userTurnId:id,recognizedText:text,receivedAt:now,turnAssociation:'exact-caption'});};return {sessionId:'OFFLINE-NOT-A-PROVIDER-SESSION',stop:stopVoiceSession,setPaused:setVoiceSessionPaused};}
 export async function stopVoiceSession(){if(options){await new Promise(r=>setTimeout(r,120));await options.onAudioSegment?.({id:crypto.randomUUID(),direction:'user',startedAt:Date.now()-200,endedAt:Date.now(),blob:new Blob(['OFFLINE-FLUSH-CONTRACT-ONLY'],{type:'audio/webm'}),mimeType:'audio/webm',bytes:27});options.onStatus('disconnected');}}
 export async function setVoiceSessionPaused(){}export async function announceVoiceProgress(){return {announced:false};}export async function saveEpisodeToServer(){throw new Error('Offline test forbids episode persistence');}
 `}));
await context.route('**/api/**',async route=>{
 const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
 if(path==='/api/voice/start'&&method==='POST'){result.starts++;assert.equal(result.starts,1,'Only one paid session is authorized');result.startRequestedAt=Date.now();deadline=setTimeout(()=>{result.safetyStop=true;if(voiceURL)void page.evaluate(async url=>(await import(url)).stopVoiceSession(),voiceURL).catch(()=>{});},90000);}
 if(method==='POST'&&['/api/voice/reset','/api/scenes/draft','/api/planner/plan'].includes(path)){await route.abort('blockedbyclient');return;}
 if(path.startsWith('/api/experiments')&&offline){
  if(method==='POST'&&path==='/api/experiments'){mockSaved=request.postDataJSON().experiment;mockReport=await page.evaluate(async experiment=>(await import('/src/data/voice-experiment.ts')).buildVoiceExperimentReport(experiment),mockSaved);await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({saved:true,id:mockSaved.id,report:mockReport})});return;}
  if(method==='POST'&&path.includes('/audio/')){result.uploads.push({path,bytes:request.postDataBuffer()?.length,mock:true});await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({saved:true})});return;}
  const payload=path==='/api/experiments'?{experiments:mockSaved?[{id:mockSaved.id,startedAt:mockSaved.startedAt,endedAt:mockSaved.endedAt,savedAt:new Date().toISOString(),report:mockReport}]:[]}:{record:{experiment:mockSaved,report:mockReport},audioManifest:[]};await route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});return;
 }
 if(method==='POST'&&/^\/api\/experiments\/[^/]+\/audio\//.test(path)){const body=request.postDataBuffer();uploadedBodies.set(path,body);result.uploads.push({path,bytes:body?.length,sha256:body&&createHash('sha256').update(body).digest('hex')});}
 await route.continue();
});
try{
 await page.goto('/kitchen?voice=off');await page.getByRole('button',{name:'Start simulation',exact:true}).waitFor();
 await page.waitForTimeout(400);await page.getByRole('button',{name:'Start simulation',exact:true}).click();
 await page.waitForFunction(()=>['live','error'].includes(document.querySelector('.voice-conversation')?.getAttribute('data-voice-status')),null,{timeout:60000});
 assert.equal(await page.locator('.voice-conversation').getAttribute('data-voice-status'),'live',`Voice setup failed: ${await page.evaluate(()=>document.querySelector('.mobile-voice')?.textContent?.slice(-300)??'see safe voiceStartResponses diagnostics')}`);
 result.connectedAt=Date.now();
 await page.getByRole('tab',{name:'Coordinates',exact:true}).click();
 if(offline){await page.evaluate(()=>window.__offlineIssue('Move forward 1 meter'));await page.waitForTimeout(700);result.starts=await page.evaluate(()=>window.__offlineStarts);}
 else{
  const endAt=result.startRequestedAt+39000;
  while(Date.now()<endAt)await page.waitForTimeout(Math.min(2500,endAt-Date.now()));
 }
 await page.screenshot({path:resolve(directory,'live-coordinates.png')});
 result.liveActivity=await page.evaluate(()=>document.querySelector('.activity-terminal-log')?.textContent??null);
 result.snapshots=await page.evaluate(()=>window.__experimentSnapshots);
 assert.equal(result.http.filter(item=>item.method==='POST'&&item.path==='/api/experiments').length,0,'Recording must not save before Stop or consent');
 await page.getByRole('button',{name:'Stop simulation',exact:true}).click();
 const finish=page.getByRole('dialog',{name:'Finish experiment',exact:true});await finish.waitFor();result.stoppedAt=Date.now();clearTimeout(deadline);
 assert.equal(new URL(page.url()).pathname,'/kitchen');assert.equal(result.http.filter(item=>item.method==='POST').length,0,'Stopping creates an unsaved draft');
 const draft=await finish.textContent();result.draftSummary=draft;assert.match(draft,/Audio clips/);if(offline)assert.match(draft,/Audio clips1/,'Awaited asynchronous final audio segment reaches the draft');
 result.checks.push({name:'Stop ends voice, preserves kitchen, flushes final audio into draft and asks before any save',passed:true});
 await page.screenshot({path:resolve(directory,'finish-save-choice.png')});
 await finish.getByRole('button',{name:'Save & view report',exact:true}).click();
 const qa=page.getByRole('dialog',{name:'Voice experiment QA console',exact:true});await qa.waitFor({timeout:45000});
 await page.waitForFunction(()=>document.querySelector('.experiment-report-heading')?.textContent?.includes('Saved'));
 assert.equal(result.http.filter(item=>item.path==='/api/experiments'&&item.method==='POST'&&item.status===201).length,1);assert.ok(result.uploads.length>0,'Actual application must upload flushed audio clips');
 result.checks.push({name:'Explicit Save creates one experiment and uploads captured audio before opening the human report',passed:true});
 if(offline){result.report=mockReport;assert.ok(mockSaved.events.some(event=>event.type==='audio-segment'));assert.ok(mockSaved.events.some(event=>event.type==='world-sample'));result.checks.push({name:'Intercepted offline draft preserves final audio and 5Hz world samples without calling providers or persistent API',passed:true});}
 else{
  const href=await qa.getByRole('link',{name:'Export JSONL',exact:true}).getAttribute('href');assert.ok(href);result.experimentId=href.split('/')[3];
  const response=await context.request.get(`/api/experiments/${result.experimentId}`);assert.equal(response.status(),200);const saved=await response.json();result.report=saved.record.report;result.audioManifest=saved.audioManifest;result.experimentCounts={events:saved.record.experiment.events.length,attempts:saved.record.experiment.attempts.length,transcripts:saved.record.experiment.transcripts.length};
  await writeFile(resolve(directory,'saved-record.json'),JSON.stringify(saved,null,2));
  const rows=result.report.rows;assert.ok(rows.some(row=>row.expected?.kind==='relative-motion'&&Math.abs(row.expected.meters-1)<.01&&row.status==='passed'),'One-meter request must be matched to actual one-meter execution');
  const refused=rows.find(row=>row.expected?.kind==='relative-motion'&&Math.abs(row.expected.meters-6)<.01);assert.ok(refused,'Six-meter ASR request must retain its explicit requested distance');assert.equal(refused.status,'failed','A refusal must not satisfy a movement request');assert.equal(refused.observed.pathDistanceMeters,0,'The refused six-meter request must not move or silently replace its destination');
  result.checks.push({name:'One-meter request matches actual motion; refused six-meter request remains a failed unmet goal with zero travel',passed:true});
  assert.ok(rows.some(row=>row.expected?.kind==='relative-motion'&&Math.abs(row.expected.meters-6)<.01&&row.status==='failed'),'Six-meter request must remain failed if bounded controller refuses');
  result.checks.push({name:'QA distinguishes actual one-meter pass from refused six-meter requested goal',passed:true});
  assert.ok(saved.audioManifest.some(clip=>clip.direction==='user'));assert.ok(saved.audioManifest.some(clip=>clip.direction==='assistant'));
  for(const clip of saved.audioManifest){const path=`/api/experiments/${result.experimentId}/audio/${clip.id}`,download=await context.request.get(path);assert.equal(download.status(),200);const bytes=await download.body(),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,clip.bytes);assert.equal(hash,clip.sha256);assert.ok(bytes.equals(uploadedBodies.get(path)),'Downloaded bytes must equal the actual app MediaRecorder upload');const file=resolve(directory,`${clip.direction}-${clip.id}.webm`);await writeFile(file,bytes);execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-f','null','-'],{stdio:'pipe'});}
  result.checks.push({name:'Separate native microphone and assistant RTC clips persist byte-for-byte with SHA-256 and independently decode',passed:true});
  const exportResponse=await context.request.get(href);assert.equal(exportResponse.status(),200);const jsonl=await exportResponse.text();await writeFile(resolve(directory,'experiment.jsonl'),jsonl);const lines=jsonl.trim().split('\n').map(line=>JSON.parse(line));result.jsonlTypes=[...new Set(lines.map(line=>line.type))];for(const type of ['experiment','event','transcript','native-attempt','requested-vs-observed','report','audio-manifest'])assert.ok(result.jsonlTypes.includes(type),`JSONL must contain ${type}`);
  assert.ok(saved.record.experiment.events.some(event=>event.type==='world-sample'));
  const coords=result.snapshots.map(s=>s.value.position).filter(Boolean);assert.ok(new Set(coords).size>2,'Coordinates must change during actual motion');
  result.checks.push({name:'Portable JSONL includes genuine speech, actual native actions, sampled states, evaluations and audio manifests; live coordinates update',passed:true});
  const replay=qa.getByRole('button',{name:'Replay action',exact:true}).first();await replay.click();await qa.getByRole('button',{name:'Play replay',exact:true}).click();const slider=qa.getByRole('slider',{name:'Seek experiment action'});await page.waitForTimeout(700);assert.ok(Number(await slider.inputValue())>0,'Native replay must advance actual recorded frames');await qa.getByRole('button',{name:'Pause replay',exact:true}).click();
  result.checks.push({name:'Human report replays native recorded robot state rather than regenerating an animation',passed:true});
  await qa.locator('summary').filter({hasText:/^Audio clips/}).click();await qa.locator('audio').first().evaluate(async element=>{await element.play();});await page.waitForTimeout(500);assert.equal(await qa.locator('audio').first().evaluate(element=>element.paused),false);
  result.checks.push({name:'Saved audio can play through the report native player',passed:true});
 }
 await page.screenshot({path:resolve(directory,'saved-qa-report.png'),fullPage:true});assert.deepEqual(result.errors,[]);result.passed=true;
}catch(error){result.passed=false;result.failure=error.stack;process.exitCode=1;await page.screenshot({path:resolve(directory,'failure.png')}).catch(()=>{});}
finally{clearTimeout(deadline);if(voiceURL)await page.evaluate(async url=>(await import(url)).stopVoiceSession(),voiceURL).catch(()=>{});await Promise.allSettled(responseReads);result.finishedAt=new Date().toISOString();await context.close();await browser.close();await writeFile(resolve(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,mode:result.mode,checks:result.checks,failure:result.failure,starts:result.starts,voiceStartResponses:result.voiceStartResponses,sessionMs:result.stoppedAt-result.startRequestedAt,uploads:result.uploads,rows:result.report?.rows,errors:result.errors},null,2));}
