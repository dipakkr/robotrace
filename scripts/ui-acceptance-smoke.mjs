import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',').map(Number);
let checkIndex = 0;
const output = resolve('.local/qa'), screenshots = resolve('docs/screenshots');
await mkdir(output, { recursive: true }); await mkdir(screenshots, { recursive: true });
const result = { schema: 'teachtrace.final-ui-acceptance.v1', startedAt: new Date().toISOString(), checks: [], errors: [], findings: [], selectedStyles: [], screenshots: [], blockedRequests: [], mockSceneDrafts: 0, scope: 'Isolated local UI acceptance. One explicitly mocked AI draft; no live providers, voice reset or persistent writes.' };
const mockSpec = { version: 1, title: 'QA MOCK · Six-step review fixture', baseEnvironmentId: 'workbench', instruction: 'Sort all parts', objects: Array.from({ length: 6 }, (_, i) => ({ id: `fixture-${i}`, label: `QA ${i < 3 ? 'red' : 'blue'} part ${i + 1}`, asset: 'block', color: i < 3 ? 'red' : 'blue', slot: i })), assignments: Array.from({ length: 6 }, (_, i) => ({ objectId: `fixture-${i}`, destination: i < 3 ? 'tray-a' : 'tray-b', unchanged: false })) };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  if (req.method() === 'POST' && path === '/api/scenes/draft') { result.mockSceneDrafts++; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ spec: mockSpec, model: 'qa-mock-no-provider', requestDurationMs: 0 }) }); return; }
  if (req.method() !== 'GET') { result.blockedRequests.push({ method: req.method(), path }); await route.abort('blockedbyclient'); return; }
  await route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => result.errors.push(error.message));
