import { MOBILE_PROTECTED_POLICY, mobileProtectedChange } from '../src/data/mobile-protected-policy.mjs';

// Portable analysis only: no renderer, controller, API, filesystem or model imports.
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function analysisCanonicalJSON(value, depth = 0) {
  demand(depth <= 80, 'Trace nesting exceeds the analysis bound.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (finite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(item => analysisCanonicalJSON(item, depth + 1)).join(',') + ']';
  demand(object(value), 'Only finite JSON values are supported.');
  return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key) + ':' + analysisCanonicalJSON(value[key], depth + 1)).join(',') + '}';
}
export async function analysisSHA256(value) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const same = (a, b) => analysisCanonicalJSON(a) === analysisCanonicalJSON(b);
const center = item => [item.position[0], item.height + 0.09, item.position[1]];
function validateWorld(world) {
  demand(world?.schema === 'teachtrace.mobile-kitchen.v1' && finite(world.simTime), 'A native mobile world and finite clock are required.');
  demand(Array.isArray(world.objects) && world.objects.length > 0 && world.objects.length <= 6, 'The mobile trace needs a bounded object inventory.');
  demand(new Set(world.objects.map(item => item.id)).size === world.objects.length, 'Object IDs must be unique.');
  for (const item of world.objects) demand(typeof item.id === 'string' && item.id.length <= 128 && Array.isArray(item.position) && item.position.length === 2 && item.position.every(finite) && finite(item.height), 'Object identity or coordinates are invalid.');
}
function interventions(run) {
  let previous; const changes = [];
  for (const sample of run.trajectory) {
    const value = analysisCanonicalJSON(sample.world.human ?? null);
    if (value !== previous) { changes.push({ time: sample.world.simTime - run.initialWorld.simTime, human: sample.world.human ?? null }); previous = value; }
  }
  return changes;
}
function liveLayoutInterventions(run) {
 const id='sandbox-floor-block',fixed=w=>w.obstacles.filter(o=>o.id!==id);
 const read=(w,placement=false)=>{
  demand(Array.isArray(w.obstacles)&&new Set(w.obstacles.map(o=>o.id)).size===w.obstacles.length,'Recorded obstacle identities must remain unique.');
  const b=w.bounds,o=w.obstacles.find(o=>o.id===id);if(!o)return null;
  demand(Object.keys(o).length===6&&['id','label','minX','maxX','minZ','maxZ'].every(k=>Object.hasOwn(o,k))&&o.label==='Movable floor block'&&[o.minX,o.maxX,o.minZ,o.maxZ].every(finite)&&Math.abs(o.maxX-o.minX-.7)<=1e-9&&Math.abs(o.maxZ-o.minZ-.7)<=1e-9&&o.minX>=b.minX&&o.maxX<=b.maxX&&o.minZ>=b.minZ&&o.maxZ<=b.maxZ,'Invalid reserved live block geometry or label.');
  demand(!fixed(w).some(f=>o.minX<=f.maxX+.03&&o.maxX>=f.minX-.03&&o.minZ<=f.maxZ+.03&&o.maxZ>=f.minZ-.03),'Live block overlaps fixed furniture.');
  if(placement){const hits=(p,r)=>p[0]>=o.minX-r-.03&&p[0]<=o.maxX+r+.03&&p[1]>=o.minZ-r-.03&&p[1]<=o.maxZ+r+.03;demand(!hits(w.robot.position,w.robot.radius)&&(!w.human||!hits(w.human.position,w.human.radius)),'Live block overlaps the recorded base/person.');}return o;
 };
 let previous=run.initialWorld,prior=read(previous,true);const changes=[];
 for(const sample of run.trajectory){const w=sample.world;demand(same(fixed(w),fixed(run.initialWorld)),'Fixed furniture changed in a live recording.');const current=read(w);
  if(!same(current,prior)){if(current)read(w,true);const action=!current?'removed':!prior?'placed':'moved',x=current?(current.minX+current.maxX)/2:0,z=current?(current.minZ+current.maxZ)/2:0;
   const marker=e=>{if(e.kind!=='control'||e.time!==w.simTime)return false;if(!current)return e.message==='Sandbox floor block removed; paused motion still requires explicit resume.';const match=e.message.match(/^Sandbox floor block (placed at|moved to) \((-?\d+\.\d{2}), (-?\d+\.\d{2})\)\.$/);return Boolean(match&&match[1]===(action==='placed'?'placed at':'moved to')&&Math.abs(Number(match[2])-x)<=.005000001&&Math.abs(Number(match[3])-z)<=.005000001);};
   demand(w.revision>previous.revision&&w.events.filter(marker).length>previous.events.filter(marker).length,'Live block change lacks its explicit same-clock control intervention.');changes.push({time:w.simTime,action,obstacle:current?structuredClone(current):null});
  }previous=w;prior=current;
 }return changes;
}
function analyzeRun(run, { native = false, fallbackId } = {}) {
  demand(typeof run.id === 'string' && run.id.length <= 200 || fallbackId, 'The trace needs a bounded run ID.');
  validateWorld(run.initialWorld); validateWorld(run.finalWorld);
  demand(run.goal && typeof run.goal.objectId === 'string' && typeof run.goal.stationId === 'string', 'A task goal is required to identify protected objects.');
  demand(Object.keys(run.goal).every(key=>['objectId','stationId','hold'].includes(key)) && ['counter','table','sink','home'].includes(run.goal.stationId) && (run.goal.hold === undefined || run.goal.hold === true), 'The task goal must use a supported object destination and optional explicit hold mode.');
  demand(run.initialWorld.objects.some(item => item.id === run.goal.objectId), 'The task target is missing from the initial scene.');
  demand(Array.isArray(run.trajectory) && run.trajectory.length > 0 && run.trajectory.length <= 20000, 'A bounded, nonempty recorded trajectory is required.');
  demand(same(run.trajectory[0].world, run.initialWorld) && same(run.trajectory.at(-1).world, run.finalWorld), 'Recorded endpoints do not match the supplied scene snapshots.');
  const layoutInterventions = native ? liveLayoutInterventions(run) : [];
  if(native)for(const [key,value] of Object.entries({sceneConditions:layoutInterventions.length?'live-operator-layout-interventions':'fixed-recorded-layout',layoutInterventions,matchedComparison:false})) {
    demand((!layoutInterventions.length || run.provenance?.[key] !== undefined) && (run.provenance?.[key] === undefined || same(run.provenance[key],value)), 'Recorded live layout provenance disagrees with independently reconstructed interventions.');
  }
  let previous = -Infinity;
  for (const sample of run.trajectory) {
    validateWorld(sample.world);
    const expected = native ? sample.world.simTime : sample.world.simTime - run.initialWorld.simTime;
    demand(finite(sample.time) && sample.time >= previous && Math.abs(sample.time - expected) <= 1e-7, 'Recorded sample clocks must be chronological and agree with the world.');
    previous = sample.time;
    demand(same(run.initialWorld.objects.map(item => item.id), sample.world.objects.map(item => item.id)), 'Recorded object identities changed.');
    for (const key of (native ? ['seed', 'bounds', 'stations'] : ['seed', 'bounds', 'obstacles', 'stations'])) demand(same(run.initialWorld[key], sample.world[key]), 'A supposedly frozen trace changed its scene conditions.');
    for (const key of ['radius', 'speed', 'armReach']) demand(same(run.initialWorld.robot[key], sample.world.robot[key]), 'A supposedly frozen trace changed robot capabilities.');
  }
  if (run.protectedObjectPolicy !== undefined) demand(same(run.protectedObjectPolicy, MOBILE_PROTECTED_POLICY), 'Unsupported protected-object policy; do not silently change the tolerance.');
  const protectedObjects = run.initialWorld.objects.filter(item => item.id !== run.goal.objectId).map(original => {
    const points = run.trajectory.map((sample, sampleIndex) => {
      const current = sample.world.objects.find(item => item.id === original.id);
      const change = mobileProtectedChange(original, current);
      demand(finite(change.displacementMeters), 'Protected-object displacement is not finite.');
      return { sampleIndex, timeSeconds: sample.world.simTime - run.initialWorld.simTime, worldTimeSeconds: sample.world.simTime,
        positionMeters: center(current), displacementMeters: change.displacementMeters, violated: change.violated,
        positionChanged: change.positionChanged, changedFields: change.changedFields,
        stepIndex: sample.world.mission?.stepIndex ?? null, status: current.status, station: current.station };
    });
    const firstRecordViolation = points.find(point => point.violated) ?? null;
    const firstPositionViolation = points.find(point => point.positionChanged) ?? null;
    const declared = run.protectedViolations?.find(item => item.objectId === original.id);
    if (declared) {
      const matching = points.find(point => Math.abs(point.timeSeconds - declared.timeSeconds) <= 1e-7);
      demand(matching?.violated === true, 'The declared native violation is absent from the exported trajectory.');
      demand(firstRecordViolation && Math.abs(firstRecordViolation.timeSeconds - declared.timeSeconds) <= 1e-7, 'Native violation metadata disagrees with the first recorded violation.');
    }
    return { id: original.id, label: String(original.label ?? original.id), initialPositionMeters: center(original), points,
      independentlyPassed: !firstRecordViolation, firstRecordViolation, firstPositionViolation,
      peakDisplacementMeters: Math.max(...points.map(point => point.displacementMeters)),
      finalDisplacementMeters: points.at(-1).displacementMeters,
      finalRecordRestored: same(original, run.finalWorld.objects.find(item => item.id === original.id)),
      firstNativeViolationRecorded: Boolean(declared),
      sourceProtectedCheckPassed: run.checks?.find(check => check.id === 'protected-' + original.id)?.passed ?? null };
  });
  return { id: run.id ?? fallbackId, label: String(run.label ?? 'Recorded mobile attempt'), source: String(run.source ?? 'recorded simulator'),
    reportedControllerOutcome: run.outcome ?? run.finalWorld.mission?.status ?? 'unknown', reportedTaskAccepted: typeof run.taskAccepted === 'boolean' ? run.taskAccepted : null,
    sceneConditions: layoutInterventions.length ? 'live-operator-layout-interventions' : 'fixed-recorded-layout', layoutInterventions, matchedComparison: false,
    taskKind: run.goal.hold ? 'held-object-transport' : 'object-delivery', releaseRequired: !run.goal.hold,
    goal: run.goal, seed: run.initialWorld.seed, sampleCount: run.trajectory.length,
    durationSeconds: run.finalWorld.simTime - run.initialWorld.simTime, protectedObjects,
    protectedObjectsPassed: protectedObjects.every(item => item.independentlyPassed),
    sampling: 'Recorded samples; exact first native violation is asserted only when matching metadata and its forced sample exist.' };
}

