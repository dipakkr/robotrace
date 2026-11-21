import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// UI lineage acceptance only: generation responses are explicit fixtures, never a model score.
const directory = resolve('.local/qa'); await mkdir(directory, { recursive: true });
const results = { schema: 'teachtrace.reference-provenance-smoke.v1', scope: 'Mocked scene generator; actual UI resizing, hashing, approval, controller recording and native export.', startedAt: new Date().toISOString(), checks: [], requests: [], errors: [] };
const videoPath = resolve(directory, 'reference-synthetic.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=steelblue:s=320x240:d=1', '-vf', 'drawbox=x=80:y=60:w=60:h=100:color=orange:t=fill', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', videoPath]);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.addInitScript(() => { localStorage.setItem('teachtrace.auto-simulation-approval', 'false'); });
const page = await context.newPage(); page.setDefaultTimeout(30000);
page.on('pageerror', error => results.errors.push(error.message));
await context.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  if (req.method() === 'POST' && path === '/api/scenes/draft') {
    const body = req.postDataJSON(), bytes = Buffer.from(body.referenceImage.split(',')[1], 'base64');
    results.requests.push({ path, fixture: true, sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ model: 'mocked-lineage-fixture', requestDurationMs: 0, source: 'ui-test-fixture', spec: { version: 1, title: `Reference lineage ${results.requests.length}`, baseEnvironmentId: 'kitchen', instruction: 'Move Cup to Serving tray', objects: [{ id: 'cup', label: 'Cup', asset: 'cup', color: 'blue', slot: 0 }, { id: 'bowl', label: 'Bowl', asset: 'bowl', color: 'green', slot: 3 }], assignments: [{ objectId: 'cup', destination: 'tray-a', unchanged: false }, { objectId: 'bowl', destination: 'table', unchanged: true }] } }) }); return;
  }
  if (req.method() === 'POST') { await route.abort('blockedbyclient'); return; }
  await route.continue();
});
const studio = () => page.getByRole('dialog', { name: 'Environment studio', exact: true });
async function open() { await page.locator('.new-environment-button').click(); await studio().getByRole('button', { name: 'AI scene + reference', exact: true }).click(); }
async function photo(color) {
  const data = await page.evaluate(color => { const canvas = document.createElement('canvas'); canvas.width = 420; canvas.height = 300; const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0,0,420,300); ctx.fillStyle = '#fff'; ctx.fillRect(80,70,40,80); return canvas.toDataURL('image/png'); }, color);
  return { name: `synthetic-${color.replace('#','')}.png`, mimeType: 'image/png', buffer: Buffer.from(data.split(',')[1], 'base64') };
}
async function recordAndExport(kind, frameTimeSeconds) {
  const expected = results.requests.at(-1).sha256;
  await studio().getByRole('button', { name: 'Approve & apply AI scene', exact: true }).click();
  await page.getByRole('combobox', { name: 'Simulation speed', exact: true }).selectOption('3');
  await page.getByRole('textbox', { name: 'Robot command', exact: true }).fill('Move Cup to Serving tray');
  await page.getByRole('button', { name: 'Send command', exact: true }).click();
  await page.getByRole('button', { name: 'Approve & run', exact: true }).click();
  await page.waitForFunction(expected => { const item=JSON.parse(localStorage.getItem('teachtrace.episodes.v1')||'[]')[0]; return item?.outcome === 'completed' && item.initialWorld.sceneProvenance?.reference?.sha256 === expected; }, expected);
  const episode = await page.evaluate(() => JSON.parse(localStorage.getItem('teachtrace.episodes.v1'))[0]);
  const metadata = episode.initialWorld.sceneProvenance.reference;
  assert.deepEqual(metadata, { kind, sha256: expected, ...(frameTimeSeconds !== undefined ? { frameTimeSeconds } : {}), calibrated: false, rightsVerified: false, basis: 'submitted-reference-frame' });
  assert.ok(episode.samples.every(sample => JSON.stringify(sample.world.sceneProvenance.reference) === JSON.stringify(metadata)));
  assert.ok(!JSON.stringify(episode).includes('data:image/')); assert.ok(!JSON.stringify(episode).includes('synthetic-'));
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export evidence package', exact: true }).click();
  const file = await pending, path = resolve(directory, `reference-${kind}.teachtrace.json`); await file.saveAs(path);
  const native = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(native.scene.initialWorld.sceneProvenance.reference, metadata);
  assert.deepEqual(native.episode.initialWorld.sceneProvenance.reference, metadata);
  const validation = await page.evaluate(async native => { const { validateEvidencePackage } = await import('/src/data/evidence.ts'); return validateEvidencePackage(native); }, native);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  return { kind, sha256: expected, frameTimeSeconds, samples: episode.samples.length, completedActions: episode.completedActions, sealedNativeValid: validation.valid };
}
async function check(name, run) { try { const detail = await run(); results.checks.push({ name, passed: true, detail }); console.log(`PASS ${name} ${JSON.stringify(detail)}`); } catch(error) { results.checks.push({ name, passed: false, error: error.message }); throw error; } }
try {
  await page.goto(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5189/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('group', { name: 'Presentation layout', exact: true }).getByRole('button', { name: 'Copilot', exact: true }).click();
  await open();
  await check('photo hashes exact submitted resized JPEG and survives real recording and native export', async () => {
    await studio().getByLabel('Scene reference file', { exact: true }).setInputFiles(await photo('#446688'));
    await studio().getByRole('button', { name: 'Generate with reference frame', exact: true }).click();
    await studio().getByText(/Reference SHA-256/).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const preview = await studio().locator('.scene-generated-preview').boundingBox();
    const rendered = await studio().locator('.scene-generated-preview canvas').boundingBox();
    assert.ok(preview && rendered && Math.abs(preview.width-rendered.width)<2 && Math.abs(preview.height-rendered.height)<2 && Math.abs(preview.x-rendered.x)<2 && Math.abs(preview.y-rendered.y)<2, 'Generated preview must remain inside its comparison cell.');
    await page.screenshot({ path: resolve(directory, 'reference-photo-comparison.png'), fullPage: true });
    return recordAndExport('image');
  });
  await open();
  await check('loading video immediately removes old draft and selected frame retains exact time and JPEG hash', async () => {
    await studio().getByLabel('Scene reference file', { exact: true }).setInputFiles(videoPath);
    assert.equal(await studio().getByRole('button', { name: 'Approve & apply AI scene', exact: true }).count(), 0);
    assert.equal(await studio().getByRole('button', { name: 'Generate AI scene draft', exact: true }).isDisabled(), true);
    const clip = studio().locator('video');
    await clip.evaluate(async element => { if(element.readyState<1) await new Promise(resolve=>element.addEventListener('loadedmetadata',resolve,{once:true})); element.currentTime=.4; if(element.seeking) await new Promise(resolve=>element.addEventListener('seeked',resolve,{once:true})); });
    const time = await clip.evaluate(element => element.currentTime);
    await studio().getByRole('button', { name: 'Use this frame', exact: true }).click();
    await studio().getByRole('button', { name: 'Generate with reference frame', exact: true }).click();
    await studio().getByText(/Reference SHA-256/).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const preview = await studio().locator('.scene-generated-preview').boundingBox();
    const rendered = await studio().locator('.scene-generated-preview canvas').boundingBox();
    assert.ok(preview && rendered && Math.abs(preview.width-rendered.width)<2 && Math.abs(preview.height-rendered.height)<2 && Math.abs(preview.x-rendered.x)<2 && Math.abs(preview.y-rendered.y)<2, 'Generated preview must remain inside its comparison cell.');
    await page.screenshot({ path: resolve(directory, 'reference-video-comparison.png'), fullPage: true });
    return recordAndExport('selected-video-frame', time);
  });
  await open();
  await check('reference changed while hashing cancels stale generation before any API request', async () => {
    await studio().getByLabel('Scene reference file', { exact: true }).setInputFiles(await photo('#885544'));
    await page.evaluate(() => { const original=crypto.subtle.digest.bind(crypto.subtle); window.__holdReferenceHash=true; crypto.subtle.digest=(algorithm,data)=>window.__holdReferenceHash?new Promise(resolve=>{window.__releaseReferenceHash=()=>original(algorithm,data).then(resolve);}):original(algorithm,data); });
    await studio().getByRole('button', { name: 'Generate with reference frame', exact: true }).click();
    await page.waitForFunction(()=>typeof window.__releaseReferenceHash==='function');
    await studio().getByLabel('Scene reference file', { exact: true }).setInputFiles(await photo('#448855'));
    await page.evaluate(()=>{window.__holdReferenceHash=false;window.__releaseReferenceHash();});
    await studio().getByRole('button', { name: 'Generate with reference frame', exact: true }).waitFor();
    await page.waitForTimeout(200);
    assert.equal(results.requests.length,2);
    assert.equal(await studio().getByRole('button', { name: 'Approve & apply AI scene', exact: true }).count(),0);
    return { fixtureRequests:2, staleRequestSent:false };
  });
  await check('oversized source rejected locally before generation', async()=>{
    await studio().getByLabel('Scene reference file',{exact:true}).evaluate(element=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(50*1024*1024+1)],'oversized.png',{type:'image/png'}));element.files=transfer.files;element.dispatchEvent(new Event('change',{bubbles:true}));});
    await studio().getByRole('alert').filter({hasText:'at most 50 MiB'}).waitFor(); assert.equal(results.requests.length,2); return { maxMiB:50, rejectedBeforeAPI:true };
  });
  assert.deepEqual(results.errors,[]); results.passed=true;
} catch(error) { results.passed=false;results.failure=error.message;process.exitCode=1;await page.screenshot({path:resolve(directory,'reference-provenance-failure.png'),fullPage:true}).catch(()=>{}); }
finally { results.finishedAt=new Date().toISOString();await writeFile(resolve(directory,'reference-provenance-results.json'),JSON.stringify(results,null,2));await browser.close(); }
