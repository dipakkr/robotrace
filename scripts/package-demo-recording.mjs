import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const directory = resolve('.local/qa/final-workflow');
const result = JSON.parse(await readFile(resolve(directory, 'results.json'), 'utf8'));
if (!result.passed) throw new Error('Only package the passed rehearsal.');
const label = 'AUTOMATED REHEARSAL | Prerecorded command / real Agora + Murf | Approximate A/V alignment';
await writeFile(resolve(directory, 'recording-label.txt'), label);
const labelPNG = resolve(directory, 'recording-label.png');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 44 }, deviceScaleFactor: 1 });
  await page.setContent('<style>body{margin:0;background:#101112;color:white;font:17px Arial,sans-serif;padding:12px 16px;box-sizing:border-box;white-space:nowrap}</style><body></body>');
  await page.evaluate(value => { document.body.textContent = value; }, label);
  await page.screenshot({ path: labelPNG });
} finally { await browser.close(); }
// Playwright does not expose its first frame's wall-clock origin. Keep the
// original video and individual RTC audio untouched; this is a labelled viewing
// copy with approximate alignment, never word/action synchronization evidence.
const offset = (result.timing.audioTrackStarted - result.timing.beforePageCreated) / 1000;
const inputOffset = (result.timing.voiceStartRequested - result.timing.beforePageCreated) / 1000;
const output = resolve(directory, 'teachtrace-voice-workflow.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', result.video,
  '-itsoffset', offset.toFixed(3), '-i', resolve(directory, 'remote-agent.webm'),
  '-itsoffset', inputOffset.toFixed(3), '-i', resolve(directory, 'prerecorded-input.wav'), '-loop', '1', '-i', labelPNG,
  '-filter_complex', '[0:v]pad=iw:ih+44:0:0:color=0x101112[pad];[pad][3:v]overlay=0:H-h:shortest=1[video];[1:a][2:a]amix=inputs=2:duration=longest:normalize=0[audio]',
  '-map', '[video]', '-map', '[audio]',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', output], { stdio: 'pipe' });
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', output], { encoding: 'utf8' }));
if (!probe.streams.some(stream => stream.codec_type === 'video') || !probe.streams.some(stream => stream.codec_type === 'audio')) throw new Error('The viewing copy requires both actual tracks.');
await writeFile(resolve(directory, 'recording-manifest.json'), JSON.stringify({ schema: 'teachtrace.rehearsal-recording.v1',
  input: result.input, output, originalVideo: result.video, originalAudio: resolve(directory, 'remote-agent.webm'),
  visibleLabel: label, alignment: 'Approximate: remote-track wall time relative to page creation; first frame origin is unavailable',
  offsetSeconds: offset, prerecordedInputOffsetSeconds: inputOffset, prerecordedInputIncluded: true,
  noSyntheticAgentAudioSubstituted: true, humanMicrophoneVerified: false, humanPlaybackVerified: false, probe }, null, 2));
console.log(JSON.stringify({ output, durationSeconds: Number(probe.format.duration), labelledAutomatedRehearsal: true, exactSynchronizationVerified: false }));
