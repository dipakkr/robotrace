import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One explicitly intended normal, unpaused real-provider session with silence.
// Record raw inbound RTC audio before app playback volume: UI muting cannot pass it.
const directory = resolve(process.env.QUIET_QA_OUTPUT || '.local/qa/voice-quiet'); await mkdir(directory, { recursive: true });
const input = resolve(directory, 'silent-input.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '50', '-c:a', 'pcm_s16le', input], { stdio: 'pipe' });
const result = { schema: 'teachtrace.voice-quiet.v1', startedAt: new Date().toISOString(), scope: '35 seconds of normal unpaused Agora/Murf audio with a silent microphone; one greeting allowed, no reminder/filler speech', starts: 0, errors: [], blockedRequests: [], checks: [], acknowledgments: [], announcements: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${input}`,
  '--autoplay-policy=no-user-gesture-required', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 900 }, permissions: ['microphone'], recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
await context.addInitScript(() => {
  window.__quietAudio = []; window.__quietSnapshots = [];
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(Native, { construct(Target, args) { const pc = new Target(...args); pc.addEventListener('track', event => {
    if (event.track.kind !== 'audio') return;
    const item = { startedAt: Date.now(), chunks: [], recorder: new MediaRecorder(new MediaStream([event.track]), { mimeType: 'audio/webm;codecs=opus' }) };
    item.recorder.ondataavailable = value => { if (value.data.size) item.chunks.push(value.data); }; item.recorder.start(500); window.__quietAudio.push(item);
  }); return pc; } });
  new MutationObserver(() => { const rows = [...document.querySelectorAll('.voice-conversation-row')].map(row => ({ speaker: row.classList.contains('voice-speaker-user') ? 'user' : 'assistant', text: row.querySelector('p')?.textContent?.replace(/▍$/, ''), final: row.dataset.final === 'true' }));
    if (rows.length && JSON.stringify(rows) !== JSON.stringify(window.__quietSnapshots.at(-1)?.rows)) window.__quietSnapshots.push({ at: Date.now(), rows });
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-final'] });
});
const page = await context.newPage(); page.setDefaultTimeout(20000); let voiceURL, deadlineTimer; const rawTracks = [];
const stopOwnVoice = async () => { if (voiceURL) await page.evaluate(async url => { await (await import(url)).stopVoiceSession(); }, voiceURL).catch(() => {}); };
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path === '/api/voice/start') { result.starts++; if (result.starts > 1) { await route.abort('blockedbyclient'); return; } result.startRequestedAt = Date.now(); deadlineTimer = setTimeout(() => { result.safetyStop = true; void stopOwnVoice(); }, 55000); }
  // Actual app announcements are deliberately NOT blocked: an idle nag must be
  // observed in the raw recording and make this test fail.
  if (request.method() === 'POST' && path === '/api/voice/announce') result.announcements.push({ at: Date.now(), text: request.postDataJSON()?.text });
  if (request.method() === 'POST' && ['/api/voice/reset', '/api/scenes/draft', '/api/mobile-planner/plan', '/api/planner/plan', '/api/mobile/episodes'].includes(path)) { result.blockedRequests.push(path); await route.abort('blockedbyclient'); return; }
  await route.continue();
});
page.on('pageerror', error => result.errors.push(error.message));
page.on('response', response => { const path = new URL(response.url()).pathname; if (path === '/src/integrations/voice.ts') voiceURL = response.url(); if (path === '/api/voice/ack') result.acknowledgments.push(response.request().postDataJSON()?.result); });
try {
  const ready = page.waitForResponse(response => new URL(response.url()).pathname === '/api/integrations/status' && response.status() === 200);
  await page.goto('/kitchen?voice=off'); await ready; await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.voice-conversation')?.getAttribute('data-voice-status') === 'live', null, { timeout: 20000 });
  result.connectedAt = Date.now();
  // The window stays normal/unmuted. We never click Pause or suppress audio.
  for (let index = 0; index < 7; index++) {
    await page.waitForTimeout(5000);
    assert.equal(await page.locator('.voice-conversation').getAttribute('data-voice-status'), 'live');
    assert.equal(await page.locator('.voice-conversation').getAttribute('data-paused'), 'false');
    assert.equal(await page.getByRole('button', { name: 'Resume simulation', exact: true }).count(), 0);
  }
  result.quietWindowEndedAt = Date.now(); result.checks.push({ name: 'Normal RTC session remained connected and unpaused for 35 seconds', passed: true });
  result.snapshots = await page.evaluate(() => window.__quietSnapshots); result.finalRows = result.snapshots.at(-1)?.rows ?? [];
  const users = result.finalRows.filter(row => row.speaker === 'user'), assistant = result.finalRows.filter(row => row.speaker === 'assistant');
  assert.equal(users.length, 0, 'Silent microphone must not create an actual user utterance');
  assert.equal(assistant.length, 1, 'Only one greeting transcript is allowed; later filler or reminders fail');
  assert.equal(result.announcements.length, 0, 'An idle simulator must not send progress announcements');
  assert.ok(assistant[0].text.trim()); result.checks.push({ name: 'Actual transcript stream contains one greeting and no user speech, reminders or fillers', passed: true });
  await page.screenshot({ path: resolve(directory, 'quiet-connected.png') });
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.activity-terminal-log')?.textContent?.includes('microphone input and audio playback are held'));
  await page.waitForTimeout(500);
  assert.equal(result.starts, 1); await page.screenshot({ path: resolve(directory, 'paused-same-session.png') });
  await page.getByRole('button', { name: 'Resume simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.activity-terminal-log')?.textContent?.includes('Simulation resumed. Listening for your next instruction.'));
  assert.equal(result.starts, 1); result.checks.push({ name: 'Pause and Resume confirmed real SDK microphone mute/unmute and audio controls without starting another RTC session', passed: true });
  await page.getByRole('button', { name: 'Stop simulation', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.voice-conversation')?.getAttribute('data-voice-status') === 'disconnected');
  assert.equal(new URL(page.url()).pathname, '/kitchen');
  result.checks.push({ name: 'Stop simulation ended voice and kept the kitchen route open', passed: true });
} catch (error) { result.failure = error.message; await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => {}); }
finally {
  result.snapshots ??= await page.evaluate(() => window.__quietSnapshots).catch(() => []);
  await page.evaluate(async () => { await Promise.all(window.__quietAudio.map(({ recorder }) => new Promise(resolve => { if (recorder.state !== 'recording') { resolve(); return; } recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); }))); }).catch(() => {});
  const records = await page.evaluate(async () => Promise.all(window.__quietAudio.map(async item => { const data = new Uint8Array(await new Blob(item.chunks).arrayBuffer()); let value = ''; for (const byte of data) value += String.fromCharCode(byte); return { startedAt: item.startedAt, base64: btoa(value) }; }))).catch(() => []);
  result.audioTracks = []; for (const [index, item] of records.entries()) { const data = Buffer.from(item.base64, 'base64'), path = resolve(directory, `remote-audio-${index}.webm`); await writeFile(path, data); result.audioTracks.push({ startedAt: item.startedAt, bytes: data.length, path }); if (data.length > 1000) rawTracks.push({ ...item, path }); }
  await stopOwnVoice(); if (deadlineTimer) clearTimeout(deadlineTimer); result.stoppedAt = Date.now(); result.video = await page.video().path(); await context.close(); await browser.close();
}
try {
  assert.ok(rawTracks.length, 'Actual remote audio must have been recorded');
  const analyses = [];
  const { spawnSync } = await import('node:child_process');
  let greetingAudioObserved = false;
  for (const track of rawTracks) {
    const quietStart = Math.max(0, ((result.connectedAt ?? result.startRequestedAt) + 12000 - track.startedAt) / 1000);
    if (quietStart > .1) {
      const greeting = spawnSync('ffmpeg', ['-hide_banner', '-i', track.path, '-af', `atrim=end=${quietStart.toFixed(3)},astats=metadata=1:reset=0`, '-f', 'null', '-'], { encoding: 'utf8' });
      const levels = [...(greeting.stderr ?? '').matchAll(/RMS level dB:\s*(-?\d+(?:\.\d+)?|-inf)/g)].map(match => match[1] === '-inf' ? -Infinity : Number(match[1]));
      assert.equal(greeting.status, 0); if (levels.some(level => level > -45)) greetingAudioObserved = true;
      analyses.push({ path: track.path, region: 'greeting allowance', rmsDb: levels.map(value => Number.isFinite(value) ? value : '-inf') });
    }
    // atrim operates on decoded audio before astats; no duration/cues metadata
    // is required from MediaRecorder's streaming WebM container.
    const run = spawnSync('ffmpeg', ['-hide_banner', '-i', track.path, '-af', `atrim=start=${quietStart.toFixed(3)},astats=metadata=1:reset=0`, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(run.status, 0, 'Raw audio analysis must complete');
    const values = [...(run.stderr ?? '').matchAll(/RMS level dB:\s*(-?\d+(?:\.\d+)?|-inf)/g)].map(match => match[1] === '-inf' ? -Infinity : Number(match[1]));
    if (!values.length) { analyses.push({ path: track.path, quietStart, note: 'No decoded audio samples after the greeting allowance; any later track is checked separately.' }); continue; }
    const rms = Math.max(...values); analyses.push({ path: track.path, quietStart, rmsDb: Number.isFinite(rms) ? rms : '-inf' }); assert.ok(rms < -45, `Actual inbound audio contains energy after the greeting: RMS ${rms} dB`);
  }
  assert.ok(greetingAudioObserved, 'The raw capture must contain greeting audio, not a completely muted or broken audio stream');
  result.audioAnalysis = analyses; result.checks.push({ name: 'Raw inbound RTC audio after the greeting is silent, independently of UI playback volume', passed: true });
} catch (error) { result.audioAnalysisFailure = error.message; }
result.passed = result.checks.length === 5 && result.checks.every(check => check.passed) && !result.failure && !result.audioAnalysisFailure && !result.safetyStop && result.starts === 1 && !result.errors.length && !result.blockedRequests.length;
result.finishedAt = new Date().toISOString(); await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, finalRows: result.finalRows, failure: result.failure, audioAnalysisFailure: result.audioAnalysisFailure, starts: result.starts, sessionMs: result.stoppedAt - result.startRequestedAt, errors: result.errors }, null, 2)); if (!result.passed) process.exitCode = 1;
