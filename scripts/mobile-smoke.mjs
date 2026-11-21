import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Isolated UI acceptance of actual mobile controller behavior. No paid provider calls.
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189';
const output = resolve('.local/qa');
const visualsOnly = process.argv.includes('--visuals-only');
const resultName = visualsOnly ? 'mobile-visual-smoke-results.json' : 'mobile-smoke-results.json';
const screenshots = resolve('docs/screenshots');
await Promise.all([mkdir(output, { recursive: true }), mkdir(screenshots, { recursive: true })]);
const results = { schema: 'teachtrace.mobile-browser-smoke.v1', startedAt: new Date().toISOString(), checks: [], errors: [], apiMutations: [], screenshots: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(30000);
page.on('pageerror', error => results.errors.push(error.message));
page.on('request', request => {
  const path = new URL(request.url()).pathname;
  if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) results.apiMutations.push({ path, method: request.method() });
});
async function capture(name) {
  const path = resolve(screenshots, `mobile-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  results.screenshots.push(path);
}
async function check(name, work) {
  const started = Date.now();
  try {
    const detail = await work();
    results.checks.push({ name, passed: true, elapsedMs: Date.now() - started, detail });
    console.log(`PASS ${name} ${JSON.stringify(detail)}`);
  } catch (error) {
    results.checks.push({ name, passed: false, error: error.message });
    await capture(`failure-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`).catch(() => {});
    throw error;
  }
}
const mode = () => page.locator('.mobile-workspace > header .state-pill').innerText();
async function waitMode(value) { await page.waitForFunction(value => document.querySelector('.mobile-workspace > header .state-pill')?.textContent === value, value); }
async function command(text) {
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mobile robot command', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send mobile command', exact: true }).click();
}
async function prepare(text) {
  await command(text);
  const review = page.getByRole('region', { name: 'Review mobile motion', exact: true });
  await review.waitFor();
  const cancel = review.getByRole('button', { name: 'Cancel countdown', exact: true });
  if (await cancel.isVisible()) await cancel.click();
  await review.getByRole('checkbox', { name: 'Auto run reversible simulation after 3 seconds', exact: true }).uncheck();
  return review;
}
async function approve(text) {
  const review = await prepare(text);
  await review.getByRole('button', { name: 'Approve & run mobile task', exact: true }).click();
  return review;
}
async function exportWorld(filename) {
  await page.getByRole('button', { name: 'Task plan', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export mobile evaluation', exact: true }).click();
  const file = await pending;
  const path = resolve(output, filename);
  await file.saveAs(path);
  const envelope = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(envelope.payload.schema, 'teachtrace.mobile-evaluation.v1');
  assert.equal(envelope.integrity.algorithm, 'SHA-256');
  assert.equal(envelope.integrity.digest, createHash('sha256').update(JSON.stringify(envelope.payload)).digest('hex'));
  assert.ok(envelope.payload.trajectory.length > 0);
  const armCheck = await page.evaluate(async trajectory => {
    const { solveMobileArm } = await import('/src/sim/mobile-arm.ts');
    const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
    return trajectory.every(sample => {
      const expected = solveMobileArm(sample.world);
      return sample.arm && JSON.stringify(sample.arm) === JSON.stringify(expected)
        && sample.arm.angleUnit === 'radians' && sample.arm.basis === 'simulated-analytic-kinematics'
        && Object.values(sample.arm.jointAngles).every(Number.isFinite)
        && Math.abs(distance(sample.arm.joints.shoulder, sample.arm.joints.elbow) - 0.82) < 1e-8
        && Math.abs(distance(sample.arm.joints.elbow, sample.arm.joints.wrist) - 0.82) < 1e-8;
    });
  }, envelope.payload.trajectory);
  assert.equal(armCheck, true, 'Every exported arm pose must use the same finite analytic solver and link lengths as the renderer.');
  assert.equal(envelope.payload.provenance.humanRecording, false);
  assert.equal(envelope.payload.provenance.learnedPolicy, false);
  assert.equal(envelope.payload.provenance.physicalTransferValidated, false);
  return envelope.payload;
}
async function waitCarrying() {
  await page.waitForFunction(() => document.querySelectorAll('.mobile-step.done').length >= 3 && document.querySelector('.mobile-workspace > header .state-pill')?.textContent === 'running');
}
async function reset() {
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Approve reset', exact: true }).click();
  await waitMode('idle');
}
function cup(world) { return world.objects.find(object => object.id === 'cup'); }
function bowl(world) { return world.objects.find(object => object.id === 'bowl'); }

try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Mobile kitchen', exact: true }).click();
  await page.getByRole('heading', { name: 'Kitchen navigation lab', exact: true }).waitFor();
  await page.waitForFunction(() => { const canvas = document.querySelector('.mobile-viewport canvas'); return canvas && canvas.width > 100 && canvas.height > 100; });
  await page.getByRole('combobox', { name: 'Mobile simulation speed', exact: true }).selectOption('3');
  if (!visualsOnly) {
  await check('beyond-reach plan holds carried cup for human proxy and resumes to real delivery', async () => {
    const review = await prepare('Take cup from counter to sink');
    assert.ok((await review.innerText()).includes('beyond'));
    assert.equal(await review.locator('ol li').count(), 5);
    assert.equal(await mode(), 'idle', 'Preparing/cancelling must not start the base.');
    await capture('reach-review');
    await review.getByRole('button', { name: 'Approve & run mobile task', exact: true }).click();
    await waitCarrying();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await waitMode('paused');
    const manualHold = await page.locator('.mobile-metrics').innerText();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.mobile-metrics').innerText(), manualHold, 'Manual pause holds the simulator clock and base distance.');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.getByRole('button', { name: 'Human enters', exact: true }).click();
    await waitMode('paused');
    const occupied = await exportWorld('mobile-occupied.json');
    assert.equal(occupied.finalWorld.robot.cargoObjectId, 'cup');
    assert.equal(cup(occupied.finalWorld).station, 'robot');
    assert.ok(occupied.finalWorld.human);
    await capture('occupied-with-cargo');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    assert.equal(await mode(), 'paused', 'Occupied scenario must refuse resume.');
    await page.waitForTimeout(500);
    const still = await exportWorld('mobile-still-occupied.json');
    assert.equal(still.finalWorld.simTime, occupied.finalWorld.simTime);
    assert.deepEqual(still.finalWorld.robot.position, occupied.finalWorld.robot.position);
    assert.deepEqual(still.finalWorld.objects, occupied.finalWorld.objects);
    await page.getByRole('button', { name: 'Clear human', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await mode(), 'paused', 'Clearance must not automatically resume.');
    const cleared = await exportWorld('mobile-cleared.json');
    assert.equal(cleared.finalWorld.simTime, occupied.finalWorld.simTime);
    assert.deepEqual(cleared.finalWorld.objects, occupied.finalWorld.objects);
    assert.equal(cleared.finalWorld.human, null);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await waitMode('idle');
    const completed = await exportWorld('mobile-delivery.json');
    assert.equal(completed.receipt.status, 'succeeded');
    assert.equal(completed.receipt.verified, true);
    assert.ok(completed.checks.every(item => item.passed));
    assert.equal(cup(completed.finalWorld).station, 'sink');
    assert.equal(cup(completed.finalWorld).status, 'delivered');
    assert.equal(completed.finalWorld.robot.cargoObjectId, null);
    assert.deepEqual(bowl(completed.initialWorld), bowl(completed.finalWorld));
    assert.ok(completed.finalWorld.distanceTravelled >= 9.9);
    assert.ok(completed.finalWorld.events.some(event => event.kind === 'reach-check'));
    assert.ok(completed.trajectory.some(sample => sample.world.robot.cargoObjectId === 'cup' && sample.world.human));
    await capture('delivery-verified');
    return { distanceTravelled: completed.finalWorld.distanceTravelled, samples: completed.trajectory.length, cup: 'sink', holdAndExplicitResume: true, integrityVerified: true };
  });

  await check('fixed-base ablation and mobile delivery use one identical scene and target', async () => {
    await page.getByRole('button', { name: 'Task plan', exact: true }).click();
    const before = await page.locator('.mobile-metrics').innerText();
    await page.getByRole('button', { name: 'Compare fixed vs mobile reach', exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export reach comparison', exact: true }).click();
    const file = await pending;
    const path = resolve(output, 'mobile-comparison-ui.json');
    await file.saveAs(path);
    const comparison = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(comparison.schema, 'teachtrace.mobile-comparison.v1');
    assert.deepEqual(comparison.fixedBase.initialWorld, comparison.mobileBase.initialWorld);
    assert.deepEqual(comparison.initialWorld, comparison.mobileBase.initialWorld);
    assert.equal(comparison.fixedBase.capabilities.armReach, comparison.mobileBase.capabilities.armReach);
    assert.equal(comparison.fixedBase.taskAccepted, false);
    assert.equal(comparison.fixedBase.completedPlacements, 0);
    assert.equal(comparison.fixedBase.distanceTravelled, 0);
    assert.ok(comparison.fixedBase.error.includes('beyond arm reach'));
    assert.equal(comparison.mobileBase.taskAccepted, true);
    assert.equal(comparison.mobileBase.completedPickups, 1);
    assert.equal(comparison.mobileBase.completedPlacements, 1);
    assert.ok(comparison.mobileBase.distanceTravelled >= 9.9);
    assert.ok(comparison.mobileBase.steps.some(step => step.kind === 'navigate'));
    assert.ok(comparison.fixedBase.steps.every(step => step.kind !== 'navigate'));
    assert.equal(await page.locator('.mobile-metrics').innerText(), before, 'Headless comparison must not mutate the live mobile scene.');
    await capture('same-scene-comparison');
    return { fixedBaseAccepted: false, mobileBaseAccepted: true, sameArmReach: true, sameFrozenScene: true };
  });

  await check('navigation detours around furniture and unsupported commands preserve the result', async () => {
    const review = await prepare('Navigate to the table');
    await review.getByRole('button', { name: 'Approve & run mobile task', exact: true }).click();
    await waitMode('idle');
    const arrived = await exportWorld('mobile-table-route.json');
    assert.ok(arrived.checks.every(item => item.passed));
    const route = arrived.finalWorld.mission.plan.steps.find(step => step.kind === 'navigate').path;
    assert.ok(route.length > 2, 'A furniture detour should contain intermediate waypoints.');
    const validation = await page.evaluate(async payload => {
      const mobile = await import('/src/sim/mobile-navigation.ts');
      return payload.route.slice(1).every((point, index) => mobile.mobileSegmentIsClear(payload.world, payload.route[index], point));
    }, { world: arrived.initialWorld, route });
    assert.equal(validation, true);
    await command('Take fork to sink');
    await page.getByText('Use one known object at a time and one named station, for example “Take cup from counter to sink”.', { exact: true }).waitFor();
    const after = await exportWorld('mobile-after-invalid.json');
    assert.deepEqual(after.finalWorld.robot.position, arrived.finalWorld.robot.position);
    assert.deepEqual(after.finalWorld.objects, arrived.finalWorld.objects);
    return { collisionCheckedSegments: route.length - 1, unknownObjectMovedNothing: true };
  });

  await check('explicit reset and stop retain cargo until a fresh recovery plan', async () => {
    const before = await page.locator('.mobile-metrics').innerText();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForTimeout(3300);
    assert.equal(await page.locator('.mobile-metrics').innerText(), before, 'Reset must not inherit automatic-motion approval.');
    await page.getByRole('button', { name: 'Cancel reset', exact: true }).click();
    assert.equal(await page.locator('.mobile-metrics').innerText(), before);
    await reset();
    assert.ok((await page.locator('.mobile-metrics').innerText()).includes('0.00 m'));
    await page.getByRole('button', { name: 'Human enters', exact: true }).click();
    const occupiedReview = await prepare('Take cup from counter to sink');
    await occupiedReview.getByRole('checkbox', { name: 'Auto run reversible simulation after 3 seconds', exact: true }).check();
    await waitMode('paused');
    const initiallyOccupied = await exportWorld('mobile-initially-occupied.json');
    assert.equal(initiallyOccupied.finalWorld.simTime, 0);
    assert.equal(initiallyOccupied.finalWorld.distanceTravelled, 0);
    assert.equal(initiallyOccupied.finalWorld.robot.cargoObjectId, null);
    assert.deepEqual(initiallyOccupied.finalWorld.objects, initiallyOccupied.initialWorld.objects);
    await page.getByRole('button', { name: 'Clear human', exact: true }).click();
    await page.waitForTimeout(250);
    assert.equal(await mode(), 'paused', 'Initially occupied clearance cannot resume implicitly.');
    await reset(); // Explicitly discard this interrupted test before the stop/recovery task.
    await approve('Bring bowl to table');
    await waitCarrying();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await waitMode('stopped');
    const stopped = await exportWorld('mobile-stopped-cargo.json');
    assert.equal(stopped.receipt.status, 'cancelled');
    assert.equal(stopped.receipt.verified, false);
    assert.equal(stopped.finalWorld.robot.cargoObjectId, 'bowl');
    assert.equal(bowl(stopped.finalWorld).station, 'robot');
    await command('Resume');
    assert.equal(await mode(), 'stopped');
    const review = await prepare('Bring bowl to table');
    assert.equal(await review.locator('ol li').count(), 2, 'Recovery uses retained cargo: navigate and place, no duplicate pickup.');
    await review.getByRole('button', { name: 'Approve & run mobile task', exact: true }).click();
    await waitMode('idle');
    const recovered = await exportWorld('mobile-recovered.json');
    assert.equal(recovered.receipt.verified, true);
    assert.ok(recovered.checks.every(item => item.passed));
    assert.equal(bowl(recovered.finalWorld).station, 'table');
    assert.equal(recovered.finalWorld.robot.cargoObjectId, null);
    return { resetStayedExplicit: true, stoppedCargoRetained: true, recoverySteps: 2, bowl: 'table' };
  });

  }
  await check('mobile camera immersive exit and responsive controls remain reachable', async () => {
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    await page.waitForTimeout(500);
    const orbitCanvas = await page.locator('.mobile-viewport canvas').screenshot();
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    await page.waitForTimeout(500);
    const topCanvas = await page.locator('.mobile-viewport canvas').screenshot();
    assert.notEqual(createHash('sha256').update(orbitCanvas).digest('hex'), createHash('sha256').update(topCanvas).digest('hex'), 'Camera controls must change the actual rendered canvas, not just button state.');
    await page.waitForTimeout(350);
    await capture('top-map');
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    await page.getByRole('button', { name: 'Simulation only', exact: true }).click();
    assert.equal(await page.locator('.mobile-copilot').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Stop', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.mobile-copilot').isVisible(), true);
    const responsive = [];
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.document <= dimensions.client + 1 && dimensions.body <= dimensions.client + 1, `Horizontal mobile overflow: ${JSON.stringify({ viewport, dimensions })}`);
      assert.ok(await page.getByRole('button', { name: 'Stop', exact: true }).isVisible());
      responsive.push({ ...viewport, ...dimensions });
      const input = page.getByRole('textbox', { name: 'Mobile robot command', exact: true });
      await input.scrollIntoViewIfNeeded();
      const reachable = await input.evaluate(element => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return box.top >= 0 && box.bottom <= innerHeight && hit === element;
      });
      assert.equal(reachable, true, 'Mobile command input must be scroll-reachable and unobscured.');
      await capture(`${viewport.width}x${viewport.height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Workcell', exact: true }).click();
    await page.getByRole('textbox', { name: 'Robot command', exact: true }).waitFor();
    return { responsive, immersiveExitWorked: true, returnedToWorkcell: true };
  });
  assert.deepEqual(results.apiMutations, [], 'Mobile smoke must make no paid calls or API record writes.');
  assert.deepEqual(results.errors, [], 'No uncaught browser errors.');
} catch (error) {
  results.failure = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  results.finishedAt = new Date().toISOString(); results.passed = !results.failure;
  await writeFile(resolve(output, resultName), JSON.stringify(results, null, 2));
  console.log(`Results: ${resolve(output, resultName)}`);
  await context.close(); await browser.close();
}
