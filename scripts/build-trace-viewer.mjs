import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Serialized into a standalone HTML artifact. All data-dependent labels use
// textContent; source labels never become HTML, scripts, URLs or event handlers.
function bootTraceViewer() {
  const ui = id => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  let report = null, source = null, runIndex = 0, objectId = '', pointIndex = 0, generation = 0;
  const text = (id, value) => { ui(id).textContent = String(value); };
  const meters = value => Number(value).toPrecision(5) + ' m';
  const seconds = value => Number(value).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + ' s';
  const node = (tag, content, parent) => { const element = document.createElement(tag); element.textContent = content; if (parent) parent.append(element); return element; };
  const svg = (tag, attributes, parent, label) => { const element = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value)); if (label !== undefined) element.textContent = label; parent.append(element); return element; };
  const download = (name, contents, type) => { const url = URL.createObjectURL(new Blob([contents], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  function selected() { const run = report.runs[runIndex]; return { run, item: run.protectedObjects.find(item => item.id === objectId) ?? run.protectedObjects[0] }; }
  function renderPoint() {
    const { item } = selected(); if (!item) return;
    const point = item.points[pointIndex];
    ui('sample').value = pointIndex;
    text('point-number', (pointIndex + 1) + ' / ' + item.points.length);
    text('point-time', seconds(point.timeSeconds));
    text('point-position', point.positionMeters.map(value => value.toFixed(6)).join(', ') + ' m');
    text('point-displacement', meters(point.displacementMeters));
    text('point-state', point.violated ? 'Protected record changed: ' + point.changedFields.join(', ') : 'Matches initial protected record');
    text('point-action', 'Recorded step ' + (point.stepIndex === null ? 'unknown' : point.stepIndex + 1) + ' · ' + point.station + ' · ' + point.status);
    const indicator = ui('selected-line'); if (indicator) { indicator.setAttribute('x1', 64 + point.timeSeconds / Number(ui('plot').dataset.maxTime) * 816); indicator.setAttribute('x2', indicator.getAttribute('x1')); }
  }
  function renderChart() {
    const { run, item } = selected();
    const chart = ui('plot'); chart.replaceChildren();
    if (!item) { text('explanation', 'This record has no unrequested objects to analyze.'); return; }
    const overlays = report.pair ? report.runs.map(value => ({ run: value, item: value.protectedObjects.find(other => other.id === item.id) })).filter(value => value.item) : [{ run, item }];
    const maxTime = Math.max(0.001, ...overlays.map(value => value.item.points.at(-1).timeSeconds));
    const maxY = Math.max(0.01, ...overlays.map(value => value.item.peakDisplacementMeters)) * 1.12;
    chart.dataset.maxTime = maxTime;
    const x = time => 64 + time / maxTime * 816, y = distance => 294 - distance / maxY * 248;
    for (let tick = 0; tick <= 4; tick++) {
      const value = maxY * tick / 4;
      svg('line', { x1: 64, x2: 880, y1: y(value), y2: y(value), stroke: '#303332' }, chart);
      svg('text', { x: 56, y: y(value) + 4, 'text-anchor': 'end', fill: '#a7aba8', 'font-size': 11 }, chart, value.toFixed(2));
      svg('text', { x: x(maxTime * tick / 4), y: 318, 'text-anchor': 'middle', fill: '#a7aba8', 'font-size': 11 }, chart, (maxTime * tick / 4).toFixed(1));
    }
    svg('line', { x1: 64, x2: 880, y1: y(0), y2: y(0), stroke: '#c3b378', 'stroke-dasharray': '6 5' }, chart);
    svg('text', { x: 70, y: y(0) - 8, fill: '#c3b378', 'font-size': 11 }, chart, 'Allowed displacement: 0 m · strict simulator policy');
    for (const overlay of overlays) {
      const color = overlay.item.independentlyPassed ? '#9abea4' : '#efa467';
      svg('path', { d: overlay.item.points.map((point, index) => (index ? 'L' : 'M') + x(point.timeSeconds) + ' ' + y(point.displacementMeters)).join(' '), stroke: color, 'stroke-width': overlay.run.id === run.id ? 3 : 2, fill: 'none', opacity: overlay.run.id === run.id ? 1 : 0.65 }, chart);
    }
    const first = item.firstRecordViolation;
    if (first) {
      svg('circle', { cx: x(first.timeSeconds), cy: y(first.displacementMeters), r: 6, fill: '#efa467', stroke: '#111312', 'stroke-width': 2 }, chart);
      svg('text', { x: Math.min(720, x(first.timeSeconds) + 10), y: Math.max(30, y(first.displacementMeters) - 15), fill: '#efa467', 'font-size': 12 }, chart, 'First record violation');
    }
    svg('line', { id: 'selected-line', x1: 64, x2: 64, y1: 35, y2: 294, stroke: '#f4f0e9', 'stroke-dasharray': '3 5', opacity: 0.65 }, chart);
    svg('text', { x: 470, y: 345, fill: '#a7aba8', 'font-size': 12, 'text-anchor': 'middle' }, chart, 'Elapsed simulated seconds');
    svg('text', { x: 64, y: 20, fill: '#a7aba8', 'font-size': 12 }, chart, 'Displacement from initial XYZ position (m)');
    text('plot-run', run.label + ' · ' + run.id);
    text('initial-position', item.initialPositionMeters.map(value => value.toFixed(6)).join(', ') + ' m');
    text('peak', meters(item.peakDisplacementMeters)); text('final-displacement', meters(item.finalDisplacementMeters));
    text('final-restored', item.finalRecordRestored ? 'Exact final record restored' : 'Final record differs');
    text('first-record', first ? seconds(first.timeSeconds) + ' · ' + first.changedFields.join(', ') : 'No recorded violation');
    text('first-position', item.firstPositionViolation ? seconds(item.firstPositionViolation.timeSeconds) : 'No recorded position change');
    text('independent-verdict', item.independentlyPassed ? 'Protected-object history passed' : 'Protected-object history failed');
    text('explanation', first ? (item.finalRecordRestored ? 'The object ends in its exact original state, but an earlier recorded change violates the protected-object rule. ' : 'The recorded object history violates the protected-object rule. ') + (first.displacementMeters === 0 ? 'The first violation is a record/status change at zero displacement; visible movement starts later.' : 'The first recorded violation includes measurable displacement.') : 'Every sampled protected-object record matches its initial state. Unsampled events cannot be inferred.');
    text('sampling', item.firstNativeViolationRecorded ? 'Exact first native violation is explicitly recorded in this export.' : 'First recorded violation only; this older trace does not carry an explicit first-native marker.');
    ui('sample').max = item.points.length - 1; pointIndex = first?.sampleIndex ?? 0;
    ui('jump-violation').disabled = !first;
    renderPoint();
    chart.onclick = event => {
      const box = chart.getBoundingClientRect(), time = Math.max(0, Math.min(maxTime, ((event.clientX - box.left) / box.width * 920 - 64) / 816 * maxTime));
      pointIndex = item.points.reduce((best, point, index) => Math.abs(point.timeSeconds - time) < Math.abs(item.points[best].timeSeconds - time) ? index : best, 0); renderPoint();
    };
  }
  function render() {
    ui('analysis').hidden = false;
    text('package-id', report.pair?.id ?? report.runs[0].id);
    text('fingerprint', report.pair?.initialSceneSha256 ?? report.inputDigestSha256 ?? 'Unsealed source report');
    text('source-status', report.integrityVerified ? 'SHA-256 content integrity verified' : 'Unsealed recorded source · authorship unverified');
    text('conditions', report.pair ? 'Matched initial scene, goal and external intervention schedule · seed ' + report.pair.seed : 'Single record/report analysis · no matched-comparison claim');
    text('instruction', report.pair?.instruction ?? 'Deliver ' + report.runs[0].goal.objectId + ' to ' + report.runs[0].goal.stationId + '; preserve unrequested objects.');
    ui('run').replaceChildren(); ui('results').replaceChildren();
    report.runs.forEach((run, index) => {
      const option = node('option', run.label + ' · ' + run.id.slice(0, 8), ui('run')); option.value = index;
      const row = node('tr', '', ui('results'));
      for (const value of [run.label, run.id, run.reportedControllerOutcome, run.reportedTaskAccepted === null ? 'Not recomputed' : run.reportedTaskAccepted ? 'Accepted' : 'Rejected', run.protectedObjectsPassed ? 'Passed' : 'Failed']) node('td', value, row);
    });
    runIndex = Math.max(0, report.runs.findIndex(run => !run.protectedObjectsPassed)); ui('run').value = runIndex;
    renderObjectPicker();
    text('preference', report.preference ? 'Unreviewed preference candidate: choose ' + report.preference.chosenRunId + ' over ' + report.preference.rejectedRunId + '. ' + report.preference.reason : 'No candidate preference exported.');
  }
  function renderObjectPicker() {
    const run = report.runs[runIndex]; ui('object').replaceChildren();
    run.protectedObjects.forEach(item => { const option = node('option', item.label, ui('object')); option.value = item.id; });
    objectId = run.protectedObjects[0]?.id; renderChart();
  }
  async function load(input) {
    const own = ++generation; report = null; source = null; ui('analysis').hidden = true; text('error', ''); text('load-status', 'Checking recorded trace…');
    try { const analyzed = await analyzeProtectedInput(input); if (own !== generation) return; report = analyzed; source = input; render(); text('load-status', 'Independent analysis complete · no API, model or simulator connection'); }
    catch (error) { if (own === generation) { text('error', error.message); text('load-status', 'File rejected; no previous verdict retained'); } }
  }
  async function open(file) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { generation++; report = null; source = null; ui('analysis').hidden = true; text('error', 'Maximum supported file size is 50 MiB.'); return; }
    try { await load(JSON.parse(await file.text())); } catch { generation++; ui('analysis').hidden = true; report = null; source = null; text('error', 'This file is not valid trace JSON.'); }
  }
  ui('file').onchange = event => void open(event.target.files[0]);
  ui('drop').ondragover = event => { event.preventDefault(); };
  ui('drop').ondrop = event => { event.preventDefault(); void open(event.dataTransfer.files[0]); };
  ui('run').onchange = () => { runIndex = Number(ui('run').value); renderObjectPicker(); };
  ui('object').onchange = () => { objectId = ui('object').value; renderChart(); };
  ui('sample').oninput = () => { pointIndex = Number(ui('sample').value); renderPoint(); };
  ui('jump-violation').onclick = () => { pointIndex = selected().item.firstRecordViolation.sampleIndex; renderPoint(); };
  ui('focus-analysis').onclick = () => {
    const focused = document.body.toggleAttribute('data-focus-analysis');
    ui('focus-analysis').textContent = focused ? 'Show full report' : 'Presentation view';
    window.scrollTo(0, 0);
  };
  ui('download-json').onclick = () => { if (report) download('teachtrace-protected-analysis.json', JSON.stringify(report, null, 2), 'application/json'); };
  ui('download-html').onclick = () => {
    if (!source) return;
    const copy = document.documentElement.cloneNode(true);
    copy.querySelector('#initial-data').textContent = JSON.stringify(source).replace(/</g, '\\u003c');
    download('teachtrace-independent-report.html', '<!doctype html>\n' + copy.outerHTML, 'text/html');
  };
  const initial = ui('initial-data').textContent.trim(); if (initial) { try { void load(JSON.parse(initial)); } catch { text('error', 'Embedded trace JSON is invalid.'); } }
}

export async function renderTraceViewer(input = null) {
  const strip = code => code.replace(/^import[^\n]*\n/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const)\b)/g, '');
  const policy = strip(await readFile(resolve(project, 'src/data/mobile-protected-policy.mjs'), 'utf8'));
  const core = strip(await readFile(resolve(project, 'scripts/protected-analysis-core.mjs'), 'utf8'));
  const initial = input === null ? '' : JSON.stringify(input).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RoboTrace · Independent trace analysis</title><style>
