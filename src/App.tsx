import { createProtectedHistory, mergeProtectedHistoryChecks } from './sim/protected-history';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, AudioLines, Blocks, Box, Check, CheckCheck, ChevronDown, ChevronRight, Circle, CircleHelp, ClipboardCheck, Clock3, Code2, Download, Expand, FileJson, FolderOpen, Grid2X2, History, HardDrive, Layers3, ListChecks, Loader2, Mic, MousePointer2, Move3D, PanelLeftClose, Pause, Play, Plus, Radio, RotateCcw, Send, Settings2, ShieldCheck, Square, TriangleAlert, Users, Volume2, X } from 'lucide-react';
import type { MobileBridge } from './components/MobileKitchen';
import ActivityTerminal from './components/ActivityTerminal';
import type { TerminalEntry } from './components/ActivityTerminal';
import { RobotScene } from './components/RobotScene';
import { advanceWorld, DESTINATIONS, planCommand } from './sim/engine';
import type { ActionStep, CommandPlan, WorldState } from './sim/engine';
import type { EnvironmentSpec } from './components/ScenarioStudio';
import { SCENARIOS } from './sim/scenarios';
import { ENVIRONMENTS } from './sim/environments';
import { WORKPLACE_CASES } from './sim/workplace-cases';
import { taskForWorld, worldFromSceneSpec } from './sim/scene-spec';
import { draftSceneFromText } from './sim/scene-authoring';
import { worldForCommand } from './sim/command-task';
import type { EvidenceEpisode } from './data/evidence';
import type { EvaluationCampaign } from './sim/evaluation';
import type { VoiceCommandResult } from './integrations/voice';
import { mergeVoiceTranscripts } from './integrations/voice-captions';
import type { VoiceTranscript } from './integrations/voice-captions';

const MobileKitchen = lazy(() => import('./components/MobileKitchen'));
const ScenarioStudio = lazy(() => import('./components/ScenarioStudio'));
const EpisodeLibrary = lazy(() => import('./components/EpisodeLibrary'));
const PlannerBench = lazy(() => import('./components/PlannerBench'));
const EvaluationLab = lazy(() => import('./components/EvaluationLab'));

