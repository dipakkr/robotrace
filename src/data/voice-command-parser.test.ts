import test from 'node:test';
import assert from 'node:assert/strict';
import { directSpeechCommand, VoiceSpeechControlGate } from '../integrations/voice-command-parser';
import type { VoiceTranscript } from '../integrations/voice-captions';
import type { VoiceCommandResult } from '../integrations/voice';
import type { VoiceCommandContext } from '../integrations/voice';
import { advanceMobileWorld, applyMobileControl, createMobileKitchen, mobileGoalChecks, planMobileTask, startMobilePlan } from '../sim/mobile-navigation';
const transcript = (id: string, text: string, final = true): VoiceTranscript => ({ id, text, final, speaker: 'user', receivedAt: 1000 });

test('strict stop imperatives include repetitions but exclude negation, quoted examples and conditions', () => {
  for (const text of ['Stop', 'Stop.', 'No. Stop. Stop.', 'Please stop', 'Stop robot', 'Stop the robot now please', 'stop stop stop']) assert.deepEqual(directSpeechCommand(text, false), { kind: 'stop', command: 'stop' }, text);
  for (const text of ["Don't stop", 'Do not stop', 'Please do not stop', 'If I say stop', 'When I say stop stop the robot', 'Can you explain stop?', 'No stopping', 'Stop at the sink', 'Stop if someone enters', 'I said stop earlier', 'Stop cup from falling', 'Never stop']) assert.equal(directSpeechCommand(text, true), null, text);
});

test('navigation fast path requires final literal station movement and never adds a payload', () => {
  for (const [text, command] of [['Go sink', 'Go to Sink'], ['Go to sync.', 'Go to Sink'], ['Please go to the table', 'Go to Table'], ['Can you go to table?', 'Go to Table'], ['Could you please go to the counter?', 'Go to Counter'], ['Would you go to sink please?', 'Go to Sink'], ['Navigate to counter please', 'Go to Counter'], ['Return home', 'Go to Home'], ['Go to dock', 'Go to Home']]) {
    assert.equal(directSpeechCommand(text, false), null); assert.deepEqual(directSpeechCommand(text, true), { kind: 'navigation', command });
  }
  for (const text of ['Take cup to sink', 'Go to sink with cup', 'Go to sink and pick cup', 'Do not go to sink', 'Could you not go to sink', 'If I say go to sink', 'Go to table or sink', 'Go to refrigerator']) assert.equal(directSpeechCommand(text, true), null, text);
});

test('Stop invokes synchronously on a partial once per turn without waiting for an LLM or receipt', async () => {
  const calls: string[] = []; let finish!: (value: VoiceCommandResult) => void;
  const gate = new VoiceSpeechControlGate(command => { calls.push(command); return new Promise(resolve => { finish = resolve; }); }, undefined, () => 1003);
  const observed = gate.receive(transcript('turn-stop', 'No. Stop. Stop.', false));
  assert.deepEqual(calls, ['stop']); assert.equal(observed?.dispatchDelayMs, 3);
  gate.receive(transcript('turn-stop', 'Stop', true)); assert.equal(calls.length, 1);
  finish({ completed: true, summary: 'Control stop applied.', world: { robot: { mode: 'stopped' } } });
  const response = await gate.executeTool('please stop');
  assert.equal(response.completed, true); assert.equal(response.speechControlDeduplicated, true); assert.equal(calls.length, 1);
});

test('navigation dispatch executes once and rejects an LLM attempt to add cup delivery', async () => {
  const calls: string[] = [];
  const gate = new VoiceSpeechControlGate(command => { calls.push(command); return { completed: false, status: 'running', summary: 'Base navigation started.' }; });
  gate.receive(transcript('nav', 'Go to sink', false)); assert.equal(calls.length, 0);
  gate.receive(transcript('nav', 'Go to sink', true)); assert.deepEqual(calls, ['Go to Sink']);
  const duplicate = await gate.executeTool('navigate to the sink'); assert.equal(duplicate.speechControlDeduplicated, true);
  const embellished = await gate.executeTool('Take cup from counter to sink'); assert.equal(embellished.status, 'rejected'); assert.match(embellished.error!, /navigation only/);
  assert.deepEqual(calls, ['Go to Sink']);
  gate.receive(transcript('pickup-next', 'Pick up the cup', false));
  const next = await gate.executeTool('Take cup from counter to sink'); assert.equal(next.status, 'running');
  assert.deepEqual(calls, ['Go to Sink', 'Take cup from counter to sink']);
});

