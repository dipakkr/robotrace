import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, buildAgentConfig } from './config.mjs';
import { taskGuideForEnvironment } from './task-guides.mjs';

const fakeEnv = {
  AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32),
  AGORA_CUSTOMER_ID: 'fake-customer', AGORA_CUSTOMER_SECRET: 'fake-secret',
  MURF_API_KEY: 'fake-murf', LLM_API_KEY: 'fake-llm', PUBLIC_API_BASE_URL: 'https://example.test',
};

test('configuration exposes presence only and rejects loopback callbacks', () => {
  const empty = configuration({});
  assert.equal(empty.configured, false);
  assert.equal(empty.providers.agora, false);
  assert.ok(empty.missing.includes('MURF_API_KEY'));
  assert.equal(configuration(fakeEnv).configured, true);
  assert.equal(configuration({ ...fakeEnv, PUBLIC_API_BASE_URL: 'http://localhost:8788' }).configured, false);
  const serialized = JSON.stringify(configuration(fakeEnv));
  assert.equal(serialized.includes('fake-secret'), false);
  assert.equal(serialized.includes('fake-murf'), false);
});

test('certificate authentication makes REST account credentials optional while retaining the LLM requirement', () => {
  const env = { ...fakeEnv };
  delete env.AGORA_CUSTOMER_ID;
  delete env.AGORA_CUSTOMER_SECRET;
  const status = configuration(env);
  assert.equal(status.configured, true);
  assert.equal(status.providers.agora, true);
  assert.deepEqual(status.missing, []);
  delete env.LLM_API_KEY;
  assert.equal(configuration(env).configured, false);
  assert.ok(configuration(env).missing.includes('LLM_API_KEY'));
});

test('agent configuration uses Murf Falcon and synchronous authenticated tools', () => {
  const config = buildAgentConfig({ env: fakeEnv, id: 'session', channel: 'room', agentToken: 'rtc', toolSecret: 'tool-secret' });
  assert.equal(config.properties.tts.vendor, 'murf');
  assert.equal(config.properties.tts.credential_mode, 'byok');
  assert.equal(config.properties.tts.params.api_key, fakeEnv.MURF_API_KEY);
  assert.equal(config.properties.tts.params.base_url, 'wss://global.api.murf.ai/v1/speech/stream-input');
  assert.equal(config.properties.tts.params.voiceId, 'Matthew');
  assert.equal(config.properties.tts.params.sample_rate, 24000);
  assert.equal('api_key' in config.properties.tts, false);
  assert.equal(config.properties.tts.params.model, 'FALCON');
  assert.equal(config.properties.asr.credential_mode, 'managed');
  assert.equal(config.properties.asr.vendor, 'deepgram');
  assert.equal(config.properties.asr.params.url, 'wss://api.deepgram.com/v1/listen');
  assert.equal(config.properties.asr.params.model, 'nova-3');
  assert.equal(config.properties.asr.params.language, 'multi');
  assert.equal(config.properties.llm.credential_mode, 'byok');
  assert.equal(config.properties.llm.api_key, fakeEnv.LLM_API_KEY);
  assert.equal(config.properties.advanced_features.enable_tools, true);
  assert.deepEqual(config.properties.parameters.transcript, { enable: true, protocol_version: 'v2', enable_words: false });
  assert.equal(config.properties.parameters.data_channel, 'datastream');
  assert.equal(config.properties.llm.tools.length, 2);
  assert.equal(config.properties.llm.tools[1].server.url, 'https://example.test/api/voice/tools/session/command');
  assert.equal(config.properties.llm.tools[1].server.headers.Authorization, 'Bearer tool-secret');
  assert.equal(config.properties.llm.tools[1].execution.mode, 'sync');
  assert.equal(config.properties.llm.tools[1].server.body.command, '{{args.command}}');
  assert.equal(config.properties.llm.tools[1].server.body.toolCallId, '{{tool_call_id}}');
});

