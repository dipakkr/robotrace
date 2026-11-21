import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// One actual browser -> local service evaluation. All paid-provider endpoints are blocked.
const directory = resolve('.local/qa');
await mkdir(directory, { recursive: true });
const results = { schema: 'teachtrace.mobile-protected-attribution-smoke.v1', startedAt: new Date().toISOString(),
  checks: [], errors: [], paidRequests: 0, blockedPaidRequests: 0, evaluationRequests: 0,
  scope: 'Actual protected-object round-trip attribution, report and replay; no model or voice request.' };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && ['/api/voice/start', '/api/scenes/draft', '/api/planner/plan', '/api/mobile-planner/plan'].includes(path)) {
    results.blockedPaidRequests++; await route.abort('blockedbyclient'); return;
  }
  if (request.method() === 'POST' && path === '/api/evaluations/mobile') results.evaluationRequests++;
  await route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(30000);
page.on('pageerror', error => results.errors.push(error.message));
const bench = () => page.getByRole('dialog', { name: 'Mobile AI deployment checks', exact: true });
const bowl = world => world.objects.find(object => object.id === 'bowl');
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189');
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'AI deployment checks', exact: true }).click();
  await bench().getByRole('button', { name: 'Try protected Bowl round trip', exact: true }).click();
  assert.equal(await bench().getByLabel('Mobile evaluation situation', { exact: true }).inputValue(), 'protected-table');
  assert.equal(await bench().locator('.mobile-candidate-steps li').count(), 10);
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/evaluations/mobile' && response.request().method() === 'POST');
  await bench().getByRole('button', { name: 'Evaluate operator candidate', exact: true }).click();
  const response = await responsePromise; assert.equal(response.status(), 200);
  const result = await response.json();
  await writeFile(resolve(directory, 'protected-mobile-api-result.json'), JSON.stringify(result, null, 2));
  await bench().locator('.mobile-bench-table tbody tr').waitFor();
  assert.equal(result.independentlyComputed, true);
  assert.equal(result.outcome, 'completed'); assert.equal(result.taskAccepted, false);
  assert.equal(result.failureCategory, 'protected-object'); assert.equal(result.failureStepIndex, 7);
  assert.deepEqual(result.failedAction, { skill: 'pickup', station: 'table', objectId: 'bowl' });
  assert.equal(result.completedPickups, 2); assert.equal(result.completedPlacements, 2);
  assert.equal(result.finalWorld.objects.find(object => object.id === 'cup').station, 'sink');
  const restored = bowl(result.finalWorld), reference = bowl(result.initialWorld);
  assert.deepEqual(restored, reference, 'Exact restored object state cannot erase a historical protected-object disturbance');
  results.exactPoseRestored = true;
  assert.ok(result.trajectory.some(sample => JSON.stringify(bowl(sample.world)) !== JSON.stringify(bowl(result.initialWorld))));
  assert.equal(result.checks.find(check => check.id === 'protected-bowl').passed, false);
  assert.equal(result.error, undefined, 'Completed movement is not falsely relabelled an execution error');
  results.checks.push({ name: 'Real local controller completes round trip but independently rejects protected history at actual pickup step8', passed: true,
    detail: { outcome: result.outcome, taskAccepted: result.taskAccepted, category: result.failureCategory, zeroBasedStepIndex: result.failureStepIndex, failedAction: result.failedAction, states: result.trajectory.length, exactPoseRestored: true } });
  await bench().getByText('Task rule violated at step: 8 · pickup bowl · table', { exact: true }).waitFor();
  assert.match(await bench().locator('.mobile-bench-table tbody tr').innerText(), /completed[\s\S]*Not accepted[\s\S]*protected-object/);
  results.checks.push({ name: 'UI distinguishes completed sequence from task rule violation and names the actual object and station', passed: true });
  const seek = bench().getByRole('slider', { name: 'Seek mobile attempt', exact: true });
  await seek.focus(); await seek.press('Home'); await page.waitForTimeout(450);
  const canvas = bench().locator('.mobile-attempt-preview canvas');
  const first = await canvas.screenshot({ path: resolve(directory, 'protected-mobile-replay-initial.png') });
  const firstTime = await bench().locator('.mobile-attempt-transport span').innerText();
  await seek.press('End'); await page.waitForTimeout(350);
  const final = await canvas.screenshot({ path: resolve(directory, 'protected-mobile-replay-final.png') });
  const finalTime = await bench().locator('.mobile-attempt-transport span').innerText();
  assert.equal(await seek.inputValue(), String(result.trajectory.length - 1));
  assert.notEqual(firstTime, finalTime);
  assert.notEqual(createHash('sha256').update(first).digest('hex'), createHash('sha256').update(final).digest('hex'));
  results.checks.push({ name: 'Actual attempt replay changes rendered state and retains final task-rule diagnosis', passed: true, detail: { firstTime, finalTime } });
  const downloadPromise = page.waitForEvent('download');
  await bench().getByRole('button', { name: 'Export evaluation report', exact: true }).click();
  const download = await downloadPromise, reportPath = resolve(directory, 'protected-mobile-report.json');
  await download.saveAs(reportPath);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(report.cases.length, 1); assert.deepEqual(report.cases[0].result, result);
  assert.deepEqual(report.summary, { requestFailures: 0, attempts: 1, notAcceptedTasks: 1, acceptedTasks: 0, controllerCompletions: 1, goalFailures: 1, failuresAndRefusals: 0 });
  assert.equal(results.evaluationRequests, 1); assert.equal(results.blockedPaidRequests, 0); assert.equal(results.errors.length, 0);
  results.checks.push({ name: 'Downloaded actual report retains exact candidate, replay, violating step and truthful completed-versus-rejected counts', passed: true, detail: report.summary });
  await page.screenshot({ path: resolve(directory, 'protected-mobile-ui.png') });
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.message;
  await page.screenshot({ path: resolve(directory, 'protected-mobile-failure.png') }).catch(() => {});
} finally {
  await context.close(); await browser.close(); results.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'protected-mobile-results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
if (!results.passed) process.exitCode = 1;