*{box-sizing:border-box}body{margin:0;background:#111312;color:#e8ebe7;font:14px/1.55 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px 24px}header{display:flex;justify-content:space-between;gap:20px;align-items:center}h1{font-size:25px;letter-spacing:-.7px;margin:5px 0}h2{font-size:18px;margin:0 0 12px}p{color:#a7aba8}.eyebrow,small{font:11px ui-monospace,monospace;color:#a7aba8;letter-spacing:.6px}button,.file-button{border:1px solid #3b403c;background:#242925;color:#e8ebe7;border-radius:18px;padding:8px 14px;font:inherit;font-size:12px;cursor:pointer;display:inline-block}button:disabled{opacity:.4;cursor:default}.file-button{background:#dfa06e;color:#161916;border-color:#dfa06e}input[type=file]{position:absolute;width:1px;height:1px;opacity:0}input[type=file]:focus+.file-button{outline:2px solid white}#drop{margin:24px 0;padding:20px;background:#1a1e1b;border:1px dashed #454c46;border-radius:12px}#error{color:#f1a68e;overflow-wrap:anywhere}#load-status{font-size:12px;margin:12px 0 0}.panel{margin:22px 0;padding:22px;background:#191d1a;border-radius:12px}.facts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.facts div{min-width:0}.facts strong,.facts code{display:block;font:12px ui-monospace,monospace;overflow-wrap:anywhere;margin-top:4px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:10px;text-align:left;border-bottom:1px solid #333a34;vertical-align:top}th{color:#a7aba8;font-weight:400}td:nth-child(2){font:11px ui-monospace,monospace;overflow-wrap:anywhere;max-width:250px}.toolbar{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:18px}label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#a7aba8}select{background:#242925;color:#e8ebe7;border:1px solid #41483f;border-radius:8px;padding:8px;max-width:400px}svg{width:100%;height:auto;display:block;touch-action:manipulation;cursor:crosshair}#sample{width:100%;accent-color:#dfa06e}#independent-verdict{color:#efa467}.selected-point{background:#202721;border-radius:10px;padding:18px;margin-top:16px}#explanation{max-width:900px}footer{font-size:12px;color:#a7aba8;margin:25px 0}#preference{overflow-wrap:anywhere}#plot-run{display:block;overflow-wrap:anywhere;margin:8px 0}.actions{display:flex;gap:10px;flex-wrap:wrap}.legend{display:flex;gap:20px;font-size:12px}.legend span:first-child{color:#9abea4}.legend span:last-child{color:#efa467}[hidden]{display:none!important}@media(max-width:650px){main{padding:18px 12px}header{align-items:start;flex-direction:column}.facts{grid-template-columns:1fr}.panel{padding:16px}select{max-width:310px}h1{font-size:22px}}
.chart-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(250px,1fr);gap:20px;align-items:start}.chart-grid .selected-point{margin-top:0}.chart-grid .selected-point .facts{grid-template-columns:1fr}.chart-grid .selected-point p{overflow-wrap:anywhere}body[data-focus-analysis] main{max-width:1600px;padding:10px}body[data-focus-analysis] header,body[data-focus-analysis] #drop,body[data-focus-analysis] .source-panel,body[data-focus-analysis] .preference-panel,body[data-focus-analysis] footer{display:none}body[data-focus-analysis] .chart-panel{margin:0;padding:18px}body[data-focus-analysis] .toolbar{margin-bottom:8px}body[data-focus-analysis] #plot-run{margin:4px 0}body[data-focus-analysis] .chart-left p{font-size:12px}@media(max-width:900px){.chart-grid{display:block}.chart-grid .selected-point{margin-top:16px}}</style></head><body><main><header><div><span class="eyebrow">ROBOTRACE / INDEPENDENT DATA CONSUMER</span><h1>What happened between the final frames?</h1><p>Open the exported trace. Locate the first protected-object violation.</p></div><span class="eyebrow">LOCAL FILES · NO API REQUIRED</span></header>
<section id="drop"><input id="file" type="file" accept=".json,application/json"><label for="file" class="file-button">Open exported trace JSON</label><span style="margin-left:12px;color:#a7aba8;font-size:12px">or drop a comparison / mobile recording here</span><p id="load-status" role="status">No trace loaded. All numbers will come from your exported file.</p><p id="error" role="alert"></p></section>
<div id="analysis" hidden><section class="panel source-panel"><h2 id="instruction"></h2><div class="facts"><div><small>PACKAGE / RUN ID</small><strong id="package-id"></strong></div><div><small>CONTENT INTEGRITY</small><strong id="source-status"></strong></div><div><small>INITIAL SCENE SHA-256</small><code id="fingerprint"></code></div><div><small>COMPARISON CONDITIONS</small><strong id="conditions"></strong></div></div><p>Controller and task verdicts come from the source evaluator. This consumer independently recomputes protected-object history.</p><div class="table-wrap"><table><thead><tr><th>Plan label</th><th>Run ID</th><th>Source controller</th><th>Source task verdict</th><th>Independent protected check</th></tr></thead><tbody id="results"></tbody></table></div></section>
<section class="panel chart-panel"><div class="toolbar"><label>Recorded attempt<select id="run"></select></label><label>Protected object<select id="object"></select></label><button id="jump-violation">Jump to first recorded violation</button><button id="focus-analysis">Presentation view</button></div><h2 id="independent-verdict"></h2><small id="plot-run"></small><div class="chart-grid"><div class="chart-left"><div class="legend"><span>Preserved protected record</span><span>Disturbed protected record</span></div><svg id="plot" viewBox="0 0 920 360" role="img" aria-label="Protected object displacement over simulated time"></svg><div class="facts"><div><small>FIRST RECORD VIOLATION</small><strong id="first-record"></strong></div><div><small>FIRST POSITION CHANGE</small><strong id="first-position"></strong></div><div><small>MAXIMUM DISPLACEMENT</small><strong id="peak"></strong></div><div><small>FINAL DISPLACEMENT</small><strong id="final-displacement"></strong><small id="final-restored"></small></div></div><p id="explanation"></p><p id="sampling"></p></div><div class="selected-point"><label for="sample">Inspect recorded sample <span id="point-number"></span></label><input id="sample" type="range" min="0" max="0" value="0" aria-label="Inspect protected object sample"><div class="facts"><div><small>ELAPSED SIMULATED TIME</small><strong id="point-time"></strong></div><div><small>RECORDED XYZ POSITION</small><strong id="point-position"></strong></div><div><small>DISPLACEMENT FROM START</small><strong id="point-displacement"></strong></div><div><small>INITIAL XYZ POSITION</small><strong id="initial-position"></strong></div></div><p id="point-state"></p><small id="point-action"></small></div></div></section>
<section class="panel preference-panel"><h2>Candidate research handoff</h2><p id="preference"></p><p>Preference examples remain candidates for researcher review. This program performs no model training, demonstrates no learning gain, and approves no physical deployment.</p><div class="actions"><button id="download-json">Download analysis JSON</button><button id="download-html">Download standalone report</button></div></section></div><footer>The evaluator uses exact complete-record equality, including handling status, with 0 m allowed position change. This is a strict simulator invariant, not a calibrated real-robot tolerance. Analysis is limited to supplied recorded states; source authorship and physical truth are unverified.</footer></main><script type="application/json" id="initial-data">${initial}</script><script>${policy}\n${core}\n(${bootTraceViewer.toString()})();</script></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const destination = resolve(project, 'public/trace-analysis.html');
  await writeFile(destination, await renderTraceViewer());
  console.log('Built self-contained independent viewer: public/trace-analysis.html');
}
