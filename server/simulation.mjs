import { taskGuideForWorld } from './task-guides.mjs';
import { tsImport } from 'tsx/esm/api';

let modules;
function simulationModules() {
  // Fixed, server-owned module paths only. This scoped import does not install
  // global TS hooks or accept source code/module paths from HTTP requests.
  modules ??= Promise.all([
    tsImport('../src/sim/scene-authoring.ts', import.meta.url),
    tsImport('../src/sim/candidate-plans.ts', import.meta.url),
    tsImport('../src/sim/scene-spec.ts', import.meta.url),
    tsImport('../src/data/evidence.ts', import.meta.url),
    tsImport('../src/sim/engine.ts', import.meta.url),
  ]).then(([scene, candidates, tasks, evidence, engine]) => ({ ...scene, ...candidates, ...tasks, ...evidence, ...engine }));
  return modules;
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const fail = message => Object.assign(new Error(message), { status: 400 });
function boundedJson(value, maximum) {
  try { const serialized = JSON.stringify(value); return typeof serialized === 'string' && Buffer.byteLength(serialized) <= maximum; }
  catch { return false; }
}
const limits = 'Server checks use recorded client states and a deterministic kinematic controller with idealized grasps. They do not authenticate the recording, validate audio, physical contact, real-world safety, or a learned policy.';

/** Runs the shared bounded controller as an authoritative local API computation. */
export async function evaluatePlanOnServer(input) {
  if (!record(input) || !['human', 'llm', 'baseline'].includes(input.source) || !bounded(input.label, 100)
    || (input.instruction !== undefined && !bounded(input.instruction, 1500)) || !Object.hasOwn(input, 'steps')
    || !boundedJson(input.world, 100000) || !boundedJson(input.steps, 10000)) throw fail('Provide a bounded scene, candidate steps, source and label.');
  const api = await simulationModules();
  const validation = api.validateScene(input.world);
  if (!validation.valid) throw fail('The evaluation requires a valid, settled bounded scene with supported geometry and object data.');
  const result = api.evaluateCandidatePlan({
    world: input.world, steps: input.steps, source: input.source, label: input.label,
    ...(input.instruction !== undefined ? { instruction: input.instruction } : {}),
  });
  return { ...result, evaluationBasis: 'server-executed-kinematic-controller', independentlyComputed: true, limits };
}

function sameObjects(a, b) {
  if (a.objects.length !== b.objects.length) return false;
  return a.objects.every(object => {
    const other = b.objects.find(candidate => candidate.id === object.id);
    return other && object.location === other.location && object.status === other.status
      && object.position.every((coordinate, axis) => Math.abs(coordinate - other.position[axis]) <= 0.00001);
  });
}

function hasRecordedHumanInterventions(episode) {
  const samples = episode.samples;
  const state = world => world.humanPresence?.state ?? 'clear';
  if (!samples.some((sample, index) => state(sample.world) !== state(index ? samples[index - 1].world : episode.initialWorld))) return false;
  const controls = episode.events.filter(event => event.kind === 'control');
  const sameTime = (a, b) => Math.abs(a - b) <= 0.000001;
  let previousResume = -1;
  let occupied = false;
  for (let index = 0; index < samples.length; index++) {
    if (state(samples[index].world) !== 'in-workspace') continue;
    occupied = true;
    const start = index;
    while (index + 1 < samples.length && state(samples[index + 1].world) === 'in-workspace') index++;
    const held = samples[index], cleared = samples[index + 1];
    // A real software hold preserves the clock, objects and gripper through
    // clearance, then waits for a separately recorded operator resume. Do not
    // erase occupancy or treat a metadata-only state change as a valid resume.
    if (!cleared || !['clear', 'nearby'].includes(state(cleared.world)) || held.world.robot.mode !== 'paused' || cleared.world.robot.mode !== 'paused'
      || !sameTime(held.time, cleared.time) || !sameTime(held.world.simTime, cleared.world.simTime)
      || JSON.stringify(held.world.objects) !== JSON.stringify(cleared.world.objects)
      || JSON.stringify(held.world.robot.position) !== JSON.stringify(cleared.world.robot.position)
      || held.world.robot.gripperOpen !== cleared.world.robot.gripperOpen
      || held.world.robot.heldObjectId !== cleared.world.robot.heldObjectId
      || JSON.stringify(held.world.motion) !== JSON.stringify(cleared.world.motion)) return false;
    const clearEvent = controls.findIndex((event, eventIndex) => eventIndex > previousResume
      && event.time >= samples[start].time - 0.000001 && sameTime(event.time, cleared.time)
      && new RegExp(`^Human scenario changed to ${state(cleared.world)}$`, 'i').test(event.label));
    const resumeEvent = controls.findIndex((event, eventIndex) => eventIndex > clearEvent && clearEvent !== -1
      && sameTime(event.time, cleared.time) && /^Operator resumed motion$/i.test(event.label));
    if (clearEvent === -1 || resumeEvent === -1) return false;
    previousResume = resumeEvent;
  }
  // Changes between clear/nearby also make a command-only replay incomplete,
  // but must have their own actual human-scenario control event in the record.
  return occupied || controls.some(event => /^Human scenario changed to (?:clear|nearby)$/i.test(event.label));
}

/** Recomputes task checks from validated native evidence, ignoring posted check booleans. */
export async function recomputeEpisodeAcceptance(episode) {
  const unverified = reason => ({
    independentlyRecomputed: false, basis: 'unverified-native-recording', checks: [],
    recordingValid: false, errors: [reason], replay: { performed: false, matched: null }, limits,
  });
  if (!record(episode) || !boundedJson(episode, 1000000) || !Array.isArray(episode.samples) || episode.samples.length > 1500
    || !Array.isArray(episode.events) || episode.events.length > 1500) return unverified('A complete bounded native recording is required for server verification.');
  const api = await simulationModules();
  let evidence;
  try { evidence = api.buildEvidencePackage(episode); }
  catch { return unverified('The native recording is incomplete or internally inconsistent.'); }
  const validation = api.validateEvidencePackage(evidence);
  if (!validation.valid || !api.validateScene(episode.initialWorld).valid) return unverified('The native recording or initial scene did not pass shared evidence validation.');
  const initial = episode.initialWorld;
  const final = episode.samples.at(-1).world;
  const definition = api.taskForWorld(initial);
  if (!definition) return unverified('The native recording has no supported collection assignment.');
  const checks = definition.successChecks(final);
  for (const target of definition.targets.filter(item => item.unchanged)) {
    const original = initial.objects.find(object => object.id === target.objectId);
    const current = final.objects.find(object => object.id === target.objectId);
    const index = checks.findIndex(check => check.id === `target-${target.objectId}`);
    const protectedCheck = {
      id: `target-${target.objectId}`, name: `${original?.label ?? target.objectId} remains undisturbed`,
      passed: Boolean(original && current && JSON.stringify(original) === JSON.stringify(current)),
      detail: 'The protected object must retain its full actual recorded initial state.',
    };
    if (index === -1) checks.push(protectedCheck); else checks[index] = protectedCheck;
  }
  // A valid intervention may prevent command-only replay; it must never erase
  // a protected object's recorded pickup, motion target, or intermediate change.
  const { createProtectedHistory, mergeProtectedHistoryChecks } = await tsImport('../src/sim/protected-history.ts', import.meta.url);
  const protectedHistory = createProtectedHistory(initial);
  for (const sample of episode.samples) protectedHistory.observe(sample.world);
  const historyChecks = mergeProtectedHistoryChecks(checks, protectedHistory.checks());
  checks.splice(0, checks.length, ...historyChecks);
  let replay = { performed: false, matched: null };
  if (episode.outcome === 'completed') {
    const humanInterventions = hasRecordedHumanInterventions(episode);
    const plan = api.planCommand(episode.command, initial);
    if (humanInterventions) {
      replay = { performed: false, matched: null, reason: 'Human scenario interventions require control-aware replay; final task geometry was independently recomputed.' };
    } else if (!plan.error && !plan.control && plan.steps.length <= 6 && plan.steps.every(step => step.kind === 'pick_place')) {
      const result = api.evaluateCandidatePlan({ world: initial, steps: plan.steps.map(({ objectId, destination }) => ({ objectId, destination })), source: 'baseline', label: 'Recorded command verification' });
      const matched = result.outcome === 'completed' && result.completedActions === episode.completedActions && sameObjects(result.finalWorld, final);
      replay = { performed: true, matched };
      checks.push({ id: 'recorded-command-replay', name: 'Recorded final placement agrees with deterministic command replay', passed: matched,
        detail: matched ? 'Shared planner/controller replay reproduced the recorded object positions, destinations, states and completion count.' : 'The recorded objects or completion count disagree with shared controller replay of the recorded command.' });
    }
  }
  return {
    independentlyRecomputed: true, basis: 'server-recomputed-simulator-checks', checks,
    recordingValid: true, errors: [], replay, limits,
  };
}

let mobileCandidates;
export async function evaluateMobilePlanOnServer(input) {
 const allowed=['world','candidate','goal','source','label','model','requestDurationMs','instruction'];
 if (!record(input) || Object.keys(input).some(key=>!allowed.includes(key)) || !['human','llm','baseline'].includes(input.source) || !bounded(input.label,100) || !boundedJson(input.world,50000) || !boundedJson(input.candidate,20000)) throw fail('Provide a bounded mobile scene, candidate, source and label.');
 const requestedGoal=input.goal??{objectId:'cup',stationId:'sink'};
 if(!record(requestedGoal)||Object.keys(requestedGoal).length!==2||!Object.hasOwn(requestedGoal,'objectId')||!Object.hasOwn(requestedGoal,'stationId')||!['cup','bowl'].includes(requestedGoal.objectId)||!['counter','table','sink'].includes(requestedGoal.stationId))throw fail('Provide exactly one known mobile object and delivery station as the frozen goal.');
 if((input.model!==undefined&&!bounded(input.model,100))||(input.instruction!==undefined&&!bounded(input.instruction,1500))||(input.requestDurationMs!==undefined&&(!Number.isFinite(input.requestDurationMs)||input.requestDurationMs<0||input.requestDurationMs>120000)))throw fail('Evaluation metadata exceeds the supported bounds.');
 if (taskGuideForWorld({...input.world,environmentId:'mobile-kitchen'}).id !== 'TT-MOBILE-KITCHEN-001') throw fail('The mobile evaluation requires a supported valid kitchen snapshot.');
 const w=input.world;
 // Freeze geometry and current object/base state. Old missions, events and
 // arbitrary client fields are not execution inputs or repeated replay payloads.
 const world={schema:w.schema,seed:w.seed,simTime:w.simTime,revision:w.revision,distanceTravelled:w.distanceTravelled,bounds:{minX:w.bounds.minX,maxX:w.bounds.maxX,minZ:w.bounds.minZ,maxZ:w.bounds.maxZ},cellSize:w.cellSize,
 obstacles:w.obstacles.map((o,index)=>({id:bounded(o.id,80)?o.id:`obstacle-${index}`,label:bounded(o.label,80)?o.label:'Obstacle',minX:o.minX,maxX:o.maxX,minZ:o.minZ,maxZ:o.maxZ})),
 stations:w.stations.map(o=>({id:o.id,label:o.label,dock:[...o.dock],surface:[...o.surface],height:o.height})),
 objects:w.objects.map(o=>({id:o.id,label:o.label,position:[...o.position],height:o.height,station:o.station,status:o.status})),
 robot:{position:[...w.robot.position],yaw:w.robot.yaw,radius:w.robot.radius,speed:w.robot.speed,armReach:w.robot.armReach,mode:w.robot.mode,phase:bounded(w.robot.phase,150)?w.robot.phase:'Ready',cargoObjectId:w.robot.cargoObjectId},
 human:w.human?{position:[...w.human.position],radius:w.human.radius,source:'scenario-proxy'}:null,mission:null,events:[],
 simulation:{type:'deterministic-floor-navigation',contactDynamics:false,slam:false,learnedPolicy:false,limitations:['Known-map geometric navigation and idealized kinematic attachment.','No sensor perception, complete arm collision validation, motor-policy training or physical transfer established.']}};
 mobileCandidates ??= tsImport('../src/sim/mobile-candidates.ts',import.meta.url);
 const api=await mobileCandidates;
 const result=api.evaluateMobileCandidate({world,candidate:input.candidate,goal:{objectId:requestedGoal.objectId,stationId:requestedGoal.stationId},source:input.source,label:input.label,...(input.model!==undefined?{model:input.model}:{}),...(input.instruction!==undefined?{instruction:input.instruction}:{}),...(input.requestDurationMs!==undefined?{requestDurationMs:input.requestDurationMs}:{})});
 return {...result,evaluationBasis:'server-executed-mobile-kinematic-controller',independentlyComputed:true,inputNormalization:'Known geometry and current robot/object state preserved; prior mission/event history and arbitrary extra fields omitted for a new test.'};
}
