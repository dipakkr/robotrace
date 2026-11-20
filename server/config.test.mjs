import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, buildAgentConfig } from './config.mjs';

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
  assert.equal(config.properties.llm.credential_mode, 'byok');
  assert.equal(config.properties.llm.api_key, fakeEnv.LLM_API_KEY);
  assert.equal(config.properties.advanced_features.enable_tools, true);
  assert.equal(config.properties.llm.tools.length, 2);
  assert.equal(config.properties.llm.tools[1].server.url, 'https://example.test/api/voice/tools/session/command');
  assert.equal(config.properties.llm.tools[1].server.headers.Authorization, 'Bearer tool-secret');
  assert.equal(config.properties.llm.tools[1].execution.mode, 'sync');
  assert.equal(config.properties.llm.tools[1].server.body.command, '{{args.command}}');
  assert.equal(config.properties.llm.tools[1].server.body.toolCallId, '{{tool_call_id}}');
});

export { fakeEnv };
