import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Explicit bounded live-provider rehearsal. No automatic retries. The microphone
// is prerecorded test speech, never evidence of a human microphone/hearing test.
assert.equal(process.argv.length, 2);
process.loadEnvFile(resolve('.env.local'));
const directory = resolve('.local/qa/final-workflow');
await mkdir(directory, { recursive: true });
const result = { schema: 'teachtrace.final-voice-workflow.v1', startedAt: new Date().toISOString(),
  input: 'Prerecorded synthetic test speech; real Agora Conversational AI, LLM, Murf Falcon and local evidence API',
  humanMicrophoneVerified: false, humanPlaybackVerified: false, starts: 0, saves: 0,
  transcriptionRequests: 0, fixtureSpeechRequests: 0, errors: [], checks: [], acknowledgments: [], announcements: [], contextReports: [], timing: {} };
const question = resolve(directory, 'saved-report-question.wav');
const fixtureExists = await access(question).then(() => true, () => false);
if (!fixtureExists) {
result.fixtureSpeechRequests++;
const speech = await fetch('https://global.api.murf.ai/v1/speech/stream', {
  method: 'POST', headers: { 'api-key': process.env.MURF_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Was the reviewed mobile record saved, and did its task checks pass?', voiceId: 'en-US-matthew', model: 'FALCON', locale: 'en-US', sampleRate: 24000, format: 'WAV' }), signal: AbortSignal.timeout(25000),
});
assert.ok(speech.ok, `Speech fixture HTTP ${speech.status}`);
await writeFile(question, Buffer.from(await speech.arrayBuffer()));
}
const input = resolve(directory, 'prerecorded-input.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono',
  '-i', resolve('.local/qa/mobile-task.wav'), '-i', question, '-filter_complex',
  '[1:a]aresample=48000,adelay=7000:all=1[task];[2:a]aresample=48000,adelay=55000:all=1[question];[0:a][task][question]amix=inputs=3:duration=first:normalize=0[out]',
  '-map', '[out]', '-t', '78', '-c:a', 'pcm_s16le', input], { stdio: 'pipe' });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${input}`, '--autoplay-policy=no-user-gesture-required', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 900 }, permissions: ['microphone'], acceptDownloads: true,
  recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
await context.addInitScript(() => {
  window.__workflowAudio = [];
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(Native, { construct(Target, args) {
    const pc = new Target(...args);
    pc.addEventListener('track', event => {
      if (event.track.kind !== 'audio') return;
      const recording = { startedAt: Date.now(), chunks: [], recorder: new MediaRecorder(new MediaStream([event.track]), { mimeType: 'audio/webm;codecs=opus' }) };
      recording.recorder.ondataavailable = data => { if (data.data.size) recording.chunks.push(data.data); };
      recording.recorder.start(500); window.__workflowAudio.push(recording);
    }); return pc;
  } });
});
result.timing.beforePageCreated = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(20000);
let voiceURL, deadlineTimer, audio = Buffer.alloc(0);
const responses = new Set();
const stopOwnVoice = async () => {
  if (voiceURL) await page.evaluate(async url => { const voice = await import(url); await voice.stopVoiceSession(); }, voiceURL).catch(() => {});
};
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (path === '/api/voice/start' && request.method() === 'POST') {
    result.starts++;
    if (result.starts !== 1) { await route.abort('blockedbyclient'); return; }
    result.timing.voiceStartRequested = Date.now();
    deadlineTimer = setTimeout(() => { result.safetyStop = true; void stopOwnVoice(); }, 82000);
  }
  // This run is the voice workplace flow, not another paid scene/planner test.
  if (request.method() === 'POST' && ['/api/scenes/draft', '/api/planner/plan', '/api/mobile-planner/plan', '/api/voice/reset'].includes(path)) { await route.abort('blockedbyclient'); return; }
  if (request.method() === 'POST' && path === '/api/mobile/episodes') result.saves++;
  await route.continue();
});
page.on('pageerror', error => result.errors.push(error.message));
page.on('response', response => {
  const path = new URL(response.url()).pathname;
  if (path === '/src/integrations/voice.ts') voiceURL = response.url();
  if (path === '/api/voice/context') {
    const report = response.request().postDataJSON()?.world?.latestServiceReport;
    if (report) result.contextReports.push({ id: report.id, accepted: report.accepted, outcome: report.outcome, at: Date.now() });
  }
  if (path === '/api/voice/ack') {
    const value = response.request().postDataJSON()?.result;
    result.acknowledgments.push({ completed: value?.completed, status: value?.status, summary: value?.summary, plannedActions: value?.plannedActions, error: value?.error });
  }
  if (path === '/api/voice/announce') {
    const pending = response.json().then(value => result.announcements.push({ text: response.request().postDataJSON()?.text, status: response.status(), accepted: value.accepted, at: Date.now() }));
    responses.add(pending); pending.finally(() => responses.delete(pending)).catch(() => {});
  }
});
try {
  await page.goto('http://127.0.0.1:5189');
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'Connect voice', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.mobile-voice')?.textContent?.includes('live'), null, { timeout: 15000 });
  result.checks.push({ name: 'Real Agora/Murf session connected', passed: true });
  await page.waitForFunction(() => {
    const checks = [...document.querySelectorAll('.outcome-check strong')];
    return checks.length === 3 && checks.every(check => check.textContent === 'Passed');
  }, null, { timeout: 65000 });
  result.timing.taskCompleted = Date.now();
  assert.ok(result.acknowledgments.some(ack => ack.plannedActions?.length === 5), 'Actual voice tool prepares all five mobile steps');
  result.checks.push({ name: 'Speech prepared five steps and actual controller passed all three task checks', passed: true });
  const review = page.getByRole('region', { name: 'Review and save mobile evidence', exact: true });
  await page.getByRole('button', { name: 'Review & save mobile evidence', exact: true }).click();
  const approve = review.getByRole('button', { name: 'Approve & save mobile evidence', exact: true });
  await approve.waitFor();
  await page.waitForFunction(() => !document.querySelector('.mobile-evidence-review .button-primary')?.disabled);
  await page.waitForTimeout(3300);
  assert.equal(result.saves, 0, 'Critical evidence write never auto-approves');
  const saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/mobile/episodes' && response.request().method() === 'POST');
  await approve.click();
  const response = await saveResponse, saved = await response.json();
  assert.equal(response.status(), 201); assert.equal(saved.saved, true); assert.equal(saved.report.accepted, true);
  assert.equal(saved.report.independentlyRecomputed, true); assert.equal(saved.report.postedReceiptUsedForAcceptance, false);
  result.saved = { id: saved.id, report: saved.report }; result.timing.recordSaved = Date.now();
  const stored = await page.request.get(`/api/mobile/episodes/${saved.id}`);
  assert.equal(stored.status(), 200);
  await writeFile(resolve(directory, 'saved-mobile-record.json'), JSON.stringify(await stored.json(), null, 2));
  result.checks.push({ name: 'Explicit review persisted an independently checked accepted service report', passed: true });
  await page.getByText('Saved · task accepted', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(directory, 'voice-task-reviewed-saved.png') });
  // The second spoken input starts 55 seconds into microphone capture. Allow its
  // actual LLM/RTC output to complete before closing the bounded session.
  const elapsed = Date.now() - result.timing.voiceStartRequested;
  await page.waitForTimeout(Math.max(0, 73000 - elapsed));
  assert.ok(result.contextReports.some(report => report.id === saved.report.id && report.accepted), 'Saved report reaches actual live voice context');
  result.checks.push({ name: 'Live voice context received the actual saved report', passed: true });
} catch (error) {
  result.failure = error.message;
  await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    await Promise.all(window.__workflowAudio.map(({ recorder }) => new Promise(resolve => {
      if (recorder.state !== 'recording') { resolve(); return; }
      recorder.addEventListener('stop', resolve, { once: true }); recorder.stop();
    })));
  }).catch(() => {});
  const tracks = await page.evaluate(async () => Promise.all(window.__workflowAudio.map(async recording => {
    const bytes = new Uint8Array(await new Blob(recording.chunks, { type: 'audio/webm' }).arrayBuffer());
    let encoded = ''; for (const byte of bytes) encoded += String.fromCharCode(byte);
    return { startedAt: recording.startedAt, data: btoa(encoded) };
  }))).catch(() => []);
  const recordings = tracks.map(track => ({ startedAt: track.startedAt, bytes: Buffer.from(track.data, 'base64') }));
  result.tracks = recordings.map(track => ({ startedAt: track.startedAt, bytes: track.bytes.length }));
  for (const [index, track] of recordings.entries()) await writeFile(resolve(directory, `remote-track-${index}.webm`), track.bytes);
  const selected = [...recordings].sort((a, b) => b.bytes.length - a.bytes.length)[0];
  if (selected) { audio = selected.bytes; result.timing.audioTrackStarted = selected.startedAt; }
  await writeFile(resolve(directory, 'remote-agent.webm'), audio);
  await stopOwnVoice(); if (deadlineTimer) clearTimeout(deadlineTimer);
  result.timing.voiceStopped = Date.now();
  await Promise.allSettled([...responses]);
  result.video = await page.video().path();
  await context.close(); await browser.close();
  result.timing.browserClosed = Date.now();
}
if (audio.length > 1000) {
  try {
    const form = new FormData(); form.append('file', new Blob([audio], { type: 'audio/webm' }), 'remote-agent.webm');
    form.append('model', 'whisper-1'); form.append('response_format', 'verbose_json'); result.transcriptionRequests++;
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` }, body: form, signal: AbortSignal.timeout(45000) });
    assert.ok(response.ok, `Transcription HTTP ${response.status}`);
    const transcript = await response.json(); result.transcriptText = transcript.text;
    await writeFile(resolve(directory, 'remote-transcript.json'), JSON.stringify(transcript, null, 2));
    const text = transcript.text.toLowerCase();
    result.spokenSavedReportVerified = /saved/.test(text) && /checks?/.test(text) && /pass/.test(text);
    result.spokenDeliveryVerified = /cup/.test(text) && /sink/.test(text) && /deliver|placed|completed/.test(text);
    result.checks.push({ name: 'Actual remote RTC speech includes delivery and saved/passed report outcome', passed: result.spokenSavedReportVerified && result.spokenDeliveryVerified });
  } catch (error) { result.transcriptionFailure = error.message; }
}
result.passed = result.checks.length === 5 && result.checks.every(check => check.passed) && !result.failure && !result.transcriptionFailure && !result.safetyStop && result.errors.length === 0 && result.starts === 1 && result.saves === 1;
result.finishedAt = new Date().toISOString();
await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, starts: result.starts, saves: result.saves, transcript: result.transcriptText,
  failure: result.failure, transcriptionFailure: result.transcriptionFailure, errors: result.errors, video: result.video, sessionMs: result.timing.voiceStopped - result.timing.voiceStartRequested }, null, 2));
if (!result.passed) process.exitCode = 1;
