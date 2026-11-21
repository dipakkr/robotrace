import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const directory = resolve('.local/qa'); await mkdir(directory, { recursive: true });
const result = { schema: 'teachtrace.approval-edge-audit.v1', startedAt: new Date().toISOString(), checks: [], unexercised: [], errors: [], forbiddenRequests: [], scope: 'Real local UI commands and controller; isolated Chrome contexts; no paid requests, voice resets or persistence writes.' };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function fresh() {
 const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
 await context.route('**/api/**', async route => { const req = route.request(); if (req.method() !== 'GET') { result.forbiddenRequests.push({ method: req.method(), path: new URL(req.url()).pathname }); await route.abort('blockedbyclient'); return; } await route.continue(); });
 const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => result.errors.push(e.message));
 await page.goto(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189'); await page.getByRole('textbox', { name: 'Robot command', exact: true }).waitFor(); await page.getByLabel('Simulation speed', { exact: true }).selectOption('3');
 return { context, page };
}
const review = page => page.locator('.approval-review');
const command = async (page, text) => { await page.getByRole('textbox', { name: 'Robot command', exact: true }).fill(text); await page.getByRole('button', { name: 'Send command', exact: true }).click(); };
const episodes = page => page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]'));
const mode = page => page.locator('.workspace-title .state-pill').innerText();
async function completed(page) { await page.waitForFunction(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')[0]?.outcome === 'completed', null, { timeout: 25000 }); return (await episodes(page))[0]; }
async function check(name, run) {
 const started = Date.now(), own = await fresh();
 try { const detail = await run(own.page, own.context); result.checks.push({ name, passed: true, elapsedMs: Date.now() - started, detail }); }
 catch (error) { result.checks.push({ name, passed: false, elapsedMs: Date.now() - started, error: error.message }); await own.page.screenshot({ path: resolve(directory, `approval-edge-failure-${result.checks.length}.png`) }).catch(() => {}); }
 finally { await own.context.close(); await writeFile(resolve(directory, 'approval-edge-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result.checks.at(-1))); }
}
try {
 await check('manual approval near expiry produces exactly one manually approved execution', async page => {
  const prepared = Date.now(); await command(page, 'Move red to tray A'); await review(page).getByRole('button', { name: 'Cancel countdown', exact: true }).waitFor();
  await page.waitForTimeout(Math.max(0, 2450 - (Date.now() - prepared)));
  const clickedAtMs = Date.now() - prepared; assert.ok(clickedAtMs >= 2350 && clickedAtMs < 2950, `Manual approval missed intended pre-expiry window: ${clickedAtMs}ms`);
  await review(page).getByRole('button', { name: 'Approve & run', exact: true }).click(); const episode = await completed(page);
  await page.waitForTimeout(3300); const saved = await episodes(page); assert.equal(saved.length, 1); assert.equal(saved[0].id, episode.id); assert.equal(episode.completedActions, 1);
  const approvals = episode.events.filter(event => /approved/i.test(event.label)); assert.equal(approvals.length, 1); assert.match(approvals[0].label, /explicitly/); assert.ok(!episode.events.some(event => /automatically approved/i.test(event.label)));
  return { clickedAtMs, episodeCount: saved.length, completedActions: episode.completedActions, approval: approvals[0].label };
 });
 await check('discard and replacement cancel the old timer and only the replacement plan executes', async page => {
  await command(page, 'Move red to tray A'); await review(page).getByRole('button', { name: 'Cancel countdown', exact: true }).waitFor(); await page.waitForTimeout(600); await review(page).getByRole('button', { name: 'Discard plan', exact: true }).click();
  await page.waitForTimeout(3300); assert.equal((await episodes(page)).length, 0); assert.match(await mode(page), /Ready/); assert.equal(await page.locator('.viewport-status-time').innerText(), '00:00.0');
  const oldPrepared = Date.now(); await command(page, 'Move red to tray A'); await review(page).getByRole('button', { name: 'Cancel countdown', exact: true }).waitFor(); await page.waitForTimeout(1200);
  await command(page, 'Move blue to tray B'); const replacementPrepared = Date.now(); await review(page).getByRole('button', { name: 'Cancel countdown', exact: true }).waitFor(); await page.waitForTimeout(2050);
  assert.ok(Date.now() - oldPrepared > 3000); assert.ok(Date.now() - replacementPrepared < 2900, 'The old-deadline assertion must precede the fresh deadline'); assert.match(await mode(page), /Ready/); assert.equal((await episodes(page)).length, 0);
  const episode = await completed(page); await page.waitForTimeout(3300); assert.equal((await episodes(page)).length, 1); assert.equal(episode.command, 'Move blue to tray B'); assert.equal(episode.completedActions, 1);
  const blue = episode.initialWorld.objects.find(object => /blue/i.test(object.label)), red = episode.initialWorld.objects.find(object => /red/i.test(object.label)); assert.ok(blue && red);
  assert.equal(episode.samples.at(-1).world.objects.find(object => object.id === blue.id).location, 'tray-b'); assert.deepEqual(episode.samples.at(-1).world.objects.find(object => object.id === red.id), red);
  assert.equal(episode.events.filter(event => /approved/i.test(event.label)).length, 1);
  return { discardMovedNothing: true, oldDeadlineMovedNothing: true, executedCommand: episode.command, completedActions: 1, redUnchanged: true };
 });
 // Genuine visibility probe only. Do not redefine document.hidden or synthesize a visibility event.
 {
  const own = await fresh(); const first = await own.page.evaluate(() => document.visibilityState); const other = await own.context.newPage(); await other.goto('about:blank'); await other.bringToFront(); await own.page.waitForTimeout(200);
  const background = await own.page.evaluate(() => document.visibilityState);
  if (background !== 'hidden') result.unexercised.push({ case: 'hidden-tab cancellation', reason: `Actual headless Chrome tab switch reported ${first}→${background}; no document.hidden override or synthetic event was used.` });
  else {
   await own.page.bringToFront(); await command(own.page, 'Move red to tray A'); await review(own.page).getByRole('button', { name: 'Cancel countdown', exact: true }).waitFor(); await other.bringToFront(); await own.page.waitForTimeout(3300); assert.equal(await own.page.evaluate(() => document.visibilityState), 'hidden'); assert.equal((await episodes(own.page)).length, 0); await own.page.bringToFront(); await own.page.waitForTimeout(3300); assert.equal((await episodes(own.page)).length, 0); result.checks.push({ name: 'genuine hidden tab cancels countdown and returning does not resume', passed: true, detail: { visibility: 'hidden' } });
  }
  await own.context.close();
 }
} finally {
 result.passed = result.checks.every(item => item.passed) && result.errors.length === 0 && result.forbiddenRequests.length === 0; result.finishedAt = new Date().toISOString(); await writeFile(resolve(directory, 'approval-edge-results.json'), JSON.stringify(result, null, 2)); await browser.close();
}
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, unexercised: result.unexercised, errors: result.errors, forbiddenRequests: result.forbiddenRequests }, null, 2)); if (!result.passed) process.exitCode = 1;