test('voice action contract names each retrieved assignment and the structured plan/outcome evidence', () => {
  const { properties: { llm } } = buildAgentConfig({ env: fakeEnv, id: 'session', channel: 'room', agentToken: 'rtc', toolSecret: 'tool-secret' });
  const instructions = llm.system_messages.map(message => message.content).join(' ');
  const commandTool = llm.tools.find(tool => tool.function.name === 'ExecuteWorkcellCommand').function;
  for (const environment of ['workbench', 'kitchen', 'lab']) {
    assert.ok(instructions.includes(taskGuideForEnvironment(environment).command), `The ${environment} SOP command must remain available to the voice agent`);
  }
  for (const receiptField of ['plannedActions', 'verifiedPlacements', 'unchangedProtectedObjects', 'completed:false']) {
    assert.ok(instructions.includes(receiptField), `The voice contract must interpret ${receiptField}`);
    assert.ok(commandTool.description.includes(receiptField), `The action tool must describe ${receiptField}`);
  }
  assert.deepEqual(Object.keys(commandTool.parameters.properties), ['command']);
  assert.equal(commandTool.parameters.additionalProperties, false);
  assert.deepEqual(llm.tools.map(tool => tool.function.name), ['GetWorkcellContext', 'ExecuteWorkcellCommand'], 'Dataset review and submission remain human UI actions');
});

test('voice mobile contract grounds commands, rationale and completion in current mobile receipts', () => {
  const { properties: { llm } } = buildAgentConfig({ env: fakeEnv, id: 'session', channel: 'room', agentToken: 'rtc', toolSecret: 'tool-secret' });
  const instructions = llm.system_messages.map(message => message.content).join(' ');
  for (const value of ['teachtrace.mobile-kitchen.v1', 'mobile-kitchen', 'Cup', 'Bowl', 'Counter', 'Table', 'Sink', 'Home', 'Take cup from counter to sink', 'Bring bowl to table', 'Go Home', 'TT-MOBILE-UNVERIFIED', 'taskGuide.rationale', 'plannedActions', 'status:running', 'status:paused', 'executionReceipt', 'status:succeeded', 'verified:true', 'passed checks', 'observedLocation', 'destinationLabel']) {
    assert.ok(instructions.includes(value), `Voice must interpret mobile contract field ${value}`);
  }
  assert.match(instructions, /do not assume the initial out-of-reach reason still applies/);
  assert.match(instructions, /Never invent tabletop trays, washing, a learned policy, SLAM/);
  assert.match(llm.tools[0].function.description, /geometric reach context and executionReceipt/);
  assert.match(llm.tools[1].function.description, /reasoning/);
  assert.match(llm.greeting_message, /where the robot should go/);
});

test('voice policy follows immediate simulation execution and separates saving from human review', () => {
  const { properties: { llm } } = buildAgentConfig({ env: fakeEnv, id: 'session', channel: 'room', agentToken: 'rtc', toolSecret: 'tool-secret' });
  const instructions = llm.system_messages.map(message => message.content).join(' ');
  const command = llm.tools[1].function;
  assert.match(instructions, /current local console uses immediate simulation execution/);
  assert.match(instructions, /do not ask the operator to approve/);
  assert.match(command.description, /no approval gate or countdown/);
  assert.match(command.parameters.properties.command.description, /execute immediately without approval/);
  assert.match(instructions, /unreviewed record must never be described as human-approved/);
  assert.match(instructions, /status:succeeded and verified:true/);
});

export { fakeEnv };