test('stale movement and automatic resume after Stop are blocked until a new actual user turn', async () => {
  const calls: string[] = [];
  const gate = new VoiceSpeechControlGate(command => { calls.push(command); return { completed: true, summary: `Control ${command} applied.` }; });
  gate.receive(transcript('stop', 'Stop', false));
  gate.receive({ ...transcript('assistant:1', 'Going to the sink'), speaker: 'assistant' });
  assert.equal((await gate.executeTool('Go to Sink')).status, 'rejected'); assert.equal((await gate.executeTool('resume')).status, 'rejected');
  assert.deepEqual(calls, ['stop']);
  gate.receive(transcript('resume-next', 'Resume')); await gate.executeTool('resume'); assert.deepEqual(calls, ['stop', 'resume']);
});

test('Stop overrides an earlier direct navigation even if ASR reuses its turn identity', async () => {
  const calls: string[] = []; const gate = new VoiceSpeechControlGate(command => { calls.push(command); return { completed: true }; });
  gate.receive(transcript('same-turn', 'Go to Sink'));
  gate.receive(transcript('same-turn', 'Stop', false)); gate.receive(transcript('same-turn', 'Stop', true));
  assert.deepEqual(calls, ['Go to Sink', 'stop']); assert.equal((await gate.executeTool('Go to Sink')).status, 'rejected');
});

test('a matching tool that beats the final transcript is reused and failed handlers remain failures', async () => {
  const calls: string[] = [];
  const gate = new VoiceSpeechControlGate(command => { calls.push(command); return { completed: false, error: 'The current mission is paused.' }; });
  gate.receive(transcript('nav', 'Go to', false));
  await gate.executeTool('Go to Sink'); gate.receive(transcript('nav', 'Go to Sink', true));
  const result = await gate.executeTool('Go Sink'); assert.equal(calls.length, 1); assert.equal(result.completed, false); assert.match(result.error!, /paused/);
  const throwing = new VoiceSpeechControlGate(() => { throw new Error('Handler unavailable'); });
  throwing.receive(transcript('stop', 'Stop')); assert.equal((await throwing.executeTool('stop')).error, 'Handler unavailable');
});

test('Hindi and Hinglish strict stops exclude negated, conditional and object-specific requests', () => {
  for (const text of ['रुको', 'रुक जाओ', 'रोबोट, रुक जाओ।', 'रोक दो', 'बस रोक दो', 'कृपया रोको', 'रुको। रुको।', 'stop karo', 'ruk jao', 'robot ruk jao', 'bas stop kar do']) assert.deepEqual(directSpeechCommand(text, false), { kind: 'stop', command: 'stop' }, text);
  for (const text of ['मत रुको', 'रुको मत', 'रोकना मत', 'अगर मैं रुकने को कहूँ', 'अगर मैं कहूँ रुको', 'लोगों', 'rukna mat', 'mat ruko', 'stop mat karo', 'कप को गिरने से रोक दो']) assert.equal(directSpeechCommand(text, true), null, text);
});

test('Hindi and Hinglish navigation only dispatches a final exact station imperative', () => {
  for (const [text, command] of [['sink par jao', 'Go to Sink'], ['सिंक पर जाओ', 'Go to Sink'], ['टेबल पर जाओ', 'Go to Table'], ['काउंटर तक जाओ', 'Go to Counter'], ['घर जाओ', 'Go to Home'], ['table pe jao please', 'Go to Table']]) {
    assert.equal(directSpeechCommand(text, false), null); assert.deepEqual(directSpeechCommand(text, true), { kind: 'navigation', command });
  }
  for (const text of ['कप को सिंक पर ले जाओ', 'cup sink par le jao', 'सिंक पर मत जाओ', 'अगर सिंक पर जाओ', 'table par jao aur cup uthao']) assert.equal(directSpeechCommand(text, true), null, text);
});

