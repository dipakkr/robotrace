import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One explicitly intended real Agora/Murf session. Reuses prerecorded test
// speech; this is not a human microphone or human listening acceptance test.
const directory = resolve(process.env.CAPTION_QA_OUTPUT || '.local/qa/live-voice-captions'); await mkdir(directory, { recursive: true });
const input = resolve(directory, 'input.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-i', resolve('.local/qa/mobile-task.wav'),
  '-filter_complex', '[1:a]aresample=48000,adelay=7000:all=1[speech];[0:a][speech]amix=inputs=2:duration=first:normalize=0[out]', '-map', '[out]', '-t', '60', '-c:a', 'pcm_s16le', input], { stdio: 'pipe' });
const result = { schema: 'teachtrace.live-voice-captions.v1', startedAt: new Date().toISOString(), input: 'Prerecorded speech; real Agora/Murf RTC session and caption events',
  humanMicrophoneVerified: false, humanPlaybackVerified: false, starts: 0, acks: [], errors: [], blockedRequests: [], checks: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${input}`,
  '--autoplay-policy=no-user-gesture-required', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 900 }, permissions: ['microphone'], recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
await context.addInitScript(() => {
  window.__captionSnapshots = []; window.__captionAudio = [];
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(Native, { construct(Target, args) {
    const pc = new Target(...args); pc.addEventListener('track', event => {
      if (event.track.kind !== 'audio') return;
      const state = { chunks: [], recorder: new MediaRecorder(new MediaStream([event.track]), { mimeType: 'audio/webm;codecs=opus' }) };
      state.recorder.ondataavailable = data => { if (data.data.size) state.chunks.push(data.data); }; state.recorder.start(500); window.__captionAudio.push(state);
    }); return pc;
  } });
  new MutationObserver(() => {
    const rows = [...document.querySelectorAll('.voice-conversation-row')].map(row => ({ speaker: row.classList.contains('voice-speaker-user') ? 'user' : 'assistant', text: row.querySelector('p')?.textContent?.replace(/▍$/, ''), final: row.dataset.final === 'true' }));
    if (rows.length && JSON.stringify(rows) !== JSON.stringify(window.__captionSnapshots.at(-1)?.rows)) window.__captionSnapshots.push({ at: Date.now(), rows });
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-final'] });
});
const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => result.errors.push(error.message));
let voiceURL, deadlineTimer;
const stop = async () => { if (voiceURL) await page.evaluate(async url => { const module = await import(url); await module.stopVoiceSession(); }, voiceURL).catch(() => {}); };
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path === '/api/voice/start') {
    result.starts++; if (result.starts > 1) { await route.abort('blockedbyclient'); return; }
    result.startRequestedAt = Date.now(); deadlineTimer = setTimeout(() => { result.safetyStop = true; void stop(); }, 60000);
  }
  if (request.method() === 'POST' && ['/api/voice/reset', '/api/scenes/draft', '/api/planner/plan', '/api/mobile-planner/plan', '/api/mobile/episodes', '/api/evaluations/mobile'].includes(path)) { result.blockedRequests.push(path); await route.abort('blockedbyclient'); return; }
  await route.continue();
});
page.on('response', response => {
  const path = new URL(response.url()).pathname;
  if (path === '/src/integrations/voice.ts') voiceURL = response.url();
  if (path === '/api/voice/ack') { const data = response.request().postDataJSON()?.result; result.acks.push({ status: data?.status, completed: data?.completed, plannedActions: data?.plannedActions, error: data?.error }); }
});
try {
  await page.goto('/'); await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('region', { name: 'Live voice conversation', exact: true }).waitFor();
  assert.equal(await page.locator('.voice-conversation-row').count(), 0, 'No invented conversation before connecting');
  await page.evaluate(async url => { const voice = await import(url); voice.enableVoiceCaptionDiagnostics(true); }, voiceURL || '/src/integrations/voice.ts');
  await page.getByRole('button', { name: 'Connect voice', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.voice-conversation header')?.textContent?.includes('RTC audio connected'), null, { timeout: 20000 });
  result.checks.push({ name: 'Actual Agora remote audio subscribed', passed: true });
  await page.waitForFunction(() => [...document.querySelectorAll('.voice-speaker-user[data-final=true] p')].some(row => /cup/i.test(row.textContent) && /sink|sync/i.test(row.textContent)), null, { timeout: 30000 });
  result.checks.push({ name: 'Actual user speech recognized and displayed in provider transcript', passed: true });
  await page.waitForFunction(() => document.querySelector('.mobile-phase')?.textContent === 'Mobile task completed', null, { timeout: 30000 });
  assert.ok(result.acks.some(ack => ack.plannedActions?.length === 5));
  result.checks.push({ name: 'Voice tool request ran the actual five-step delivery controller', passed: true });
  await page.waitForFunction(() => [...document.querySelectorAll('.voice-speaker-assistant[data-final=true] p')].some(row => /cup/i.test(row.textContent)), null, { timeout: 15000 });
  await page.screenshot({ path: resolve(directory, 'conversation-and-simulation.png') });
  result.checks.push({ name: 'Actual assistant transcript displayed with its speaker identity', passed: true });
} catch (error) { result.failure = error.message; await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => {}); }
finally {
  result.snapshots = await page.evaluate(() => window.__captionSnapshots).catch(() => []);
  result.partialUpdatesObserved = result.snapshots.filter(snapshot => snapshot.rows.some(row => !row.final)).length;
  result.finalRows = result.snapshots.at(-1)?.rows ?? [];
  result.transport = await page.evaluate(async url => { const voice = await import(url); return voice.getVoiceCaptionDiagnostics(); }, voiceURL || '/src/integrations/voice.ts').catch(() => null);
  await page.evaluate(async () => { await Promise.all(window.__captionAudio.map(({ recorder }) => new Promise(resolve => { if (recorder.state !== 'recording') { resolve(); return; } recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); }))); }).catch(() => {});
  const audio = await page.evaluate(async () => Promise.all(window.__captionAudio.map(async recording => { const data = new Uint8Array(await new Blob(recording.chunks).arrayBuffer()); let encoded = ''; for (const byte of data) encoded += String.fromCharCode(byte); return btoa(encoded); }))).catch(() => []);
  result.audioTracks = []; for (const [index, encoded] of audio.entries()) { const data = Buffer.from(encoded, 'base64'); await writeFile(resolve(directory, `remote-audio-${index}.webm`), data); result.audioTracks.push({ index, bytes: data.length }); }
  await stop(); if (deadlineTimer) clearTimeout(deadlineTimer); result.stoppedAt = Date.now();
  result.video = await page.video().path(); await context.close(); await browser.close();
}
result.passed = result.checks.length === 4 && result.checks.every(check => check.passed) && result.starts === 1 && !result.failure && !result.safetyStop && result.errors.length === 0;
result.finishedAt = new Date().toISOString(); await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, partialUpdatesObserved: result.partialUpdatesObserved, finalRows: result.finalRows, failure: result.failure, starts: result.starts, audioTracks: result.audioTracks, errors: result.errors }, null, 2));
if (!result.passed) process.exitCode = 1;
