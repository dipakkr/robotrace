import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Uses an isolated Chrome context and real local UI/API. Never connects live voice.
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189';
const output = resolve('.local/qa');
const screenshots = resolve('docs/screenshots');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const selected = name => !only || only.includes(name);
await Promise.all([mkdir(output, { recursive: true }), mkdir(screenshots, { recursive: true })]);
const resultFilename = only ? `browser-smoke-${only.join('-')}-results.json` : 'browser-smoke-results.json';
const results = { schema: 'teachtrace.browser-smoke.v1', startedAt: new Date().toISOString(), baseURL, checks: [], errors: [], screenshots: [], paidVoiceCalls: 0, paidPlannerCalls: 0 };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await context.addInitScript(() => { localStorage.setItem('teachtrace.auto-simulation-approval', 'false'); });
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(30000);
page.on('pageerror', error => results.errors.push({ type: 'pageerror', message: error.message }));
page.on('console', message => { if (message.type() === 'error') results.errors.push({ type: 'console', message: message.text() }); });
page.on('request', request => {
  const path = new URL(request.url()).pathname;
  if (/\/api\/voice\/(sessions|start|connect)/.test(path) && request.method() === 'POST') results.paidVoiceCalls++;
  if (path === '/api/planner/plan' && request.method() === 'POST') results.paidPlannerCalls++;
});