test('actual native navigation stays empty, Hindi Stop freezes motion, and a new pickup can later carry without release', async () => {
  let world = createMobileKitchen(); const initialObjects = structuredClone(world.objects), calls: string[] = [];
  const gate = new VoiceSpeechControlGate(command => {
    calls.push(command); const plan = planMobileTask(command, world);
    const result = plan.control ? applyMobileControl(world, plan.control) : startMobilePlan(world, plan, 'immediate');
    world = result.world; return { completed: !result.error && Boolean(plan.control), error: result.error, world };
  });
  gate.receive(transcript('native-nav', 'Go to sink')); assert.equal(world.mission?.plan.goal?.objectId, undefined);
  world = advanceMobileWorld(world, 1).world; assert.deepEqual(world.objects, initialObjects);
  gate.receive(transcript('native-stop', 'रुको', false)); assert.equal(world.robot.mode, 'stopped');
  const stopped = structuredClone(world); world = advanceMobileWorld(world, 1).world; assert.deepEqual(world, stopped);
  await gate.executeTool('Take cup from counter to sink'); assert.deepEqual(calls, ['Go to Sink', 'stop']);
  gate.receive(transcript('native-pickup', 'Pick up cup')); await gate.executeTool('Pick up cup');
  for (let i = 0; i < 1000 && world.robot.mode === 'running'; i++) world = advanceMobileWorld(world, .1).world;
  assert.equal(world.robot.cargoObjectId, 'cup'); assert.ok(mobileGoalChecks(world).every(check => check.passed));
  gate.receive(transcript('native-held-nav', 'सिंक पर जाओ'));
  assert.equal(world.mission?.plan.goal?.objectId, undefined);
  for (let i = 0; i < 1000 && world.robot.mode === 'running'; i++) world = advanceMobileWorld(world, .1).world;
  assert.equal(world.robot.cargoObjectId, 'cup'); assert.equal(world.objects[0].station, 'robot');
  assert.equal(world.events.filter(event => event.kind === 'place').length, 0); assert.ok(mobileGoalChecks(world).every(check => check.passed));
});

test('direct controls carry their exact recognized caption while tools label only the latest observed association', async () => {
  const calls: { command: string; context?: VoiceCommandContext }[] = [];
  const gate = new VoiceSpeechControlGate((command, context) => { calls.push({ command, context }); return { completed: false, status: 'running' }; });
  gate.receive(transcript('session:user:8', 'Can you go to table?'));
  assert.deepEqual(calls[0], { command: 'Go to Table', context: { source: 'speech-control', userTurnId: 'session:user:8', recognizedText: 'Can you go to table?', receivedAt: 1000, turnAssociation: 'exact-caption' } });
  await gate.executeTool('Go to Table', 'duplicate-tool-id'); assert.equal(calls.length, 1);
  gate.receive(transcript('session:user:9', 'कप को उठाओ।'));
  await gate.executeTool('Pick up cup', 'tool-command-id');
  assert.deepEqual(calls[1].context, { source: 'voice-tool', userTurnId: 'session:user:9', recognizedText: 'कप को उठाओ।', receivedAt: 1000, commandId: 'tool-command-id', turnAssociation: 'latest-observed-user-turn' });
  gate.clear(); await gate.executeTool('Go Home', 'no-caption');
  assert.deepEqual(calls[2].context, { source: 'voice-tool', commandId: 'no-caption' });
});

