import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Separate fresh-context handoff of the EXACT record saved in the final voice
// rehearsal. No voice/model requests, no new evidence writes, no invented score.
const directory = resolve('.local/qa/final-workflow');
const raw = JSON.parse(await readFile(resolve(directory, 'saved-mobile-record.json'), 'utf8'));
const record = raw.record ?? raw;
const result = { schema: 'teachtrace.final-record-handoff.v1', startedAt: new Date().toISOString(),
  savedRecordId: record.id, sourceHash: record.evidence.integrity.digest,
  scope: 'Fresh browser API reopening/replay/export and independent native consumer of the exact voice-rehearsal record',
  paidRequests: 0, writes: 0, checks: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5189', viewport: { width: 1280, height: 720 }, acceptDownloads: true });
await context.route('**/api/**', async route => {
  if (route.request().method() === 'POST') { result.writes++; await route.abort('blockedbyclient'); return; }
  await route.continue();
});
const page = await context.newPage(); page.setDefaultTimeout(20000);
page.on('pageerror', error => result.errors.push(error.message));
try {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('button', { name: 'Saved recordings', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Saved mobile evidence', exact: true });
  await library.locator('article').filter({ hasText: record.id }).getByRole('button', { name: 'Open mobile recording', exact: true }).click();
  await library.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('textbox', { name: 'Mobile robot command', exact: true }).isDisabled(), true);
  const slider = page.getByRole('slider', { name: 'Seek saved mobile recording', exact: true });
  await slider.focus(); await slider.press('Home'); await page.waitForTimeout(300);
  const initial = await page.locator('.mobile-metrics').innerText();
  await slider.press('End'); await page.waitForTimeout(300);
  const final = await page.locator('.mobile-metrics').innerText();
  assert.notEqual(initial, final);
  result.checks.push({ name: 'Exact stored record opens read-only and actual replay clock/travel changes', passed: true });
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved mobile recording', exact: true }).click();
  const downloaded = await pending, exported = resolve(directory, 'mobile-evidence.json');
  await downloaded.saveAs(exported);
  assert.deepEqual(JSON.parse(await readFile(exported, 'utf8')), record.evidence);
  result.checks.push({ name: 'Reexport exactly preserves the voice-saved sealed evidence', passed: true });
  await page.screenshot({ path: resolve(directory, 'saved-record-replay.png') });
  await page.getByRole('button', { name: 'Return to live kitchen', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Mobile robot command', exact: true }).isEnabled(), true);
  result.checks.push({ name: 'Return to live restores command controls', passed: true });
  const output = resolve(directory, 'independent-consumer');
  execFileSync(process.execPath, [resolve('scripts/consume-evidence.mjs'), exported, '--out', output], { stdio: 'pipe' });
  result.consumer = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));
  result.checks.push({ name: 'Standalone Node-only SHA/FK consumer ingests the exact reexport', passed: true });
  assert.equal(result.writes, 0); assert.deepEqual(result.errors, []); result.passed = true;
} catch (error) { result.passed = false; result.failure = error.message; process.exitCode = 1; }
finally {
  await browser.close(); result.finishedAt = new Date().toISOString();
  await writeFile(resolve(directory, 'handoff-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ passed: result.passed, savedRecordId: result.savedRecordId, checks: result.checks, writes: result.writes, errors: result.errors, failure: result.failure }, null, 2));
}