export async function analyzeProtectedInput(input) {
  analysisCanonicalJSON(input);
  let runs, native = false, pair = null, integrityVerified = false, digest = null;
  const inputSchema = input?.schema ?? input?.payload?.schema;
  if (inputSchema === 'teachtrace.mobile-matched-pair.v1') {
    demand(Array.isArray(input.runs) && input.runs.length === 2, 'A matched pair requires exactly two attempts.');
    const { integrity, ...unsigned } = input;
    demand(integrity?.algorithm === 'SHA-256' && integrity.canonicalization === 'teachtrace.canonical-json.v1', 'A matched pair needs its declared canonical SHA-256 integrity metadata.');
    digest = await analysisSHA256(analysisCanonicalJSON(unsigned));
    demand((integrity.sha256 ?? integrity.digest) === digest, 'Matched-pair SHA-256 integrity mismatch.');
    runs = input.runs;
    demand(runs[0].id !== runs[1].id, 'Matched attempts must retain distinct run IDs.');
    demand(same(runs[0].initialWorld, runs[1].initialWorld) && same(runs[0].goal, runs[1].goal) && same(input.goal, runs[0].goal), 'A matched pair must preserve the exact initial world and task goal.');
    const initialSceneSha256 = await analysisSHA256(analysisCanonicalJSON({ initialWorld: runs[0].initialWorld, goal: runs[0].goal }));
    demand(input.initialSceneSha256 === initialSceneSha256 && input.seed === runs[0].initialWorld.seed, 'Comparison source fingerprint or seed disagrees with the recorded scene.');
    demand(same(interventions(runs[0]), interventions(runs[1])), 'External human-intervention schedules differ; these runs cannot be called a matched comparison.');
    pair = { id: input.id, initialSceneSha256, instruction: input.instruction, seed: input.seed, sameInitialScene: true, sameGoal: true, sameInterventionSchedule: true };
    integrityVerified = true;
  } else if (inputSchema === 'teachtrace.mobile-candidate-result.v1') runs = [input];
  else if (inputSchema === 'teachtrace.mobile-planner-report.v1') {
    demand(Array.isArray(input.cases) && input.cases.length > 0 && input.cases.length <= 20, 'Select a report containing 1–20 recorded attempts.');
    runs = input.cases.map(item => item.result);
  } else if (input?.payload?.schema === 'teachtrace.mobile-evaluation.v1') {
    demand(input.integrity?.algorithm === 'SHA-256' && input.integrity.encoding === 'UTF-8 JSON.stringify(payload)', 'Unsupported mobile integrity format.');
    digest = await analysisSHA256(JSON.stringify(input.payload));
    demand(digest === input.integrity.digest, 'Mobile evidence integrity mismatch.');
    const payload = input.payload, goal = payload.finalWorld.mission?.plan.goal;
    runs = [{ ...payload, id: payload.runId ?? 'sha256:' + digest.slice(0, 16), label: payload.finalWorld.mission?.plan.command,
      goal, outcome: payload.finalWorld.mission?.status, taskAccepted: null }]; native = true; integrityVerified = true;
  } else throw new Error('Open a mobile matched pair, candidate result, planner report or sealed mobile evaluation.');
  demand(runs.every(run => object(run)) && runs.reduce((count, run) => count + (run.trajectory?.length ?? 0), 0) <= 40000, 'The analysis exceeds its recorded-state bound.');
  const analyzed = runs.map(run => analyzeRun(run, { native }));
  let preference = null;
  if (pair && input.preference) {
    const chosen = analyzed.find(run => run.id === input.preference.chosenRunId), rejected = analyzed.find(run => run.id === input.preference.rejectedRunId);
    demand(chosen && rejected && chosen.id !== rejected.id && chosen.reportedTaskAccepted === true && chosen.protectedObjectsPassed && rejected.reportedTaskAccepted === false && !rejected.protectedObjectsPassed, 'Candidate preference disagrees with recorded protected-object evidence.');
    demand(input.preference.reviewStatus === 'candidate-unreviewed' && input.preference.trainingValidated === false, 'This analysis does not authenticate human review or validate training.');
    preference = { ...input.preference, humanReviewVerified: false, trainingBenefitMeasured: false };
  }
  return { schema: 'teachtrace.protected-trace-analysis.v1', generatedAt: new Date().toISOString(), inputSchema,
    inputDigestSha256: digest, integrityVerified, policy: MOBILE_PROTECTED_POLICY, pair, runs: analyzed, preference,
    taskAcceptanceRecomputed: false, protectedObjectHistoryRecomputed: true, sourceAuthorshipVerified: false,
    limitations: ['Independent recorded-state analysis using the same versioned protected-object policy as the evaluator.',
      'Position displacement is measured in XYZ from the initial rendered object center. Complete-record changes also include status, station and metadata.',
      'Source task verdicts are reported separately; this program does not execute the robot controller or recompute every task predicate.',
      'Unsampled changes cannot be recovered. Exact first native timing requires its explicitly forced recorded state.',
      'Integrity verifies content consistency, not authorship, physical truth, human review or improved model training.'] };
}
