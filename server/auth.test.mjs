import test from 'node:test';
import assert from 'node:assert/strict';
import agoraToken from 'agora-token';
import { agoraAuthorization } from './auth.mjs';

const env = { AGORA_APP_ID: 'a'.repeat(32), AGORA_APP_CERTIFICATE: 'b'.repeat(32) };

test('certificate auth generates combined RTC/RTM tokens with join scope and one-hour lifetimes', () => {
  let argumentsUsed;
  const header = agoraAuthorization(env, { properties: { channel: 'teachtrace-test', agent_rtc_uid: '1001' } }, (...args) => {
    argumentsUsed = args;
    return 'generated-test-token';
  });
  assert.equal(header, 'agora token=generated-test-token');
  assert.deepEqual(argumentsUsed, [env.AGORA_APP_ID, env.AGORA_APP_CERTIFICATE, 'teachtrace-test', '1001', agoraToken.RtcRole.PUBLISHER, 3600, 3600]);
  assert.equal(header.includes(env.AGORA_APP_CERTIFICATE), false);
});

test('control requests mint a fresh bounded control/0 token on each request', () => {
  const calls = [];
  const build = (...args) => { calls.push(args); return `token-${calls.length}`; };
  assert.equal(agoraAuthorization(env, undefined, build), 'agora token=token-1');
  assert.equal(agoraAuthorization(env, { text: 'Done.', priority: 'APPEND' }, build), 'agora token=token-2');
  assert.deepEqual(calls.map(args => args.slice(2, 4)), [['control', '0'], ['control', '0']]);
});

test('Basic authentication is selected only when both optional account credentials exist', () => {
  const customer = { AGORA_CUSTOMER_ID: 'customer-sentinel', AGORA_CUSTOMER_SECRET: 'secret-sentinel' };
  const header = agoraAuthorization({ ...env, ...customer }, {}, () => { throw new Error('Token builder should not run'); });
  assert.equal(Buffer.from(header.slice('Basic '.length), 'base64').toString(), 'customer-sentinel:secret-sentinel');
  for (const partial of [{ AGORA_CUSTOMER_ID: customer.AGORA_CUSTOMER_ID }, { AGORA_CUSTOMER_SECRET: customer.AGORA_CUSTOMER_SECRET }, { ...customer, AGORA_CUSTOMER_SECRET: ' ' }]) {
    assert.equal(agoraAuthorization({ ...env, ...partial }, {}, () => 'certificate-token'), 'agora token=certificate-token');
  }
});

test('invalid credentials, invalid join scope, and builder errors never echo supplied values', () => {
  const secret = 'credential-private-sentinel';
  const failure = operation => {
    assert.throws(operation, error => !error.message.includes(secret));
  };
  failure(() => agoraAuthorization({ ...env, AGORA_APP_CERTIFICATE: secret }));
  for (const properties of [
    { channel: secret.repeat(5), agent_rtc_uid: '1001' },
    { channel: `room\n${secret}`, agent_rtc_uid: '1001' },
    { channel: 'room', agent_rtc_uid: secret },
    { channel: 'room', agent_rtc_uid: -1 },
    { channel: 'room', agent_rtc_uid: '4294967296' },
    {},
  ]) failure(() => agoraAuthorization(env, { properties }));
  failure(() => agoraAuthorization(env, {}, () => { throw new Error(secret); }));
  assert.throws(() => agoraAuthorization(env, {}, () => ''), /could not be generated/);
});

test('installed agora-token generates a nonempty ConvoAI token without REST credentials', () => {
  const header = agoraAuthorization(env, { properties: { channel: 'teachtrace-test', agent_rtc_uid: 1001 } });
  assert.ok(header.startsWith('agora token=007'));
  assert.ok(header.length > 100);
  assert.equal(header.includes(env.AGORA_APP_CERTIFICATE), false);
});
