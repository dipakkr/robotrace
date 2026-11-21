import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Explicitly authorized ONE combined real-provider rehearsal. Offline OS speech
// fixtures are microphone input; this does not establish a human microphone test.
const directory = resolve(process.env.SPEECH_CONTROL_QA_OUTPUT || '.local/qa/voice-speech-controls'); await mkdir(directory, { recursive: true });
const phrases = [{ voice: 'Samantha', text: 'Can you please navigate to the sink?', at: 7 }, { voice: 'Lekha', text: 'कृपया रोबोट, अभी रुक जाओ।', at: 13 },
  { voice: 'Lekha', text: 'रोबोट, काउंटर पर रखे कप को उठाओ।', at: 23 }, { voice: 'Lekha', text: 'अब कप को हाथ में पकड़े रखते हुए सिंक तक जाओ।', at: 46 }];
for (const [index, phrase] of phrases.entries()) execFileSync('say', ['-v', phrase.voice, '-r', phrase.voice === 'Lekha' ? '140' : '155', '-o', resolve(directory, `phrase-${index}.aiff`), phrase.text], { stdio: 'pipe' });
const input = resolve(directory, 'input.wav'), args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono'];
for (const index of phrases.keys()) args.push('-i', resolve(directory, `phrase-${index}.aiff`));
const filters = phrases.map((phrase, index) => `[${index + 1}:a]aresample=48000,adelay=${phrase.at * 1000}:all=1[phrase${index}]`).join(';');
args.push('-filter_complex', `${filters};[0:a]${phrases.map((_, index) => `[phrase${index}]`).join('')}amix=inputs=5:duration=first:normalize=0[out]`, '-map', '[out]', '-t', '88', '-c:a', 'pcm_s16le', input);
execFileSync('ffmpeg', args, { stdio: 'pipe' });
const result = { schema: 'teachtrace.voice-speech-controls.v1', startedAt: new Date().toISOString(), scope: 'Real Agora/Deepgram multilingual ASR + Murf audio, strict direct speech controls and real native controller; prerecorded offline speech',
  humanMicrophoneVerified: false, humanPlaybackVerified: false, phrases, starts: 0, errors: [], checks: [], acknowledgments: [], blockedRequests: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${input}`,
  '--autoplay-policy=no-user-gesture-required', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 900 }, permissions: ['microphone'], acceptDownloads: true, recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
await context.addInitScript(() => {
  window.__voiceControlSnapshots = []; window.__voiceControlAudio = []; window.__voiceControlCommands = [];
  const NativeSource = window.EventSource;
  window.EventSource = new Proxy(NativeSource, { construct(Target, args) { const source = new Target(...args); source.addEventListener('command', event => { try { window.__voiceControlCommands.push(JSON.parse(event.data)); } catch {} }); return source; } });
  const NativeRTC = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(NativeRTC, { construct(Target, args) { const pc = new Target(...args); pc.addEventListener('track', event => {
    if (event.track.kind !== 'audio') return;
    const item = { chunks: [], recorder: new MediaRecorder(new MediaStream([event.track]), { mimeType: 'audio/webm;codecs=opus' }) };
    item.recorder.ondataavailable = data => { if (data.data.size) item.chunks.push(data.data); }; item.recorder.start(500); window.__voiceControlAudio.push(item);
  }); return pc; } });
  new MutationObserver(() => { const rows = [...document.querySelectorAll('.voice-conversation-row')].map(row => ({ speaker: row.classList.contains('voice-speaker-user') ? 'user' : 'assistant', text: row.querySelector('p')?.textContent?.replace(/▍$/, ''), final: row.dataset.final === 'true' }));
    if (rows.length && JSON.stringify(rows) !== JSON.stringify(window.__voiceControlSnapshots.at(-1)?.rows)) window.__voiceControlSnapshots.push({ at: Date.now(), rows });
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-final'] });
});
const page = await context.newPage(); page.setDefaultTimeout(25000); let voiceURL, timer;
const stopVoice = async () => { if (voiceURL) await page.evaluate(async url => { await (await import(url)).stopVoiceSession(); }, voiceURL).catch(() => {}); };
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path === '/api/voice/start') { result.starts++; if (result.starts > 1) { await route.abort('blockedbyclient'); return; } result.startRequestedAt = Date.now(); timer = setTimeout(() => { result.safetyStop = true; void stopVoice(); }, 90000); }
  if (request.method() === 'POST' && ['/api/voice/reset', '/api/scenes/draft', '/api/planner/plan', '/api/mobile-planner/plan', '/api/mobile/episodes', '/api/evaluations/mobile'].includes(path)) { result.blockedRequests.push(path); await route.abort('blockedbyclient'); return; }
  await route.continue();
});
page.on('pageerror', error => result.errors.push(error.message));
page.on('response', response => { const path = new URL(response.url()).pathname; if (path === '/src/integrations/voice.ts') voiceURL = response.url(); if (path === '/api/voice/ack') {
  const reply = response.request().postDataJSON()?.result; result.acknowledgments.push({ at: Date.now(), completed: reply?.completed, status: reply?.status, error: reply?.error, summary: reply?.summary,
    deduplicated: reply?.speechControlDeduplicated, plannedActions: reply?.plannedActions, goal: reply?.world?.mission?.plan?.goal });
} });
const mode = () => page.locator('.mobile-workspace header .state-pill').innerText();
const speechMetrics = () => page.evaluate(async url => (await import(url)).getVoiceSpeechControlDiagnostics(), voiceURL || '/src/integrations/voice.ts');
async function exportNative(name) { const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export mobile evaluation', exact: true }).click(); const file = await event, path = resolve(directory, `${name}.json`); await file.saveAs(path); return JSON.parse(await readFile(path, 'utf8')); }
try {
  await page.goto('/kitchen');
  await page.getByRole('combobox', { name: 'Mobile simulation speed', exact: true }).selectOption('1');
  await page.waitForFunction(() => document.querySelector('.voice-conversation header')?.textContent?.includes('RTC audio connected'), null, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('.mobile-workspace header .state-pill')?.textContent === 'stopped', null, { timeout: 26000 });
  const frozenClock = await page.locator('.mobile-metrics b').nth(2).innerText(); await page.waitForTimeout(450); assert.equal(await page.locator('.mobile-metrics b').nth(2).innerText(), frozenClock);
  const stopped = await exportNative('stopped-navigation');
  assert.equal(stopped.payload.finalWorld.mission.plan.goal.objectId, undefined); assert.equal(stopped.payload.finalWorld.robot.cargoObjectId, null);
  assert.deepEqual(stopped.payload.finalWorld.objects, stopped.payload.initialWorld.objects); assert.equal(stopped.payload.finalWorld.events.filter(event => ['pickup', 'place'].includes(event.kind)).length, 0);
  assert.ok(stopped.payload.finalWorld.distanceTravelled > 0); assert.notEqual(stopped.payload.finalWorld.mission.status, 'completed');
  const stopWorld = stopped.payload.finalWorld, stopSink = stopWorld.stations.find(station => station.id === 'sink');
  assert.ok(Math.hypot(stopWorld.robot.position[0] - stopSink.dock[0], stopWorld.robot.position[1] - stopSink.dock[1]) > .1, 'Stop must interrupt travel before the destination, not merely stop an already completed task');
  const controls = await speechMetrics(), stopMetric = controls.find(item => item.command === 'stop');
  result.fastPathObservation = { navigationObserved: controls.some(item => item.command === 'Go to Sink'), stopObserved: Boolean(stopMetric), ...(stopMetric ? { stopMetric } : {}),
    note: 'Optional measured property, distinct from workflow outcome. Missing direct dispatch does not establish a fast-path latency.' };
  result.checks.push({ name: 'English navigation kept Cup untouched with zero pickups or placements', passed: true });
  result.checks.push({ name: 'Hindi Stop interrupted actual travel before Sink and froze the controller clock', passed: true, ...(stopMetric ? { stopMetric } : {}), frozenClock, travelledMeters: stopped.payload.finalWorld.distanceTravelled });
  await page.screenshot({ path: resolve(directory, 'hindi-stop.png') });
  await page.waitForFunction(() => document.querySelector('.mobile-phase')?.textContent === 'Mobile task completed' && document.querySelector('.mobile-workspace header .state-pill')?.textContent === 'idle', null, { timeout: 28000 });
  const pickup = await exportNative('hindi-pickup'); assert.equal(pickup.payload.finalWorld.robot.cargoObjectId, 'cup'); assert.equal(pickup.payload.finalWorld.objects.find(object => object.id === 'cup').station, 'robot');
  assert.ok(pickup.payload.checks.every(check => check.passed)); result.checks.push({ name: 'A later Hindi pickup request cleared the Stop guard and completed a real held-object pickup', passed: true });
  // Wait for the last scheduled utterance to arrive, then for the carry to settle.
  await page.waitForFunction(() => [...document.querySelectorAll('.voice-speaker-user p')].some(row => /हाथ|पकड़े|pakad/i.test(row.textContent)), null, { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.mobile-terminal-details .mobile-step p')].some(node => node.textContent === 'Navigate to Sink'), null, { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('.mobile-phase')?.textContent === 'Mobile task completed' && document.querySelector('.mobile-workspace header .state-pill')?.textContent === 'idle', null, { timeout: 25000 });
  const carried = await exportNative('hindi-carried-navigation'); const world = carried.payload.finalWorld, sink = world.stations.find(station => station.id === 'sink');
  assert.equal(world.robot.cargoObjectId, 'cup'); assert.equal(world.objects.find(object => object.id === 'cup').station, 'robot'); assert.ok(Math.hypot(world.robot.position[0] - sink.dock[0], world.robot.position[1] - sink.dock[1]) <= .05);
  assert.equal(world.events.filter(event => event.kind === 'place').length, 0); assert.ok(carried.payload.checks.every(check => check.passed));
  result.checks.push({ name: 'Hindi carry instruction reached Sink while retaining Cup without an invented release', passed: true });
  await page.screenshot({ path: resolve(directory, 'hindi-carry-completed.png') });
} catch (error) { result.failure = error.message; await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => {}); }
finally {
  result.controls = await speechMetrics().catch(() => []); result.snapshots = await page.evaluate(() => window.__voiceControlSnapshots).catch(() => []); result.commands = await page.evaluate(() => window.__voiceControlCommands).catch(() => []);
  result.captionTransport = await page.evaluate(async url => (await import(url)).getVoiceCaptionDiagnostics(), voiceURL || '/src/integrations/voice.ts').catch(() => null);
  await page.evaluate(async () => { await Promise.all(window.__voiceControlAudio.map(({ recorder }) => new Promise(resolve => { if (recorder.state !== 'recording') { resolve(); return; } recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); }))); }).catch(() => {});
  const tracks = await page.evaluate(async () => Promise.all(window.__voiceControlAudio.map(async item => { const data = new Uint8Array(await new Blob(item.chunks).arrayBuffer()); let value = ''; for (const byte of data) value += String.fromCharCode(byte); return btoa(value); }))).catch(() => []);
  result.audioTracks = []; for (const [index, track] of tracks.entries()) { const data = Buffer.from(track, 'base64'); await writeFile(resolve(directory, `remote-audio-${index}.webm`), data); result.audioTracks.push({ bytes: data.length }); }
  await stopVoice(); if (timer) clearTimeout(timer); result.stoppedAt = Date.now(); result.video = await page.video().path(); await context.close(); await browser.close();
}
result.passed = result.checks.length === 4 && result.checks.every(check => check.passed) && result.starts === 1 && !result.failure && !result.safetyStop && !result.errors.length;
result.finishedAt = new Date().toISOString(); await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, controls: result.controls, commands: result.commands, failure: result.failure, errors: result.errors, starts: result.starts, sessionMs: result.stoppedAt - result.startRequestedAt }, null, 2)); if (!result.passed) process.exitCode = 1;