async function screenshot(name) {
  const path = resolve(screenshots, `smoke-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  results.screenshots.push(path);
}
async function check(name, work) {
  const start = Date.now();
  try {
    const detail = await work();
    results.checks.push({ name, passed: true, elapsedMs: Date.now() - start, ...(detail ? { detail } : {}) });
    console.log(`PASS ${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    results.checks.push({ name, passed: false, elapsedMs: Date.now() - start, error: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    await screenshot(`failure-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`).catch(() => {});
    throw error;
  }
}
async function ready() {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Robot command' }).waitFor();
  await page.waitForFunction(() => { const canvas = document.querySelector('canvas'); return canvas && canvas.width > 100 && canvas.height > 100; });
  await page.waitForTimeout(600);
}
async function closeDialog() {
  const close = page.getByRole('button', { name: 'Close dialog', exact: true });
  if (await close.isVisible()) await close.click();
}
async function loadEnvironment(name) {
  await page.locator('.new-environment-button').click();
  const dialog = page.getByRole('dialog', { name: 'Environment studio' });
  await dialog.getByRole('heading', { name, exact: true }).locator('..').getByRole('button', { name: 'Load workplace' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('combobox', { name: 'Simulation speed' }).selectOption('3');
}
async function command(text) {
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  await page.getByRole('textbox', { name: 'Robot command' }).fill(text);
  await page.getByRole('button', { name: 'Send command', exact: true }).click();
}
async function episodes() { return page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')); }
async function waitEpisode(previous) {
  await page.waitForFunction(before => {
    const episodes = JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]');
    return episodes[0] && episodes[0].id !== before;
  }, previous, { timeout: 30000 });
  return (await episodes())[0];
}
async function download(button, filename) {
  const pending = page.waitForEvent('download', { timeout: 30000 });
  await button.click();
  const file = await pending;
  const destination = resolve(output, filename || file.suggestedFilename());
  await file.saveAs(destination);
  return JSON.parse(await readFile(destination, 'utf8'));
}

try {
  await ready();
  if (selected('flow')) {
    for (const environment of [
      { id: 'workbench', name: 'Repair workbench', instruction: 'Prepare repair kit', actions: 3 },
      { id: 'kitchen', name: 'Kitchen counter', instruction: 'Clear the counter', actions: 3 },
      { id: 'lab', name: 'Sample preparation lab', instruction: 'Route the samples', actions: 2 },
    ]) {
      await check(`${environment.id} approved execution and persistent report`, async () => {
        await loadEnvironment(environment.name);
        const before = (await episodes())[0]?.id ?? null;
        await command(environment.instruction);
        const approval = page.getByRole('button', { name: 'Approve & run', exact: true });
        await approval.waitFor();
        assert.equal((await episodes())[0]?.id ?? null, before, 'Preparing a plan must not execute it.');
        await approval.click();
        const episode = await waitEpisode(before);
        assert.equal(episode.outcome, 'completed');
        assert.equal(episode.completedActions, environment.actions);
        assert.equal(episode.initialWorld.environmentId, environment.id);
        assert.ok(episode.samples.length > 2);
        const visibleChecks = await page.locator('.outcome-check strong').allTextContents();
        assert.ok(visibleChecks.length >= 5);
        assert.ok(visibleChecks.every(text => text === 'Passed'), `Visible checks: ${visibleChecks.join(', ')}`);
        await page.locator('.recording-panel').getByRole('button', { name: 'Review episode', exact: true }).filter({ visible: true }).click();
        const scrubber = page.getByRole('slider', { name: 'Seek episode' });
        await scrubber.fill(String(episode.samples.length - 1));
        await page.locator('.recording-panel').getByRole('button', { name: 'Submit evidence', exact: true }).filter({ visible: true }).click();
        const receiptResponse = page.waitForResponse(response => response.url().endsWith('/api/episodes') && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Approve & submit evidence', exact: true }).click();
        const response = await receiptResponse;
        assert.equal(response.status(), 201);
        const receipt = await response.json();
        assert.ok(receipt.saved && receipt.report?.id, 'Real API must return a persisted report.');
        assert.equal(receipt.report.acceptance.status, 'passed');
        assert.equal(receipt.report.metrics.completedActions, environment.actions);
        await page.getByRole('dialog', { name: 'Collection service report' }).waitFor();
        await screenshot(`${environment.id}-report`);
        await closeDialog();
        const bundle = await download(page.getByRole('button', { name: 'Export evidence package', exact: true }), `${environment.id}.teachtrace.json`);
        const verification = await page.evaluate(async payload => {
          const evidence = await import('/src/data/evidence.ts');
          return evidence.verifyEvidencePackage(payload);
        }, bundle);
        assert.deepEqual(verification, { valid: true, errors: [] });
        assert.equal(bundle.metrics.taskAcceptancePassed, true);
        assert.equal(bundle.report.id, receipt.report.id);
        const persisted = await page.request.get(`/api/reports/${receipt.report.id}`);
        assert.equal(persisted.status(), 200);
        assert.equal((await persisted.json()).acceptance.status, 'passed');
        const assignment = await page.request.get(`/api/assignments/${environment.id}`);
        assert.equal((await assignment.json()).status, 'submitted');
        await page.getByRole('button', { name: 'Return to live scene', exact: true }).click();
        return { actions: episode.completedActions, samples: episode.samples.length, reportId: receipt.report.id, digestVerified: true };
      });
    }
  }

  if (selected('layouts')) await check('presentation modes cameras and responsive overflow', async () => {
    await closeDialog();
    await loadEnvironment('Repair workbench');
    for (const label of ['Studio', 'Copilot', 'Simulation']) {
      await page.getByRole('group', { name: 'Presentation layout' }).getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator('.studio').getAttribute('data-layout'), label.toLowerCase());
      if (label === 'Simulation') {
        await screenshot('simulation');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.studio').getAttribute('data-layout'), 'studio');
      }
    }
    for (const camera of ['Top', 'Robot', 'Orbit']) {
      await page.getByRole('button', { name: camera, exact: true }).click();
      assert.ok((await page.getByRole('button', { name: camera, exact: true }).getAttribute('class')).includes('selected'));
    }
    await page.getByRole('button', { name: 'Collapse scene inspector', exact: true }).click();
    assert.equal(await page.locator('.studio').getAttribute('data-sidebar'), 'collapsed');
    assert.equal(await page.locator('.scene-sidebar').isVisible(), false);
    await page.getByRole('button', { name: 'Toggle scene inspector', exact: true }).click();
    assert.equal(await page.locator('.studio').getAttribute('data-sidebar'), 'open');
    await page.getByRole('button', { name: 'Collapse copilot', exact: true }).click();
    assert.equal(await page.locator('.copilot-panel').isVisible(), false);
    await page.getByRole('button', { name: 'Toggle copilot panel', exact: true }).click();
    assert.equal(await page.locator('.copilot-panel').isVisible(), true);
    const collapsedTimeline = await page.locator('.recording-panel').boundingBox();
    assert.ok(collapsedTimeline.height < 65, 'Collapsed timeline should stay compact.');
    await page.getByRole('button', { name: 'Expand timeline', exact: true }).click();
    assert.ok((await page.locator('.recording-panel').boundingBox()).height > collapsedTimeline.height + 40);
    await page.getByRole('button', { name: 'Collapse timeline', exact: true }).click();
    const layouts = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(250);
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.client + 1 && dimensions.body <= dimensions.client + 1, `Horizontal page overflow at ${viewport.width}: ${JSON.stringify(dimensions)}`);
      layouts.push({ ...viewport, ...dimensions });
      if (viewport.width >= 1000) {
        await page.getByRole('group', { name: 'Presentation layout' }).getByRole('button', { name: 'Copilot', exact: true }).click();
        await command('Prepare repair kit');
        const approval = page.getByRole('region', { name: 'Review simulated motion' }).getByRole('button', { name: 'Approve & run', exact: true });
        await approval.waitFor();
        const bounds = await approval.boundingBox();
        assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width,
          `Approval must be within the ${viewport.width}x${viewport.height} viewport before any scrolling: ${JSON.stringify(bounds)}`);
        const hit = await approval.evaluate(button => {
          const box = button.getBoundingClientRect();
          return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button') === button;
        });
        assert.equal(hit, true, 'Approval must receive pointer input without clipping or overlays.');
        await screenshot(`approval-${viewport.width}x${viewport.height}`);
        await page.getByRole('button', { name: 'Discard plan', exact: true }).click();
      }
      await screenshot(`${viewport.width}x${viewport.height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return layouts;
  });

  if (selected('planners')) await check('human and bounded planner share frozen scene with honest task outcomes', async () => {
    await closeDialog();
    await page.getByRole('group', { name: 'Presentation layout' }).getByRole('button', { name: 'Copilot', exact: true }).click();
    await loadEnvironment('Repair workbench');
    const liveChecksBefore = await page.locator('.assignment-strip .badge').innerText();
    await page.getByRole('button', { name: 'Human and AI planner comparison', exact: true }).click();
    const bench = page.locator('.planner-bench');
    await bench.getByRole('combobox', { name: 'Object', exact: true }).selectOption('part-red');
    await bench.getByRole('combobox', { name: 'Destination', exact: true }).selectOption('tray-b');
    await bench.getByRole('button', { name: 'Add step', exact: true }).click();
    await bench.getByRole('button', { name: 'Evaluate human plan', exact: true }).click();
    await bench.locator('.bench-table tbody tr').first().waitFor();
    await bench.getByRole('button', { name: 'Evaluate bounded baseline', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.bench-table tbody tr').length === 2);
    const rows = bench.locator('.bench-table tbody tr');
    assert.deepEqual(await rows.nth(0).locator('td').allTextContents(), ['Yes', 'No', '1', '—']);
    assert.deepEqual(await rows.nth(1).locator('td').allTextContents(), ['Yes', 'Yes', '3', '—']);
    const exported = await download(bench.getByRole('button', { name: 'Export comparison JSON', exact: true }), 'planner-comparison.json');
    assert.equal(exported.schema, 'teachtrace.planner-comparison.v1');
    assert.equal(exported.initialWorld.environmentId, 'workbench');
    assert.deepEqual(exported.results.map(result => [result.source, result.outcome, result.taskAccepted]), [['human', 'completed', false], ['baseline', 'completed', true]]);
    for (const result of exported.results) {
      assert.deepEqual(result.initialWorld, exported.initialWorld);
      assert.equal(result.requestDurationMs, undefined, 'Local plans must not invent LLM request timing.');
    }
    assert.ok(exported.results[0].checks.some(item => !item.passed));
    await rows.nth(0).locator('summary').click();
    assert.ok((await rows.nth(0).innerText()).includes('Controller outcome: completed'));
    await rows.nth(0).locator('summary').click();
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.getByRole('dialog').evaluate(dialog => { dialog.scrollTop = 0; });
    const path = resolve(screenshots, 'planner-comparison.png');
    await page.screenshot({ path, fullPage: true });
    results.screenshots.push(path);
    await page.setViewportSize({ width: 1440, height: 900 });
    await bench.getByRole('button', { name: 'Use current scene', exact: true }).click();
    assert.equal(await bench.locator('.bench-table tbody tr').count(), 0);
    assert.equal(await bench.locator('.bench-draft li').count(), 0);
    await closeDialog();
    assert.equal(await page.locator('.assignment-strip .badge').innerText(), liveChecksBefore, 'Comparison must not mutate the live world.');
    return { human: 'controller completed; task rejected', baseline: 'controller completed; task accepted', sameFrozenScene: true, paidModelRequests: results.paidPlannerCalls };
  });

  if (selected('evaluation')) await check('nine-case controller evaluation and native result export', async () => {
    await page.getByRole('button', { name: 'Controller evaluation', exact: true }).click();
    await page.getByRole('button', { name: 'Run evaluation campaign', exact: true }).click();
    await page.locator('.evaluation-table tbody tr').last().waitFor();
    assert.equal(await page.locator('.evaluation-table tbody tr').count(), 9);
    assert.deepEqual(await page.locator('.evaluation-summary-card strong').allTextContents(), ['9/9', '6', '3']);
    const referenceResults = await page.locator('.evaluation-table tbody tr td:last-child').allTextContents();
    assert.equal(referenceResults.filter(text => text === 'Preserved').length, 3);
    await page.locator('.evaluation-case-details summary').first().click();
    assert.ok(await page.locator('.evaluation-checks').first().isVisible());
    const campaign = await download(page.getByRole('button', { name: 'Export evaluation JSON', exact: true }), 'evaluation-campaign.json');
    assert.deepEqual(campaign.summary, { total: 9, passed: 9, failed: 0, taskCompletions: 6, expectedRejections: 3 });
    assert.ok(campaign.cases.every(item => item.initialWorld && item.finalWorld && item.checks.length));
    await screenshot('evaluation');
    await closeDialog();
    return campaign.summary;
  });

  if (selected('composer')) await check('reviewed scene composition and zero-action reach refusal', async () => {
    await page.locator('.new-environment-button').click();
    await page.getByRole('button', { name: 'Describe a scene', exact: true }).click();
    await page.getByRole('textbox', { name: 'DESCRIBE THE ENVIRONMENT' }).fill('Create a reach-limit test');
    await page.getByRole('button', { name: 'Generate scene draft', exact: true }).click();
    await page.getByRole('button', { name: 'Approve & apply environment', exact: true }).click();
    const before = (await episodes())[0]?.id ?? null;
    await command('Move the red block to tray A');
    await page.getByRole('button', { name: 'Approve & run', exact: true }).click();
    const episode = await waitEpisode(before);
    assert.equal(episode.outcome, 'failed');
    assert.equal(episode.completedActions, 0);
    assert.ok(episode.events.some(event => event.kind === 'error' && event.label.includes('outside the configured workcell reach')));
    assert.deepEqual(episode.samples.at(-1).world.objects, episode.initialWorld.objects, 'Refused request must leave objects unchanged.');
    const bundle = await download(page.getByRole('button', { name: 'Export evidence package', exact: true }), 'refused-attempt.teachtrace.json');
    assert.equal(bundle.metrics.recordedOutcome, 'failed');
    assert.equal(bundle.metrics.completedActions, 0);
    assert.deepEqual(await page.evaluate(async payload => (await import('/src/data/evidence.ts')).verifyEvidencePackage(payload), bundle), { valid: true, errors: [] });
    await screenshot('reach-refusal');
    return { outcome: episode.outcome, completedActions: episode.completedActions };
  });
  assert.equal(results.paidVoiceCalls, 0, 'Smoke test must not create paid voice sessions.');
  assert.equal(results.paidPlannerCalls, 0, 'Smoke test must not request paid AI planner calls.');
  assert.equal(results.errors.filter(item => item.type === 'pageerror').length, 0, 'No uncaught browser runtime errors.');
} catch (error) {
  results.failure = error.message;
  process.exitCode = 1;
} finally {
  results.finishedAt = new Date().toISOString();
  results.passed = !results.failure;
  await writeFile(resolve(output, resultFilename), JSON.stringify(results, null, 2));
  console.log(`Results: ${resolve(output, resultFilename)}`);
  await context.close();
  await browser.close();
}
