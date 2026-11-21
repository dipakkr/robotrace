import test from 'node:test';
import assert from 'node:assert/strict';
import { VoicePauseCommandGate } from '../integrations/voice-pause-gate';
const user = (id: string, text = 'Go to Sink') => ({ id, text, speaker: 'user' as const, final: true, receivedAt: 1000 });
test('paused voice rejects movement without queuing and allows Stop/Pause', () => {
  const gate = new VoicePauseCommandGate(); gate.observe(user('before'));
  assert.equal(gate.blockReason('Go to Sink'), null); gate.setPaused(true);
  assert.match(gate.blockReason('Go to Sink')!, /discarded, not queued/);
  assert.match(gate.blockReason('resume')!, /paused/);
  assert.equal(gate.blockReason('Stop'), null); assert.equal(gate.blockReason('pause'), null);
});
test('resume requires a new actual user turn, not delayed pre-pause/paused speech or assistant output', () => {
  const gate = new VoicePauseCommandGate(); gate.observe(user('before')); gate.setPaused(true); gate.observe(user('during')); gate.setPaused(false);
  assert.match(gate.blockReason('Take cup to Sink')!, /without new user speech/);
  gate.observe(user('before')); gate.observe(user('during')); assert.ok(gate.blockReason('Go to Sink'));
  gate.observe({ ...user('assistant'), speaker: 'assistant' }); assert.ok(gate.blockReason('Go to Sink'));
  gate.observe(user('after', 'Pick up Cup')); assert.equal(gate.blockReason('Pick up cup'), null);
});
test('repeated pause/resume calls do not invalidate fresh speech and a fresh session clears the gate', () => {
  const gate = new VoicePauseCommandGate(); gate.setPaused(true); gate.setPaused(false); gate.observe(user('fresh')); gate.setPaused(false);
  assert.equal(gate.blockReason('Go Home'), null); gate.setPaused(true); gate.clear(); assert.equal(gate.blockReason('Go Home'), null); assert.equal(gate.paused, false);
});
