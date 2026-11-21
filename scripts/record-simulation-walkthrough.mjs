import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { analyzeProtectedInput } from './protected-analysis-core.mjs';

const directory = resolve('.local/qa/simulation-video'); await mkdir(directory, { recursive: true });
const result = { schema: 'teachtrace.simulation-walkthrough.v1', startedAt: new Date().toISOString(),
  scope: 'Actual local UI/controller recording using typed commands; authored matched plans, not a live AI-model or voice session.',
  paidRequests: 0, evaluationRequests: 0, errors: [], chapters: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1440, height: 900 },
  acceptDownloads: true, recordVideo: { dir: directory, size: { width: 1440, height: 900 } } });
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && ['/api/voice/start', '/api/scenes/draft', '/api/planner/plan', '/api/mobile-planner/plan', '/api/voice/reset'].includes(path)) {
    result.paidRequests++; await route.abort('blockedbyclient'); return;
  }
  if (request.method() === 'POST' && path === '/api/evaluations/mobile') result.evaluationRequests++;
  await route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(30000);
page.on('pageerror', error => result.errors.push(error.message));
async function chapter(text) {
  result.chapters.push({ text, at: new Date().toISOString() });
  await page.evaluate(value => {
    let caption = document.getElementById('recording-caption');
    if (!caption) { caption = document.createElement('div'); caption.id = 'recording-caption'; caption.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:10px 18px;background:#101312;color:#f1f0e8;font:13px system-ui,sans-serif;pointer-events:none;border-top:1px solid #40433f;'; document.body.append(caption); }
    caption.textContent = value;
  }, text);
}
let pairPath;
try {
  await page.goto('/'); await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await chapter('1 / ACTUAL LOCAL SIMULATION · Typed command → mobile navigation → cup delivery. No voice session in this recording.');
  await page.waitForTimeout(3000);
  const command = page.getByRole('textbox', { name: 'Mobile robot command', exact: true });
  await command.pressSequentially('Take cup from counter to sink', { delay: 55 });
  await page.waitForTimeout(700); await command.press('Enter');
  await page.waitForFunction(() => document.querySelector('.mobile-phase')?.textContent?.includes('Navigate to Sink') && document.querySelector('.mobile-workspace > header .state-pill')?.textContent === 'running', null, { timeout: 45000 });
  await page.getByRole('button', { name: 'Human enters', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.mobile-workspace > header .state-pill')?.textContent === 'paused');
  await chapter('1 / HUMAN INTERRUPTION · The robot pauses while carrying Cup. This is a software scenario proxy.');
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Clear human', exact: true }).click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.mobile-workspace > header .state-pill').innerText(), 'paused');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await chapter('1 / EXPLICIT RESUME · Clearing the person does not restart motion automatically.');
  await page.waitForFunction(() => document.querySelector('.mobile-workspace > header .state-pill')?.textContent === 'idle', null, { timeout: 35000 });
  await page.waitForTimeout(2200);
  await chapter('1 / ONE-CLICK SAVE · Preserve the actual attempt and checked report. The record is unreviewed; no approval screen is used.');
  const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/mobile/episodes' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save mobile evidence', exact: true }).click();
  const saved = await savedResponse, receipt = await saved.json();
  assert.equal(saved.status(), 201); assert.equal(receipt.saved, true); assert.equal(receipt.report.review.approved, false);
  assert.equal(receipt.report.review.source, 'operator-save'); result.savedRecordId = receipt.id;
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'AI deployment checks', exact: true }).click();
  const bench = page.getByRole('dialog', { name: 'Mobile AI deployment checks', exact: true });
  await chapter('2 / SEPARATE MATCHED REGRESSION · Same scene and task; two authored plans. The live interruption is not included in this pair.');
  await bench.getByRole('button', { name: 'Run matched regression pair', exact: true }).click();
  await bench.getByRole('button', { name: 'Download comparison', exact: true }).waitFor();
  await page.waitForTimeout(4000);
  const download = page.waitForEvent('download'); await bench.getByRole('button', { name: 'Download comparison', exact: true }).click();
  pairPath = resolve(directory, 'recorded-comparison.json'); await (await download).saveAs(pairPath);
  const pair = JSON.parse(await readFile(pairPath, 'utf8')); result.pairId = pair.id; result.runIds = pair.runs.map(run => run.id);
  assert.deepEqual(pair.runs.map(run => run.finalWorld.objects.find(item => item.id === 'cup').station), ['sink', 'sink']);
  await bench.getByRole('button', { name: 'Replay run 1', exact: true }).click();
  await bench.locator('.mobile-attempt-review').scrollIntoViewIfNeeded();
  await chapter('2 / ACCEPTED BASELINE REPLAY · Cup reaches Sink. Protected Bowl stays untouched.');
  await bench.getByRole('button', { name: 'Play attempt', exact: true }).click();
  await page.waitForTimeout(4500);
  await bench.getByRole('slider', { name: 'Seek mobile attempt', exact: true }).focus();
  await bench.getByRole('slider', { name: 'Seek mobile attempt', exact: true }).press('End');
  await page.waitForTimeout(1800);
  await bench.getByRole('button', { name: 'Jump to task violation', exact: true }).click();
  await bench.locator('.mobile-attempt-review').scrollIntoViewIfNeeded();
  await chapter('2 / REJECTED ROUND TRIP REPLAY · Cup is at Sink, but step 8 picks up the protected Bowl and later returns it.');
  await page.waitForTimeout(2200); await bench.getByRole('button', { name: 'Play attempt', exact: true }).click();
  await page.waitForFunction(() => { const input = document.querySelector('[aria-label="Seek mobile attempt"]'); return input && input.value === input.max; }, null, { timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.goto('/trace-analysis.html'); await page.locator('#file').setInputFiles(pairPath);
  await page.getByText('Independent analysis complete · no API, model or simulator connection', { exact: true }).waitFor();
  await chapter('3 / INDEPENDENT FILE ANALYSIS · This page reads the exact exported pair. It does not call the simulator or APIs.');
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: 'Presentation view', exact: true }).click();
  await page.waitForTimeout(4500);
  const analysis = await analyzeProtectedInput(pair), object = analysis.runs[1].protectedObjects[0];
  const peak = object.points.reduce((best, point) => point.displacementMeters > best.displacementMeters ? point : best, object.points[0]);
  const box = await page.locator('#plot').boundingBox(), maxTime = Number(await page.locator('#plot').getAttribute('data-max-time'));
  await page.mouse.click(box.x + (64 + peak.timeSeconds / maxTime * 816) / 920 * box.width, box.y + box.height / 2);
  await chapter('3 / THE EXCURSION · Inspect recorded time and XYZ. Bowl moves about 1.20 m from its starting position.');
  await page.waitForTimeout(4000);
  await page.locator('#sample').focus(); await page.locator('#sample').press('End');
  await chapter('3 / FINAL POSITION RETURNS TO ZERO · The historical violation remains. This is why the final frame alone cannot approve the plan.');
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Jump to first recorded violation', exact: true }).click();
  await page.waitForTimeout(2500);
  assert.equal(result.evaluationRequests, 2); assert.equal(result.paidRequests, 0); assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) { result.passed = false; result.failure = error.message; process.exitCode = 1; await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => {}); }
finally {
  result.originalVideo = await page.video().path(); await context.close(); await browser.close();
  if (result.passed) {
    result.video = resolve(directory, 'teachtrace-simulation-walkthrough.mp4');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', result.originalVideo, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', result.video], { stdio: 'pipe' });
    result.durationSeconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', result.video], { encoding: 'utf8' }).trim());
  }
  result.finishedAt = new Date().toISOString(); await writeFile(resolve(directory, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