test('persistent mobile voice separates navigation, custody and release without a default task', () => {
  const { properties: { llm } } = buildAgentConfig({ env: fakeEnv, id: 'session', channel: 'room', agentToken: 'rtc', toolSecret: 'tool-secret' });
  const prompt = llm.system_messages.map(message => message.content).join(' ');
  assert.match(prompt, /NO default assignment/);
  assert.match(prompt, /base navigation ONLY: never add a pickup/);
  assert.match(prompt, /arrive while still holding Cup, without release/);
  assert.match(prompt, /Execute explicit stop immediately/);
  assert.match(prompt, /Be quiet after acknowledging an outcome/);
});
test('multilingual input preserves the verified English TTS voice and canonical action boundaries',()=>{
 const config=buildAgentConfig({env:fakeEnv,id:'session',channel:'room',agentToken:'rtc',toolSecret:'tool-secret'});
 assert.equal(config.properties.asr.params.language,'multi');
 assert.equal(config.properties.tts.params.voiceId,'Matthew');assert.equal(config.properties.tts.params.locale,'en-US');assert.equal(config.properties.tts.params.model,'FALCON');
 const prompt=config.properties.llm.system_messages.map(message=>message.content).join(' ');
 for(const concept of ['Hindi in Devanagari','Hinglish','canonical English command','negation','Carry cup to Sink without release','mat ruko','speak concise English replies'])assert.ok(prompt.includes(concept),concept);
 const configured=buildAgentConfig({env:{...fakeEnv,MURF_VOICE_ID:'ExistingConfiguredVoice'},id:'session',channel:'room',agentToken:'rtc',toolSecret:'tool-secret'});assert.equal(configured.properties.tts.params.voiceId,'ExistingConfiguredVoice');
});
test('Hindi ASR uses one documented literal keyterm and limits homophone recovery to grounded action context',()=>{
 const {properties}=buildAgentConfig({env:fakeEnv,id:'session',channel:'room',agentToken:'rtc',toolSecret:'tool-secret'});
 assert.equal(properties.asr.params.language,'multi');assert.equal(typeof properties.asr.params.keyterm,'string');
 assert.equal(decodeURIComponent(properties.asr.params.keyterm),'कप');assert.equal(/[;,\n]/.test(properties.asr.params.keyterm),false);assert.equal('keywords' in properties.asr.params,false);
 const prompt=properties.llm.system_messages.map(message=>message.content).join(' ');
 assert.ok(prompt.includes('freshly retrieved unique visible labels'));assert.ok(prompt.includes('Never replace unrelated words globally'));assert.ok(prompt.includes('map लोगों to Stop'));assert.ok(prompt.includes('मत रुको remains a negation'));
});
test('platform silence reminders and filler speech are explicitly disabled without disabling listening or captions',()=>{
 const {properties}=buildAgentConfig({env:fakeEnv,id:'session',channel:'room',agentToken:'rtc',toolSecret:'tool-secret'});
 assert.deepEqual(properties.parameters.silence_config,{timeout_ms:0});assert.deepEqual(properties.filler_words,{enable:false});
 assert.equal(properties.parameters.transcript.enable,true);assert.deepEqual(properties.remote_rtc_uids,['1002']);assert.equal(properties.asr.vendor,'deepgram');assert.equal(properties.idle_timeout,60);
 assert.equal('content' in properties.parameters.silence_config,false,'No inactive-user reminder text is configured');
 const prompt=properties.llm.system_messages.map(message=>message.content).join(' ');assert.ok(prompt.includes('Empty text, whitespace, silence'));assert.ok(prompt.includes('emit no spoken content, make no tool calls'));
});

test('scene questions count grounded inventory surface items and preserve prop capability boundaries',()=>{
 const {properties}=buildAgentConfig({env:fakeEnv,id:'session',channel:'room',agentToken:'rtc',toolSecret:'tool-secret'});
 const prompt=properties.llm.system_messages.map(message=>message.content).join(' ');
 for(const concept of ['world.sceneInventory','sceneInventory.items explicitly assigned','rather than counting only the Cup and Bowl','rendered kettle','not camera perception','Never claim the kettle can be picked up','Never require valid Hindi or Hinglish'])assert.ok(prompt.toLowerCase().includes(concept.toLowerCase()),concept);
});
