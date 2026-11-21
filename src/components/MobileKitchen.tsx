import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, RotateCcw } from 'lucide-react';
import { kitchenSceneInventory } from '../sim/kitchen-inventory';
import { mobileCompletionOutcome } from '../sim/mobile-outcome';
import { sealMobilePayload } from '../data/mobile-records';
import type { MobileEnvelope, MobileStoredRecord } from '../data/mobile-records';
import { createMobileEvidence } from '../data/mobile-evidence';
import { enqueueSandboxTask, reorderSandboxTask } from '../data/mobile-sandbox';
import type { SandboxTask } from '../data/mobile-sandbox';
import { solveMobileArm } from '../sim/mobile-arm';
import { runMobileComparison } from '../sim/mobile-comparison';
import type { MobileComparison } from '../sim/mobile-comparison';
import { advanceMobileWorld, applyMobileControl, createMobileKitchen, mobileGoalChecks, mobileHumanAheadPosition, mobileObjectReach, mobileSegmentIsClear, navigationDistanceContext, planMobileTask, setMobileFloorObstacle, setMobileHuman, startMobilePlan } from '../sim/mobile-navigation';
import type { MobilePlan, MobilePoint, MobileWorld } from '../sim/mobile-navigation';
import type { VoiceCommandResult, VoiceStatus, VoiceAudioActivity } from '../integrations/voice';
import type { VoiceAudioSegment, VoiceRecordingStatus, VoiceCommandContext } from '../integrations/voice';
import { useVoiceExperiment } from '../hooks/useVoiceExperiment';
import ActivityTerminal from './ActivityTerminal';
import LiveCoordinates from './LiveCoordinates';
import type { TerminalEntry } from './ActivityTerminal';
import MobileRecordLibrary from './MobileRecordLibrary';
import MobileKitchenScene from './MobileKitchenScene';
import PhotoHallScene from './PhotoHallScene';
import PhotoRoomBuilder from './PhotoRoomBuilder';
import type {PhotoRoomSpec} from './PhotoRoomBuilder';
import type {ReferenceFingerprint} from '../data/reference-fingerprint';
import {createPhotoHallWorld,createPhotoHallWorldFromSpec,planPhotoHallTask} from '../sim/photo-hall';
import VoiceConversation from './VoiceConversation';
import type { VoiceTranscript } from '../integrations/voice-captions';
import './MobileKitchen.css';

const MobilePlannerBench = lazy(() => import('./MobilePlannerBench'));
const ExperimentConsole = lazy(() => import('./ExperimentConsole'));
const SimulationTestComparison = lazy(() => import('./SimulationTestComparison'));
export interface MobileBridge { command: (text: string, context?: VoiceCommandContext) => Promise<VoiceCommandResult>; getWorld: () => unknown; recordTranscript: (turn: VoiceTranscript) => void; recordAudio: (segment: VoiceAudioSegment) => void; recordingStatus: (status: VoiceRecordingStatus) => void; finishExperiment: () => Promise<void> }
interface Props { environment?: 'kitchen' | 'hall'; onBack: () => void; onBridge: (bridge: MobileBridge | null) => void; voiceStatus: VoiceStatus; voiceTranscripts: VoiceTranscript[]; voiceAudioActivity?: VoiceAudioActivity | null; voiceErrorMessage?: string | null; onVoice: () => void | Promise<void>; onDisconnect: () => void | Promise<void>; onPauseVoice: (paused: boolean) => Promise<void>; onResetVoice: () => void; announce: (text: string) => void }
type SessionAttempt = { id: string; command: string; outcome: string; payload: ReturnType<typeof createMobileEvidence> };

