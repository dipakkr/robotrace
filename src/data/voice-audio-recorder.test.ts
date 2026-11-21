import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceAudioRecorder } from '../integrations/voice-audio-recorder';
import type { VoiceAudioSegment, VoiceRecordingStatus } from '../integrations/voice-audio-recorder';

class Track extends EventTarget { readyState: MediaStreamTrackState = 'live'; stopCalls = 0; stop() { this.stopCalls++; } end() { this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); } }
class Capture {
  state: RecordingState = 'inactive'; mimeType = 'audio/webm;codecs=opus';
  ondataavailable: MediaRecorder['ondataavailable'] = null; onstop: MediaRecorder['onstop'] = null; onerror: MediaRecorder['onerror'] = null;
  starts = 0; stops = 0;
  data(value: string) { this.ondataavailable?.call(this as unknown as MediaRecorder, { data: new Blob([value], { type: this.mimeType }) } as BlobEvent); }
  start() { this.starts++; this.state = 'recording'; this.data('independent-header|'); }
  stop() { this.stops++; this.state = 'inactive'; queueMicrotask(() => { this.data('final-tail'); this.onstop?.call(this as unknown as MediaRecorder, new Event('stop')); }); }
  error() { this.state = 'inactive'; this.onerror?.call(this as unknown as MediaRecorder, new Event('error') as ErrorEvent); queueMicrotask(() => { this.data('broken-tail'); this.onstop?.call(this as unknown as MediaRecorder, new Event('stop')); }); }
}
function fixture(receiver?: (segment: VoiceAudioSegment) => void | Promise<void>, limits: { maxBytes?: number; maxDurationMs?: number } = {}) {
  const segments: VoiceAudioSegment[] = [], status: VoiceRecordingStatus[] = [], captures: Capture[] = [];
  const timers = new Map<number, { callback: () => void; delay: number }>(); let serial = 0, time = 1000;
  const recorder = new VoiceAudioRecorder({ onSegment: receiver ?? (segment => { segments.push(segment); }), onStatus: value => status.push(value),
    recorderFactory: () => { const capture = new Capture(); captures.push(capture); return capture; }, streamFactory: track => track as unknown as MediaStream,
    scheduler: { set: (callback, delay) => { const id = ++serial; timers.set(id, { callback, delay }); return id; }, clear: id => { timers.delete(id as number); } }, now: () => time, ...limits });
  const add = (direction: 'user' | 'assistant', track = new Track()) => { recorder.addTrack(direction, track as unknown as MediaStreamTrack); return track; };
  return { recorder, add, captures, segments, status, timers, setTime: (value: number) => { time = value; }, fire: (delay: number) => { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } } };
}

test('stop awaits final blob events and async segment receivers without closing SDK-owned tracks', async () => {
  const received: VoiceAudioSegment[] = [], complete: (() => void)[] = [];
  const f = fixture(segment => { received.push(segment); return new Promise<void>(resolve => complete.push(resolve)); });
  const user = f.add('user'), assistant = f.add('assistant'); f.setTime(2500);
  let stopped = false; const done = f.recorder.stop().then(() => { stopped = true; });
  await new Promise<void>(queueMicrotask); assert.equal(received.length, 2); assert.equal(stopped, false);
  assert.ok(received.every(segment => segment.startedAt === 1000 && segment.endedAt === 2500 && segment.bytes === segment.blob.size));
  assert.deepEqual(new Set(received.map(segment => segment.direction)), new Set(['user', 'assistant']));
  assert.ok((await received[0].blob.text()).endsWith('final-tail'));
  complete.forEach(resolve => resolve()); await done; await f.recorder.stop();
  assert.equal(stopped, true); assert.equal(received.length, 2); assert.equal(user.stopCalls + assistant.stopCalls, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.status.at(-1)?.state, 'stopped');
});

test('pause finalizes existing clips and resume starts fresh captures including tracks added while paused', async () => {
  const f = fixture(); f.add('user'); const oldAssistant = f.add('assistant'); f.setTime(2000); await f.recorder.pause();
  assert.equal(f.segments.length, 2); assert.ok(f.captures.every(capture => capture.state === 'inactive'));
  oldAssistant.end(); f.add('assistant'); assert.equal(f.captures.length, 2, 'No new microphone/remote recording while paused');
  f.setTime(5000); f.recorder.resume(); assert.equal(f.captures.length, 4); f.setTime(6000); await f.recorder.stop();
  assert.deepEqual(f.segments.map(segment => [segment.startedAt, segment.endedAt]), [[1000, 2000], [1000, 2000], [5000, 6000], [5000, 6000]]);
  assert.ok(f.status.some(value => value.state === 'paused'));
});

test('60-second rolls produce distinct independently started clips and flush a final partial segment', async () => {
  const f = fixture(); f.add('user'); f.setTime(61000); f.fire(60000); await new Promise<void>(queueMicrotask);
  assert.equal(f.captures.length, 2); f.setTime(65000); await f.recorder.stop();
  assert.equal(f.segments.length, 2); assert.notEqual(f.segments[0].id, f.segments[1].id);
  assert.deepEqual(f.segments.map(segment => [segment.startedAt, segment.endedAt]), [[1000, 61000], [61000, 65000]]);
  for (const segment of f.segments) assert.equal(await segment.blob.text(), 'independent-header|final-tail');
});

test('unsupported capture reports its actual state and emits no invented audio', async () => {
  const statuses: VoiceRecordingStatus[] = []; const segments: VoiceAudioSegment[] = [];
  const recorder = new VoiceAudioRecorder({ recorderFactory: null, onSegment: segment => { segments.push(segment); }, onStatus: value => statuses.push(value) });
  recorder.addTrack('user', new Track() as unknown as MediaStreamTrack); await recorder.pause(); recorder.resume(); await recorder.stop();
  assert.equal(recorder.supported, false); assert.equal(statuses[0].state, 'error'); assert.equal(segments.length, 0);
});

test('oversize and browser errors stop recording, release buffers and report failure without partial/fake clips', async () => {
  const oversized = fixture(undefined, { maxBytes: 8 }); oversized.add('user'); await oversized.recorder.stop();
  assert.equal(oversized.segments.length, 0); assert.equal(oversized.status.at(-1)?.state, 'error'); assert.equal(oversized.timers.size, 0);
  const broken = fixture(); broken.add('assistant'); broken.captures[0].error(); await broken.recorder.stop();
  assert.equal(broken.segments.length, 0); assert.equal(broken.status.at(-1)?.state, 'error'); assert.equal(broken.timers.size, 0);
});

test('receiver failure is surfaced and teardown finishes before late browser events can emit another clip', async () => {
  const f = fixture(() => { throw new Error('Private receiver detail'); }); f.add('user'); const source = f.captures[0]; await f.recorder.stop();
  assert.equal(f.status.at(-1)?.state, 'error'); assert.match(f.status.at(-1)?.error ?? '', /could not be delivered/);
  assert.ok(!JSON.stringify(f.status).includes('Private receiver detail'));
  source.data('late-event'); source.onstop?.call(source as unknown as MediaRecorder, new Event('stop')); assert.equal(f.status.at(-1)?.state, 'error');
});

test('the recording duration limit is bounded even when a session remains paused', async () => {
  const f = fixture(undefined, { maxDurationMs: 1000 }); f.add('user'); await f.recorder.pause(); f.fire(1000); await f.recorder.stop();
  assert.equal(f.status.at(-1)?.state, 'error'); assert.match(f.status.at(-1)?.error ?? '', /session limit/); assert.equal(f.timers.size, 0);
});
