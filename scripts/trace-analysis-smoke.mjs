import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { analyzeProtectedInput } from './protected-analysis-core.mjs';

const directory = resolve('.local/qa'); await mkdir(directory, { recursive: true });
const inputPath = resolve(directory, 'mobile-matched-pair.json');
const input = JSON.parse(await readFile(inputPath, 'utf8'));
const independentlyComputed = await analyzeProtectedInput(input);
const failed = independentlyComputed.runs.find(run => !run.protectedObjectsPassed);
const failedObject = failed.protectedObjects.find(item => !item.independentlyPassed);
const result = { schema: 'teachtrace.trace-analysis-ui.v1', startedAt: new Date().toISOString(),
  pairId: input.id, runIds: input.runs.map(run => run.id), checks: [], errors: [], apiRequests: 0, paidRequests: 0, offlineHTTPRequests: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.route('**/api/**', async route => { result.apiRequests++; await route.abort('blockedbyclient'); });
const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => result.errors.push(error.message));
const checks = async (name, work) => { await work(); result.checks.push({ name, passed: true }); console.log('PASS ' + name); };
try {
  await page.goto('http://127.0.0.1:5189/trace-analysis.html');
  await page.locator('#file').setInputFiles(inputPath);
  await page.getByText('Independent analysis complete · no API, model or simulator connection', { exact: true }).waitFor();
  await checks('Actual pair file is read independently; both run IDs and recomputed protected verdicts agree with source traces', async () => {
    assert.equal(await page.locator('#results tr').count(), 2);
    for (const id of result.runIds) assert.match(await page.locator('#results').innerText(), new RegExp(id));
    assert.equal(await page.locator('#package-id').innerText(), input.id);
    assert.equal(await page.locator('#fingerprint').innerText(), input.initialSceneSha256);
    assert.match(await page.locator('#conditions').innerText(), /Matched initial scene, goal and external intervention schedule/);
    assert.match(await page.locator('#independent-verdict').innerText(), /failed/);
    assert.equal(await page.locator('#plot path').count(), 2);
    assert.match(await page.locator('#source-status').innerText(), /SHA-256.*verified/);
  });
  await checks('Plot exposes actual first violation and selectable time/XYZ; terminal zero does not erase failure', async () => {
    const time = Number((await page.locator('#point-time').innerText()).replace(' s', ''));
    assert.ok(Math.abs(time - failedObject.firstRecordViolation.timeSeconds) < 1e-6);
    for (const coordinate of failedObject.firstRecordViolation.positionMeters.map(value => value.toFixed(6))) assert.ok((await page.locator('#point-position').innerText()).includes(coordinate));
    await page.locator('#sample').focus(); await page.locator('#sample').press('End');
    assert.equal(await page.locator('#point-displacement').innerText(), '0.0000 m');
    assert.match(await page.locator('#point-state').innerText(), /Matches initial protected record/);
    assert.match(await page.locator('#independent-verdict').innerText(), /failed/);
    await page.getByRole('button', { name: 'Jump to first recorded violation', exact: true }).click();
    assert.equal(await page.locator('#sample').inputValue(), String(failedObject.firstRecordViolation.sampleIndex));
    assert.ok(Number((await page.locator('#point-displacement').innerText()).replace(' m', '')) > 0);
    await page.locator('#run').selectOption('0'); assert.match(await page.locator('#independent-verdict').innerText(), /passed/);
    await page.locator('#run').selectOption('1'); assert.match(await page.locator('#independent-verdict').innerText(), /failed/);
    await page.locator('#plot').click({ position: { x: 300, y: 150 } });
    assert.notEqual(await page.locator('#sample').inputValue(), String(failedObject.firstRecordViolation.sampleIndex));
    await page.getByRole('button', { name: 'Jump to first recorded violation', exact: true }).click();
    await page.screenshot({ path: resolve(directory, 'trace-analysis-desktop.png'), fullPage: true });
  });
  let reportPath;
  await checks('Downloaded JSON equals independently calculated values and standalone HTML reopens entirely offline', async () => {
    let pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download analysis JSON', exact: true }).click();
    const analysisPath = resolve(directory, 'trace-analysis-browser.json'); await (await pending).saveAs(analysisPath);
    const browserReport = JSON.parse(await readFile(analysisPath, 'utf8'));
    assert.deepEqual(browserReport.runs, independentlyComputed.runs); assert.deepEqual(browserReport.preference, independentlyComputed.preference);
    pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download standalone report', exact: true }).click();
    reportPath = resolve(directory, 'trace-analysis-offline-report.html'); await (await pending).saveAs(reportPath);
    const offline = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
    const offlinePage = await offline.newPage(); offlinePage.on('pageerror', error => result.errors.push(error.message));
    offlinePage.on('request', request => { if (/^https?:/.test(request.url())) result.offlineHTTPRequests.push(request.url()); });
    try {
      await offlinePage.goto(pathToFileURL(reportPath).href);
      await offlinePage.getByText('Independent analysis complete · no API, model or simulator connection', { exact: true }).waitFor();
      assert.equal(await offlinePage.locator('#package-id').innerText(), input.id);
      assert.match(await offlinePage.locator('#independent-verdict').innerText(), /failed/);
      assert.equal(await offlinePage.locator('#results tr').count(), 2);
      await offlinePage.screenshot({ path: resolve(directory, 'trace-analysis-offline.png'), fullPage: true });
      assert.deepEqual(result.offlineHTTPRequests, []);
    } finally { await offline.close(); }
  });
  await checks('Presentation view keeps plot, selected coordinates and return control visible at 1280×720', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Presentation view', exact: true }).click();
    for (const selector of ['#plot', '#point-time', '#point-position', '#focus-analysis']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1281 && box.y + box.height <= 721, selector + ' ' + JSON.stringify(box));
    }
    await page.screenshot({ path: resolve(directory, 'trace-analysis-presentation.png') });
    await page.getByRole('button', { name: 'Show full report', exact: true }).click();
    assert.equal(await page.locator('#drop').isVisible(), true);
  });
  await checks('Tampered file rejects integrity and clears the previous verdict; phone layout remains usable', async () => {
    const tampered = structuredClone(input); tampered.runs[1].label += ' changed';
    await page.locator('#file').setInputFiles({ name: 'tampered.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tampered)) });
    await page.getByText('File rejected; no previous verdict retained', { exact: true }).waitFor();
    assert.match(await page.locator('#error').innerText(), /integrity mismatch/); assert.equal(await page.locator('#analysis').isVisible(), false);
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#file').setInputFiles(inputPath);
    await page.getByText('Independent analysis complete · no API, model or simulator connection', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#sample').scrollIntoViewIfNeeded(); assert.equal(await page.locator('#sample').isVisible(), true);
    await page.screenshot({ path: resolve(directory, 'trace-analysis-phone.png'), fullPage: true });
  });
  assert.equal(result.apiRequests, 0); assert.deepEqual(result.errors, []); result.passed = true;
  result.firstViolation = failedObject.firstRecordViolation;
  result.maximumDisplacementMeters = failedObject.peakDisplacementMeters; result.finalDisplacementMeters = failedObject.finalDisplacementMeters;
  result.offlineReport = reportPath;
} catch (error) {
  result.passed = false; result.failure = error.message; process.exitCode = 1;
  await page.screenshot({ path: resolve(directory, 'trace-analysis-failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close(); result.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'trace-analysis-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
