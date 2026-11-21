import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Real local UI/controller evidence. This harness never calls voice or a paid model.
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189';
const output = resolve('.local/qa/human-smoke-results.json');
const screenshotDirectory = resolve('docs/screenshots');
await Promise.all([mkdir(resolve('.local/qa'), { recursive: true }), mkdir(screenshotDirectory, { recursive: true })]);
const results = { schema: 'teachtrace.human-scenario-smoke.v1', startedAt: new Date().toISOString(), baseURL,
  scope: 'Explicit software human-presence scenario; no tracked human, contact dynamics or safety certification.',
  checks: [], errors: [], screenshots: [], paidVoiceCalls: 0, paidModelCalls: 0 };
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { localStorage.setItem('teachtrace.auto-simulation-approval', 'false'); });
const page = await context.newPage();
page.setDefaultTimeout(30000);
let stage = 'bootstrap';
page.on('pageerror', error => results.errors.push({ type: 'pageerror', stage, at: new Date().toISOString(), message: error.message }));
page.on('console', message => { if (message.type() === 'error') results.errors.push({ type: 'console', stage, at: new Date().toISOString(), message: message.text(), location: message.location() }); });
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  if (request.method() === 'POST' && path.startsWith('/api/voice/')) { results.paidVoiceCalls++; await route.abort(); return; }
  if (request.method() === 'POST' && /\/api\/(planner|scene)/.test(path)) { results.paidModelCalls++; await route.abort(); return; }
  await route.continue();
});