const review = () => page.locator('.approval-review');
const command = async text => { await page.getByRole('textbox', { name: 'Robot command', exact: true }).fill(text); await page.getByRole('button', { name: 'Send command', exact: true }).click(); };
const screenshot = async name => { const file = `ui-acceptance-${name}.png`; await page.screenshot({ path: resolve(screenshots, file) }); result.screenshots.push(file); };
const bounds = async locator => { const box = await locator.boundingBox(); assert.ok(box, 'Control must be rendered'); const viewport = page.viewportSize(); assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `Control clipped outside viewport: ${JSON.stringify(box)}`); return box; };
const inspectSelected = async label => {
 const entries = await page.locator('.rail-button.active,.tree-row.is-selected,.sidebar-tabs .selected,.copilot-tabs .active,.layout-switcher .selected,.view-button.selected,.episode-card.selected-episode,.environment-tabs .selected').evaluateAll(elements => elements.map(el => {
   const s = getComputedStyle(el); const pseudo = ['::before', '::after'].map(kind => { const p = getComputedStyle(el, kind); return { kind, content: p.content, width: p.width, height: p.height, left: p.left, right: p.right, shadow: p.boxShadow }; });
   return { label: el.textContent?.trim() || el.getAttribute('aria-label'), className: el.className, shadow: s.boxShadow, borderLeft: s.borderLeftWidth, borderRight: s.borderRightWidth, borderTop: s.borderTopWidth, borderBottom: s.borderBottomWidth, font: s.fontSize, height: el.getBoundingClientRect().height, pseudo };
 }));
 for (const entry of entries) {
   assert.ok(!(parseFloat(entry.borderLeft) > 0 && parseFloat(entry.borderRight) === 0), `${label}: left-only selection border`);
   const plainShadow = entry.shadow.replace(/rgba?\([^)]*\)/g, '').replace(/#[0-9a-f]+/gi, '');
   if (plainShadow.includes('inset')) { const nums = plainShadow.match(/-?\d+(?:\.\d+)?px/g)?.map(parseFloat) ?? []; assert.ok(nums[0] === 0 && nums[1] === 0, `${label}: directional inset selection stripe`); }
   for (const pseudo of entry.pseudo) assert.ok(!(['none', 'normal'].includes(pseudo.content) === false && parseFloat(pseudo.width) <= 4 && parseFloat(pseudo.height) > 8), `${label}: vertical pseudo selection stripe`);
 }
 result.selectedStyles.push({ label, entries });
};
async function check(name, fn) { checkIndex++; if (only && !only.includes(checkIndex)) return; const start = Date.now(); try { const detail = await fn(); result.checks.push({ name, passed: true, elapsedMs: Date.now() - start, ...(detail ? { detail } : {}) }); } catch (error) { result.checks.push({ name, passed: false, error: error.message }); result.findings.push({ name, error: error.message }); await screenshot(`failure-${result.checks.length}`); } }
try {
 await page.goto(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189'); await page.getByRole('textbox', { name: 'Robot command', exact: true }).waitFor(); await page.waitForTimeout(650);
 await check('desktop layouts, chat recovery, panel restoration and selected-state styling', async () => {
   await page.getByRole('button', { name: 'Studio', exact: true }).click();
   await inspectSelected('initial Studio');
   await bounds(page.getByRole('textbox', { name: 'Robot command', exact: true }));
   await page.getByRole('button', { name: 'Collapse scene inspector', exact: true }).click(); assert.equal(await page.locator('.studio').getAttribute('data-sidebar'), 'collapsed');
   await page.getByRole('button', { name: 'Toggle scene inspector', exact: true }).click(); assert.equal(await page.locator('.studio').getAttribute('data-sidebar'), 'open');
   await page.getByRole('button', { name: 'Collapse copilot', exact: true }).click(); await page.getByRole('button', { name: 'Toggle copilot panel', exact: true }).click();
   for (const mode of ['Copilot', 'Studio']) { await page.getByRole('button', { name: mode, exact: true }).click(); await bounds(page.getByRole('textbox', { name: 'Robot command', exact: true })); await inspectSelected(mode); }
   await page.getByRole('button', { name: 'Simulation', exact: true }).click(); await page.getByRole('button', { name: 'Show copilot', exact: true }).click(); await bounds(page.getByRole('textbox', { name: 'Robot command', exact: true }));
   await page.getByRole('button', { name: 'Simulation', exact: true }).click(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.studio').getAttribute('data-layout'), 'studio');
   for (const mode of ['Top', 'Robot', 'Orbit']) { await page.getByRole('button', { name: mode, exact: true }).click(); await inspectSelected(`camera ${mode}`); }
   const expand = page.getByRole('button', { name: 'Expand timeline', exact: true });
   if (await expand.isVisible()) await expand.click();
   await page.getByRole('button', { name: 'Collapse timeline', exact: true }).click(); await page.getByRole('button', { name: 'Expand timeline', exact: true }).click();
   const density = await page.locator('.tree-row.is-selected').first().evaluate(el => ({ font: getComputedStyle(el).fontSize, height: el.getBoundingClientRect().height }));
   assert.ok(parseFloat(density.font) <= 12 && density.height <= 28); await screenshot('studio-1280'); return { density };
 });
 await check('motion Review auto-opens and visible cancellation survives its three-second deadline', async () => {
   await page.getByLabel('Simulation speed', { exact: true }).selectOption('3'); await command('Move red to tray A');
   await review().getByRole('button', { name: 'Cancel countdown', exact: true }).click(); await bounds(review().getByRole('button', { name: 'Approve & run', exact: true }));
   await page.waitForTimeout(3300); assert.equal(await page.locator('.skill-active').count(), 0); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]').length), 0);
   await review().getByRole('button', { name: 'Approve & run', exact: true }).click();
   await page.waitForFunction(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')[0]?.outcome === 'completed', null, { timeout: 25000 });
   await review().getByText('Recorded evidence needs review', { exact: true }).waitFor(); await bounds(review().getByRole('button', { name: 'Review & submit evidence', exact: true })); await screenshot('dataset-review-1280');
 });
 await check('dataset submission and reset remain explicit after more than three seconds', async () => {
   await page.waitForTimeout(3300); const episode = await page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1'))[0]); assert.equal(episode.status, 'review');
   await review().getByRole('button', { name: 'Review & submit evidence', exact: true }).click(); await page.waitForTimeout(3300); await page.getByRole('button', { name: 'Approve & submit evidence', exact: true }).waitFor(); assert.equal(result.blockedRequests.length, 0); await page.keyboard.press('Escape');
   await page.getByRole('button', { name: 'Reset scene', exact: true }).click(); await page.waitForTimeout(3300); await page.getByRole('heading', { name: 'Reset the workcell?', exact: true }).waitFor(); assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1'))[0])).id, episode.id); await page.getByRole('button', { name: 'Keep current scene', exact: true }).click();
   await page.getByRole('button', { name: 'Episodes', exact: true }).first().click(); await inspectSelected('selected recorded episode');
 });
 await check('explicitly mocked six-object draft stays unapplied until approval and long Review keeps footer reachable', async () => {
   await page.getByRole('button', { name: 'Studio', exact: true }).click();
   const expandBeforeDraft = page.getByRole('button', { name: 'Expand timeline', exact: true });
   if (await expandBeforeDraft.isVisible()) await expandBeforeDraft.click();
   await page.locator('.new-environment-button').click(); const dialog = page.getByRole('dialog', { name: 'Environment studio', exact: true }); await dialog.getByRole('button', { name: 'AI scene + reference', exact: true }).click();
   await dialog.getByLabel('AI scene description', { exact: true }).fill('QA MOCK ONLY: six-block footer acceptance fixture'); await dialog.getByRole('button', { name: 'Generate AI scene draft', exact: true }).click();
   await dialog.getByText(`Validated draft · ${mockSpec.title}`, { exact: true }).waitFor(); await page.waitForTimeout(3300); assert.ok(!(await page.locator('.environment-switcher').innerText()).includes(mockSpec.title)); await inspectSelected('mock scene draft');
   await dialog.getByRole('button', { name: 'Approve & apply AI scene', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
   const expandBeforeMotion = page.getByRole('button', { name: 'Expand timeline', exact: true });
   if (await expandBeforeMotion.isVisible()) await expandBeforeMotion.click();
   await command('Sort all parts');
   await page.waitForFunction(() => document.querySelector('.recording-panel')?.classList.contains('is-collapsed')); await review().getByRole('button', { name: 'Cancel countdown', exact: true }).click(); assert.equal(await review().locator('.approval-review-steps li').count(), 6);
   const scroll = await review().locator('.approval-review-content').evaluate(el => ({ height: el.clientHeight, scrollHeight: el.scrollHeight })); assert.ok(scroll.scrollHeight > scroll.height); assert.ok(scroll.height >= 80, `Review action list is too short to inspect: ${scroll.height}px`); await review().locator('.approval-review-content').evaluate(el => el.scrollTop = el.scrollHeight); await bounds(review().getByRole('button', { name: 'Approve & run', exact: true })); await screenshot('six-step-review-1280');
   await review().getByRole('checkbox', { name: 'Auto run simulation plans after 3 seconds', exact: true }).uncheck(); await review().getByRole('button', { name: 'Discard plan', exact: true }).click(); return { mockModel: 'qa-mock-no-provider', scroll };
 });
 await check('disabled automatic motion persists across reload and phone controls stay scroll-reachable', async () => {
   await page.reload(); await command('Move red to tray A'); assert.equal(await review().getByRole('checkbox').isChecked(), false); await page.waitForTimeout(3300); assert.equal(await page.locator('.skill-active').count(), 0);
   await page.setViewportSize({ width: 390, height: 844 }); await review().getByRole('button', { name: 'Approve & run', exact: true }).scrollIntoViewIfNeeded(); await bounds(review().getByRole('button', { name: 'Approve & run', exact: true }));
   await page.getByRole('textbox', { name: 'Robot command', exact: true }).scrollIntoViewIfNeeded(); await bounds(page.getByRole('textbox', { name: 'Robot command', exact: true }));
   const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: innerWidth })); assert.ok(widths.document <= widths.viewport && widths.body <= widths.viewport); await inspectSelected('phone Review'); await screenshot('review-390'); await review().getByRole('button', { name: 'Discard plan', exact: true }).click(); return widths;
 });
 await check('Go Home copy describes navigation and custody without an invented release', async () => {
   await page.setViewportSize({ width: 1280, height: 720 }); await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
   await page.getByRole('textbox', { name: 'Mobile robot command', exact: true }).fill('Go Home'); await page.getByRole('button', { name: 'Send mobile command', exact: true }).click();
   const approve = page.getByRole('button', { name: 'Approve & run', exact: true }); if (await approve.isVisible()) await approve.click();
   await page.waitForFunction(() => document.querySelector('.mobile-evidence-ready') !== null, null, { timeout: 12000 });
   await page.getByRole('button', { name: 'Assistant', exact: true }).click();
   const copy = await page.locator('.mobile-message').last().innerText(); assert.match(copy, /navigation/i); assert.ok(!/object.*released|delivery.*verified/i.test(copy)); await screenshot('mobile-home'); return { copy };
 });
} finally {
 result.passed = result.checks.every(check => check.passed) && result.errors.length === 0 && result.blockedRequests.length === 0; result.finishedAt = new Date().toISOString();
 await writeFile(resolve(output, only?.length === 1 ? 'ui-acceptance-review-regression-results.json' : only ? 'ui-acceptance-followup-results.json' : 'ui-acceptance-results.json'), JSON.stringify(result, null, 2)); await context.close(); await browser.close();
}
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, errors: result.errors, findings: result.findings, mockSceneDrafts: result.mockSceneDrafts, blockedRequests: result.blockedRequests }, null, 2)); if (!result.passed) process.exitCode = 1;
