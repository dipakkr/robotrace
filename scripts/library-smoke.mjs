import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Isolated UI acceptance. Exactly one explicit paid planner request is authorized.
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189';
const output = resolve('.local/qa');
const screenshots = resolve('docs/screenshots');
await Promise.all([mkdir(output, { recursive: true }), mkdir(screenshots, { recursive: true })]);
const results = { schema: 'teachtrace.library-planner-smoke.v1', startedAt: new Date().toISOString(), checks: [], requests: [], errors: [], screenshots: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.addInitScript(() => { localStorage.setItem('teachtrace.auto-simulation-approval', 'false'); });
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(30000);
page.on('pageerror', error => results.errors.push({ type: 'pageerror', message: error.message }));
page.on('request', request => {
  const path = new URL(request.url()).pathname;
  if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) results.requests.push({ path, method: request.method() });
});
async function check(name, work) {
  const started = Date.now();
  try {
    const detail = await work();
    results.checks.push({ name, passed: true, elapsedMs: Date.now() - started, detail });
    console.log(`PASS ${name} ${JSON.stringify(detail)}`);
  } catch (error) {
    results.checks.push({ name, passed: false, error: error.message });
    const path = resolve(screenshots, 'library-smoke-failure.png');
    await page.screenshot({ path, fullPage: true }).catch(() => {});
    results.screenshots.push(path);
    throw error;
  }
}
async function openLibrary() {
  await page.getByRole('button', { name: 'Saved episode library', exact: true }).filter({ visible: true }).first().click();
  await page.getByRole('heading', { name: 'Reopen the evidence.', exact: true }).waitFor();
}
async function history() { return page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')); }
async function waitForEpisode(id) { await page.waitForFunction(id => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')[0]?.id === id, id); return (await history())[0]; }
async function download(button, filename) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  const path = resolve(output, filename);
  await file.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8'));
}
async function capture(name) {
  const path = resolve(screenshots, name);
  await page.screenshot({ path, fullPage: true });
  results.screenshots.push(path);
}

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Robot command' }).waitFor();
  await page.waitForFunction(() => { const canvas = document.querySelector('canvas'); return canvas && canvas.width > 100 && canvas.height > 100; });
  await check('server saved episode reopens with its recorded outcome and review state', async () => {
    const listResponse = await page.request.get('/api/episodes');
    assert.equal(listResponse.status(), 200);
    const list = await listResponse.json();
    assert.ok(list.episodes.length > 0);
    let record;
    for (const entry of list.episodes.slice(0, 5)) {
      const response = await page.request.get(`/api/episodes/${entry.id}`);
      assert.equal(response.status(), 200);
      const candidate = await response.json();
      const validation = await page.evaluate(async source => {
        const evidence = await import('/src/data/evidence.ts');
        try { return evidence.validateEvidencePackage(evidence.buildEvidencePackage(source)); } catch (error) { return { valid: false, errors: [error.message] }; }
      }, candidate.episode);
      if (validation.valid) { record = candidate; break; }
    }
    assert.ok(record, 'One of the five latest server records must be a valid native episode.');
    await openLibrary();
    await page.locator('.library-record').first().waitFor();
    await capture('episode-library.png');
    const card = page.locator('.library-record').filter({ has: page.locator('code', { hasText: record.id }) });
    await card.getByRole('button', { name: /^Load and inspect/ }).click();
    const episode = await waitForEpisode(record.episode.id);
    assert.equal(episode.savedId, record.id);
    assert.equal(episode.outcome, record.episode.outcome);
    assert.equal(episode.status, record.episode.status);
    assert.equal(episode.completedActions, record.episode.completedActions);
    assert.equal(episode.samples.length, record.episode.samples.length);
    assert.deepEqual(episode.initialWorld, record.episode.initialWorld);
    assert.deepEqual(episode.samples.at(-1), record.episode.samples.at(-1));
    const expand = page.getByRole('button', { name: 'Expand timeline', exact: true });
    if (await expand.isVisible()) await expand.click();
    await page.getByRole('slider', { name: 'Seek episode' }).fill(String(episode.samples.length - 1));
    assert.ok((await page.locator('.viewport-status').innerText()).includes('RECORDED REPLAY'));
    await capture('episode-library-replay.png');
    assert.equal(results.requests.length, 0, 'Loading and replaying server records must not write records.');
    return { savedId: record.id, outcome: episode.outcome, review: episode.status, samples: episode.samples.length, noWrites: true };
  });

  await check('sealed native import preserves review and outcome while stripping storage links', async () => {
    const native = JSON.parse(await readFile(resolve(output, 'ai-scene.teachtrace.json'), 'utf8'));
    await openLibrary();
    await page.getByLabel('Native evidence package', { exact: true }).setInputFiles(resolve(output, 'ai-scene.teachtrace.json'));
    await page.getByRole('heading', { name: 'Reopen the evidence.', exact: true }).waitFor({ state: 'hidden' });
    const episode = await waitForEpisode(native.episode.id);
    assert.equal(episode.outcome, native.episode.outcome);
    assert.equal(episode.status, native.episode.status);
    assert.equal(episode.completedActions, native.episode.completedActions);
    assert.equal(Object.hasOwn(episode, 'savedId'), false);
    assert.equal(Object.hasOwn(episode, 'reportId'), false);
    assert.deepEqual(episode.initialWorld, native.episode.initialWorld);
    assert.deepEqual(episode.samples.at(-1), native.episode.samples.at(-1));
    assert.equal(results.requests.length, 0, 'Import must not save or approve a server record.');
    await openLibrary();
    await page.locator('.library-record').first().waitFor();
    const before = JSON.stringify(await history());
    const corrupted = structuredClone(native);
    corrupted.integrity.sha256 = (corrupted.integrity.sha256[0] === '0' ? '1' : '0') + corrupted.integrity.sha256.slice(1);
    await page.getByLabel('Native evidence package', { exact: true }).setInputFiles({ name: 'tampered.teachtrace.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(corrupted)) });
    await page.locator('.episode-library [role="alert"]').filter({ hasText: /integrity mismatch/i }).waitFor();
    assert.equal(JSON.stringify(await history()), before, 'Corrupt package must not inject or change any history entry.');
    await capture('episode-library-integrity-rejection.png');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    assert.equal(results.requests.length, 0);
    return { originalOutcome: native.episode.outcome, originalReview: native.episode.status, storageLinksRemoved: true, corruptDigestRejected: true, historyUnchanged: true, noWrites: true };
  });

  await check('one explicitly requested live AI planner candidate evaluates and exports its model and latency', async () => {
    await page.getByRole('button', { name: 'Return to live scene', exact: true }).click();
    await page.getByRole('group', { name: 'Presentation layout' }).getByRole('button', { name: 'Copilot', exact: true }).click();
    await page.locator('.new-environment-button').click();
    const dialog = page.getByRole('dialog', { name: 'Environment studio' });
    await dialog.getByRole('heading', { name: 'Repair workbench', exact: true }).locator('..').getByRole('button', { name: 'Load workplace' }).click();
    await page.getByRole('button', { name: 'Human and AI planner comparison', exact: true }).click();
    const bench = page.locator('.planner-bench');
    await bench.getByRole('combobox', { name: 'AI planner model', exact: true }).selectOption('gpt-4.1-mini');
    assert.equal(results.requests.filter(item => item.path === '/api/planner/plan').length, 0);
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/planner/plan' && response.request().method() === 'POST', { timeout: 30000 });
    await bench.getByRole('button', { name: 'Generate and evaluate AI plan', exact: true }).click(); // Exactly one authorized paid request; no retries.
    const response = await pending;
    assert.equal(response.status(), 200, 'The single live model request must succeed; do not retry automatically.');
    const receipt = await response.json();
    assert.equal(receipt.model, 'gpt-4.1-mini');
    assert.ok(Number.isFinite(receipt.requestDurationMs) && receipt.requestDurationMs > 0);
    await bench.locator('.bench-table tbody tr').first().waitFor();
    const cells = await bench.locator('.bench-table tbody tr').first().locator('td').allTextContents();
    assert.deepEqual(cells.slice(0, 3), ['Yes', 'Yes', '3']);
    const exported = await download(bench.getByRole('button', { name: 'Export comparison JSON', exact: true }), 'planner-live-ui.json');
    assert.equal(exported.results.length, 1);
    const result = exported.results[0];
    assert.equal(result.source, 'llm');
    assert.equal(result.model, 'gpt-4.1-mini');
    assert.equal(result.requestDurationMs, receipt.requestDurationMs);
    assert.equal(result.taskAccepted, true);
    assert.equal(result.planValid, true);
    assert.equal(result.outcome, 'completed');
    assert.equal(result.completedActions, 3);
    assert.deepEqual(result.initialWorld, exported.initialWorld);
    assert.deepEqual(results.requests, [{ path: '/api/planner/plan', method: 'POST' }], 'No write or extra paid request is authorized by this smoke test.');
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.getByRole('dialog').evaluate(dialog => { dialog.scrollTop = 0; });
    await capture('planner-live-ai.png');
    return { model: result.model, requestDurationMs: result.requestDurationMs, completedActions: result.completedActions, taskAccepted: result.taskAccepted, paidRequests: 1 };
  });
  assert.equal(results.errors.length, 0, 'No uncaught browser errors.');
} catch (error) {
  results.failure = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  results.finishedAt = new Date().toISOString();
  results.passed = !results.failure;
  await writeFile(resolve(output, 'library-smoke-results.json'), JSON.stringify(results, null, 2));
  console.log(`Results: ${resolve(output, 'library-smoke-results.json')}`);
  await context.close();
  await browser.close();
}
