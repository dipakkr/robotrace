import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Explicit paid-provider audit: one bounded real Agora/Murf session and at most
// one transcription request. Silent synthetic microphone input, isolated browser.
assert.equal(process.argv.length, 2, 'This audit accepts no flags or automatic retry mode.');
process.loadEnvFile(resolve('.env.local'));
assert.ok(process.env.LLM_API_KEY, 'A locally configured transcription credential is required.');
const directory = resolve('.local/qa');
await mkdir(directory, { recursive: true });
const silence = resolve(directory, 'voice-progress-silence.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '17', '-c:a', 'pcm_s16le', silence], { stdio: 'pipe' });
const phrase = 'Progress check. The robot is idle at its starting position.';
const results = { schema: 'teachtrace.voice-progress-audit.v1', startedAt: new Date().toISOString(),
  input: 'synthetic-silent-microphone', providers: 'Real Agora Conversational AI, configured LLM and Murf Falcon',
  humanMicrophoneVerified: false, humanPlaybackVerified: false, requestedPhrase: phrase,
  startRequests: 0, transcriptionRequests: 0, errors: [], checks: [], apiResponses: [],
  caveat: 'REST accepted/queued is distinct from remote RTC audio. Transcription is automated playback-content evidence, not a human listening test.' };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-audio-capture=${silence}`, '--autoplay-policy=no-user-gesture-required', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
await context.addInitScript(() => {
  window.__progressAudio = { tracks: 0, recordings: [], lastTrackAt: 0 };
  const Native = window.RTCPeerConnection;
  window.RTCPeerConnection = new Proxy(Native, { construct(Target, args) {
    const connection = new Target(...args);
    connection.addEventListener('track', event => {
      if (event.track.kind !== 'audio') return;
      const state = window.__progressAudio;
      state.tracks++; state.lastTrackAt = performance.now();
      // Agora can expose an empty initial track and then the agent's live track.
      // Keep each container separate; choose the nonempty recording for transcription.
      const recorder = new MediaRecorder(new MediaStream([event.track]), { mimeType: 'audio/webm;codecs=opus' });
      const recording = { recorder, chunks: [] };
      recorder.ondataavailable = event => { if (event.data.size) recording.chunks.push(event.data); };
      recorder.start(500); state.recordings.push(recording);
    });
    return connection;
  } });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
let sessionStartedAt = null, safetyTimer = null, voiceModuleURL = null, audioBytes = Buffer.alloc(0);
const pendingResponses = new Set();
const stopOwnConnection = async () => {
  if (!voiceModuleURL) return;
  await page.evaluate(async url => {
    const voice = await import(url);
    await voice.stopVoiceSession();
  }, voiceModuleURL).catch(() => {});
};
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path === '/api/voice/start') {
    results.startRequests++;
    if (results.startRequests > 1) { await route.abort('blockedbyclient'); return; }
    sessionStartedAt = Date.now();
    safetyTimer = setTimeout(() => { results.safetyStopTriggered = true; void stopOwnConnection(); }, 28000);
  }
  if (request.method() === 'POST' && ['/api/planner/plan', '/api/mobile-planner/plan', '/api/scenes/draft', '/api/voice/reset'].includes(path)) {
    await route.abort('blockedbyclient'); return;
  }
  await route.continue();
});
page.on('pageerror', error => results.errors.push(error.message));
page.on('response', response => {
  const path = new URL(response.url()).pathname;
  if (path === '/src/integrations/voice.ts') voiceModuleURL = response.url();
  if (!['/api/voice/start', '/api/voice/announce', '/api/voice/stop'].includes(path)) return;
  const work = (async () => {
    // Never record channel tokens, session IDs, provider IDs or credential-bearing start responses.
    results.apiResponses.push({ path, status: response.status(), ...(path === '/api/voice/announce' ? { requestedText: response.request().postDataJSON().text, result: await response.json() } : {}) });
  })();
  pendingResponses.add(work); work.finally(() => pendingResponses.delete(work)).catch(() => {});
});
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189');
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  const startingState = await page.locator('.mobile-voice').innerText();
  assert.match(startingState, /disconnected/);
  await page.getByRole('button', { name: 'Connect voice', exact: true }).click();
  await page.waitForFunction(() => window.__progressAudio.tracks > 0 && document.querySelector('.mobile-voice')?.textContent?.includes('live'), null, { timeout: 12000 });
  assert.ok(voiceModuleURL, 'Capture the exact lazy-loaded voice module used by App.');
  results.moduleIdentityVerified = true;
  results.checks.push({ name: 'Own isolated connection received a real remote RTC audio track', passed: true });
  await page.waitForTimeout(5000); // Let the initial greeting finish before testing APPEND.
  assert.ok(Date.now() - sessionStartedAt < 18000, 'Insufficient bounded session time remains for the announcement.');
  results.preAnnouncementUI = await page.locator('.mobile-workspace').innerText().catch(() => page.locator('body').innerText());
  assert.match(results.preAnnouncementUI, /Ready at home|Ready|idle/i);
  results.announcement = await page.evaluate(async ({ text, url }) => {
    const voice = await import(url);
    return voice.announceVoiceProgress(text);
  }, { text: phrase, url: voiceModuleURL });
  results.announcementElapsedMs = Date.now() - sessionStartedAt;
  results.checks.push({ name: 'Progress speak API accepted the exact actual-idle phrase', passed: results.announcement.accepted === true });
  // Also exercise the real product milestone announcer. This is typed motion plus
  // real provider speech, not a human/synthetic speech-to-command demonstration.
  await page.getByLabel('Mobile simulation speed', { exact: true }).selectOption('2');
  await page.getByLabel('Mobile robot command', { exact: true }).fill('Take cup from counter to sink');
  await page.getByRole('button', { name: 'Send mobile command', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.outcome-check strong')].length === 3
    && [...document.querySelectorAll('.outcome-check strong')].every(node => node.textContent === 'Passed'), null, { timeout: Math.min(18500, Math.max(1000, 26500 - (Date.now() - sessionStartedAt))) });
  results.typedTaskCompleted = true;
  results.typedTaskScope = 'Actual typed Cup→Sink task with product progress announcements; silent microphone input.';
  await page.waitForTimeout(Math.min(8000, Math.max(0, 27000 - (Date.now() - sessionStartedAt))));
  await page.screenshot({ path: resolve(directory, 'voice-progress-audit.png') });
} catch (error) {
  results.failure = error.message;
  results.failureUI = await page.locator('.mobile-workspace').innerText().catch(() => 'UI unavailable');
  await page.screenshot({ path: resolve(directory, 'voice-progress-audit-failure.png') }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    await Promise.all(window.__progressAudio.recordings.map(({ recorder }) => new Promise(resolve => {
      if (recorder.state !== 'recording') { resolve(); return; }
      recorder.addEventListener('stop', resolve, { once: true }); recorder.stop();
    })));
  }).catch(() => {});
  const recorded = await page.evaluate(async () => {
    const state = window.__progressAudio;
    const containers = await Promise.all(state.recordings.map(async recording => {
      const bytes = new Uint8Array(await new Blob(recording.chunks, { type: 'audio/webm' }).arrayBuffer());
      let encoded = ''; for (const byte of bytes) encoded += String.fromCharCode(byte);
      return btoa(encoded);
    }));
    return { tracks: state.tracks, containers };
  }).catch(() => ({ tracks: 0, containers: [] }));
  const containers = recorded.containers.map(value => Buffer.from(value, 'base64'));
  results.remoteTracks = recorded.tracks; results.remoteTrackBytes = containers.map(value => value.length);
  for (const [index, bytes] of containers.entries()) await writeFile(resolve(directory, `voice-progress-track-${index}.webm`), bytes);
  audioBytes = [...containers].sort((a, b) => b.length - a.length)[0] ?? Buffer.alloc(0);
  results.remoteAudioBytes = audioBytes.length;
  results.audioSelection = 'Largest separate remote RTC recording; containers are never interleaved.';
  await writeFile(resolve(directory, 'voice-progress-remote.webm'), audioBytes);
  await stopOwnConnection();
  if (safetyTimer) clearTimeout(safetyTimer);
  if (sessionStartedAt) results.sessionElapsedMs = Date.now() - sessionStartedAt;
  await Promise.allSettled([...pendingResponses]);
  await context.close(); await browser.close();
}

// Session is already stopped; transcription cannot extend provider voice time.
if (audioBytes.length > 1000) {
  try {
    const form = new FormData();
    form.append('file', new Blob([await readFile(resolve(directory, 'voice-progress-remote.webm'))], { type: 'audio/webm' }), 'voice-progress-remote.webm');
    form.append('model', 'whisper-1'); form.append('response_format', 'verbose_json');
    results.transcriptionRequests++;
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` }, body: form, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Transcription HTTP ${response.status}`);
    const transcript = await response.json();
    await writeFile(resolve(directory, 'voice-progress-transcript.json'), JSON.stringify(transcript, null, 2));
    results.transcriptText = transcript.text;
    const normalize = value => value.toLowerCase().replace(/[^a-z]/g, '');
    results.remoteAnnouncementContentVerified = normalize(transcript.text).includes(normalize('The robot is idle at its starting position'));
    const observed = normalize(transcript.text);
    results.productAnnouncementRequests = results.apiResponses.filter(item => item.path === '/api/voice/announce' && item.requestedText !== phrase).map(item => ({ text: item.requestedText, status: item.status, accepted: item.result?.accepted === true, transcriptMatched: observed.includes(normalize(item.requestedText)) }));
    results.productMilestoneContentVerified = results.productAnnouncementRequests.some(item => item.accepted && item.transcriptMatched);
    results.checks.push({ name: 'Recorded remote RTC speech contains the requested progress phrase', passed: results.remoteAnnouncementContentVerified });
  } catch (error) { results.transcriptionFailure = error.message; }
} else results.remoteAnnouncementContentVerified = false;
results.voiceProgressVerified = results.remoteAnnouncementContentVerified === true && results.productMilestoneContentVerified === true;
results.typedTaskCompletionVerified = results.typedTaskCompleted === true;
results.passed = results.checks.length === 3 && results.checks.every(check => check.passed) && !results.failure && !results.transcriptionFailure && results.errors.length === 0;
results.finishedAt = new Date().toISOString();
await writeFile(resolve(directory, 'voice-progress-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.passed, checks: results.checks, startRequests: results.startRequests, transcriptionRequests: results.transcriptionRequests,
  sessionElapsedMs: results.sessionElapsedMs, remoteAudioBytes: results.remoteAudioBytes, announcement: results.announcement, voiceProgressVerified: results.voiceProgressVerified, typedTaskCompletionVerified: results.typedTaskCompletionVerified,
  transcript: results.transcriptText, failure: results.failure, transcriptionFailure: results.transcriptionFailure, errors: results.errors }, null, 2));
if (!results.passed) process.exitCode = 1;