export default function MobileKitchen({ environment = 'kitchen', onBack, onBridge, voiceStatus, voiceTranscripts, voiceAudioActivity, voiceErrorMessage, onVoice, onDisconnect, onPauseVoice, onResetVoice, announce }: Props) {
  const experiment = useVoiceExperiment();
  const hall = environment === 'hall';
  const sceneBaseline = useRef<MobileWorld | null>(null);
  if (!sceneBaseline.current) {
    let loaded: MobileWorld | null = null;
    if (hall) { try { const saved = JSON.parse(localStorage.getItem('robotrace.photo-room.v1') ?? 'null'); if (saved?.spec) loaded = createPhotoHallWorldFromSpec(saved.spec, saved.reference); } catch { /* Invalid local drafts do not replace the fixed estimate. */ } }
    sceneBaseline.current = loaded ?? (hall ? createPhotoHallWorld() : createMobileKitchen());
  }
  const [world, setWorld] = useState<MobileWorld>(() => structuredClone(sceneBaseline.current!));
  const [roomBuilderOpen, setRoomBuilderOpen] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    { id: 'scene-source', time: 0, kind: 'context', text: hall ? 'Source: photo-informed office hall; estimated furniture and floor dimensions, navigation only. No reconstructed people or calibrated sensing.' : 'Source: local mobile-kitchen scene; known floor map, Cup/Bowl and Counter/Table/Sink/Home. No hardware telemetry.' },
    { id: 'command-mode', time: 0, kind: 'system', text: hall ? 'Try “Go to front desk”, “Go to window desk” or a floor coordinate. Upload a room photo to propose another estimated layout before starting voice.' : 'Commands run immediately in the local simulator. Try “Take cup from counter to sink”. Saving is one click and does not assert human quality review.' },
  ]);
  const [terminalTab, setTerminalTab] = useState<'activity' | 'coordinates'>('activity');
  const [robotEye,setRobotEye] = useState(false);
  const [inventoryOpen,setInventoryOpen] = useState(false);
  const [top, setTop] = useState(false), [full, setFull] = useState(false), [speed, setSpeed] = useState(2);
  const [placingHuman, setPlacingHuman] = useState(false), [placingBlock, setPlacingBlock] = useState(false);
  const humanPositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null), pendingHumanPosition = useRef<MobilePoint | null>(null);
  const [queue, setQueue] = useState<SandboxTask[]>([]), [attempts, setAttempts] = useState<SessionAttempt[]>([]);
  const [saveExperimentOpen, setSaveExperimentOpen] = useState(false);
  const exitAfterSave = useRef(false);
  const [inspectedAttempt, setInspectedAttempt] = useState<SessionAttempt | null>(null);
  const [sessionPaused, setSessionPaused] = useState(false), [sessionAction, setSessionAction] = useState<string | null>(null);
  const sessionPausedRef = useRef(false), inspectionRef = useRef(inspectedAttempt);
  const queueRef = useRef(queue), attemptId = useRef<string | null>(null);
  const queuedContexts = useRef(new Map<string, VoiceCommandContext | undefined>());
  const currentRequest = useRef<{ eventId?: string; context?: VoiceCommandContext; startedAt: number }>({ startedAt: Date.now() });
  const attemptMetadata = useRef<{ userTurnId?: string; commandEventId?: string; startedAt: number } | null>(null);
  const mostRecentAttempt = useRef<SessionAttempt | null>(null);
  const [planning, setPlanning] = useState(false);
  const planningRef = useRef(false), intentRequest = useRef<AbortController | null>(null), intentSerial = useRef(0);
  const [lastReceipt, setLastReceipt] = useState<Record<string, unknown> | null>(null);
  const [comparison, setComparison] = useState<MobileComparison | null>(null);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false), [libraryOpen, setLibraryOpen] = useState(false);
  const [saving, setSaving] = useState(false), [savedRecord, setSavedRecord] = useState<MobileStoredRecord | null>(null);
  const [storedReplay, setStoredReplay] = useState<{ record: MobileStoredRecord; frame: number; playing: boolean } | null>(null);
  const ref = useRef(world), planRef = useRef<MobilePlan | null>(null), receiptRef = useRef(lastReceipt), announceRef = useRef(announce);
  const replayRef = useRef(storedReplay), savingRef = useRef(saving), libraryRef = useRef(libraryOpen), plannerRef = useRef(plannerOpen), savedRecordRef = useRef(savedRecord);
  const initial = useRef<MobileWorld | null>(null), samples = useRef<{ time: number; world: MobileWorld }[]>([]), lastSample = useRef(-1);
  const frozenSave = useRef<MobileEnvelope | null>(null), saveRequest = useRef<AbortController | null>(null), generation = useRef(0), serial = useRef(0);
  const handler = useRef<(text: string, context?: VoiceCommandContext) => Promise<VoiceCommandResult>>(async () => ({ completed: false }));
  ref.current = world; receiptRef.current = lastReceipt; announceRef.current = announce;
  queueRef.current = queue;
  inspectionRef.current = inspectedAttempt;
  replayRef.current = storedReplay; savingRef.current = saving; libraryRef.current = libraryOpen; plannerRef.current = plannerOpen; savedRecordRef.current = savedRecord;

  const append = (items: Omit<TerminalEntry, 'id'>[]) => {
    const additions = items.map(item => ({ ...item, id: `mobile-${++serial.current}` }));
    setEntries(previous => [...previous, ...additions].slice(-160));
  };
  const say = (text: string, kind: TerminalEntry['kind'] = 'system') => append([{ time: ref.current.simTime, kind, text }]);
  const replace = (next: MobileWorld) => {
    const previous = ref.current;
    let overlap = Math.min(previous.events.length, next.events.length);
    while (overlap > 0 && JSON.stringify(previous.events.slice(-overlap)) !== JSON.stringify(next.events.slice(0, overlap))) overlap--;
    const observed: Omit<TerminalEntry, 'id'>[] = next.events.slice(overlap).map(event => ({
      time: event.time, kind: event.kind === 'blocked' ? next.robot.mode === 'error' ? 'error' : 'warning' : event.kind === 'goal' ? 'success' : event.kind === 'reach-check' ? 'check' : event.kind === 'control' ? 'tool' : 'action', text: event.message,
    }));
    if (next.robot.phase !== previous.robot.phase && !observed.some(event => event.text === next.robot.phase)) observed.push({
      time: next.simTime, kind: next.robot.mode === 'error' ? 'error' : next.robot.mode === 'paused' ? 'warning' : next.robot.mode === 'running' ? 'action' : 'system', text: `Controller: ${next.robot.phase}`,
    });
    ref.current = next; setWorld(next);
    for (const item of observed) experiment.event('controller-event', { kind: item.kind, text: item.text }, next.simTime);
    if (observed.length) append(observed);
  };
  const record = (next: MobileWorld, force = false) => {
    if (force || next.simTime - lastSample.current >= .099 || next.mission?.status === 'completed' || next.robot.mode === 'paused') {
      samples.current.push({ time: next.simTime, world: structuredClone(next) }); lastSample.current = next.simTime;
    }
  };
  const clearPendingSave = () => { generation.current++; saveRequest.current?.abort(); saveRequest.current = null; frozenSave.current = null; savedRecordRef.current = null; setSavedRecord(null); };
  const archiveAttempt = (finalWorld: MobileWorld, receipt: Record<string, unknown> | null) => {
    if (!attemptId.current || !initial.current) return;
    const id = attemptId.current; attemptId.current = null;
    try {
      record(finalWorld, true);
      const payload = createMobileEvidence(initial.current, samples.current, finalWorld, receipt);
      const captured = { id, command: finalWorld.mission?.plan.command ?? 'Mobile task', outcome: String(receipt?.status ?? finalWorld.robot.mode), payload };
      mostRecentAttempt.current = captured; setAttempts(previous => [captured, ...previous].slice(0, 8));
      experiment.attempt(captured, { ...attemptMetadata.current, endedAt: Date.now() });
    } catch (error) { say(`Attempt recording unavailable: ${error instanceof Error ? error.message : 'Inconsistent state.'}`, 'error'); }
  };
  const placeBlock = (position: MobilePoint | null) => {
    if (savingRef.current || replayRef.current || plannerRef.current || libraryRef.current) return;
    const result = setMobileFloorObstacle(ref.current, position);
    if (result.error) { say(result.error, 'warning'); return; }
    replace(result.world); if (initial.current) record(result.world, true);
    if (result.world.robot.mode === 'paused') say('Floor block changed. Resume explicitly to retry the current route.', 'context');
  };
  const placeHuman = (position: MobilePoint) => {
    if (savingRef.current || replayRef.current || plannerRef.current || libraryRef.current) return;
    if (!mobileSegmentIsClear({ ...ref.current, human: null, robot: { ...ref.current.robot, radius: .4 } }, position, position)) {
      say('Choose an open floor point inside the map, clear of furniture.', 'warning'); return;
    }
    const occupied = setMobileHuman(ref.current, position); replace(occupied); if (initial.current) record(occupied, true);
    say(`Person placed at ${position.map(value => value.toFixed(2)).join(', ')} m. The controller will seek a clear detour; an unreachable destination remains paused.`, 'context');
    if (occupied.robot.mode === 'paused') say('Motion is paused. Resume explicitly after repositioning the person.', 'warning');
  };
  const adjustHumanPosition = (axis: 0 | 1, value: number) => {
    const position: MobilePoint = [...(pendingHumanPosition.current ?? ref.current.human?.position ?? mobileHumanAheadPosition(ref.current))];
    position[axis] = value; pendingHumanPosition.current = position;
    if (!humanPositionTimer.current) humanPositionTimer.current = setTimeout(() => {
      humanPositionTimer.current = null; const next = pendingHumanPosition.current; pendingHumanPosition.current = null;
      if (next) placeHuman(next);
    }, 90);
  };
  const startPrepared = (): VoiceCommandResult => {
    const candidate = planRef.current;
    if (!candidate) return { completed: false, error: 'No executable mobile task is available.' };
    const result = startMobilePlan(ref.current, candidate, 'immediate');
    if (result.error) { say(result.error, 'error'); return { completed: false, error: result.error }; }
    clearPendingSave(); initial.current = structuredClone(ref.current); attemptId.current = crypto.randomUUID();
    const source = currentRequest.current;
    attemptMetadata.current = { startedAt: Date.now(), ...(source.eventId ? { commandEventId: source.eventId } : {}), ...(source.context?.turnAssociation === 'exact-caption' && source.context.userTurnId ? { userTurnId: source.context.userTurnId } : {}) };
    experiment.event('action-planned', { command: candidate.command, goal: candidate.goal, steps: candidate.steps, attemptId: attemptId.current }, ref.current.simTime);
    samples.current = [{ time: ref.current.simTime, world: structuredClone(ref.current) }]; lastSample.current = ref.current.simTime;
    replace(result.world); planRef.current = null;
    const receipt = { status: 'running', approvalSource: 'immediate', command: candidate.command, verified: false };
    receiptRef.current = receipt; setLastReceipt(receipt);
    return { completed: false, status: 'running', summary: 'The mobile simulation started immediately; completion is not yet verified.',
      plannedActions: candidate.steps.map(step => ({ kind: step.kind, label: step.label, objectLabel: 'objectId' in step ? ref.current.objects.find(object => object.id === step.objectId)?.label : undefined, destinationLabel: ref.current.stations.find(station => station.id === step.stationId)?.label })),
      reasoning: candidate.rationale, world: result.world };
  };

  handler.current = async (text, context) => {
    const exactTurn = context?.turnAssociation === 'exact-caption' ? context.userTurnId : undefined;
    const eventId = experiment.event('command-requested', { command: text, source: context ? 'voice' : 'operator-control', ...(exactTurn ? { userTurnId: exactTurn } : {}), ...(context ? { observedUserTurnId: context.userTurnId, recognizedText: context.recognizedText, turnAssociation: context.turnAssociation } : {}) }, ref.current.simTime);
    const requestContext = { eventId: eventId ?? undefined, context, startedAt: Date.now() }; currentRequest.current = requestContext;
    const normalized = text.trim().toLowerCase(); say(text, 'command');
    const refuse = (error: string): VoiceCommandResult => { say(error, 'error'); experiment.event('request-failed', { command: text, error, commandEventId: eventId }, ref.current.simTime); return { completed: false, error }; };
    if (roomBuilderOpen && normalized !== 'stop') return refuse('Close or apply the estimated room draft before commanding motion.');
    if ((libraryRef.current || plannerRef.current || inspectionRef.current) && normalized !== 'stop') return refuse('Close the recording or comparison panel before commanding live motion.');
    if (replayRef.current) return refuse('A saved recording is in read-only replay. Return to the live kitchen before commanding motion.');
    if (savingRef.current) return refuse('The exact recorded attempt is being saved. Wait for the save result before changing the live scene.');
    if (/^(approve|yes|approve and run|go ahead)[.!]*$/.test(normalized)) return { completed: receiptRef.current?.status === 'succeeded', executionReceipt: receiptRef.current ?? undefined, summary: 'Commands run immediately; no task awaits separate approval.' };
    if (/^(human enter|person enters|block route|human in workspace)$/.test(normalized)) {
      try { placeHuman(mobileHumanAheadPosition(ref.current)); }
      catch (error) { return refuse(error instanceof Error ? error.message : 'No clear floor point is available for the person.'); }
      return { completed: true, summary: 'A simulated person was placed ahead. The controller seeks a clear detour and pauses if none exists.' };
    }
    if (/^(human clear|clear human|clear route|human leaves)$/.test(normalized)) {
      const cleared = setMobileHuman(ref.current, null); replace(cleared); if (initial.current) record(cleared, true);
      const summary = cleared.robot.mode === 'paused' ? 'Obstruction cleared. The paused mission still needs Resume.' : 'Person cleared from the floor; the current task is unchanged.';
      say(summary, 'context');
      return { completed: true, summary };
    }
    const next = hall ? planPhotoHallTask(text, ref.current) : planMobileTask(text, ref.current);
    if (next.control) {
      if (['stop', 'reset', 'pause'].includes(next.control)) { intentSerial.current++; intentRequest.current?.abort(); planningRef.current = false; setPlanning(false); }
      if (next.control === 'reset') {
        if (attemptId.current) { const stopped = applyMobileControl(ref.current, 'stop').world; archiveAttempt(stopped, { status: 'cancelled', verified: false }); }
        queueRef.current = []; setQueue([]);
        clearPendingSave(); planRef.current = null; initial.current = null; samples.current = []; lastSample.current = -1;
        replace(structuredClone(sceneBaseline.current!)); receiptRef.current = null; setLastReceipt(null); setComparison(null);
        say('Local kitchen reset. Saved service records remain available.', 'tool');
        return { completed: true, summary: 'Local mobile scene reset completed.' };
      }
      const result = applyMobileControl(ref.current, next.control); replace(result.world); if (initial.current) record(result.world, true);
      if (next.control === 'stop') { planRef.current = null; queueRef.current = []; setQueue([]); const receipt = { status: 'cancelled', verified: false }; receiptRef.current = receipt; setLastReceipt(receipt); archiveAttempt(result.world, receipt); }
      say(result.error ?? result.blocked ?? `Control ${next.control} applied.`, result.error ? 'error' : result.blocked || next.control === 'pause' ? 'warning' : 'tool');
      return { completed: !result.error && !result.blocked, summary: result.error ?? result.blocked ?? `Control ${next.control} applied.`, world: result.world };
    }
    if (['running', 'paused'].includes(ref.current.robot.mode) || planningRef.current) {
      try {
        const pending = enqueueSandboxTask(queueRef.current, text); queueRef.current = pending; setQueue(pending);
        queuedContexts.current.set(pending.at(-1)!.id, context);
        say(`Queued task ${pending.length}: ${text}. Its source, route and reach will be checked against the scene when it starts.`, 'tool');
        return { completed: false, status: 'queued', summary: `Task queued at position ${pending.length}; it has not executed yet.`, queuedCommand: text };
      } catch (error) { return refuse(error instanceof Error ? error.message : 'Task queue is full.'); }
    }
    if (next.error) {
      // Geometry, custody, explicit source and already-satisfied results are authoritative.
      // Only language outside the local grammar needs a model interpretation.
      if (!/Name one destination|Use one known object|Choose Cup or Bowl/.test(next.error)) {
        receiptRef.current = { status: 'rejected', verified: false, error: next.error, command: text }; setLastReceipt(receiptRef.current); return refuse(next.error);
      }
      const serial = ++intentSerial.current, controller = new AbortController(); intentRequest.current = controller;
      planningRef.current = true; setPlanning(true); receiptRef.current = { status: 'planning', verified: false, command: text }; setLastReceipt(receiptRef.current);
      say('Interpreting the instruction against the current objects and supported actions. No motion has started.', 'context');
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch('/api/mobile/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ world: ref.current, command: text }), signal: controller.signal });
        const data = await response.json();
        if (serial !== intentSerial.current) return { completed: false, status: 'cancelled', summary: 'Interpretation cancelled before execution.' };
        if (!response.ok || !Array.isArray(data.tasks)) throw new Error(data.error ?? 'The instruction could not be interpreted.');
        say(`Planner: ${data.model ?? 'configured LLM'} · ${Math.round(data.requestDurationMs ?? 0)} ms. ${data.reply}`, 'plan');
        if (!data.tasks.length) { receiptRef.current = { status: 'clarification', verified: false, command: text }; setLastReceipt(receiptRef.current); announceRef.current(data.reply); return { completed: false, status: 'clarification', summary: data.reply }; }
        const commands: string[] = data.tasks.map((task: { objectId?: string; stationId: string; mode?: 'carry' | 'deliver' }) => task.objectId ? `${task.mode === 'carry' ? 'Carry' : 'Take'} ${task.objectId} to ${task.stationId}` : `Go to ${task.stationId}`);
        const interpreted = planMobileTask(commands[0], ref.current);
        if (interpreted.error) throw new Error(interpreted.error);
        let followUps: SandboxTask[] = [];
        for (const instruction of commands.slice(1)) followUps = enqueueSandboxTask(followUps, instruction);
        if (followUps.length + queueRef.current.length > 12) throw new Error('This instruction exceeds the pending task limit. Finish or remove queued work first.');
        for (const task of followUps) queuedContexts.current.set(task.id, context);
        queueRef.current = [...followUps, ...queueRef.current]; setQueue(queueRef.current);
        interpreted.rationale.forEach(rationale => say(rationale, 'plan'));
        say(`${interpreted.steps.length} declared steps: ${interpreted.steps.map(step => step.label).join(' → ')}`, 'plan');
        currentRequest.current = requestContext; planRef.current = interpreted; return startPrepared();
      } catch (error) {
        if (serial !== intentSerial.current) return { completed: false, status: 'cancelled', summary: 'Interpretation cancelled before execution.' };
        const message = error instanceof Error && error.name === 'AbortError' ? 'Instruction interpretation timed out. No motion was started.' : error instanceof Error ? error.message : 'Instruction interpretation is unavailable.';
        receiptRef.current = { status: 'rejected', verified: false, error: message, command: text }; setLastReceipt(receiptRef.current); return refuse(message);
      } finally { clearTimeout(timeout); if (serial === intentSerial.current) { planningRef.current = false; setPlanning(false); intentRequest.current = null; } }
    }
    say('Planner source: bounded local mobile skills on the current known map.', 'context');
    next.rationale.forEach(rationale => say(rationale, 'plan'));
    say(`${next.steps.length} declared steps: ${next.steps.map(step => step.label).join(' → ')}`, 'plan');
    planRef.current = next; // The exact parsed task is available synchronously before execution.
    return startPrepared();
  };

  useEffect(() => {
    onBridge({ command: (text, context) => handler.current(text, context), recordTranscript: turn => experiment.transcript(turn), recordAudio: segment => experiment.audio(segment), recordingStatus: status => experiment.recordingStatus(status), finishExperiment: async () => { await experiment.finish(ref.current); }, getWorld: () => ({ ...ref.current, sceneInventory: kitchenSceneInventory(ref.current), navigationDistances: navigationDistanceContext(ref.current), experimentRecording: experiment.active, reviewingRecordedEpisode: Boolean(replayRef.current), pendingEvidenceReview: false,
      pendingEvidenceSave: savingRef.current, latestServiceReport: savedRecordRef.current?.report ?? null, environmentId: hall ? 'photo-hall' : 'mobile-kitchen', executionReceipt: receiptRef.current, simulationAutoApproval: false, executionMode: 'immediate', sandboxMode: 'persistent', simulationSessionPaused: sessionPausedRef.current, reviewingSimulationTest: Boolean(inspectionRef.current), pendingSandboxTasks: queueRef.current.map(task => task.command) }) });
    return () => onBridge(null);
  }, [onBridge]);
  useEffect(() => {
    if (['connecting', 'connected', 'live'].includes(voiceStatus) && !experiment.active) experiment.begin(ref.current);
    if (voiceStatus === 'disconnected' && experiment.active) void experiment.finish(ref.current);
  }, [voiceStatus]);
  useEffect(() => { if (experiment.last?.status === 'draft') setSaveExperimentOpen(true); }, [experiment.last?.experiment.id, experiment.last?.status]);
  useEffect(() => { for (const turn of voiceTranscripts) experiment.transcript(turn); }, [voiceTranscripts]);
  useEffect(() => {
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000) * speed; last = now;
      experiment.sample(ref.current);
      if (!sessionPausedRef.current && ref.current.robot.mode === 'idle' && receiptRef.current?.status === 'succeeded' && queueRef.current.length && !savingRef.current && !plannerRef.current && !libraryRef.current && !replayRef.current && !inspectionRef.current) {
        const [next, ...remaining] = queueRef.current; queueRef.current = remaining; setQueue(remaining);
        receiptRef.current = { status: 'dispatching', verified: false }; setLastReceipt(receiptRef.current);
        say(`Dispatching queued instruction from the current scene: ${next.command}`, 'tool');
        const context = queuedContexts.current.get(next.id); queuedContexts.current.delete(next.id); void handler.current(next.command, context);
      }
      if (!sessionPausedRef.current && ref.current.robot.mode === 'running') {
        const previous = ref.current.events.length, result = advanceMobileWorld(ref.current, dt); replace(result.world); record(result.world);
        if (result.blocked) { receiptRef.current = { status: 'paused', verified: false, reason: result.blocked }; setLastReceipt(receiptRef.current); announceRef.current('No clear route reaches the destination. Mobile motion is paused.'); }
        else if (result.error) { say(result.error, 'error'); receiptRef.current = { status: 'failed', verified: false, error: result.error }; setLastReceipt(receiptRef.current); archiveAttempt(result.world, receiptRef.current); announceRef.current(`Mobile attempt stopped: ${result.error}`); }
        else if (result.done) {
          const outcome = mobileCompletionOutcome(result.world); receiptRef.current = outcome.receipt; setLastReceipt(outcome.receipt); archiveAttempt(result.world, outcome.receipt); say(outcome.summary, outcome.verified ? 'success' : 'error');
          append(outcome.receipt.checks.map(check => ({ time: result.world.simTime, kind: 'check', text: `${check.passed ? 'PASS' : 'FAIL'} · ${check.name}` })));
          announceRef.current(outcome.announcement);
        } else if (result.world.events.length > previous) {
          const event = result.world.events.at(-1); if (event && (['reach-check', 'pickup', 'place'].includes(event.kind) || /rerouted around/i.test(event.message))) announceRef.current(event.message);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [speed]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setFull(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  useEffect(() => () => { generation.current++; saveRequest.current?.abort(); intentSerial.current++; intentRequest.current?.abort(); if (humanPositionTimer.current) clearTimeout(humanPositionTimer.current); }, []);
  useEffect(() => {
    if (!placingHuman) return;
    const move = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || !ref.current.human || savingRef.current || replayRef.current) return;
      const delta: Record<string, MobilePoint> = { ArrowLeft: [-.25, 0], ArrowRight: [.25, 0], ArrowUp: [0, -.25], ArrowDown: [0, .25] };
      if (!delta[event.key]) return;
      event.preventDefault(); const current = ref.current.human.position;
      placeHuman([current[0] + delta[event.key][0], current[1] + delta[event.key][1]]);
    };
    window.addEventListener('keydown', move); return () => window.removeEventListener('keydown', move);
  }, [placingHuman]);
  useEffect(() => {
    if (!storedReplay?.playing) return;
    const timer = setInterval(() => setStoredReplay(current => current ? { ...current, frame: Math.min(current.record.evidence.payload.trajectory.length - 1, current.frame + 1), playing: current.frame + 1 < current.record.evidence.payload.trajectory.length - 1 } : null), 100);
    return () => clearInterval(timer);
  }, [storedReplay?.playing]);

  const prepareEvidence = async () => {
    if (!initial.current) throw new Error('Run or stop a mobile task before saving evidence.');
    if (!attemptId.current && mostRecentAttempt.current && mostRecentAttempt.current.payload.finalWorld.mission?.plan.id === ref.current.mission?.plan.id) return sealMobilePayload(mostRecentAttempt.current.payload);
    return sealMobilePayload(createMobileEvidence(initial.current, samples.current, ref.current, receiptRef.current));
  };
  const exportEvidence = async () => {
    try {
      const envelope = storedReplay ? storedReplay.record.evidence : frozenSave.current ?? await prepareEvidence();
      const url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'teachtrace-mobile-evaluation.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('Exported the native recording, checks and simulation limits. No human quality review is asserted.', 'tool');
    } catch (error) { say(error instanceof Error ? error.message : 'The mobile recording is inconsistent.', 'error'); }
  };
  const saveEvidence = async () => {
    if (savingRef.current || storedReplay || ['running', 'paused'].includes(ref.current.robot.mode)) return;
    savingRef.current = true; setSaving(true); const currentGeneration = generation.current;
    const controller = new AbortController(); saveRequest.current = controller; const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const evidence = frozenSave.current ?? await prepareEvidence(); frozenSave.current = evidence;
      if (generation.current !== currentGeneration || controller.signal.aborted) return;
      say('Saving the exact sealed recording to the local API. Review status: Unreviewed.', 'tool');
      const response = await fetch('/api/mobile/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evidence, review: { approved: false, identityVerified: false, source: 'operator-save' } }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.saved || !data.id || !data.report) throw new Error(data.error ?? 'The local service did not confirm a saved mobile record.');
      if (generation.current !== currentGeneration || controller.signal.aborted) return;
      const saved = { id: data.id, savedAt: data.savedAt, report: data.report, evidence }; setSavedRecord(saved); savedRecordRef.current = saved;
      say(`Saved ${saved.id} · task ${saved.report.accepted ? 'accepted' : 'not accepted'} · Unreviewed. ${saved.report.summary}`, saved.report.accepted ? 'success' : 'warning');
      announceRef.current('The mobile recording was saved. It remains unreviewed; the local service report preserves its actual task outcome.');
    } catch (error) { if (generation.current === currentGeneration) say(`${error instanceof Error ? error.message : 'The evidence service is unavailable.'} The same frozen recording is available for export or retry.`, 'error'); }
    finally { clearTimeout(timeout); if (generation.current === currentGeneration) { savingRef.current = false; setSaving(false); saveRequest.current = null; } }
  };
  const compare = () => {
    const result = runMobileComparison(initial.current ?? ref.current, ref.current.mission?.plan.command ?? 'Take cup from counter to sink'); setComparison(result);
    say(`Same-scene comparison: fixed base ${result.fixedBase.outcome}; mobile ${result.mobileBase.taskAccepted ? 'task accepted' : result.mobileBase.outcome}.`, 'check');
  };
  const exportComparison = () => {
    if (!comparison) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'teachtrace-mobile-comparison.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportSessionAttempt = async (attempt: SessionAttempt) => {
    const evidence = await sealMobilePayload(attempt.payload);
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `teachtrace-sandbox-${attempt.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Exported recorded sandbox attempt: ${attempt.command}. Review status: Unreviewed.`, 'tool');
  };
  const runNextQueued = () => {
    if (['running', 'paused'].includes(ref.current.robot.mode) || !queueRef.current.length) return;
    const [next, ...remaining] = queueRef.current; queueRef.current = remaining; setQueue(remaining); const context = queuedContexts.current.get(next.id); queuedContexts.current.delete(next.id); void handler.current(next.command, context);
  };
  const startSimulation = async () => {
    if (sessionAction) return;
    if (experiment.last?.status === 'draft') { setSaveExperimentOpen(true); return; }
    setSessionAction(sessionPausedRef.current ? 'resuming' : 'starting');
    try {
      if (sessionPausedRef.current && ['live', 'connected'].includes(voiceStatus)) {
        await onPauseVoice(false); sessionPausedRef.current = false; setSessionPaused(false); experiment.event('session-resumed', {source:'operator-control'}, ref.current.simTime);
        if (ref.current.robot.mode === 'paused') await handler.current('resume');
        say('Simulation resumed. Listening for your next instruction.', 'system');
      } else { sessionPausedRef.current = false; setSessionPaused(false); if (voiceStatus === 'error') await onDisconnect(); experiment.begin(ref.current); await onVoice(); }
    } catch (error) { say(error instanceof Error ? error.message : 'Simulation could not start.', 'error'); }
    finally { setSessionAction(null); }
  };
  const pauseSimulation = async () => {
    if (sessionAction) return;
    sessionPausedRef.current = true; setSessionPaused(true); setSessionAction('pausing'); experiment.event('session-paused', {source:'operator-control'}, ref.current.simTime);
    intentSerial.current++; intentRequest.current?.abort(); planningRef.current = false; setPlanning(false);
    if (ref.current.robot.mode === 'running') await handler.current('pause');
    try { await onPauseVoice(true); say('Simulation paused. Robot motion, microphone input and audio playback are held; the connection stays open.', 'system'); }
    catch (error) { say(`${error instanceof Error ? error.message : 'Audio pause was not confirmed.'} Robot motion remains held.`, 'error'); }
    finally { setSessionAction(null); }
  };
  const stopSimulation = async () => {
    if (sessionAction === 'stopping') return;
    setSessionAction('stopping'); sessionPausedRef.current = true;
    try {
      await handler.current('stop');
      let shutdownError: unknown = null;
      try { await onDisconnect(); } catch (error) { shutdownError = error; }
      await experiment.finish(ref.current);
      if(shutdownError) say(`${shutdownError instanceof Error ? shutdownError.message : 'Remote voice shutdown was not confirmed.'} Local recording is frozen; keep this draft and retry cleanup before starting another session.`, 'error');
      else say('Simulation stopped. Voice ended, pending tasks cleared, and this scene remains open.', 'system');
    } catch (error) { say(error instanceof Error ? error.message : 'Voice shutdown was not confirmed. Robot motion is stopped.', 'error'); }
    finally { sessionPausedRef.current = false; setSessionPaused(false); setSessionAction(null); }
  };
  const displayWorld = storedReplay?.record.evidence.payload.trajectory[storedReplay.frame]?.world ?? world;
  const telemetryWorld = useMemo(() => displayWorld, [Math.floor(displayWorld.simTime * 10), displayWorld.revision, displayWorld.robot.mode, storedReplay?.frame]);
  const arm = solveMobileArm(displayWorld), checks = mobileGoalChecks(displayWorld), missionSteps = displayWorld.mission?.plan.steps ?? [];
  const reachTarget = displayWorld.objects.find(object => object.id === (displayWorld.mission?.plan.goal?.objectId ?? 'cup')) ?? displayWorld.objects[0];
  const reach = reachTarget ? mobileObjectReach(displayWorld, reachTarget.id) : null, locked = saving || Boolean(storedReplay), active = ['running', 'paused'].includes(world.robot.mode);

  const SceneRenderer = (displayWorld as MobileWorld & {environmentId?:string}).environmentId === 'photo-hall' ? PhotoHallScene : MobileKitchenScene;
  const applyRoom = (spec: PhotoRoomSpec, reference: ReferenceFingerprint) => {
    if (active || saving || planning || experiment.active || experiment.last?.status === 'draft') throw new Error('Stop and finish the current experiment before changing the estimated room.');
    const next = createPhotoHallWorldFromSpec(spec, reference);
    sceneBaseline.current = structuredClone(next);clearPendingSave();initial.current=null;samples.current=[];lastSample.current=-1;planRef.current=null;mostRecentAttempt.current=null;receiptRef.current=null;setLastReceipt(null);setComparison(null);queueRef.current=[];setQueue([]);setStoredReplay(null);replace(next);
    try { localStorage.setItem('robotrace.photo-room.v1',JSON.stringify({spec,reference})); } catch { say('Room applied for this session; browser storage is unavailable.','warning'); }
    setRoomBuilderOpen(false);say(`Applied ${spec.title}: ${spec.fixtures.length} estimated furniture footprints, ${spec.widthMeters} × ${spec.depthMeters} m. Reference SHA ${reference.sha256.slice(0,12)}; no calibrated reconstruction or source photo is stored.`, 'context');
  };
  return <div className={`mobile-workspace${full ? ' mobile-full' : ''}`}>
    <header><button className="button button-secondary" disabled={saving || active || planning || voiceStatus === 'connecting'} onClick={() => { if (experiment.active || experiment.last?.status === 'draft') {exitAfterSave.current = true;void stopSimulation().then(() => setSaveExperimentOpen(true));} else onBack();}}><ArrowLeft size={13}/> Workcell</button><div><span className="eyebrow">ROBOTRACE · {hall ? 'ESTIMATED ROOM NAVIGATION' : 'MOBILE MANIPULATION TEST'}</span><h1>{hall ? 'Photo-informed office hall' : 'Free Kitchen Navigation Environment'}</h1></div><span className="state-pill">{storedReplay ? 'Recorded replay' : world.robot.mode}</span>{hall && <button className="button button-secondary" disabled={saving || active || planning || experiment.active || experiment.last?.status === 'draft' || Boolean(storedReplay)} onClick={() => setRoomBuilderOpen(true)}>Upload room photo</button>}<button className="button button-secondary" disabled={saving || active || planning} onClick={() => setLibraryOpen(true)}>Saved recordings</button><button className="button button-secondary" aria-label="AI deployment checks" disabled={locked || planning} onClick={() => setExperimentOpen(true)}>QA console</button><button className="button button-secondary" onClick={() => setFull(!full)}>{full ? 'Show terminal' : 'Simulation only'}</button></header>
    <div className="mobile-body"><section className="mobile-viewport"><div className="mobile-scene-toolbar"><span>{hall ? 'PHOTO-INFORMED OFFICE · ESTIMATED METERS' : 'KITCHEN SANDBOX · METERS'}</span><div><button className="view-button" disabled={locked} aria-pressed={placingHuman} onClick={() => {setPlacingHuman(value => !value);setPlacingBlock(false);setRobotEye(false);setTop(true);}}>{placingHuman ? 'Done placing' : 'Place person'}</button><button className="view-button" disabled={locked} aria-pressed={placingBlock} onClick={() => {setPlacingBlock(value => !value);setPlacingHuman(false);setRobotEye(false);setTop(true);}}>{placingBlock ? 'Done placing block' : 'Place block'}</button>{world.obstacles.some(obstacle => obstacle.id === 'sandbox-floor-block') && <button className="view-button" disabled={locked} onClick={() => placeBlock(null)}>Remove block</button>}<button className="view-button" onClick={() => {setRobotEye(false);setTop(false);setPlacingHuman(false);setPlacingBlock(false);}}>Orbit</button>{!hall && <button className="view-button" aria-pressed={robotEye} onClick={()=>setRobotEye(value=>!value)}>RoboEye</button>}<button className="view-button" aria-pressed={inventoryOpen} onClick={()=>setInventoryOpen(value=>!value)}>Objects</button><button className="view-button" onClick={() => {setRobotEye(false);setTop(true);}}>Top</button></div></div><SceneRenderer {...(!hall ? {robotEye} : {})} world={displayWorld} top={top} onPlaceHuman={!locked ? placingHuman ? placeHuman : placingBlock ? point => placeBlock(point) : undefined : undefined}/>{(placingHuman || placingBlock) && !locked && <div className="mobile-placement-hint">Click open floor to place or move the {placingBlock ? 'block' : 'person'}. Click again to reposition.</div>}{inventoryOpen && <section className="scene-inventory-panel" aria-label="Known scene inventory"><header><strong>Scene inventory</strong><button onClick={()=>setInventoryOpen(false)} aria-label="Close scene inventory">×</button></header><small>Known scene metadata · not camera detection</small>{kitchenSceneInventory(displayWorld).surfaces.filter(surface=>surface.itemCount>0).map(surface=><details key={surface.id} open><summary>{surface.label} · {surface.itemCount} items</summary>{kitchenSceneInventory(displayWorld).items.filter(item=>item.surfaceId===surface.id).map(item=><div key={item.id}><span>{item.label}</span><small>{item.manipulable?'Movable':'Fixed · identify only'}</small></div>)}</details>)}</section>}<div className="mobile-phase">{robotEye && !hall ? "RoboEye · simulated camera, known scene · " : ""}{storedReplay ? 'RECORDED REPLAY · ' : ''}{displayWorld.robot.phase}</div>{placingHuman && !locked && <section className="human-position-controls" aria-label="Human position controls"><strong>Position person</strong>{world.human ? <><label>Floor X <output>{world.human.position[0].toFixed(2)} m</output><input type="range" aria-label="Human floor X" min={world.bounds.minX + .43} max={world.bounds.maxX - .43} step="0.05" value={world.human.position[0]} onChange={event => adjustHumanPosition(0, Number(event.target.value))}/></label><label>Floor Z <output>{world.human.position[1].toFixed(2)} m</output><input type="range" aria-label="Human floor Z" min={world.bounds.minZ + .43} max={world.bounds.maxZ - .43} step="0.05" value={world.human.position[1]} onChange={event => adjustHumanPosition(1, Number(event.target.value))}/></label><div className="human-position-nudges">{[{label:'Move person left',text:'←',axis:0,delta:-.25},{label:'Move person up',text:'↑',axis:1,delta:-.25},{label:'Move person down',text:'↓',axis:1,delta:.25},{label:'Move person right',text:'→',axis:0,delta:.25}].map(action => <button key={action.label} aria-label={action.label} onClick={() => {const position = [...ref.current.human!.position] as MobilePoint;position[action.axis] += action.delta;placeHuman(position);}}>{action.text}</button>)}</div><small>Arrow keys · 0.25 m steps · click floor to relocate</small><button className="text-button" onClick={() => void handler.current('human clear')}>Remove person</button></> : <><small>Click open floor to place a person.</small><button className="text-button" onClick={() => void handler.current('human enter')}>Place ahead of robot</button></>}</section>}
      {storedReplay && <div className="mobile-saved-replay"><button className="button button-secondary" onClick={() => setStoredReplay(value => value ? { ...value, playing: !value.playing } : null)}>{storedReplay.playing ? 'Pause replay' : 'Play recording'}</button><input type="range" aria-label="Seek saved mobile recording" min={0} max={storedReplay.record.evidence.payload.trajectory.length - 1} value={storedReplay.frame} onChange={event => setStoredReplay(value => value ? { ...value, frame: Number(event.target.value), playing: false } : null)}/><button className="button button-primary" onClick={() => setStoredReplay(null)}>Return to live kitchen</button></div>}

      <div className="mobile-metrics"><span>Base travel <b>{displayWorld.distanceTravelled.toFixed(2)} m</b></span><span>Arm reach <b>{displayWorld.robot.armReach.toFixed(2)} m</b></span><span>Simulation <b>{displayWorld.simTime.toFixed(1)} s</b></span></div></section>
      <aside className="mobile-copilot"><VoiceConversation audioActivity={voiceAudioActivity} entries={voiceTranscripts} status={voiceStatus} paused={sessionPaused} controls={<>
        {(!['live', 'connected'].includes(voiceStatus) || sessionPaused) && <button className="simulation-control-primary" disabled={Boolean(sessionAction) || voiceStatus === 'connecting'} onClick={() => void startSimulation()}>{sessionPaused ? 'Resume simulation' : voiceStatus === 'connecting' ? 'Starting simulation…' : 'Start simulation'}</button>}
        {['live', 'connected'].includes(voiceStatus) && !sessionPaused && <button disabled={Boolean(sessionAction)} onClick={() => void pauseSimulation()}>Pause simulation</button>}
        <button className="simulation-control-stop" disabled={sessionAction === 'stopping' || (!['live', 'connected', 'connecting'].includes(voiceStatus) && !active && !planning && !sessionPaused && !experiment.activeId)} onClick={() => void stopSimulation()}>{sessionAction === 'stopping' ? 'Stopping…' : 'Stop simulation'}</button>
      </>}/><ActivityTerminal entries={entries} title="Activity terminal" toolbar={<div className="terminal-view-tabs" role="tablist" aria-label="Activity terminal view"><button role="tab" aria-selected={terminalTab === 'activity'} onClick={() => setTerminalTab('activity')}>Activity</button><button role="tab" aria-selected={terminalTab === 'coordinates'} onClick={() => setTerminalTab('coordinates')}>Coordinates</button></div>} body={terminalTab === 'coordinates' ? <LiveCoordinates world={telemetryWorld} initialWorld={initial.current}/> : undefined} status={`${sessionPaused ? 'paused' : planning ? 'interpreting' : storedReplay ? 'replay' : world.robot.mode} · ${voiceStatus === 'live' ? 'Agora + Murf live' : 'local simulation'}`}>
        <div className="experiment-recording-status" data-recording={Boolean(experiment.activeId)}>{experiment.activeId ? <><span className="experiment-record-dot"/>Recording experiment · {experiment.counts.elapsedSeconds.toFixed(0)} s<small>{experiment.counts.attempts} actions · {experiment.counts.transcripts} caption updates · {experiment.counts.clips} audio clips</small></> : experiment.last ? <>Experiment {experiment.last.status === 'draft' ? 'ready to save' : experiment.last.status === 'saved' ? 'saved' : experiment.last.status === 'saving' ? 'saving…' : 'save failed'}<small>{experiment.last.report.counts.passed} passed · {experiment.last.report.counts.failed} failed · {experiment.last.report.counts.unscored} unscored</small><button className="text-button" onClick={() => experiment.exportLast()}>Export JSONL</button>{experiment.last.status === 'draft' && <button className="text-button" onClick={() => setSaveExperimentOpen(true)}>Save & evaluate</button>}{experiment.last.status === 'error' && <button className="text-button" onClick={() => void experiment.retry()}>Retry save</button>}</> : <>Start simulation to record a new experiment.</>}{experiment.audioStatus?.state === 'error' && <small className="experiment-recording-error">Audio: {experiment.audioStatus.error}</small>}{experiment.last?.error && <small className="experiment-recording-error">{experiment.last.error}</small>}{Boolean(experiment.last?.audioErrors?.length) && <><small className="experiment-recording-error">{experiment.last!.audioErrors!.length} audio clips need retry.</small><button className="text-button" disabled={experiment.last?.status === 'saving'} onClick={() => void experiment.retry()}>Retry audio save</button></>}</div><div className="mobile-terminal-context"><span>{reachTarget && reach ? `${reachTarget.label}: ${reach.distance.toFixed(2)} m / ${reach.armReach.toFixed(2)} m reach` : 'Navigation only · no manipulation objects'}</span><span>{saving ? 'Saving exact recording…' : storedReplay ? 'Read-only recording' : 'Immediate simulation'}</span></div>
        {missionSteps.length > 0 && <details className="mobile-terminal-details"><summary>{displayWorld.mission?.completedSteps ?? 0}/{missionSteps.length} steps verified · action queue</summary><div>{missionSteps.map((step, index) => <div className={`mobile-step ${index < (displayWorld.mission?.completedSteps ?? 0) ? 'done' : ''}`} key={index}>{index < (displayWorld.mission?.completedSteps ?? 0) ? <Check size={12}/> : <span>{index + 1}</span>}<p>{step.label}</p></div>)}</div></details>}
        {initial.current && !active && !storedReplay && !planning && !['rejected', 'clarification'].includes(String(lastReceipt?.status)) && <div className="mobile-terminal-evidence"><button className="button button-primary" disabled={saving} onClick={() => void saveEvidence()}>{saving ? <Loader2 className="spin" size={12}/> : null}{saving ? 'Saving mobile evidence…' : 'Save mobile evidence'}</button><button className="button button-secondary" disabled={saving} onClick={() => void exportEvidence()}>Export mobile evaluation</button><small>Unreviewed · no human quality approval asserted</small></div>}
        {(storedReplay || savedRecord) && <details className="mobile-terminal-details mobile-saved-report"><summary>Saved · task {(storedReplay?.record ?? savedRecord)!.report.accepted ? 'accepted' : 'not accepted'} · Unreviewed</summary><p>{(storedReplay?.record ?? savedRecord)!.report.summary}</p><small>{(storedReplay?.record ?? savedRecord)!.id}</small><button className="text-button" onClick={() => {const saved = (storedReplay?.record ?? savedRecord)!;setInspectedAttempt({id:saved.id,command:saved.evidence.payload.finalWorld.mission?.plan.command ?? 'Recorded task',outcome:saved.report.accepted?'succeeded':'not accepted',payload:saved.evidence.payload});}}>Compare before and after</button>{storedReplay && <button className="button button-secondary" onClick={() => void exportEvidence()}>Export saved mobile recording</button>}</details>}
        {initial.current && !active && !planning && !['rejected', 'clarification'].includes(String(lastReceipt?.status)) && <details className="mobile-terminal-details"><summary>{checks.filter(check => check.passed).length}/{checks.length} current task checks</summary>{checks.map(check => <div className="outcome-check" key={check.id}><span>{check.name}</span><strong>{check.passed ? 'Passed' : 'Not passed'}</strong></div>)}</details>}
      </ActivityTerminal>
      {(queue.length > 0 || attempts.length > 0) && <details className="mobile-sandbox-history" open={queue.length > 0 ? true : undefined}><summary>{queue.length} queued · {attempts.length} recent recorded tasks</summary>{queue.length > 0 && <div className="sandbox-queue" aria-label="Pending sandbox tasks">{queue.map((task, index) => <div key={task.id}><span>{index + 1}. {task.command}</span><button disabled={locked || index === 0} aria-label={`Move queued task ${index + 1} up`} onClick={() => setQueue(previous => reorderSandboxTask(previous, task.id, -1))}>↑</button><button disabled={locked || index === queue.length - 1} aria-label={`Move queued task ${index + 1} down`} onClick={() => setQueue(previous => reorderSandboxTask(previous, task.id, 1))}>↓</button><button disabled={locked} aria-label={`Remove queued task ${index + 1}`} onClick={() => setQueue(previous => previous.filter(item => item.id !== task.id))}>×</button></div>)}<button className="text-button" disabled={locked || active} onClick={runNextQueued}>Run next queued task</button><small>Queue pauses on errors or blocked motion. Stop clears pending tasks.</small></div>}{attempts.length > 0 && <div className="sandbox-attempts" aria-label="Recent sandbox recordings">{attempts.map(attempt => <div key={attempt.id}><span>{attempt.command}<small>{attempt.outcome} · {(attempt.payload.finalWorld.simTime - attempt.payload.initialWorld.simTime).toFixed(1)} s · {(attempt.payload.finalWorld.distanceTravelled - attempt.payload.initialWorld.distanceTravelled).toFixed(2)} m</small></span><button className="text-button" onClick={() => setInspectedAttempt(attempt)}>Compare test</button><button className="text-button" onClick={() => void exportSessionAttempt(attempt)}>Export task</button></div>)}<small>Latest 8 task traces in this open session. Export to retain them before leaving.</small></div>}</details>}
      <details className="mobile-terminal-tools"><summary>Telemetry & comparison</summary><div className="mobile-telemetry"><p>Base: {displayWorld.robot.position.map(value => value.toFixed(3)).join(', ')} m · yaw {displayWorld.robot.yaw.toFixed(3)} rad</p>{Object.entries(arm.jointAngles).map(([name, value]) => <p key={name}>{name}: {value.toFixed(3)} rad</p>)}<p>TCP: {arm.objectTCP.map(value => value.toFixed(3)).join(', ')} m · gripper {arm.gripperOpen === 0 ? 'closed' : 'open'}</p><p>{samples.current.length} recorded states · derived coordinates</p></div>{!hall && <button className="text-button" disabled={locked || active} onClick={compare}>Compare fixed vs mobile reach</button>}{comparison && <><p>{comparison.results.map(result => `${result.label}: ${result.taskAccepted ? 'accepted' : result.outcome}`).join(' · ')}</p><button className="text-button" onClick={exportComparison}>Export reach comparison</button></>}</details>
      <div className="mobile-actions"><button className="button button-secondary" disabled={locked} onClick={() => void handler.current(world.human ? 'human clear' : 'human enter')}>{world.human ? 'Clear human' : 'Human enters'}</button><button className="text-button" disabled={locked || !active} onClick={() => { const mission = ref.current.mission; const step = mission?.plan.steps.slice(mission.stepIndex).find(step => step.kind === 'navigate'); const station = ref.current.stations.find(station => station.id === step?.stationId); if (step?.kind === 'navigate' && step.target) placeHuman([...step.target]); else if (station) placeHuman([...station.dock]); }}>Block destination</button><button className="text-button" disabled={locked} onClick={() => void handler.current('reset')}>Reset</button><select aria-label="Mobile simulation speed" value={speed} disabled={locked} onChange={event => setSpeed(Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>{value}×</option>)}</select></div>

      <div className="mobile-voice"><span>English · Hindi · Hinglish input</span><span role="status" aria-live="polite">{voiceStatus}</span>{voiceStatus === 'error' && <button className="text-button" onClick={onResetVoice}><RotateCcw size={12}/> Reset connection</button>}{voiceErrorMessage && <p role="alert">{voiceErrorMessage}</p>}</div></aside></div>
    <footer>Software evaluation · Known map · Idealized arm and attachment · No SLAM, contact dynamics or real-robot transfer validation.</footer>
    {roomBuilderOpen && <div className="experiment-save-backdrop" role="dialog" aria-modal="true" aria-label="Photo room builder"><PhotoRoomBuilder onClose={() => setRoomBuilderOpen(false)} onApply={applyRoom}/></div>}
    {saveExperimentOpen && experiment.last && <div className="experiment-save-backdrop"><section className="experiment-save-dialog" role="dialog" aria-modal="true" aria-label="Finish experiment"><span className="eyebrow">RECORDING STOPPED · SCENE PRESERVED</span><h2>Save this experiment?</h2><p>Keep what you said, the interpreted commands, actual robot trajectories and separate voice clips. Compare the request with the observed action.</p><dl><div><dt>Duration</dt><dd>{((experiment.last.experiment.endedAt - experiment.last.experiment.startedAt) / 1000).toFixed(0)} s</dd></div><div><dt>Recorded actions</dt><dd>{experiment.last.experiment.attempts.length}</dd></div><div><dt>Speech snapshots</dt><dd>{experiment.last.experiment.transcripts.length}</dd></div><div><dt>Audio clips</dt><dd>{experiment.counts.clips}</dd></div></dl><small>Unreviewed simulator evidence. Ambiguous speech is unscored; a different successful action does not satisfy the original request.</small>{experiment.last.error && <p role="alert" className="experiment-recording-error">{experiment.last.error}</p>}<div><button className="button button-primary" disabled={experiment.last.status === 'saving'} onClick={() => {void experiment.retry().then(saved => {if (saved) {setSaveExperimentOpen(false);if(exitAfterSave.current){exitAfterSave.current=false;onBack();}else setExperimentOpen(true);}});}}>{experiment.last.status === 'saving' ? 'Saving recording…' : 'Save & view report'}</button><button className="button button-secondary" disabled={experiment.last.status === 'saving'} onClick={() => {void experiment.retry().then(saved => {if(saved){setSaveExperimentOpen(false);if(exitAfterSave.current){exitAfterSave.current=false;onBack();}}});}}>Save recording</button><button className="text-button" disabled={experiment.last.status === 'saving'} onClick={() => {experiment.discard();setSaveExperimentOpen(false);if(exitAfterSave.current){exitAfterSave.current=false;onBack();}}}>Discard</button></div></section></div>}
    {experimentOpen && <Suspense fallback={null}><ExperimentConsole latest={experiment.last} onClose={() => setExperimentOpen(false)} onBenchmarks={() => {setExperimentOpen(false);if(hall){say('Room navigation is evaluated in the experiment report; manipulation benchmarks require the kitchen objects.', 'context');}else setPlannerOpen(true);}}/></Suspense>}
    {inspectedAttempt && <Suspense fallback={null}><SimulationTestComparison attempt={inspectedAttempt} onClose={() => setInspectedAttempt(null)} onExport={() => exportSessionAttempt(inspectedAttempt)}/></Suspense>}
    {libraryOpen && <MobileRecordLibrary onClose={() => setLibraryOpen(false)} onLoad={saved => { if (['running', 'paused'].includes(ref.current.robot.mode)) { setLibraryOpen(false); say('Stop the live mission before opening a recording.', 'error'); return; } setStoredReplay({ record: saved, frame: 0, playing: false }); setLibraryOpen(false); say(`Loaded saved record ${saved.id} for read-only replay; the live scene is unchanged.`, 'tool'); }}/>} {plannerOpen && <Suspense fallback={null}><MobilePlannerBench world={initial.current ?? world} onClose={() => setPlannerOpen(false)}/></Suspense>}
  </div>;
}