test('final literal distance speech preserves one/six/decimal quantities and never interprets questions or negation', () => {
  for(const [text,command] of [['Please move forward one meter.','Move forward 1 meter'],['Please go straight six meters.','Move straight 6 meters'],['Could you please move left half a meter?',null],['Can you move left half meter please?','Move left 0.5 meters'],['Move backward 1.5 meters.','Move backward 1.5 meters'],['Please go forward 0.05 meters.','Move forward 0.05 meters'],['कृपया एक मीटर आगे जाओ।','Move forward 1 meter'],['रोबोट आगे ६ मीटर चलो।','Move forward 6 meters'],['robot ek meter aage jao','Move forward 1 meter'],['aage chhe meter jao','Move forward 6 meters']]) {
    assert.equal(directSpeechCommand(text!,false),null,text!);
    assert.deepEqual(directSpeechCommand(text!,true),command?{kind:'relative-motion',command}:null,text!);
  }
  for(const text of ['Do not move forward one meter','How far is one meter?','Should I move forward one meter?','What happens if you move forward one meter','If I say move forward one meter','Move forward one meter and pick up cup','Move forward one or six meters','एक मीटर आगे मत जाओ','अगर एक मीटर आगे जाओ','ek meter aage mat jao']) assert.equal(directSpeechCommand(text,true),null,text);
});

test('actual recorded failed wording now drives one-meter native motion, rejects contradictory Home and refuses six meters without invented execution', async () => {
  let world=createMobileKitchen();const calls:string[]=[];
  const gate=new VoiceSpeechControlGate(command=>{calls.push(command);const plan=planMobileTask(command,world);if(plan.error)return{completed:false,error:plan.error,world};const started=startMobilePlan(world,plan,'immediate');world=started.world;return{completed:false,error:started.error,world};});
  gate.receive(transcript('actual-failed-turn-one','Please move forward one meter.'));
  for(let i=0;i<100&&world.robot.mode==='running';i++)world=advanceMobileWorld(world,.1).world;
  assert.deepEqual(world.robot.position,[-3,1.5]);assert.ok(mobileGoalChecks(world).every(check=>check.passed));
  assert.equal((await gate.executeTool('Go Home')).status,'rejected');
  assert.equal((await gate.executeTool('Move forward 1 meter')).speechControlDeduplicated,true);
  const before=structuredClone(world);gate.receive(transcript('actual-failed-turn-six','Please go straight six meters.'));
  const refusal=await gate.executeTool('Go straight 6 meters');assert.equal(refusal.completed,false);assert.match(refusal.error!,/between 0.05 and 5/);assert.deepEqual(world,before);
  assert.equal((await gate.executeTool('Go Home')).status,'rejected');assert.deepEqual(calls,['Move forward 1 meter','Move straight 6 meters']);
  gate.receive(transcript('later-legitimate','Pick up cup'));await gate.executeTool('Pick up cup');assert.equal(calls.at(-1),'Pick up cup');
});


test('obvious final questions and standalone acknowledgements cannot authorize later model motion', async () => {
  for (const text of ['How far is the sink?', 'What is the robot position?', 'Can you please tell me the distance to the table?', 'Coordinates please', 'सिंक कितनी दूर है?', 'रोबोट की लोकेशन बताओ।', 'sink kitna door hai?', 'robot kahan hai?', 'Okay', 'Okay. Okay.', 'Yes', 'Thank you', 'ठीक है।', 'Hello']) {
    const calls: string[] = []; const gate = new VoiceSpeechControlGate(command=>{calls.push(command);return {completed:true};});
    gate.receive(transcript('question',text));
    for(const command of ['Go Home','Take cup from counter to sink','resume']) assert.equal((await gate.executeTool(command)).status,'rejected',text);
    assert.deepEqual(calls,[],text);
    await gate.executeTool('stop');assert.deepEqual(calls,['stop'],text);
    gate.receive(transcript('new-explicit-action','Can you go to table?'));
    assert.deepEqual(calls,['stop','Go to Table'],text);
  }
});