async function screenshot(name, canvasOnly = false) {
  const path = resolve(screenshotDirectory, `human-${name}.png`);
  if (canvasOnly) await page.locator('.viewport-canvas').screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
  results.screenshots.push(path);
}
async function check(name, work) {
  stage = name;
  const started = Date.now();
  try {
    const detail = await work();
    results.checks.push({ name, passed: true, elapsedMs: Date.now() - started, ...(detail ? { detail } : {}) });
    console.log(`PASS ${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`);
  } catch (error) {
    results.checks.push({ name, passed: false, elapsedMs: Date.now() - started, error: error.message });
    await screenshot(`failure-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`).catch(() => {});
    throw error;
  }
}
async function presence(label) {
  await page.getByRole('button', { name: 'Human activity scenario', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Human activity scenario', exact: true });
  await modal.getByRole('button', { name: label, exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
}
async function uiState() {
  return page.evaluate(() => ({
    clock: document.querySelector('.viewport-status-time')?.textContent?.trim(),
    tcp: [...document.querySelectorAll('.coordinate-fields strong')].map(item => item.textContent),
    gripper: [...document.querySelectorAll('.property-row')].find(item => item.textContent.includes('Gripper'))?.querySelector('strong')?.textContent,
    phase: document.querySelector('.sr-only[aria-live]')?.textContent?.trim(),
    mode: document.querySelector('.state-pill')?.textContent?.trim(),
    occupancy: document.querySelector('.viewport-status')?.textContent?.trim(),
  }));
}
async function expectHeldPause() {
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  const state = await uiState();
  assert.equal(state.mode, 'Paused');
  assert.equal(state.gripper, 'Closed');
  assert.match(state.phase, /^Human workspace scenario: awaiting clearance/);
  return state;
}
async function assertFrozen(first, duration = 1100) {
  await page.waitForTimeout(duration);
  const next = await uiState();
  assert.deepEqual({ clock: next.clock, tcp: next.tcp, gripper: next.gripper }, { clock: first.clock, tcp: first.tcp, gripper: first.gripper });
  assert.equal(next.mode, 'Paused');
  return next;
}
async function prepareAndApprove() {
  const input = page.getByRole('textbox', { name: 'Robot command', exact: true });
  await input.fill('Prepare repair kit'); await input.press('Enter');
  await page.getByRole('region', { name: 'Review simulated motion' }).getByRole('button', { name: 'Approve & run', exact: true }).click();
}
async function latestEpisode() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')[0] ?? null);
}
async function waitCompleted(before) {
  await page.waitForFunction(previous => {
    const episode = JSON.parse(localStorage.getItem('teachtrace.episodes.v1') || '[]')[0];
    return episode && episode.id !== previous && episode.outcome === 'completed' && episode.completedActions === 3;
  }, before, { timeout: 60000 });
  return latestEpisode();
}
function assertPlacements(episode) {
  assert.equal(episode.outcome, 'completed'); assert.equal(episode.completedActions, 3);
  const final = episode.samples.at(-1).world;
  assert.deepEqual(final.objects.map(object => [object.id, object.location]), [['part-red', 'tray-a'], ['part-blue', 'tray-b'], ['part-green', 'tray-a']]);
  assert.equal(final.robot.heldObjectId, null); assert.equal(final.robot.mode, 'idle');
}

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Robot command', exact: true }).waitFor();
  await page.locator('.new-environment-button').click();
  await page.getByRole('heading', { name: 'Repair workbench', exact: true }).locator('..').getByRole('button', { name: 'Load workplace' }).click();
  await page.getByRole('group', { name: 'Presentation layout' }).getByRole('button', { name: 'Studio', exact: true }).click();
  if (await page.locator('.studio').getAttribute('data-sidebar') === 'collapsed') await page.getByRole('button', { name: 'Toggle scene inspector', exact: true }).click();
  await page.getByRole('button', { name: 'TT-01 robot', exact: true }).click();
  await page.getByRole('combobox', { name: 'Simulation speed', exact: true }).selectOption('1');
  await page.locator('canvas').waitFor();

  let occupied, interruptedEpisode;
  await check('nearby person permits motion before occupied held-object pause', async () => {
    await presence('Person nearby');
    assert.match((await uiState()).occupancy, /HUMAN SCENARIO · NEARBY/);
    await prepareAndApprove();
    await page.waitForFunction(() => /^(Lifting part|Transferring part)/.test(document.querySelector('.sr-only[aria-live]')?.textContent || ''), null, { timeout: 25000 });
    const lifting = await uiState();
    assert.equal(lifting.gripper, 'Closed');
    assert.notEqual(lifting.clock, '00:00.0');
    await presence('Enter workspace');
    occupied = await expectHeldPause();
    await assertFrozen(occupied);
    await screenshot('occupied-workspace');
    await screenshot('occupied-canvas', true);
    return { duringMotion: lifting, occupied, frozenAcrossWallMs: 1100 };
  });

  await check('immersive mode keeps proxy and exit controls visible', async () => {
    await page.getByRole('button', { name: 'Simulation only', exact: true }).click();
    assert.equal(await page.locator('.studio').getAttribute('data-layout'), 'simulation');
    await page.getByRole('button', { name: 'Exit · Esc', exact: true }).waitFor({ state: 'visible' });
    await page.locator('.presentation-bar').getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    await screenshot('immersive-occupied');
    await page.getByRole('button', { name: 'Exit · Esc', exact: true }).click();
    assert.equal(await page.locator('.studio').getAttribute('data-layout'), 'studio');
    return { exitVisible: true, stopVisible: true, canvas: true };
  });

  await check('clearance requires explicit resume then records all three completed placements', async () => {
    const before = (await latestEpisode())?.id ?? null;
    await presence('Clear presence');
    const clearPaused = await assertFrozen(occupied);
    assert.match(clearPaused.occupancy, /LOCAL SIMULATION/);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    interruptedEpisode = await waitCompleted(before);
    assertPlacements(interruptedEpisode);
    const occupiedSamples = interruptedEpisode.samples.filter(sample => sample.world.humanPresence?.state === 'in-workspace');
    const heldPaused = occupiedSamples.find(sample => sample.world.robot.mode === 'paused' && sample.world.robot.heldObjectId === 'part-red');
    assert.ok(heldPaused, 'Recorder must retain the occupied/paused/held-object state.');
    const cleared = interruptedEpisode.samples.find(sample => sample.world.humanPresence?.state === 'clear' && sample.world.robot.mode === 'paused');
    assert.ok(cleared, 'Recorder must retain clearance without automatic resume.');
    assert.equal(cleared.time, heldPaused.time);
    assert.deepEqual(cleared.world.robot.position, heldPaused.world.robot.position);
    assert.equal(cleared.world.robot.gripperOpen, heldPaused.world.robot.gripperOpen);
    assert.deepEqual(cleared.world.objects, heldPaused.world.objects);
    assert.deepEqual(cleared.world.motion, heldPaused.world.motion);
    assert.ok(interruptedEpisode.events.some(event => event.kind === 'control' && /Human workspace scenario is occupied/.test(event.label)));
    assert.ok(interruptedEpisode.events.some(event => event.kind === 'control' && /Operator resumed/.test(event.label)));
    const verification = await page.evaluate(async episode => {
      const evidence = await import('/src/data/evidence.ts');
      return evidence.validateEvidencePackage(evidence.buildEvidencePackage(episode));
    }, interruptedEpisode);
    assert.deepEqual(verification, { valid: true, errors: [] });
    await screenshot('completed-after-resume');
    return { episodeId: interruptedEpisode.id, actions: interruptedEpisode.completedActions, samples: interruptedEpisode.samples.length,
      occupiedSamples: occupiedSamples.length, preservedHeldObject: heldPaused.world.robot.heldObjectId, pauseTime: heldPaused.time,
      controlEvents: interruptedEpisode.events.filter(event => event.kind === 'control').map(event => event.label), nativeEvidenceValid: true };
  });

  await check('occupied-before-start blocks at zero time until clear and resume', async () => {
    await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
    await page.getByRole('dialog', { name: 'Reset scene', exact: true }).getByRole('button', { name: 'Reset scene', exact: true }).click();
    const initial = await uiState();
    assert.equal(initial.clock, '00:00.0');
    const before = (await latestEpisode())?.id ?? null;
    await presence('Enter workspace');
    await prepareAndApprove();
    await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    const blocked = await uiState();
    assert.equal(blocked.mode, 'Paused'); assert.equal(blocked.clock, initial.clock);
    assert.deepEqual(blocked.tcp, initial.tcp); assert.equal(blocked.gripper, 'Open');
    await assertFrozen(blocked);
    await screenshot('preflight-block');
    await presence('Clear presence');
    await assertFrozen(blocked, 600);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    const episode = await waitCompleted(before); assertPlacements(episode);
    const zeroPause = episode.samples.find(sample => sample.time === 0 && sample.world.robot.mode === 'paused' && sample.world.humanPresence?.state === 'in-workspace');
    assert.ok(zeroPause); assert.equal(zeroPause.world.motion, null); assert.equal(zeroPause.world.robot.heldObjectId, null);
    assert.deepEqual(zeroPause.world.objects, episode.initialWorld.objects);
    return { zeroMovementVerified: true, requiredExplicitResume: true, completedActions: episode.completedActions, episodeId: episode.id };
  });

  assert.equal(results.paidVoiceCalls, 0); assert.equal(results.paidModelCalls, 0);
  assert.deepEqual(results.errors, [], 'Browser runtime must not emit console/page errors.');
} catch (error) {
  results.fatal = error.message; process.exitCode = 1; console.error(error.stack);
} finally {
  results.finishedAt = new Date().toISOString();
  await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
