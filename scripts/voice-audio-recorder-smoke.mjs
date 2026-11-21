import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Actual browser MediaRecorder/codec verification with local synthetic tones.
// No human microphone, Agora session, or paid provider request is used.
const directory = resolve('.local/qa/voice-audio-recorder-browser'); await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext(); const blocked = [];
await context.route('**/api/**', async route => { if (route.request().method() !== 'GET') { blocked.push(route.request().url()); await route.abort('blockedbyclient'); return; } await route.continue(); });
const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5189/');
  const observed = await page.evaluate(async () => {
    const { VoiceAudioRecorder } = await import('/src/integrations/voice-audio-recorder.ts');
    const context = new AudioContext(); await context.resume();
    const tones = [440, 660].map(frequency => { const oscillator = context.createOscillator(), gain = context.createGain(), destination = context.createMediaStreamDestination(); oscillator.frequency.value = frequency; gain.gain.value = .2; oscillator.connect(gain).connect(destination); oscillator.start(); return { oscillator, track: destination.stream.getAudioTracks()[0] }; });
    const segments = [], states = [];
    const recorder = new VoiceAudioRecorder({ onStatus: state => states.push(state), onSegment: async segment => {
      const data = new Uint8Array(await segment.blob.arrayBuffer()); let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
      segments.push({ id: segment.id, direction: segment.direction, startedAt: segment.startedAt, endedAt: segment.endedAt, bytes: segment.bytes, mimeType: segment.mimeType, base64: btoa(binary) });
    } });
    recorder.addTrack('user', tones[0].track); recorder.addTrack('assistant', tones[1].track);
    await new Promise(resolve => setTimeout(resolve, 450)); await recorder.pause(); const afterPause = segments.length;
    await new Promise(resolve => setTimeout(resolve, 200)); recorder.resume(); await new Promise(resolve => setTimeout(resolve, 450)); await recorder.stop();
    const trackStatesAfterRecorderStop = tones.map(tone => tone.track.readyState);
    tones.forEach(tone => { tone.oscillator.stop(); tone.track.stop(); }); await context.close();
    return { segments, states, afterPause, trackStatesAfterRecorderStop };
  });
  assert.equal(observed.afterPause, 2); assert.equal(observed.segments.length, 4); assert.deepEqual(observed.trackStatesAfterRecorderStop, ['live', 'live']);
  assert.deepEqual(new Set(observed.segments.map(segment => segment.direction)), new Set(['user', 'assistant']));
  const clips = [];
  for (const [index, segment] of observed.segments.entries()) {
    const encoded = Buffer.from(segment.base64, 'base64'); assert.equal(encoded.length, segment.bytes); assert.ok(encoded.length > 1000); assert.ok(segment.mimeType.startsWith('audio/'));
    const path = resolve(directory, `clip-${index}.webm`); await writeFile(path, encoded);
    const decoded = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', 'pipe:1']);
    assert.ok(decoded.length > 1000, 'Each separately started clip must decode independently');
    clips.push({ ...segment, base64: undefined, path, decodedPcmBytes: decoded.length });
  }
  for (const direction of ['user', 'assistant']) { const group = clips.filter(clip => clip.direction === direction); assert.ok(group[1].startedAt - group[0].endedAt >= 150, 'Paused capture must leave an actual timestamped recording gap'); }
  assert.equal(blocked.length, 0); assert.deepEqual(errors, []);
  await writeFile(resolve(directory, 'results.json'), JSON.stringify({ passed: true, scope: 'Actual browser synthetic tones; not live microphone or provider audio', clips, states: observed.states, afterPause: observed.afterPause, trackStatesAfterRecorderStop: observed.trackStatesAfterRecorderStop, blockedRequests: blocked, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, independentlyDecodedClips: clips.length, directions: ['user', 'assistant'], providerRequests: 0, pausedGapVerified: true, sdkTracksClosedByRecorder: false }, null, 2));
} finally { await context.close(); await browser.close(); }
