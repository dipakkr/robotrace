import test from 'node:test';
import assert from 'node:assert/strict';
import { AgoraCaptionDecoder, mergeVoiceTranscripts } from '../integrations/voice-captions';
const bytes = (value: string) => new TextEncoder().encode(value);
const packet = (value: unknown) => bytes(JSON.stringify(value));

test('Agora RTC user partials and assistant final/interrupted messages keep real speaker and turn identity', () => {
  const decoder = new AgoraCaptionDecoder();
  const partial = decoder.receive(packet({ object: 'user.transcription', turn_id: 3, text: 'Take cup', final: false }), 1)!;
  const final = decoder.receive(packet({ object: 'user.transcription', turn_id: 3, text: 'Take cup to sink', final: true }), 2)!;
  assert.equal(partial.speaker, 'user'); assert.equal(partial.final, false); assert.equal(final.id, partial.id);
  let entries = mergeVoiceTranscripts([], partial); entries = mergeVoiceTranscripts(entries, final);
  assert.equal(entries.length, 1); assert.equal(entries[0].text, 'Take cup to sink');
  assert.equal(mergeVoiceTranscripts(entries, partial), entries, 'A delayed partial cannot erase the final transcript');
  const response = decoder.receive(packet({ object: 'assistant.transcription', turn_id: 3, text: 'Moving the cup.', turn_status: 1 }), 3)!;
  entries = mergeVoiceTranscripts(entries, response);
  assert.equal(entries.length, 2); assert.equal(entries[1].speaker, 'assistant'); assert.equal(entries[1].final, true);
  const interrupted = decoder.receive(packet({ object: 'assistant.transcription', turn_id: 4, text: 'The robot is', turn_status: 2 }), 4)!;
  assert.equal(interrupted.interrupted, true); assert.equal(interrupted.final, true);
});

test('v2 split base64 reassembles out of order with duplicates and UTF-8 without inventing intermediate text', () => {
  const decoder = new AgoraCaptionDecoder();
  const source = { object: 'assistant.transcription', turn_id: 7, text: 'Café — moving the cup ✓', turn_status: 1 };
  const encoded = Buffer.from(JSON.stringify(source)).toString('base64'), pieces = [encoded.slice(0, 13), encoded.slice(13, 35), encoded.slice(35)];
  assert.equal(decoder.receive(bytes(`message-7|2|3|${pieces[2]}`), 1), null);
  assert.equal(decoder.receive(bytes(`message-7|2|3|${pieces[2]}`), 2), null);
  assert.equal(decoder.receive(bytes(`message-7|0|3|${pieces[0]}`), 3), null);
  const caption = decoder.receive(bytes(`message-7|1|3|${pieces[1]}`), 4)!;
  assert.equal(caption.text, source.text); assert.equal(caption.final, true);
});

test('unknown total waits for a declared count and expired/contradictory packets never become captions', () => {
  const decoder = new AgoraCaptionDecoder(), source = Buffer.from(JSON.stringify({ object: 'user.transcription', turn_id: 2, text: 'Hello', final: true })).toString('base64');
  assert.equal(decoder.receive(bytes(`pending|0|???|${source}`), 1), null);
  assert.equal(decoder.receive(bytes(`pending|0|1|${source}`), 2)?.text, 'Hello');
  assert.equal(decoder.receive(bytes(`expired|0|2|${source.slice(0, 8)}`), 1), null);
  assert.equal(decoder.receive(bytes(`expired|1|2|${source.slice(8)}`), 40000), null);
  assert.equal(decoder.receive(bytes('invalid|0|3|AAAA'), 40001), null);
  assert.equal(decoder.receive(bytes('invalid|1|2|AAAA'), 40002), null);
  decoder.clear();
});

test('unsupported events, binary data, invalid identity and oversized messages cannot enter conversation history', () => {
  const decoder = new AgoraCaptionDecoder();
  for (const payload of [bytes('not-json'), new Uint8Array([0xff, 0x00]), bytes('x'.repeat(65537)),
    packet({ object: 'metrics', turn_id: 1, text: 'Not speech' }), packet({ object: 'user.transcription', text: 'No turn identity' }),
    packet({ object: 'user.transcription', turn_id: 1, text: 'x'.repeat(20001) }), bytes('bad|129|130|AAAA')]) assert.equal(decoder.receive(payload), null);
  const snapshot = decoder.receive(packet({ object: 'user.transcription', message_id: 'fallback-id', text: 'No numeric turn', final: true }))!;
  assert.equal(snapshot.id, 'user:fallback-id');
});

test('long sessions retain only the latest 200 actual transcript rows', () => {
  const decoder = new AgoraCaptionDecoder(); let history = [] as ReturnType<typeof mergeVoiceTranscripts>;
  for (let index = 0; index < 205; index++) history = mergeVoiceTranscripts(history, decoder.receive(packet({ object: 'user.transcription', turn_id: index, text: `Task ${index}`, final: true }))!);
  assert.equal(history.length, 200); assert.equal(history[0].id, 'user:5'); assert.equal(history.at(-1)!.text, 'Task 204');
});

test('empty final and interruption markers finish existing rows without erasing text or inventing speech', () => {
  const decoder = new AgoraCaptionDecoder();
  const partial = decoder.receive(packet({ object: 'assistant.transcription', turn_id: 1, text: 'The cup is', turn_status: 0 }))!;
  const interruption = decoder.receive(packet({ object: 'message.interrupt', turn_id: 1 }))!;
  const history = mergeVoiceTranscripts([partial], interruption);
  assert.equal(history[0].text, 'The cup is'); assert.equal(history[0].interrupted, true); assert.equal(history[0].final, true);
  const noSpeech = decoder.receive(packet({ object: 'user.transcription', turn_id: 2, text: '', final: true }))!;
  assert.equal(mergeVoiceTranscripts(history, noSpeech), history);
  const final = decoder.receive(packet({ object: 'assistant.transcription', turn_id: 1, text: '', turn_status: 1 }))!;
  assert.equal(mergeVoiceTranscripts(history, final)[0].text, 'The cup is');
  assert.equal(mergeVoiceTranscripts(history, final)[0].interrupted, true);
});

test('one-based fragment indices and SDK ArrayBuffer/string payloads decode without dropping valid packets', () => {
  const decoder = new AgoraCaptionDecoder();
  const value = { object: 'user.transcription', turn_id: 9, text: 'Move bowl to table', final: true };
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64');
  assert.equal(decoder.receive(`message:9|1|1|${encoded}`)?.text, value.text);
  assert.equal(decoder.receive(packet(value).buffer)?.text, value.text);
  assert.equal(decoder.receive(JSON.stringify(value))?.text, value.text);
  const left = encoded.slice(0, 17), right = encoded.slice(17);
  assert.equal(decoder.receive(`part-message|1|-1|${left}`), null);
  assert.equal(decoder.receive(`part-message|2|2|${right}`)?.text, value.text);
  assert.equal(decoder.receive({ unsupported: 'object' }), null);
});