test('partial questions do not invent intent; compound free commands and polite action questions remain available', async () => {
  const calls:string[]=[];const gate=new VoiceSpeechControlGate(command=>{calls.push(command);return {completed:true};});
  gate.receive(transcript('partial','How far',false));await gate.executeTool('Go Home');assert.deepEqual(calls,['Go Home']);
  gate.receive(transcript('final','How far is sink?',true));assert.equal((await gate.executeTool('Go Home')).status,'rejected');
  gate.receive(transcript('free','Go to table and relax'));await gate.executeTool('Go to Table');assert.equal(calls.at(-1),'Go to Table');
  gate.receive(transcript('question-and-action','Tell me the distance and then go to Sink'));await gate.executeTool('Go to Sink');assert.equal(calls.at(-1),'Go to Sink');
  gate.receive(transcript('compound','Okay, pick up cup'));await gate.executeTool('Pick up cup');assert.equal(calls.at(-1),'Pick up cup');
  gate.receive(transcript('courtesy','Could you please go to sink?'));assert.equal(calls.at(-1),'Go to Sink');
});


test('deduplicated speech tools return fresh verified state only for the identical native mission ID', async () => {
  const initial={mission:{plan:{id:'native-1'},status:'running'},robot:{mode:'running'}};
  let current:unknown={...initial,executionReceipt:{status:'running',verified:false}};let calls=0;
  const gate=new VoiceSpeechControlGate(()=>{calls++;return {completed:false,status:'running',summary:'Started, not yet verified.',world:initial};},undefined,Date.now,()=>current);
  gate.receive(transcript('nav-current','Move forward one meter'));
  current={mission:{plan:{id:'native-1'},status:'completed'},robot:{mode:'idle'},executionReceipt:{status:'succeeded',verified:true,checks:[{passed:true},{passed:true}]}};
  const actual=await gate.executeTool('Move forward 1 meter');assert.equal(actual.completed,true);assert.equal(actual.status,'succeeded');assert.equal(actual.receiptFreshness,'same-native-mission');assert.match(actual.summary!,/latest simulator snapshot verifies/i);assert.equal(calls,1);
  current={mission:{plan:{id:'different-2'},status:'completed'},robot:{mode:'idle'},executionReceipt:{status:'succeeded',verified:true,checks:[{passed:true}]}};
  const unrelated=await gate.executeTool('Move forward 1 meter');assert.equal(unrelated.completed,false);assert.equal(unrelated.status,'superseded');assert.equal(calls,1);
});

test('same-mission pause, stop, failed checks and empty checks never reuse old success', async () => {
  let current:unknown;const initial={mission:{plan:{id:'native-1'},status:'running'},robot:{mode:'running'}};
  const gate=new VoiceSpeechControlGate(()=>({completed:false,status:'running',world:initial}),undefined,Date.now,()=>current);gate.receive(transcript('nav','Go to sink'));
  for(const [mode,status,checks,wanted] of [['paused','running',[{passed:true}],'paused'],['stopped','stopped',[{passed:true}],'cancelled'],['idle','completed',[{passed:false}],'unverified'],['idle','completed',[],'unverified']] as const){current={mission:{plan:{id:'native-1'},status},robot:{mode},executionReceipt:{status:'succeeded',verified:true,checks}};const value=await gate.executeTool('Go to sink');assert.equal(value.completed,false);assert.equal(value.status,wanted);}
});

test('refused commands and Stop controls cannot inherit completion from another mission', async () => {
  const successful={mission:{plan:{id:'previous'},status:'completed'},robot:{mode:'idle'},executionReceipt:{status:'succeeded',verified:true,checks:[{passed:true}]}};
  const gate=new VoiceSpeechControlGate(command=>command==='stop'?{completed:true,summary:'Control stop applied.'}:{completed:false,error:'Relative movement must be between 0.05 and 5 meters.'},undefined,Date.now,()=>successful);
  gate.receive(transcript('refused','Go straight six meters'));const refused=await gate.executeTool('Go straight 6 meters');assert.equal(refused.completed,false);assert.match(refused.error!,/0.05/);assert.equal(refused.receiptFreshness,undefined);
  gate.receive(transcript('stop','Stop'));const stop=await gate.executeTool('stop');assert.equal(stop.completed,true);assert.equal(stop.summary?.startsWith('Control stop applied.'),true);
});