type Entry = { id: string; role: 'assistant' | 'user' | 'system' | 'robot'; text: string; time: string | number; kind?: TerminalEntry['kind'] };
type Event = { time: number; label: string; kind: 'command' | 'action' | 'success' | 'error' | 'control' };
type Sample = { time: number; world: WorldState };
type Episode = { id: string; title: string; scenarioId?: string; savedId?: string; reportId?: string; createdAt: string; duration: number; status: 'review' | 'approved'; outcome: 'completed' | 'stopped' | 'failed'; initialWorld: WorldState; samples: Sample[]; events: Event[]; completedActions: number; command: string };
type Recorder = { id: string; scenarioId: string; scenarioName: string; start: number; initialWorld: WorldState; samples: Sample[]; events: Event[]; command: string; completedActions: number; lastSample: number };
type Modal = 'connections' | 'help' | 'publish' | 'reset' | 'environments' | 'report' | 'readiness' | 'evaluation' | 'planners' | 'library' | 'human' | null;
type LayoutMode = 'studio' | 'copilot' | 'simulation';
type ServiceReport = { id: string; title: string; outcome: string; accepted: boolean; summary: string; createdAt: string; episodeId: string; acceptance: { status: string; checks: {id: string; name?: string; passed: boolean; detail?: string}[] }; metrics: {completedActions: number; sampleCount: number; durationSeconds: number} };
type Assignment = { id: string; title: string; status: 'assigned' | 'submitted'; instructions: string; command: string; acceptance: string[]; latestReport?: ServiceReport };
const STORE_KEY = 'teachtrace.episodes.v1';
const clone = <T,>(value: T): T => structuredClone(value);
const timestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const timecode = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor(seconds % 1 * 10)}`;
const defaultDestinationLabel = (id: string) => ({ 'tray-a': 'Tray A', 'tray-b': 'Tray B', reject: 'Review', table: 'Worktable' })[id] ?? id;
function voiceFailureMessage(value: unknown, fallback = 'Voice could not connect. Reset voice and try again.'): string {
  const message = (value instanceof Error ? value.message : typeof value === 'string' ? value : '').toLowerCase();
  if (/permission|notallowed|not_allowed|denied/.test(message)) return 'Microphone access was blocked. Allow microphone access, then connect again.';
  if (/notfound|notreadable|microphone/.test(message)) return 'A microphone could not be opened. Check your microphone and browser permissions.';
  if (/already active|already connected|active or starting|409/.test(message)) return 'Another voice session is active or starting. Reset voice, then reconnect.';
  if (/audio subscription/.test(message)) return 'Assistant audio could not connect. Reset voice and reconnect.';
  if (/rtc disconnected/.test(message)) return 'Voice disconnected unexpectedly. Reset voice and reconnect.';
  if (/not configured|failed to fetch|network|unavailable|local api/.test(message)) return 'Voice service is unavailable. Try again when it is available, or reset the connection.';
  return fallback;
}

function readEpisodes(): Episode[] {
  try { const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); return Array.isArray(parsed) ? parsed.slice(0, 6) : []; } catch { return []; }
}
function episodeRecord(episode: Episode) {
  const definition = taskForWorld(episode.initialWorld);
  const finalWorld = episode.samples.at(-1)?.world ?? episode.initialWorld;
  const taskChecks = definition?.successChecks(finalWorld) ?? [];
  return { task: definition ? { id: definition.id, name: definition.name, instruction: definition.instruction, acceptance: taskChecks } : null, summary: { outcome: episode.outcome, completedActions: episode.completedActions, sampleCount: episode.samples.length, taskAcceptancePassed: taskChecks.length ? taskChecks.every(check => check.passed) : null }, schema: 'teachtrace.episode.v1', controller: 'teachtrace-kinematic-v1', simulation: { type: 'kinematic', grasp: 'idealized attachment', physicalContactValidated: false, policyTrained: false }, ...episode };
}
async function downloadEpisode(episode: Episode, report?: ServiceReport) {
  const evidence = await import('./data/evidence');
  const payload = await evidence.sealEvidencePackage(evidence.buildEvidencePackage(episode, report));
  const result = await evidence.verifyEvidencePackage(payload);
  if (!result.valid) throw new Error(`Evidence validation failed: ${result.errors[0]}`);
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${episode.id}.teachtrace.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [voiceTranscripts, setVoiceTranscripts] = useState<VoiceTranscript[]>([]);
  const [mobileOpen, setMobileOpen] = useState(() => window.location.pathname.replace(/\/$/, '') === '/kitchen');
  const [mobileBridgeReady, setMobileBridgeReady] = useState(false);
  const autoVoicePending = useRef(mobileOpen && new URLSearchParams(window.location.search).get('voice') !== 'off');
  const mobileOpenRef = useRef(false);
  const mobileBridgeRef = useRef<MobileBridge | null>(null);
  const registerMobile = useCallback((bridge: MobileBridge | null) => { mobileBridgeRef.current = bridge; setMobileBridgeReady(Boolean(bridge)); }, []);
  mobileOpenRef.current = mobileOpen;
  const [world, setWorld] = useState<WorldState>(() => WORKPLACE_CASES[0].world);
  const [environment, setEnvironment] = useState<EnvironmentSpec>(() => ({ id: WORKPLACE_CASES[0].id, name: WORKPLACE_CASES[0].name, world: WORKPLACE_CASES[0].world, instruction: WORKPLACE_CASES[0].instruction }));
  const environmentRef = useRef(environment);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);
  const [layout, setLayout] = useState<LayoutMode>('copilot');
  const [evaluationResult, setEvaluationResult] = useState<EvaluationCampaign | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reports, setReports] = useState<Record<string, ServiceReport>>({});
  const [workflowRefresh, setWorkflowRefresh] = useState(0);
  const [reportOpen, setReportOpen] = useState<ServiceReport | null>(null);
  const [scenePrompt, setScenePrompt] = useState('');
  const [pendingEnvironment, setPendingEnvironment] = useState<EnvironmentSpec | null>(null);
  const worldRef = useRef(world);
  const [selectedId, setSelectedId] = useState<string | null>('robot');
  const [section, setSection] = useState<'scene' | 'episodes'>('scene');
  const [rightTab, setRightTab] = useState<'assistant' | 'mission' | 'review'>('assistant');
  const [view, setView] = useState<'perspective' | 'top' | 'robot'>('perspective');
  const [showGrid, setShowGrid] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [command, setCommand] = useState('');
  const [commandError,setCommandError]=useState<string|null>(null);
  const [entries, setEntries] = useState<Entry[]>([{ id: 'intro', role: 'system', kind: 'system', text: 'Workcell ready. Give a supported task to plan and execute it. Pause and Stop remain available.', time: timestamp() }]);
  const [autoApprove, setAutoApprove] = useState(() => localStorage.getItem('teachtrace.auto-simulation-approval') !== 'false');
  const [autoApprovalPaused, setAutoApprovalPaused] = useState(false);
  const [approvalCountdown, setApprovalCountdown] = useState<number | null>(null);
  const autoApprovalPausedRef = useRef(false);
  const autoApproveRef = useRef(autoApprove);
  const executionReceiptRef = useRef<Record<string, unknown> | null>(null);
  const [plan, setPlan] = useState<CommandPlan | null>(null);
  const [planCommandText, setPlanCommandText] = useState('');
  const [steps, setSteps] = useState<ActionStep[]>([]);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>(readEpisodes);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [autoRecord, setAutoRecord] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [replay, setReplay] = useState<{ episode: Episode; index: number; playing: boolean } | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const voiceAttemptRef = useRef(false);
  const voiceOperationRef = useRef(0);
  const voiceResettingRef = useRef(false);
  const [voiceState, setVoiceState] = useState<'disconnected' | 'connecting' | 'connected' | 'live' | 'error'>('disconnected');
  const [voiceErrorMessage, setVoiceErrorMessage] = useState<string | null>(null);
  const [integration, setIntegration] = useState<Record<string, unknown> | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedTo, setPublishedTo] = useState<string | null>(null);
  const [guideStep, setGuideStep] = useState(0);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [robotAnnouncement, setRobotAnnouncement] = useState('Ready for a task.');
  const [narrationQueued, setNarrationQueued] = useState(false);
  const narrationRef = useRef<(text: string) => void>(() => {});
  const narrationEnabledRef = useRef(narrationEnabled);
  const voiceLiveRef = useRef(false);
  const queueRef = useRef<{ steps: ActionStep[]; index: number } | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const lastCommandRef = useRef('');
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const taskDetailsRef=useRef<HTMLDetailsElement>(null);
  const liveRef = useRef(true);
  const finishRef = useRef<(outcome: Episode['outcome']) => void>(() => {});
  const sayRef = useRef<(text: string, role?: Entry['role']) => void>(() => {});
  const toolResolvers = useRef<((result: unknown) => void)[]>([]);
  const voiceHandler = useRef<(text: string) => Promise<VoiceCommandResult>>(async () => ({ completed: false }));

  autoApproveRef.current = autoApprove;
  autoApprovalPausedRef.current = autoApprovalPaused;
  const replaceWorld = useCallback((next: WorldState) => { worldRef.current = next; setWorld(next); }, []);
  const say = useCallback((text: string, role: Entry['role'] = 'assistant') => {
    setEntries(previous => [...previous.slice(-39), { id: crypto.randomUUID(), role, text, time: timestamp() }]);
  }, []);
  sayRef.current = say;
  narrationEnabledRef.current = narrationEnabled;
  voiceLiveRef.current = voiceState === 'live';
  narrationRef.current = (text: string) => {
    setRobotAnnouncement(text); setNarrationQueued(false);
    if (!narrationEnabledRef.current) return;
    sayRef.current(text, 'robot');
    if (voiceLiveRef.current) void import('./integrations/voice').then(voice => voice.announceVoiceProgress(text)).then(result => setNarrationQueued(Boolean(result.accepted))).catch(() => {});
  };
  const addEvent = useCallback((label: string, kind: Event['kind']) => {
    const event: Event = { time: worldRef.current.simTime, label, kind };
    setEvents(previous => [...previous.slice(-49), event]);
    if (kind !== 'command') setEntries(previous => [...previous.slice(-79), { id: crypto.randomUUID(), role: 'system', kind: kind === 'success' ? 'success' : kind === 'error' ? 'error' : kind === 'action' ? 'action' : /pause|stopp|obstruct|occup/i.test(label) ? 'warning' : 'system', text: label, time: event.time }]);
    if (recorderRef.current) {
      recorderRef.current.events.push({ ...event, time: event.time - recorderRef.current.start });
      if (kind === 'control' || kind === 'error') recorderRef.current.samples.push({ time: event.time - recorderRef.current.start, world: clone(worldRef.current) });
    }
  }, []);
  const startRecording = useCallback((instruction?: string) => {
    if (recorderRef.current) return;
    const initial = clone(worldRef.current);
    recorderRef.current = { id: `ep-${Date.now().toString(36)}`, scenarioId: environmentRef.current.id, scenarioName: environmentRef.current.name, start: initial.simTime, initialWorld: initial, samples: [{ time: 0, world: initial }], events: [], command: instruction ?? lastCommandRef.current, completedActions: 0, lastSample: initial.simTime };
    setRecording(true); setSampleCount(1); setReplay(null); setActiveEpisodeId(null);
  }, []);
  const finishRecording = useCallback((outcome: Episode['outcome']) => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    const finalWorld = clone(worldRef.current);
    recorder.samples.push({ time: finalWorld.simTime - recorder.start, world: finalWorld });
    if (finalWorld.simTime === recorder.start && outcome !== 'failed') { recorderRef.current = null; setRecording(false); setSampleCount(0); return; }
    const episode: Episode = { id: recorder.id, scenarioId: recorder.scenarioId, title: recorder.scenarioName, createdAt: new Date().toISOString(), duration: finalWorld.simTime - recorder.start, status: 'review', outcome, initialWorld: recorder.initialWorld, samples: recorder.samples, events: recorder.events, completedActions: recorder.completedActions, command: recorder.command };
    setEpisodes(previous => [episode, ...previous].slice(0, 6)); setActiveEpisodeId(episode.id); setSampleCount(episode.samples.length);
    recorderRef.current = null; setRecording(false); setGuideStep(3); setRightTab('review'); setCopilotCollapsed(false); setTimelineCollapsed(true);
    sayRef.current(`Episode recorded: ${episode.completedActions} verified action${episode.completedActions === 1 ? '' : 's'}, ${episode.samples.length} state samples. Save or export the recording when ready.`);
  }, []);
  finishRef.current = finishRecording;

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assignments', { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      setAssignments(data.assignments ?? []);
      setReports(previous => ({ ...previous, ...Object.fromEntries((data.assignments ?? []).filter((item: Assignment) => item.latestReport).map((item: Assignment) => [item.latestReport!.episodeId, item.latestReport!])) }));
    }).catch(() => {});
    return () => controller.abort();
  }, [workflowRefresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(null); setLayout('studio'); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(episodes)); } catch { setNotice('Browser storage is full. Export your episode to keep a copy.'); } }, [episodes]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [entries, plan]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/integrations/status', { signal: controller.signal }).then(async response => { if (!response.ok || !response.headers.get('content-type')?.includes('json')) return; const value = await response.json(); setIntegration(value); setBackendOnline(true); }).catch(() => {});
    return () => controller.abort();
  }, [modal]);

  useEffect(() => {
    liveRef.current = true;
    let frame = 0; let last = performance.now(); let lastRender = 0;
    const animate = (now: number) => {
      if (!liveRef.current) return;
      const dt = Math.min((now - last) / 1000, 0.08); last = now;
      const queue = queueRef.current;
      if (queue && worldRef.current.robot.mode === 'running') {
        const step = queue.steps[queue.index];
        const result = advanceWorld(worldRef.current, step, dt);
        worldRef.current = result.world;
        const recorder = recorderRef.current;
        if (recorder && (result.world.simTime - recorder.lastSample >= 0.1 || result.done)) {
          recorder.samples.push({ time: result.world.simTime - recorder.start, world: clone(result.world) }); recorder.lastSample = result.world.simTime; setSampleCount(recorder.samples.length);
        }
        if (result.blocked) {
          executionReceiptRef.current = { ...executionReceiptRef.current, status: 'paused', reason: result.blocked };
          addEvent(result.blocked, 'control'); narrationRef.current('Motion paused for the simulated human workspace scenario. Clear the scenario, then explicitly resume.'); setWorld(result.world);
        }
        if (result.done) {
          if (result.error) {
            narrationRef.current(`I stopped this action: ${result.error}`);
            executionReceiptRef.current = { ...executionReceiptRef.current, status: 'failed', error: result.error };
            setFailedStep(step.id); addEvent(result.error, 'error'); sayRef.current(result.error); queueRef.current = null; finishRef.current('failed');
            toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'failed', error: result.error }));
          } else {
            setCompletedSteps(previous => [...previous, step.id]); addEvent(step.label, 'success'); if (recorder) recorder.completedActions++;
            narrationRef.current(`Verified placement: ${step.label.replace(/^Move /, '')}.${queue.steps[queue.index + 1] ? '' : ' All requested actions are complete.'}`);
            queue.index++;
            if (queue.index < queue.steps.length) {
              worldRef.current = { ...result.world, robot: { ...result.world.robot, mode: 'running' } }; setActiveStep(queue.index);
            } else {
              queueRef.current = null; setActiveStep(-1); executionReceiptRef.current = { ...executionReceiptRef.current, status: 'succeeded', verified: true, completedActions: queue.steps.length, placements: worldRef.current.objects.map(object => ({ objectId: object.id, label: object.label, location: object.location, destinationLabel: worldRef.current.destinationLabels?.[object.location] ?? object.location })) }; addEvent('Task completed and placement verified', 'success');
              sayRef.current('Task complete. All requested placements are verified in the simulator.'); finishRef.current('completed');
              toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'succeeded', scene: worldRef.current.objects.map(({ id, location, position }) => ({ id, location, position })) }));
            }
          }
          setWorld(worldRef.current);
        } else if (now - lastRender >= 30) { setWorld(result.world); lastRender = now; }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { liveRef.current = false; cancelAnimationFrame(frame); };
  }, [addEvent]);

  useEffect(() => {
    if (!replay?.playing) return;
    const timer = setInterval(() => setReplay(previous => {
      if (!previous) return null;
      const next = previous.index + 1;
      return next >= previous.episode.samples.length ? { ...previous, playing: false } : { ...previous, index: next };
    }), 100);
    return () => clearInterval(timer);
  }, [replay?.playing]);

  const pause = () => {
    if (worldRef.current.robot.mode === 'paused' && worldRef.current.humanPresence?.state === 'in-workspace') { say('Clear the human workspace scenario before resuming motion.'); return; }
    const current = worldRef.current;
    if (current.robot.mode === 'running') { executionReceiptRef.current = { ...executionReceiptRef.current, status: 'paused' }; replaceWorld({ ...current, robot: { ...current.robot, mode: 'paused' } }); addEvent('Operator paused motion', 'control'); say('Motion paused. The current pose is held.'); }
    else if (current.robot.mode === 'paused' && queueRef.current) { executionReceiptRef.current = { ...executionReceiptRef.current, status: 'running' }; replaceWorld({ ...current, robot: { ...current.robot, mode: 'running' } }); addEvent('Operator resumed motion', 'control'); }
  };
  const stop = useCallback(() => {
    if (!queueRef.current && worldRef.current.robot.mode !== 'paused') return;
    executionReceiptRef.current = { ...executionReceiptRef.current, status: 'cancelled', reason: 'operator_stop' };
    queueRef.current = null; const current = worldRef.current;
    replaceWorld({ ...current, robot: { ...current.robot, mode: 'stopped', phase: 'Stopped by operator' } }); setActiveStep(-1); setPlan(null);
    addEvent('Operator stopped the run', 'control'); finishRef.current('stopped'); say('Stopped. The arm holds its current pose. Reset the scene before starting a new collection.');
    toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'cancelled', reason: 'operator_stop' }));
  }, [replaceWorld, addEvent, say]);
  const reset = () => {
    executionReceiptRef.current = null; setCommandError(null);
    queueRef.current = null; if (recorderRef.current) finishRecording('stopped');
    toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'cancelled', reason: 'scene_reset' }));
    replaceWorld(clone(environmentRef.current.world)); setSteps([]); setActiveStep(-1); setCompletedSteps([]); setFailedStep(null); setPlan(null); setReplay(null); setEvents([]); setSampleCount(0); setActiveEpisodeId(null); setModal(null); setGuideStep(0); say(`Scene reset to ${environmentRef.current.name.toLowerCase()}.`);
  };
  const applyEnvironment = (next: EnvironmentSpec) => {
    if (queueRef.current || recorderRef.current) { setNotice('Finish or stop the current recording before replacing the environment.'); return; }
    if (next.world.sceneProvenance) next = { ...next, world: { ...next.world, sceneProvenance: { ...next.world.sceneProvenance, reviewed: true } } };
    executionReceiptRef.current = null; setCommandError(null);
    environmentRef.current = clone(next); setEnvironment(clone(next));
    replaceWorld(clone(next.world)); queueRef.current = null; setSteps([]); setActiveStep(-1); setCompletedSteps([]); setFailedStep(null); setPlan(null); setReplay(null); setEvents([]); setSampleCount(0); setActiveEpisodeId(null); setGuideStep(0); setPendingEnvironment(null); setScenePrompt(''); setModal(null); setSelectedId('robot');
    say(`Loaded ${next.name.toLowerCase()} with ${next.world.objects.length} objects. Suggested task: “${next.instruction}”.`);
    narrationRef.current(`Environment ready: ${next.name}.`);
  };
  const runPlan = (selectedPlan = plan, instruction = planCommandText, approvalSource: 'manual' | 'automatic' | 'command' = 'command') => {
    if (!selectedPlan?.steps.length || queueRef.current || replay) return;
    if (worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') { say('Reset the scene before starting another run.'); return; }
    try { replaceWorld(worldForCommand(worldRef.current, selectedPlan, instruction)); }
    catch(cause){const message=cause instanceof Error?cause.message:'The command could not be grounded in this scene.';setCommandError(message);executionReceiptRef.current={status:'rejected',verified:false,command:instruction,error:message};setActiveEpisodeId(null);setSteps([]);setCompletedSteps([]);setPlan(null);setEntries(previous=>[...previous.slice(-79),{id:crypto.randomUUID(),role:'system',kind:'error',text:message,time:worldRef.current.simTime}]);return;}
    setCommandError(null);
    setSteps(selectedPlan.steps); setCompletedSteps([]); setFailedStep(null); setActiveStep(0); setPlan(null); setRightTab('mission'); setGuideStep(2);
    lastCommandRef.current = instruction;
    if (autoRecord) startRecording(instruction);
    addEvent(approvalSource === 'command' ? 'Simulation started directly from the operator command.' : approvalSource === 'automatic' ? 'Simulation plan automatically approved after the visible three-second countdown' : 'Operator explicitly approved the simulation plan', 'control');
    executionReceiptRef.current = { status: 'running', command: instruction, approvalSource, plannedActions: selectedPlan.steps };
    addEvent(instruction, 'command');
    queueRef.current = { steps: selectedPlan.steps, index: 0 };
    replaceWorld({ ...worldRef.current, robot: { ...worldRef.current.robot, mode: 'running' } });
    say(`Executing ${selectedPlan.steps.length} action${selectedPlan.steps.length === 1 ? '' : 's'}. You can pause or stop at any time.`);
    narrationRef.current(`Starting ${selectedPlan.steps.length} actions. ${selectedPlan.steps[0].label}.`);
  };
  const submitCommand = (text: string) => {
    if (!text.trim()) return;
    setCommand(''); setRightTab('assistant'); say(text.trim(), 'user');
    if (replay) { say('You are reviewing a recording. Return to the live scene before sending a command.'); return; }
    if (/^(create|build|set up|setup|make|generate)\b/i.test(text.trim())) {
      if (queueRef.current || recording) { say('Finish or stop the current recording before creating a new environment.'); return; }
      const draft = draftSceneFromText(text);
      setScenePrompt(text); setPendingEnvironment(draft.world ? { id: 'custom', name: 'Custom workcell', world: draft.world, instruction: 'Sort all parts' } : null); setModal('environments');
      say(draft.error ?? `${draft.summary} The scene draft is ready. Apply it to use this environment.`); return;
    }
    if (/^(yes|approve|approve and run|run plan|execute plan|go ahead)[.!\s]*$/i.test(text.trim())) {
      if (modal === 'reset') { reset(); return; }
      if (pendingEnvironment && modal === 'environments') { applyEnvironment(pendingEnvironment); return; }
      if (plan) runPlan(plan, planCommandText); else say('There is no prepared plan to approve. Describe a task first.');
      return;
    }
    const parsed = planCommand(text, worldRef.current);
    if (parsed.control === 'human-nearby' || parsed.control === 'human-enter' || parsed.control === 'human-clear') {
      const presence = parsed.control === 'human-enter' ? 'in-workspace' : parsed.control === 'human-nearby' ? 'nearby' : 'clear';
      replaceWorld({ ...worldRef.current, humanPresence: { state: presence, source: 'scenario-proxy' }, revision: worldRef.current.revision + 1 });
      addEvent(`Human scenario changed to ${presence}`, 'control');
      say(presence === 'in-workspace' ? 'Simulated workspace occupancy enabled. Motion is held by the software scenario interlock.' : presence === 'nearby' ? 'Simulated person nearby. The workspace remains clear.' : worldRef.current.robot.mode === 'paused' ? 'Human scenario cleared. Explicitly resume when you are ready.' : 'Human scenario cleared.');
      return;
    }
    if (parsed.control === 'pause') { if (worldRef.current.robot.mode === 'running') pause(); else say('There is no running motion to pause.'); return; }
    if (parsed.control === 'resume') { if (worldRef.current.robot.mode === 'paused') pause(); else say('There is no paused motion to resume.'); return; }
    if (parsed.control === 'stop') { stop(); return; }
    if (parsed.control === 'reset') { reset(); return; }
    if (queueRef.current) { say('A task is active. Pause or stop it before preparing another plan.'); return; }
    if (worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') { say('Reset the scene or load an environment before preparing another task.'); setPlan(null); return; }
    if (parsed.error) { setCommandError(parsed.error); executionReceiptRef.current={status:'rejected',verified:false,command:text,error:parsed.error}; setActiveEpisodeId(null);setSteps([]);setCompletedSteps([]);setEntries(previous=>[...previous.slice(-79),{id:crypto.randomUUID(),role:'system',kind:'error',text:parsed.error!,time:worldRef.current.simTime}]); setPlan(null); return; }
    setPlanCommandText(text); say(parsed.summary);
    setEntries(previous => [...previous.slice(-79), ...parsed.steps.map((step, index) => ({ id: crypto.randomUUID(), role: 'system' as const, kind: 'plan' as const, text: `${index + 1}. ${step.label}`, time: worldRef.current.simTime }))]);
    runPlan(parsed, text, 'command');
  };
  useEffect(()=>{if(world.robot.mode==='running')setEntries(previous=>{const text=world.robot.phase;if(previous.at(-1)?.text===text)return previous;return [...previous.slice(-79),{id:crypto.randomUUID(),role:'system',kind:'action',text,time:world.simTime}];});},[world.robot.phase,world.robot.mode]);
  const selectedEpisode = episodes.find(episode => episode.id === activeEpisodeId) ?? episodes[0] ?? null;
  const currentEpisode=replay?.episode??(selectedEpisode?.id===activeEpisodeId?selectedEpisode:null);
  const hasCurrentAttempt=Boolean(replay||recorderRef.current||currentEpisode||steps.length)&&!commandError;
  const voiceReady = voiceState === 'connected' || voiceState === 'live';
  const displayWorld = replay ? replay.episode.samples[replay.index]?.world ?? replay.episode.initialWorld : world;
  const object = displayWorld.objects.find(item => item.id === selectedId);
  const taskInitial = replay?.episode.initialWorld ?? recorderRef.current?.initialWorld ?? (selectedEpisode?.id === activeEpisodeId ? selectedEpisode.initialWorld : environment.world);
  const definition = taskForWorld(taskInitial);
  const protectedHistory = createProtectedHistory(taskInitial);
  const observedSamples = replay ? replay.episode.samples.slice(0, replay.index + 1) : recorderRef.current?.samples ?? (selectedEpisode?.id === activeEpisodeId ? selectedEpisode.samples : []);
  for (const sample of observedSamples) protectedHistory.observe(sample.world);
  protectedHistory.observe(displayWorld);
  const taskChecks = mergeProtectedHistoryChecks(definition?.successChecks(displayWorld) ?? [], protectedHistory.checks());
  const destinationLabel = (id: string) => displayWorld.destinationLabels?.[id as keyof NonNullable<WorldState['destinationLabels']>] ?? defaultDestinationLabel(id);
  const running = world.robot.mode === 'running';
  const busy = running || world.robot.mode === 'paused';
  const modeLabel = replay ? 'Replay' : commandError&&!busy?'Command rejected':({ idle: completedSteps.length ? 'Completed' : 'Ready', running: 'Executing', paused: 'Paused', stopped: 'Stopped', error: 'Attention' })[world.robot.mode];
  const currentAssignment = assignments.find(item => item.id === (displayWorld.customTask?.id ?? displayWorld.environmentId));
  const currentReport = currentEpisode ? reports[currentEpisode.id] ?? reports[currentEpisode.savedId ?? ''] : undefined;
  const currentSamples = replay?.episode.samples ?? (recorderRef.current?.samples ?? currentEpisode?.samples ?? []);
  const timelineEvents = replay?.episode.events ?? recorderRef.current?.events ?? currentEpisode?.events ?? events;
  const shownDuration = replay ? replay.episode.samples[replay.index]?.time ?? 0 : world.simTime;
  const renderedSteps = replay ? planCommand(replay.episode.command, replay.episode.initialWorld).steps : plan?.steps ?? (steps.length ? steps : planCommand(environment.instruction, displayWorld).steps);
  const renderedCompleted = replay ? renderedSteps.filter(step => replay.episode.events.some(event => event.kind === 'success' && event.label === step.label && event.time <= shownDuration)).map(step => step.id) : completedSteps;
  const renderedActiveIndex = replay ? (shownDuration < replay.episode.duration ? renderedSteps.findIndex(step => !renderedCompleted.includes(step.id)) : -1) : activeStep;
  const timelineTime = replay ? shownDuration : recorderRef.current ? world.simTime - recorderRef.current.start : currentEpisode?.duration ?? 0;
  const timelineTotal = Math.max(5, replay?.episode.duration ?? (recorderRef.current ? timelineTime : currentEpisode?.duration ?? 0));
  const activeInstruction=replay?.episode.command??definition?.instruction??environment.instruction;
  const terminalEntries:TerminalEntry[]=[{id:'workplace-context',time:'—',kind:'context',text:`${replay?.episode.title??environment.name} · ${displayWorld.objects.length} objects. ${activeInstruction}`},...entries.filter(entry=>!(entry.role==='robot'&&entry.text.startsWith('Verified placement:'))).map(entry=>({id:entry.id,time:entry.time,kind:entry.kind??(entry.role==='user'?'command':/failed|could not|unavailable|unsupported|invalid/i.test(entry.text)?'error':/paused|clearance|obstruction|stopped/i.test(entry.text)?'warning':entry.role==='robot'?'action':entry.role==='system'?'system':'system') as TerminalEntry['kind'],text:entry.text})),{id:'current-checks',time:displayWorld.simTime,kind:commandError?'error':hasCurrentAttempt?'check':'context',text:commandError?`Latest command not executed: ${commandError}`:hasCurrentAttempt?`${taskChecks.filter(check=>check.passed).length}/${taskChecks.length} task checks passed · ${modeLabel}${replay?' · recorded replay':''}`:'No task executed in this scene'}];
  const exportEvidence = async () => {
    if (!currentEpisode) return;
    try { await downloadEpisode(currentEpisode, currentReport); setNotice('Evidence package validated and exported with SHA-256 integrity.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Evidence export failed.'); }
  };
  const loadEpisode = (incoming: EvidenceEpisode & { savedId?: string }) => {
    if (queueRef.current || recorderRef.current) { setNotice('Finish or stop the current recording before reviewing another episode.'); return; }
    const episode = clone(incoming) as Episode;
    setEpisodes(previous => [episode, ...previous.filter(item => item.id !== episode.id)].slice(0, 6));
    setActiveEpisodeId(episode.id); setReplay({ episode, index: 0, playing: false }); setSection('episodes'); setLayout('studio'); setSidebarCollapsed(false); setModal(null);
    say(`Loaded recorded episode ${episode.id}. Its original outcome and review status are preserved.`);
  };
  useEffect(() => {
    if (plan || pendingEnvironment || modal === 'reset' || modal === 'publish') { setRightTab('review'); setCopilotCollapsed(false); setTimelineCollapsed(true); }
  }, [plan, pendingEnvironment, modal]);
  const pauseAutoApproval = () => {};
  const publish = async () => {
    if (!currentEpisode) return;
    setPublishing(true);
    let destination = 'this browser';
    let savedId: string | undefined;
    let savedReport: ServiceReport | undefined;
    if (backendOnline) {
      try {
        const response = await fetch('/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...episodeRecord(currentEpisode), status: 'review', submissionMode: 'operator-save', review: { approved: false, identityVerified: false, source: 'operator-save' } }) });
        if (!response.ok) throw new Error('Episode service did not accept the record.');
        const receipt = await response.json();
        savedId = receipt.id; savedReport = receipt.report;
        if (receipt.report) { setReports(previous => ({ ...previous, [currentEpisode.id]: receipt.report })); setReportOpen(receipt.report); }
        if (receipt.assignment) setAssignments(previous => previous.map(item => item.id === receipt.assignment.id ? receipt.assignment : item));
        setWorkflowRefresh(value => value + 1);
        destination = 'the local episode service';
      } catch { setPublishing(false); setNotice('The episode service could not save the record. Export a JSON copy or retry.'); return; }
    }
    setEpisodes(previous => previous.map(episode => episode.id === currentEpisode.id ? { ...episode, savedId, reportId: savedReport?.id } : episode));
    setPublishing(false); setPublishedTo(destination); setModal(savedReport ? 'report' : null); setGuideStep(4); say(`Episode ${currentEpisode.id} saved without a human-review claim to ${destination}. A JSON export includes its states, actions, and simulation limitations.`);
  };
  voiceHandler.current = async (text: string) => {
    if (mobileOpenRef.current && mobileBridgeRef.current) return mobileBridgeRef.current.command(text);
    if (/^(yes|approve|approve and run|run plan|execute plan|go ahead)[.!\s]*$/i.test(text.trim())) {
      if (modal === 'reset') { reset(); return { completed: true, summary: 'The explicitly approved scene reset completed.', world: worldRef.current }; }
      if (pendingEnvironment && modal === 'environments') {
        if (queueRef.current || recorderRef.current) return { completed: false, error: 'A recording is active. Stop it before applying an environment.' };
        applyEnvironment(pendingEnvironment); return { completed: true, summary: 'The reviewed environment was applied.', world: worldRef.current };
      }
      if (!plan && executionReceiptRef.current && ['running', 'paused', 'succeeded'].includes(String(executionReceiptRef.current.status))) return { completed: executionReceiptRef.current.status === 'succeeded' && executionReceiptRef.current.verified === true, status: executionReceiptRef.current.status, executionReceipt: executionReceiptRef.current, summary: executionReceiptRef.current.status === 'succeeded' ? 'The latest execution receipt confirms verified placements.' : 'The simulation is already active; no duplicate run was started.', world: worldRef.current };
      if (!plan || queueRef.current || replay || worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') return { completed: false, error: 'No executable plan is awaiting approval.' };
      const approvedPlan = clone(plan);
      const approvedInitial = clone(worldRef.current);
      return new Promise(resolve => {
        toolResolvers.current.push(result => {
          const receipt = result as { status: string; error?: string; reason?: string; scene?: unknown };
          const snapshot = clone(worldRef.current);
          const verifiedPlacements = approvedPlan.steps.filter(step => step.kind === 'pick_place').map(step => { const object = snapshot.objects.find(item => item.id === step.objectId); return { objectId: step.objectId, objectLabel: object?.label, destination: step.destination, destinationLabel: snapshot.destinationLabels?.[step.destination ?? 'table'] ?? defaultDestinationLabel(step.destination ?? 'table'), observedLocation: object?.location, verified: object?.location === step.destination }; });
          const taskDefinition = taskForWorld(approvedInitial);
          const unchangedProtectedObjects = (taskDefinition?.targets ?? []).filter(target => target.unchanged).map(target => { const original = approvedInitial.objects.find(item => item.id === target.objectId); const final = snapshot.objects.find(item => item.id === target.objectId); return { objectId: target.objectId, objectLabel: final?.label, unchanged: Boolean(original && final && original.location === final.location && original.position.every((value, axis) => Math.abs(value - final.position[axis]) < 0.005)) }; });
          resolve({ approvedActions: approvedPlan.steps, verifiedPlacements, unchangedProtectedObjects, taskAcceptance: taskDefinition?.successChecks(snapshot), completed: receipt.status === 'succeeded', summary: receipt.status === 'succeeded' ? 'All requested placements were verified by the simulator.' : 'Execution did not complete.', error: receipt.error ?? receipt.reason, world: worldRef.current });
        });
        submitCommand(text);
      });
    }
    if (/^(create|build|set up|setup|make|generate)\b/i.test(text.trim())) {
      const draft = draftSceneFromText(text);
      if (!draft.error || !/\b(kitchen|cups?|bowls?|samples?|lab|counter|scene|environment)\b/i.test(text)) {
        submitCommand(text);
        return { completed: false, summary: draft.error ?? 'A validated environment draft is awaiting operator approval. Ask for approval before calling approve.', world: worldRef.current };
      }
      if (queueRef.current || recorderRef.current) return { completed: false, error: 'Finish or stop the current recording before drafting a scene.' };
      say(text, 'user'); setPlan(null); setScenePrompt(text); setPendingEnvironment(null); setModal('environments');
      try {
        const response = await fetch('/api/scenes/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, baseEnvironmentId: worldRef.current.baseEnvironmentId ?? (['workbench', 'kitchen', 'lab'].includes(worldRef.current.environmentId ?? '') ? worldRef.current.environmentId : 'workbench') }), signal: AbortSignal.timeout(35000) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Scene drafting failed.');
        const next = worldFromSceneSpec(result.spec, { prompt: text, model: result.model });
        const prepared = { id: next.customTask!.id ?? 'custom', name: next.customTask!.title, world: next, instruction: next.customTask!.instruction };
        setPendingEnvironment(prepared);
        say(`Prepared ${prepared.name}. Review the objects and targets, then approve the scene before it replaces the workcell.`);
        return { completed: false, status: 'awaiting_environment_approval', summary: 'A validated AI scene draft is ready for explicit approval.', proposedScene: { name: prepared.name, objects: next.objects.map(object => ({ id: object.id, label: object.label })), task: next.customTask }, world: worldRef.current };
      } catch (error) { return { completed: false, error: error instanceof Error ? error.message : 'Scene drafting failed.', world: worldRef.current }; }

    }
    const interpreted = planCommand(text, worldRef.current);
    submitCommand(text);
    if (interpreted.control && interpreted.control !== 'reset') {
      const expected = { pause: 'paused', resume: 'running', stop: 'stopped' }[interpreted.control as 'pause' | 'resume' | 'stop'];
      const completed = !expected || worldRef.current.robot.mode === expected;
      return { completed, summary: completed ? `Control instruction handled: ${interpreted.control}.` : `Control ${interpreted.control} was not applied.`, ...(completed ? {} : { error: worldRef.current.humanPresence?.state === 'in-workspace' ? 'Clear the human workspace scenario before resuming.' : 'The controller was not in a state that permits this control.' }), world: worldRef.current };
    }
    const receipt=executionReceiptRef.current;
    return { completed: receipt?.status==='succeeded'&&receipt.verified===true, status: interpreted.error?'rejected':String(receipt?.status??'not-started'), plannedActions: interpreted.steps.map(step=>({...step,objectLabel:worldRef.current.objects.find(object=>object.id===step.objectId)?.label,destinationLabel:worldRef.current.destinationLabels?.[step.destination??'table']??defaultDestinationLabel(step.destination??'table')})), ...(receipt?.status==='rejected'?{error:String(receipt.error??'The latest command was not executed.')} : {}), summary: interpreted.error??(receipt?.status==='running'?'The supported simulation command started immediately. No separate approval is required.':'The simulator returned its current execution state.'), executionReceipt:receipt, world:worldRef.current };

  };
  const connectVoice = async () => {
    if (voiceAttemptRef.current) return;
    if (!backendOnline) { const message = 'Voice service is unavailable. Try again when it is available, or reset the connection.'; setVoiceState('error'); setVoiceErrorMessage(message); setNotice(message); if (!mobileOpenRef.current) setModal('connections'); return; }
    voiceAttemptRef.current = true;
    const operation = ++voiceOperationRef.current;
    setVoiceErrorMessage(null); setVoiceState('connecting');
    try {
      const voice = await import('./integrations/voice');
      await voice.startVoiceSession(text => voiceHandler.current(text), {
        getWorld: () => mobileOpenRef.current && mobileBridgeRef.current ? mobileBridgeRef.current.getWorld() : ({ ...worldRef.current, executionReceipt: executionReceiptRef.current, simulationAutoApproval: false, simulationExecutionMode: 'immediate' }),
        onStatus: (status, message) => { if (operation !== voiceOperationRef.current) return; setVoiceState(status); if (status === 'error') { const safe = voiceFailureMessage(message); setVoiceErrorMessage(safe); setNotice(safe); } },
        onTranscript: transcript => { if (operation === voiceOperationRef.current) setVoiceTranscripts(previous => mergeVoiceTranscripts(previous, transcript)); },
      });
      if (operation !== voiceOperationRef.current) return;
      setVoiceState(previous => previous === 'live' ? previous : 'connected'); setModal(null); say('Agora RTC joined. The status will update when the conversational agent audio arrives.');
    } catch (error) { if (operation === voiceOperationRef.current) { const message = voiceFailureMessage(error); setVoiceState('error'); setVoiceErrorMessage(message); setNotice(message); if (!mobileOpenRef.current) setModal('connections'); } } finally { if (operation === voiceOperationRef.current) voiceAttemptRef.current = false; }
  };
  const recoverVoice = async () => {
    if (voiceResettingRef.current) return;
    voiceResettingRef.current = true; voiceAttemptRef.current = true;
    voiceOperationRef.current++; setVoiceErrorMessage(null); setVoiceState('connecting');
    try {
      const voice = await import('./integrations/voice');
      await voice.stopVoiceSession().catch(() => {});
      const response = await fetch('/api/voice/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Voice reset failed. Please retry.');
      const result = await response.json();
      const warning = result.cleanupVerified === false ? 'Local voice reset. Remote shutdown could not be confirmed; check Agora before reconnecting.' : null;
      setVoiceState('disconnected'); setVoiceErrorMessage(warning); setNotice(warning ?? 'Voice connection reset. You can connect again.');
    } catch { const message = 'Voice reset failed. Please retry Reset voice.'; setVoiceState('error'); setVoiceErrorMessage(message); setNotice(message); }
    finally { voiceResettingRef.current = false; voiceAttemptRef.current = false; }
  };
  const disconnectVoice = async () => { if (voiceAttemptRef.current) return; voiceAttemptRef.current = true; voiceOperationRef.current++; try { const voice = await import('./integrations/voice'); await voice.stopVoiceSession(); setVoiceState('disconnected'); setVoiceErrorMessage(null); } catch { const message = 'Voice disconnect could not be confirmed. Reset voice before reconnecting.'; setVoiceState('error'); setVoiceErrorMessage(message); setNotice(message); } finally { voiceAttemptRef.current = false; } };

  const openKitchen = async () => {
    if (voiceState === 'live' || voiceState === 'connected') await disconnectVoice();
    const quiet = new URLSearchParams(window.location.search).get('voice') === 'off';
    window.history.pushState({}, '', quiet ? '/kitchen?voice=off' : '/kitchen');
    autoVoicePending.current = !quiet; setMobileOpen(true);
  };
  const leaveKitchen = () => {
    autoVoicePending.current = false; voiceOperationRef.current++;
    void import('./integrations/voice').then(voice => voice.stopVoiceSession()).catch(() => {}).finally(() => { setVoiceState('disconnected'); voiceAttemptRef.current = false; });
    window.history.pushState({}, '', '/'); setMobileOpen(false);
  };
  useEffect(() => {
    if (!mobileOpen || !mobileBridgeReady || !backendOnline || !autoVoicePending.current) return;
    autoVoicePending.current = false;
    if (voiceState !== 'live' && voiceState !== 'connected' && voiceState !== 'connecting') void connectVoice();
  }, [mobileOpen, mobileBridgeReady, backendOnline]);
  useEffect(() => {
    const onRoute = () => {
      const kitchen = window.location.pathname.replace(/\/$/, '') === '/kitchen';
      autoVoicePending.current = kitchen && new URLSearchParams(window.location.search).get('voice') !== 'off';
      setMobileOpen(kitchen);
      if (!kitchen) {
        voiceOperationRef.current++;
        void import('./integrations/voice').then(voice => voice.stopVoiceSession()).catch(() => {}).finally(() => { setVoiceState('disconnected'); voiceAttemptRef.current = false; });
      }
    };
    window.addEventListener('popstate', onRoute); return () => window.removeEventListener('popstate', onRoute);
  }, []);

  if (mobileOpen) return <Suspense fallback={<div className="suite-loading">Loading mobile kitchen…</div>}><MobileKitchen onBack={leaveKitchen} onBridge={registerMobile} voiceStatus={voiceState} voiceTranscripts={voiceTranscripts} voiceErrorMessage={voiceErrorMessage} onResetVoice={() => void recoverVoice()} onVoice={() => void connectVoice()} onDisconnect={() => void disconnectVoice()} announce={text => narrationRef.current(text)}/></Suspense>;

  return (
    <div className="studio" data-layout={layout} data-sidebar={sidebarCollapsed ? 'collapsed' : 'open'} data-copilot={copilotCollapsed ? 'collapsed' : 'open'}>
      <header className="topbar">
        <a className="brand" href="#" onClick={event => event.preventDefault()} aria-label="RoboTrace home"><span className="brand-mark"><Blocks size={22} strokeWidth={1.7}/></span><span>RoboTrace<span className="brand-dot">.</span></span></a>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><span>Demonstration lab</span><ChevronRight size={14}/><strong>Workcell 01</strong><ChevronDown size={13}/></div>
        <div className="topbar-actions"><button className="button button-secondary" disabled={busy || recording || Boolean(replay)} aria-label="Mobile kitchen" onClick={() => void openKitchen()}>Start simulation</button><div className="layout-switcher" role="group" aria-label="Presentation layout">{(['studio', 'copilot', 'simulation'] as LayoutMode[]).map(mode => <button key={mode} className={layout === mode ? 'selected' : ''} aria-pressed={layout === mode} onClick={() => { setLayout(mode); if (mode === 'copilot') setCopilotCollapsed(false); }}>{mode === 'studio' ? <Layers3 size={13}/> : mode === 'copilot' ? <AudioLines size={13}/> : <Expand size={13}/>}<span>{mode === 'studio' ? 'Studio' : mode === 'copilot' ? 'Copilot' : 'Simulation'}</span></button>)}</div><button className="icon-button" title="Saved episode library" aria-label="Saved episode library" onClick={() => setModal('library')}><FolderOpen size={17}/></button><button className="icon-button" title="Human and AI planner comparison" aria-label="Human and AI planner comparison" onClick={() => setModal('planners')}><ListChecks size={17}/></button><button className="icon-button" title="Controller evaluation" aria-label="Controller evaluation" onClick={() => setModal('evaluation')}><Activity size={17}/></button><button className="icon-button" title="Release readiness" aria-label="Release readiness" onClick={() => setModal('readiness')}><ShieldCheck size={17}/></button><span className="badge simulation-badge"><Box size={12}/> Simulation</span><button className="icon-button" title="Open setup and help" aria-label="Open help" onClick={() => setModal('help')}><CircleHelp size={18}/></button><button className="avatar" onClick={() => setModal('connections')} title="Connection settings">DL</button></div>
      </header>

      <div className="studio-body">
        <nav className="activity-rail" aria-label="Workspace navigation">
          <button className={section === 'scene' ? 'rail-button active' : 'rail-button'} title="Workcell" aria-label="Workcell" onClick={() => setSection('scene')}><Layers3 size={21}/></button>
          <button className={section === 'episodes' ? 'rail-button active' : 'rail-button'} title="Episodes" aria-label="Episodes" onClick={() => setSection('episodes')}><FolderOpen size={21}/>{episodes.length > 0 && <span className="rail-count">{episodes.length}</span>}</button>
          <button className="rail-button" title="Task specification" aria-label="Task specification" onClick={() => { setRightTab('mission'); setSection('scene'); }}><ListChecks size={21}/></button>
          <button className="rail-button" title="Saved episode library" aria-label="Saved episode library" onClick={() => setModal('library')}><HardDrive size={20}/></button><div className="rail-spacer"/>
          <button className="rail-button" title="Integration settings" aria-label="Integration settings" onClick={() => setModal('connections')}><Settings2 size={21}/></button>
          <button className="rail-button" title="About this prototype" aria-label="About this prototype" onClick={() => setModal('help')}><Code2 size={20}/></button>
        </nav>

        <aside className="scene-sidebar">
          <div className="sidebar-heading"><div><span className="eyebrow">COLLECTION WORKSPACE</span><h1>{section === 'scene' ? 'Workcell 01' : 'Episodes'}</h1></div><button className="icon-button" title="Collapse scene inspector" aria-label="Collapse scene inspector" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={17}/></button></div>
          <div className="workspace-description"><span className="mini-robot"><Box size={17}/></span><div><strong>Tabletop manipulation</strong><span>TT-01 · Articulated arm</span></div></div>
          <div className="sidebar-tabs"><button className={section === 'scene' ? 'selected' : ''} onClick={() => setSection('scene')}>Scene</button><button className={section === 'episodes' ? 'selected' : ''} onClick={() => setSection('episodes')}>Episodes <span>{episodes.length}</span></button></div>
          {section === 'scene' ? <>
            <div className="tree-section-title">SCENE HIERARCHY <span>{3 + displayWorld.objects.length + DESTINATIONS.length}</span></div>
            <div className="scene-tree">
              <button className="tree-row root-row" onClick={() => setSelectedId('world')}><ChevronDown size={13}/><Layers3 size={16}/><span>World</span><span className="tree-muted">m</span></button>
              <button className={`tree-row nested ${selectedId === 'robot' ? 'is-selected' : ''}`} onClick={() => setSelectedId('robot')}><Box size={16}/><span>TT-01 robot</span><span className={`small-dot ${running ? 'orange' : 'green'}`}/></button>
              <button className={`tree-row nested ${selectedId === 'table' ? 'is-selected' : ''}`} onClick={() => setSelectedId('table')}><Grid2X2 size={16}/><span>{destinationLabel('table')}</span><span className="tree-muted">fixed</span></button>
              <div className="tree-group-label">Manipulable objects</div>
              {displayWorld.objects.map(item => <button key={item.id} className={`tree-row nested object-row ${selectedId === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}><span className="object-swatch" style={{ background: item.color }}/><span>{item.label}</span>{item.location !== 'table' ? <Check size={13} className="success-text"/> : <span className="tree-muted">{item.kind}</span>}</button>)}
              <div className="tree-group-label">Destinations</div>
              {DESTINATIONS.map(item => <button key={item.id} className={`tree-row nested ${selectedId === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}><span className={`tray-icon ${item.id === 'reject' ? 'review-tray' : ''}`}/><span>{destinationLabel(item.id)}</span><span className="tree-muted">{displayWorld.objects.filter(object => object.location === item.id).length}/3</span></button>)}
            </div>
            <div className="inspector"><div className="inspector-title"><MousePointer2 size={14}/><span>INSPECTOR</span></div><h3>{object?.label ?? (selectedId === 'robot' ? 'TT-01 robot' : selectedId === 'table' ? 'Worktable' : selectedId ? destinationLabel(selectedId) : 'Select an object')}</h3>
              <div className="inspector-id">{object?.id ?? selectedId ?? 'No selection'}</div>
              <div className="property-row"><span>{object ? 'Location' : 'Controller'}</span><strong>{object ? destinationLabel(object.location) : 'Kinematic'}</strong></div>
              <div className="property-row"><span>{object ? 'Status' : 'Gripper'}</span><strong>{object?.status ?? (displayWorld.robot.gripperOpen > 0.5 ? 'Open' : 'Closed')}</strong></div>
              <div className="coordinate-heading">{object ? 'OBJECT POSITION' : 'END EFFECTOR'} <span>meters</span></div>
              <div className="coordinate-fields">{(object?.position ?? displayWorld.robot.position).map((coordinate, index) => <div key={index}><span className={`axis-${index}`}>{['X', 'Y', 'Z'][index]}</span><strong>{coordinate.toFixed(3)}</strong></div>)}</div>
              {object && !busy && !replay && <button className="text-button reposition" onClick={() => { const next = clone(worldRef.current); const item = next.objects.find(value => value.id === object.id)!; if (item.location !== 'table') { setNotice('Reset the scene to reposition a part on the table.'); return; } item.position[2] = Math.max(-0.85, Math.min(0.7, item.position[2] + (item.position[2] > 0.4 ? -0.6 : 0.2))); next.revision++; replaceWorld(next); addEvent(`${item.label} repositioned by operator`, 'control'); }}><Move3D size={13}/> Change starting position</button>}
            </div>
          </> : <div className="episode-list">{episodes.length ? episodes.map(episode => <button className={`episode-card ${selectedEpisode?.id === episode.id ? 'selected-episode' : ''}`} key={episode.id} onClick={() => { setActiveEpisodeId(episode.id); if (!busy && !recording) setReplay({ episode, index: 0, playing: false }); }}><div className="episode-card-top"><FileJson size={17}/><span>{episode.id}</span></div><strong>{episode.command || episode.title}</strong><div><span>{timecode(episode.duration)}</span><span>{episode.samples.length} samples</span></div><span className={`badge ${episode.status === 'approved' ? 'approved-badge' : ''}`}>{episode.savedId ? 'Saved' : 'Recorded'}</span></button>) : <div className="sidebar-empty"><History size={28}/><strong>Your first episode starts here</strong><p>Run a task with auto-record enabled. Review its trajectory, then approve or export it.</p></div>}</div>}
          <div className="sidebar-bottom"><ShieldCheck size={15}/><span>Local workcell · No hardware required</span></div>
        </aside>

        <main className="main-workspace">
          <div className="presentation-bar"><span className="presentation-brand"><Blocks size={18}/> RoboTrace<span className="badge">SIMULATION</span></span><div><button className="button button-secondary" onClick={() => { setLayout('copilot'); setCopilotCollapsed(false); }}><AudioLines size={14}/> Show copilot</button><button className="button button-danger" disabled={!busy} onClick={stop}><Square size={12}/> Stop</button><button className="exit-presentation button button-secondary" onClick={() => setLayout('studio')}><X size={14}/> Exit · Esc</button></div></div>
          <div className="workspace-top"><div><div className="workspace-title"><h2>Workcell studio</h2><span className={`state-pill state-${replay ? 'replay' : commandError&&!busy?'error':world.robot.mode}`}><span/>{modeLabel}</span></div><button className="environment-switcher" onClick={() => { setScenePrompt(''); setModal('environments'); }}><Grid2X2 size={13}/>{replay?.episode.title ?? environment.name}<ChevronDown size={12}/></button></div><div className="workspace-buttons"><button className="icon-button" title="Toggle scene inspector" aria-label="Toggle scene inspector" aria-pressed={!sidebarCollapsed && layout === 'studio'} onClick={() => { if (layout !== 'studio') { setLayout('studio'); setSidebarCollapsed(false); } else setSidebarCollapsed(value => !value); }}><PanelLeftClose size={15}/></button><button className="icon-button" title="Toggle copilot panel" aria-label="Toggle copilot panel" aria-pressed={!copilotCollapsed} onClick={() => setCopilotCollapsed(value => !value)}><AudioLines size={15}/></button><button className="button button-secondary new-environment-button" onClick={() => { setScenePrompt(''); setModal('environments'); }}><Plus size={14}/><span>Environment</span></button><button className={`button ${recording ? 'record-active' : 'button-secondary'}`} disabled={!!replay || (recording && busy)} onClick={() => recording ? finishRecording(busy ? 'stopped' : 'completed') : startRecording()}><span className="record-dot"/>{recording ? 'Finish recording' : 'Record episode'}</button><button className="button button-danger" disabled={!busy} onClick={stop}><Square size={13} fill="currentColor"/> Stop</button></div></div>
          <div className="assignment-strip"><div><span className="eyebrow">{currentAssignment ? 'ASSIGNED COLLECTION TASK' : 'LOCAL COLLECTION TASK'}</span><strong>{currentAssignment?.title ?? definition?.name ?? environment.name}</strong><span>{currentAssignment?.status === 'submitted' ? 'Previous attempt submitted' : 'Run the task, inspect its outcome, then save or export'}</span></div><div><span className="badge">{commandError?'Command not executed':hasCurrentAttempt?`${taskChecks.filter(check=>check.passed).length}/${taskChecks.length} checks`:'Not run'}</span><button className="text-button" onClick={() => { if(taskDetailsRef.current){taskDetailsRef.current.open=true;taskDetailsRef.current.scrollIntoView({block:'nearest'});} }}>View instructions <ChevronRight size={12}/></button>{currentReport && <button className="text-button" onClick={() => { setReportOpen(currentReport); setModal('report'); }}>Service report <FileJson size={12}/></button>}</div></div>
          <div className="work-area">
            <section className="viewport-panel" aria-label="3D robot workcell">
              <div className="panel-toolbar"><div className="panel-title"><Box size={15}/><strong>3D WORKCELL</strong><span className="toolbar-divider"/><span>{definition?.name ?? environment.name}</span></div><div className="viewport-controls"><button className="icon-button" title="Human activity scenario" aria-label="Human activity scenario" onClick={() => setModal('human')}><Users size={15}/></button><button className="icon-button" title="Simulation only" aria-label="Simulation only" onClick={() => setLayout('simulation')}><Expand size={15}/></button><button className={view === 'perspective' ? 'view-button selected' : 'view-button'} onClick={() => setView('perspective')}>Orbit</button><button className={view === 'top' ? 'view-button selected' : 'view-button'} onClick={() => setView('top')}>Top</button><button className={view === 'robot' ? 'view-button selected' : 'view-button'} onClick={() => setView('robot')}>Robot</button><span className="toolbar-divider"/><button className={`icon-button ${showGrid ? 'toggled' : ''}`} title="Toggle grid" aria-label="Toggle grid" onClick={() => setShowGrid(value => !value)}><Grid2X2 size={15}/></button><button className="icon-button" title="Toggle motion path" aria-label="Toggle motion path" onClick={() => setShowPath(value => !value)}><Activity size={15}/></button></div></div>
              <div className="viewport-canvas"><RobotScene world={displayWorld} selectedId={selectedId} onSelect={setSelectedId} view={view} showGrid={showGrid} showPath={showPath}/><div className="viewport-status"><span className="viewport-status-dot"/>{replay ? 'RECORDED REPLAY' : displayWorld.humanPresence?.state === 'in-workspace' ? 'HUMAN SCENARIO · WORKSPACE OCCUPIED' : displayWorld.humanPresence?.state === 'nearby' ? 'HUMAN SCENARIO · NEARBY' : 'LOCAL SIMULATION'}<span className="viewport-status-time">{timecode(shownDuration)}</span></div><div className="viewport-corner-label">TT-01<span>TABLETOP WORKCELL</span></div><div className="scene-instruction"><MousePointer2 size={13}/><span>Drag to orbit · Scroll to zoom · Click to inspect</span></div>{busy && <div className="motion-overlay"><span className={running ? 'pulse-dot' : 'small-dot orange'}/><span>{world.robot.mode === 'paused' ? 'Motion paused' : world.robot.phase}</span><span className="motion-step">{Math.max(0, activeStep) + 1}/{steps.length}</span></div>}{replay && <button className="button return-live" onClick={() => setReplay(null)}><Radio size={13}/> Return to live scene</button>}</div>
              <div className="viewport-bottom"><div className="transport-controls"><button className="icon-button" title="Reset scene" aria-label="Reset scene" onClick={reset}><RotateCcw size={16}/></button><button className="transport-play" title={world.robot.mode === 'paused' ? 'Resume' : busy ? 'Pause' : 'Prepare collection task'} aria-label={world.robot.mode === 'paused' ? 'Resume' : busy ? 'Pause' : 'Prepare collection task'} onClick={() => busy ? pause() : submitCommand(environment.instruction)}>{running ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="transport-label">{busy ? world.robot.mode === 'paused' ? 'Resume' : 'Pause' : 'Prepare task'}</span><span className="toolbar-divider"/><select aria-label="Simulation speed" value={world.robot.speed} disabled={!!replay} onChange={event => replaceWorld({ ...worldRef.current, robot: { ...worldRef.current.robot, speed: Number(event.target.value) } })}><option value={0.5}>0.5×</option><option value={1}>1× speed</option><option value={2}>2× speed</option><option value={3}>3× speed</option></select><ChevronDown size={11}/></div><span className="simulation-note"><span/> Kinematic · Idealized grasp</span></div>
            </section>

            <aside className="copilot-panel">
              <ActivityTerminal entries={terminalEntries} title="Activity terminal" status={`${modeLabel} · ${voiceReady?'voice':'local'}`} toolbar={<><button className={`icon-button ${narrationEnabled ? 'narration-on' : ''}`} title="Toggle robot announcements" aria-label="Toggle robot announcements" aria-pressed={narrationEnabled} onClick={() => setNarrationEnabled(value => !value)}><Volume2 size={16}/></button><button className="icon-button" title="Collapse copilot" aria-label="Collapse copilot" onClick={() => setCopilotCollapsed(true)}><PanelLeftClose size={15}/></button><button className="icon-button" title="Copilot connection settings" aria-label="Copilot connection settings" onClick={() => setModal('connections')}><Settings2 size={16}/></button></>}>
                <details className="terminal-task-details" ref={taskDetailsRef}><summary>Task context and checks</summary><p>{currentAssignment?.instructions??activeInstruction}</p>{hasCurrentAttempt?taskChecks.map(check=><div className="outcome-check" key={check.id}><span>{check.name}</span><strong>{check.passed?'Passed':'Pending'}</strong></div>):<p>{commandError?'Latest command was not executed.':'No task executed in this scene'}</p>}</details>
                {pendingEnvironment&&<div className="terminal-record-tools"><span>Scene draft: {pendingEnvironment.name}</span><button className="text-button" onClick={()=>setModal('environments')}>Open scene draft</button></div>}
                {!currentEpisode&&episodes.length>0&&<button className="text-button terminal-previous-records" onClick={()=>{setSection('episodes');setLayout('studio');setSidebarCollapsed(false);}}>Previous records ({episodes.length})</button>}
                {currentEpisode&&!recording&&<div className="terminal-record-tools"><span>{currentEpisode.completedActions} actions · {currentEpisode.outcome}{currentEpisode.savedId?' · saved':' · unsaved'}</span><button className="text-button" disabled={busy} onClick={()=>{setTimelineCollapsed(false);setReplay({episode:currentEpisode,index:0,playing:false});}}>Replay</button><button className="button button-secondary" disabled={busy||publishing||Boolean(currentEpisode.savedId)} onClick={()=>void publish()}>{publishing?'Saving…':currentEpisode.savedId?'Saved':'Save episode'}</button><button className="text-button" onClick={()=>void exportEvidence()}>Export</button></div>}
              </ActivityTerminal>
              <div className="command-area"><form onSubmit={event => { event.preventDefault(); submitCommand(command); }}><input value={command} onChange={event => { setCommand(event.target.value); if (plan) pauseAutoApproval(); }} aria-label="Robot command" placeholder="Tell the workcell what to do…"/><button type="submit" className="send-button" aria-label="Send command" disabled={!command.trim()}><Send size={16}/></button></form><div className="voice-row"><button className={`voice-button ${voiceReady ? 'connected' : ''}`} disabled={voiceState === 'connecting'} onClick={() => voiceReady ? disconnectVoice() : connectVoice()}>{voiceState === 'connecting' ? <Loader2 size={14} className="spin"/> : <Mic size={14}/>}<span>{voiceState === 'live' ? 'Voice connected' : voiceState === 'connected' ? 'Waiting for agent' : voiceState === 'connecting' ? 'Connecting…' : 'Connect voice'}</span></button><span>{voiceReady ? 'Agora · Murf Falcon' : integration?.configured ? 'Ready to connect' : 'Agora setup required'}</span></div></div>
            </aside>
          </div>

          <section className={`recording-panel ${timelineCollapsed ? 'is-collapsed' : ''}`} aria-label="Episode recording and playback"><div className="recording-header"><div><button className="icon-button" aria-label={timelineCollapsed ? 'Expand timeline' : 'Collapse timeline'} aria-expanded={!timelineCollapsed} onClick={() => setTimelineCollapsed(value => !value)}><ChevronDown size={14} style={{ transform: timelineCollapsed ? 'rotate(-90deg)' : undefined }}/></button><History size={15}/><strong>EPISODE TIMELINE</strong>{recording && <span className="recording-label"><span className="record-dot"/> Recording</span>}{replay && <span className="badge">Replay</span>}{!recording && !replay && <span className="timeline-hint">{currentEpisode ? currentEpisode.id : 'No episode recorded yet'}</span>}</div><div>{timelineCollapsed && currentEpisode && !recording && <><button className="text-button" disabled={busy} onClick={() => { setTimelineCollapsed(false); setReplay({ episode: currentEpisode, index: 0, playing: false }); }}>Review episode</button><button className="small-primary" disabled={(Boolean(currentEpisode.savedId)) || busy} onClick={() => void publish()}>{currentEpisode.savedId ? 'Saved' : 'Save episode'}</button></>}<label className="auto-record"><input type="checkbox" checked={autoRecord} onChange={event => setAutoRecord(event.target.checked)}/>Auto-record tasks</label><button className="icon-button" title="Export evidence package" aria-label="Export evidence package" disabled={!currentEpisode || recording} onClick={exportEvidence}><Download size={15}/></button></div></div>
            <div className="timeline-body"><button className="timeline-play" aria-label={replay?.playing ? 'Pause replay' : 'Replay latest episode'} disabled={!currentEpisode || busy || recording} onClick={() => { if (replay) setReplay({ ...replay, playing: !replay.playing, index: replay.index >= replay.episode.samples.length - 1 ? 0 : replay.index }); else if (currentEpisode) setReplay({ episode: currentEpisode, index: 0, playing: true }); }}>{replay?.playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="timeline-time">{timecode(timelineTime)}</span><div className="timeline-track"><div className="timeline-ruler">{[0, 1, 2, 3, 4, 5].map(index => <span key={index}>{timecode(index * Math.max(5, Math.ceil(timelineTotal / 5)))}</span>)}</div><div className="timeline-lanes">{currentSamples.length ? <div className="recorded-lane"><span>State trajectory</span><svg viewBox="0 0 500 25" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={currentSamples.filter((_, i) => i % Math.max(1, Math.floor(currentSamples.length / 90)) === 0).map((sample, index, samples) => `${index / Math.max(1, samples.length - 1) * 500},${22 - (sample.world.robot.position[1] - 0.75) * 17}`).join(' ')}/></svg></div> : <div className="empty-lane"><span>Run a task to capture its trajectory and action events.</span></div>}<div className="timeline-events">{timelineEvents.filter(event => event.kind !== 'command').map((event, index) => <span key={index} className={`timeline-event event-${event.kind}`} style={{ left: `${Math.min(99, event.time / (Math.max(5, Math.ceil(timelineTotal / 5)) * 5) * 100)}%` }} title={`${timecode(event.time)} · ${event.label}`} />)}</div>{replay && <input className="timeline-scrubber" type="range" min={0} max={Math.max(0, replay.episode.samples.length - 1)} value={replay.index} onChange={event => setReplay({ ...replay, index: Number(event.target.value), playing: false })} aria-label="Seek episode"/>}</div></div><div className="sample-counter"><strong>{replay?.episode.samples.length ?? (recording ? sampleCount : currentEpisode?.samples.length ?? sampleCount)}</strong><span>samples</span></div></div>
            <div className="timeline-footer"><span><span className="small-dot green"/>{recording ? 'Capturing simulator states · up to 10 Hz' : currentEpisode ? `${currentEpisode.completedActions} verified actions · ${currentEpisode.savedId ? 'Saved' : 'Recorded'}` : 'Recorder ready · States, actions, and outcomes'}</span>{currentEpisode && !recording && <div><button className="text-button" disabled={busy || recording} onClick={() => setReplay({ episode: currentEpisode, index: 0, playing: false })}>Review episode</button><button className="small-primary" disabled={(Boolean(currentEpisode.savedId)) || busy} onClick={() => void publish()}>{currentEpisode.savedId ? 'Saved' : 'Save episode'}<Check size={12}/></button></div>}</div>
          </section>
          <div className="workflow-strip">{['Describe task', 'Plan', 'Observe execution', 'Inspect episode', 'Save demonstration'].map((label, index) => <div className={guideStep > index ? 'workflow-done' : guideStep === index ? 'workflow-current' : ''} key={label}><span>{guideStep > index ? <Check size={10}/> : index + 1}</span>{label}{index < 4 && <ChevronRight size={11}/>}</div>)}</div>
        </main>
      </div>
      <footer className="statusbar"><div><span className="small-dot green"/>Local simulator ready<span className="statusbar-divider"/><span>World revision {displayWorld.revision}</span></div><div><span>{voiceReady ? 'Agora connected' : 'Agora not connected'}</span><span className="statusbar-divider"/><span>Simulation data · No physical robot</span><button onClick={() => setModal('connections')}><Settings2 size={12}/></button></div></footer>
      {notice && <div className="toast" role="status"><TriangleAlert size={17}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={15}/></button></div>}
      {modal && <div className="modal-backdrop" onClick={() => { setModal(null); setPendingEnvironment(null); }}><section className={`modal ${modal === 'environments' || modal === 'evaluation' || modal === 'planners' || modal === 'library' ? 'environment-modal' : ''}`} role="dialog" aria-modal="true" aria-label={modal === 'environments' ? 'Environment studio' : modal === 'connections' ? 'Connection setup' : modal === 'publish' ? 'Approve episode' : modal === 'reset' ? 'Reset scene' : modal === 'report' ? 'Collection service report' : modal === 'readiness' ? 'Release readiness' : modal === 'evaluation' ? 'Controller evaluation' : modal === 'planners' ? 'Human and AI planner comparison' : modal === 'library' ? 'Saved episode library' : modal === 'human' ? 'Human activity scenario' : 'About RoboTrace'} onClick={event => event.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setModal(null); setPendingEnvironment(null); }}><X size={19}/></button>
        <Suspense fallback={<div className="suite-loading"><Loader2 size={24} className="spin"/><p>Loading workspace tools…</p></div>}>{modal === 'human' ? <><div className="modal-symbol"><Users size={24}/></div><span className="eyebrow">HUMAN ACTIVITY · SCENARIO PROXY</span><h2>A person joins the workcell.</h2><p>Test an explicit human-presence interruption. Entering the workspace holds the controller; clearing the scenario still requires an explicit Resume.</p><div className="human-scenario-actions">{[{label:'Person nearby',command:'Simulate a person nearby'},{label:'Enter workspace',command:'Simulate a person entering workspace'},{label:'Clear presence',command:'Clear the human workspace scenario'}].map(item => <button className="button button-secondary" key={item.label} onClick={() => { submitCommand(item.command); setModal(null); }}>{item.label}</button>)}</div><p className="fine-print">Scripted person geometry and software pause rules. No camera-based tracking, contact simulation, or physical safety certification.</p></> : modal === 'library' ? <EpisodeLibrary onLoad={loadEpisode}/> : modal === 'planners' ? <PlannerBench world={world}/> : modal === 'evaluation' ? <EvaluationLab onResults={setEvaluationResult}/> : modal === 'report' ? <><div className="modal-symbol"><FileJson size={24}/></div><span className="eyebrow">COLLECTION SERVICE REPORT</span><h2>{reportOpen?.title ?? 'Report not available'}</h2><p>{reportOpen?.summary ?? 'Save an episode while the local API is connected to generate a persistent report.'}</p>{reportOpen && <><div className="review-summary"><div><span>Outcome</span><strong>{reportOpen.outcome}</strong></div><div><span>Task acceptance</span><strong>{reportOpen.acceptance.status}</strong></div><div><span>Completed actions</span><strong>{reportOpen.metrics.completedActions}</strong></div><div><span>Recorded states</span><strong>{reportOpen.metrics.sampleCount}</strong></div></div><p className="fine-print">Report {reportOpen.id} · Task geometry and recording consistency independently recomputed by the local service. Kinematic evidence; physical transfer is unverified.</p><button className="button button-secondary full-width" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(reportOpen, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `report-${reportOpen.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download size={14}/> Download service report</button></>}</> : modal === 'readiness' ? <><div className="modal-symbol"><ShieldCheck size={24}/></div><span className="eyebrow">INTERNAL ACCEPTANCE RUBRIC</span><h2>Evidence before claims.</h2><p>Track the complete workplace workflow. These are our release checks, not an organizer score or a claim of robot training performance.</p><div className="readiness-checks">{[{name:'Provider configuration',weight:20,passed:Boolean(integration?.configured),detail:'Agora + Murf + LLM + HTTPS configured. Audible voice still needs a round-trip check.'},{name:'Workplace workflow',weight:20,passed:Object.values(reports).length > 0,detail:'A recorded attempt is saved with an assignment update and factual report.'},{name:'Action execution',weight:15,passed:episodes.some(item => item.completedActions > 0),detail:'Observed controller outcomes are recorded.'},{name:'Physical-AI evidence',weight:15,passed:episodes.some(item => item.samples.length > 1),detail:'Reproducible scenes, checks and provenance; native kinematic data.'},{name:'Demo presentation',weight:15,passed:true,detail:'Studio, Copilot and immersive Simulation modes.'},{name:'Recovery controls',weight:10,passed:backendOnline && Boolean(evaluationResult),detail:evaluationResult ? `${evaluationResult.summary.passed}/${evaluationResult.summary.total} regression cases matched expected outcomes. Reset and lifecycle recovery are tested.` : 'Run the controller evaluation; pause/stop and voice reset are available.'},{name:'Measured results',weight:5,passed:Object.values(reports).length > 0,detail:'Reports contain observed actions, samples and acceptance outcomes.'}].map(item => <div className="readiness-row" key={item.name}><span>{item.passed ? <CheckCheck size={17}/> : <Circle size={17}/>}</span><div><strong>{item.name}<small>{item.weight} points</small></strong><p>{item.detail}</p></div><span className="badge">{item.passed ? 'Evidence present' : 'Pending'}</span></div>)}</div><p className="fine-print">No total score is awarded automatically. Full voice credit requires verified speech → tool → action → spoken result.</p></> : modal === 'environments' ? <ScenarioStudio currentWorld={world} currentInstruction={environment.instruction} initialPrompt={scenePrompt} preparedDraft={pendingEnvironment} onApply={applyEnvironment} onDraft={setPendingEnvironment}/> : modal === 'connections' ? <><div className="modal-symbol"><Mic size={24}/></div><span className="eyebrow">LIVE CONVERSATION</span><h2>Connect Agora + Murf</h2><p>The simulator works locally. Live voice needs your provider credentials and the local integration service.</p><div className="connection-status"><span className={`small-dot ${backendOnline ? 'green' : 'orange'}`}/><strong>{backendOnline ? 'Local integration service available' : 'Integration service is not running'}</strong></div><ol className="setup-steps"><li><strong>Create your provider credentials</strong><span>Agora App ID, App Certificate, Murf Falcon key, and an LLM key.</span></li><li><strong>Add them to .env.local</strong><span>Copy .env.example. Keep secrets on your computer and out of chat.</span></li><li><strong>Start the integration service</strong><code>npm run server</code><span>See server/SETUP.md for account setup and the HTTPS tool callback.</span></li></ol>{integration && <details className="integration-detail"><summary>Configuration status</summary><pre>{JSON.stringify(integration, null, 2)}</pre></details>}<button className="button button-primary full-width" disabled={!backendOnline || voiceState === 'connecting'} onClick={voiceReady ? disconnectVoice : connectVoice}>{voiceState === 'connecting' ? <Loader2 className="spin" size={15}/> : <Mic size={15}/>} {voiceReady ? 'End live voice session' : 'Start live voice session'}</button><button className="button button-secondary full-width" onClick={recoverVoice}>Reset voice connection</button><a className="modal-link" href="https://console.agora.io/" target="_blank" rel="noreferrer">Open Agora console</a><a className="modal-link" href="https://murf.ai/api" target="_blank" rel="noreferrer">Murf API access</a></> : modal === 'publish' ? <><div className="modal-symbol"><ClipboardCheck size={24}/></div><span className="eyebrow">SAVE RECORDING</span><h2>Save this recording?</h2><p>Save the recorded attempt with its simulator provenance and actual outcome. Saving does not assert human quality review.</p><div className="review-summary"><div><span>Episode</span><strong>{selectedEpisode?.id}</strong></div><div><span>Outcome</span><strong>{selectedEpisode?.outcome}</strong></div><div><span>State samples</span><strong>{selectedEpisode?.samples.length}</strong></div><div><span>Save destination</span><strong>{backendOnline ? 'Local episode service' : 'This browser'}</strong></div></div><p className="fine-print">Kinematic trajectories with idealized grasps. This recording does not validate physical contact or train a robot policy.</p><button className="button button-primary full-width" disabled={publishing} onClick={publish}>{publishing ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} Save episode</button></> : modal === 'reset' ? <><div className="modal-symbol"><RotateCcw size={24}/></div><h2>Reset the workcell?</h2><p>This stops any active task and returns the robot and objects to their initial positions. Saved episodes remain available.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Keep current scene</button><button className="button button-primary" onClick={reset}>Reset scene</button></div></> : <><div className="modal-symbol"><Blocks size={24}/></div><span className="eyebrow">ROBOTRACE · PROTOTYPE</span><h2>A workbench you can talk to.</h2><p>Direct a tabletop robot, inspect its actions, and collect reviewable demonstration episodes. Built for a laptop, with no physical robot required.</p><div className="honesty-card"><strong>What is working</strong><p>Scene-grounded local commands, articulated motion, pick-and-place, pause/stop, state recording, replay, and JSON export.</p><strong>Simulation boundary</strong><p>Deterministic kinematics and idealized attachment grasps. No contact dynamics, learned robot policy, or real-world deployment claim.</p><strong>Live voice</strong><p>Agora Conversational AI and Murf Falcon require provider setup. The status bar reports the actual connection state.</p></div><div className="help-commands"><strong>Supported command examples</strong><code>Sort all parts</code><code>Move red and blue to tray A</code><code>Move green to review</code><code>Return red to table</code><code>Pause / Resume / Stop / Reset</code></div><button className="button button-primary full-width" onClick={() => setModal(null)}>Open workcell</button></>}
      </Suspense></section></div>}
      <span className="sr-only" aria-live="polite">{world.robot.phase}. {publishedTo ? `Episode saved to ${publishedTo}.` : ''}</span>
    </div>
  );
}
