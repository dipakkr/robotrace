import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Default is offline-provider QA. --with-ai is an explicitly authorized single
// real provider-button request; it never enables retries or automatic AI suites.
const withAI = process.argv.includes('--with-ai');
assert.ok(process.argv.slice(2).every(value => value === '--with-ai'), 'Use only the optional --with-ai flag.');
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189';
const directory = resolve('.local/qa');
await mkdir(directory, { recursive: true });
const prefix = withAI ? 'mobile-planner-live' : 'mobile-planner-offline';
const results = { schema: 'teachtrace.mobile-planner-ui-smoke.v1', startedAt: new Date().toISOString(),
  mode: withAI ? 'one-explicit-real-model-request' : 'no-provider-calls', checks: [], errors: [], screenshots: [],
  evaluationRequests: 0, modelRequests: 0, blockedProviderRequests: 0, scope: 'Actual symbolic candidate/controller/task outcomes; no learned motor policy or physical transfer claim.' };
const evaluations = [], modelResponses = [], responseWork = new Set();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, acceptDownloads: true });
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path === '/api/mobile-planner/plan') {
    if (!withAI || results.modelRequests >= 1) { results.blockedProviderRequests++; await route.abort('blockedbyclient'); return; }
    results.modelRequests++;
  } else if (request.method() === 'POST' && ['/api/planner/plan', '/api/scenes/draft', '/api/voice/start'].includes(path)) {
    results.blockedProviderRequests++; await route.abort('blockedbyclient'); return;
  }
  await route.continue();
});
const page = await context.newPage();
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(30000);
page.on('pageerror', error => results.errors.push(error.message));
page.on('response', response => {
  const path = new URL(response.url()).pathname;
  if (!['/api/evaluations/mobile', '/api/mobile-planner/plan'].includes(path) || response.request().method() !== 'POST') return;
  const work = (async () => {
    const data = await response.json();
    if (path === '/api/evaluations/mobile') { results.evaluationRequests++; evaluations.push({ status: response.status(), request: response.request().postDataJSON(), result: data }); }
    else modelResponses.push({ status: response.status(), result: data });
  })();
  responseWork.add(work); work.finally(() => responseWork.delete(work)).catch(error => results.errors.push(`Response evidence collection failed: ${error.message}`));
});
const bench = () => page.getByRole('dialog', { name: 'Mobile AI deployment checks', exact: true });
const bodyRows = () => bench().locator('.mobile-bench-table tbody tr');
async function flush() { await Promise.all([...responseWork]); }
async function capture(name) {
  const path = resolve(directory, `${prefix}-${name}.png`);
  await page.screenshot({ path, fullPage: true }); results.screenshots.push(path);
}
async function check(name, execute) {
  const started = Date.now();
  try { const detail = await execute(); results.checks.push({ name, passed: true, elapsedMs: Date.now() - started, detail }); console.log(`PASS ${name} ${JSON.stringify(detail)}`); }
  catch (error) { results.checks.push({ name, passed: false, error: error.message }); await capture('failure').catch(() => {}); throw error; }
}
async function runHuman(preset) {
  const count = await bodyRows().count();
  await bench().getByRole('button', { name: preset, exact: true }).click();
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/evaluations/mobile' && response.request().method() === 'POST');
  await bench().getByRole('button', { name: 'Evaluate operator candidate', exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const value = await response.json();
  await page.waitForFunction(count => document.querySelectorAll('.mobile-bench-table tbody tr').length === count + 1, count);
  await flush();
  return value;
}
const object = (world, id) => world.objects.find(item => item.id === id);
function protectedThroughout(run) {
  const expected = object(run.initialWorld, 'bowl');
  assert.ok(run.trajectory.every(sample => JSON.stringify(object(sample.world, 'bowl')) === JSON.stringify(expected)));
  assert.ok(run.checks.some(check => check.id === 'protected-bowl' && check.passed));
}
async function exportReport(name) {
  const pending = page.waitForEvent('download');
  await bench().getByRole('button', { name: 'Export evaluation report', exact: true }).click();
  const download = await pending, path = resolve(directory, name);
  await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}
function verifyReport(report, attempts) {
  assert.equal(report.schema, 'teachtrace.mobile-planner-report.v1');
  assert.deepEqual(report.goal, { objectId: 'cup', stationId: 'sink', protectedObject: 'bowl' });
  assert.equal(report.cases.length, attempts);
  assert.deepEqual(report.summary, {
    requestFailures: report.requestFailures.length,
    attempts, notAcceptedTasks: report.cases.filter(item => !item.result.taskAccepted).length,
    acceptedTasks: report.cases.filter(item => item.result.taskAccepted).length,
    controllerCompletions: report.cases.filter(item => item.result.outcome === 'completed').length,
    goalFailures: report.cases.filter(item => item.result.outcome === 'completed' && !item.result.taskAccepted).length,
    failuresAndRefusals: report.cases.filter(item => item.result.outcome !== 'completed').length,
  });
  assert.equal(report.requestFailures.length, 0);
  assert.match(report.provenance.controller, /client-declared metadata/);
  for (const run of report.cases) {
    assert.deepEqual(run.result.goal, { objectId: 'cup', stationId: 'sink' });
    assert.equal(run.result.independentlyComputed, true);
    assert.equal(run.result.evaluationBasis, 'server-executed-mobile-kinematic-controller');
    if (run.result.source !== 'llm') {
      assert.equal(run.result.model, undefined); assert.equal(run.result.requestDurationMs, undefined);
    }
  }
}
function csv(report) {
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const keys = ['source', 'caseId', 'model', 'outcome', 'taskAccepted', 'failureCategory', 'distanceTravelled', 'completedPlacements'];
  return [keys.join(','), ...report.cases.map(run => [run.result.source, run.caseId, run.result.model, run.result.outcome, run.result.taskAccepted,
    run.result.failureCategory, run.result.distanceTravelled, run.result.completedPlacements].map(cell).join(','))].join('\n') + '\n';
}

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'AI deployment checks', exact: true }).click();
  await bench().waitFor();
  await page.waitForFunction(() => document.querySelector('select[aria-label="Mobile planner model"]')?.options.length > 0);
  await check('declared reach check before navigation fails at zero travel without invented actions', async () => {
    const value = await runHuman('Try pickup before moving');
    assert.equal(value.source, 'human'); assert.equal(value.outcome, 'failed'); assert.equal(value.failureCategory, 'reach');
    assert.equal(value.distanceTravelled, 0); assert.equal(value.completedPickups, 0); assert.equal(value.completedPlacements, 0);
    assert.equal(value.failureStepIndex, 0); assert.equal(value.failedAction.skill, 'reach-check'); assert.equal(value.taskAccepted, false);
    assert.ok((await bodyRows().nth(0).innerText()).includes('Not accepted'));
    return { outcome: value.outcome, failureCategory: value.failureCategory, failedSkill: value.failedAction.skill, distance: value.distanceTravelled };
  });
  await check('wrong destination completes mechanically while the independent task goal fails', async () => {
    const value = await runHuman('Try wrong destination');
    assert.equal(value.outcome, 'completed'); assert.equal(value.taskAccepted, false); assert.equal(value.failureCategory, 'wrong-goal');
    assert.equal(value.completedPlacements, 1); assert.equal(object(value.finalWorld, 'cup').station, 'table');
    protectedThroughout(value);
    return { outcome: value.outcome, goalAccepted: value.taskAccepted, actualDestination: object(value.finalWorld, 'cup').station };
  });
  await check('correct operator recipe executes all declared steps and preserves the frozen source', async () => {
    const value = await runHuman('Load correct recipe');
    assert.equal(value.outcome, 'completed'); assert.equal(value.taskAccepted, true);
    assert.equal(value.completedPickups, 1); assert.equal(value.completedPlacements, 1); assert.equal(object(value.finalWorld, 'cup').station, 'sink');
    protectedThroughout(value);
    assert.deepEqual(evaluations.slice(0, 3).map(item => item.result.initialWorld), [value.initialWorld, value.initialWorld, value.initialWorld]);
    return { accepted: true, states: value.trajectory.length, declaredSteps: value.candidate.actions.length, distance: value.distanceTravelled };
  });
  await check('attempt replay changes the actual canvas and recorded frame time', async () => {
    const slider = bench().getByRole('slider', { name: 'Seek mobile attempt', exact: true });
    await slider.focus(); await slider.press('Home'); await page.waitForTimeout(350);
    const canvas = bench().locator('.mobile-attempt-preview canvas');
    const first = await canvas.screenshot({ path: resolve(directory, `${prefix}-replay-initial.png`) });
    const initialTime = await bench().locator('.mobile-attempt-transport span').innerText();
    await slider.press('End'); await page.waitForTimeout(350);
    const final = await canvas.screenshot({ path: resolve(directory, `${prefix}-replay-final.png`) });
    const finalTime = await bench().locator('.mobile-attempt-transport span').innerText();
    assert.equal(await slider.inputValue(), await slider.getAttribute('max'));
    assert.notEqual(initialTime, finalTime);
    const initialHash = createHash('sha256').update(first).digest('hex'), finalHash = createHash('sha256').update(final).digest('hex');
    assert.notEqual(initialHash, finalHash, 'Replay must move the rendered robot/object rather than just a slider label');
    return { initialTime, finalTime, initialCanvasHash: initialHash, finalCanvasHash: finalHash };
  });
  await check('five actual baseline cases report two accepted tasks and three specific failures', async () => {
    await bench().getByRole('button', { name: 'Run five-case baseline suite', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.mobile-bench-table tbody tr').length === 8, undefined, { timeout: 30000 });
    await flush();
    const suite = evaluations.slice(3, 8).map(item => item.result);
    assert.equal(suite.length, 5); assert.equal(suite.filter(value => value.taskAccepted).length, 2);
    assert.deepEqual(suite.filter(value => !value.taskAccepted).map(value => value.failureCategory).sort(), ['human-blocked', 'no-route', 'reach']);
    assert.ok(suite.every(value => value.source === 'baseline' && !Object.hasOwn(value, 'model') && !Object.hasOwn(value, 'requestDurationMs')));
    suite.filter(value => value.taskAccepted).forEach(protectedThroughout);
    return { acceptedTasks: 2, failures: suite.filter(value => !value.taskAccepted).map(value => ({ outcome: value.outcome, category: value.failureCategory })) };
  });
  if (withAI) {
    await check('one real AI button request retains actual model candidate, timing and authoritative outcome', async () => {
      const button = bench().getByRole('button', { name: 'Generate & evaluate AI plan', exact: true });
      const provider = page.waitForResponse(response => new URL(response.url()).pathname === '/api/mobile-planner/plan' && response.request().method() === 'POST');
      const evaluation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/evaluations/mobile' && response.request().method() === 'POST').catch(() => null);
      await button.click();
      const modelResponse = await provider; assert.equal(modelResponse.status(), 200);
      const generated = await modelResponse.json();
      const actualResponse = await evaluation; assert.ok(actualResponse, 'The generated candidate must reach authoritative evaluation.'); assert.equal(actualResponse.status(), 200);
      const actual = await actualResponse.json();
      await page.waitForFunction(() => document.querySelectorAll('.mobile-bench-table tbody tr').length === 9);
      await flush();
      assert.equal(results.modelRequests, 1); assert.equal(modelResponses.length, 1);
      assert.equal(actual.source, 'llm'); assert.equal(actual.model, generated.model);
      assert.ok(Number.isFinite(actual.requestDurationMs) && actual.requestDurationMs > 0);
      assert.deepEqual(actual.submittedCandidate, generated.candidate);
      assert.equal(actual.taskAccepted, actual.outcome === 'completed' && actual.checks.every(check => check.passed));
      assert.equal(actual.independentlyComputed, true);
      return { model: actual.model, requestDurationMs: actual.requestDurationMs, candidateActions: actual.candidate?.actions.length,
        outcome: actual.outcome, taskAccepted: actual.taskAccepted, failureCategory: actual.failureCategory };
    });
  }
  await check('downloaded report and derived CSV preserve actual attempts, goals, sources and counts', async () => {
    const report = await exportReport(`${prefix}-report.json`);
    verifyReport(report, withAI ? 9 : 8);
    assert.deepEqual(report.cases.slice(0, 3).map(item => item.result.initialWorld), Array.from({ length: 3 }, () => report.cases[0].result.initialWorld));
    if (!withAI) assert.equal(report.cases.filter(item => item.result.source === 'llm').length, 0);
    await writeFile(resolve(directory, `${prefix}-observed.csv`), csv(report));
    await capture('observed-results');
    return { summary: report.summary, csvSource: 'Downloaded actual UI report; no synthetic scores', realModelAttempts: report.cases.filter(item => item.result.source === 'llm').length };
  });
  await check('desktop and phone layouts keep the dialog and controls within the viewport', async () => {
    const measured = [];
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(250);
      const bounds = await bench().evaluate(dialog => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, left: dialog.getBoundingClientRect().left, right: dialog.getBoundingClientRect().right, clientWidth: dialog.clientWidth, scrollWidth: dialog.scrollWidth }));
      assert.ok(bounds.left >= -1 && bounds.right <= width + 1, JSON.stringify(bounds));
      assert.ok(bounds.documentWidth <= width + 1, JSON.stringify(bounds));
      assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1, 'Only the results table may scroll internally; the whole dialog must fit.');
      const close = bench().getByRole('button', { name: 'Close mobile evaluations', exact: true });
      await close.scrollIntoViewIfNeeded(); assert.equal(await close.isVisible(), true);
      await capture(`viewport-${width}`); measured.push(bounds);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    return measured;
  });
  assert.equal(results.modelRequests, withAI ? 1 : 0);
  assert.equal(results.blockedProviderRequests, 0);
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.message; process.exitCode = 1;
} finally {
  await flush().catch(() => {});
  results.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, `${prefix}-results.json`), JSON.stringify(results, null, 2));
  await writeFile(resolve(directory, `${prefix}-api-evidence.json`), JSON.stringify({ evaluations, modelResponses }, null, 2));
  await context.close(); await browser.close();
}
