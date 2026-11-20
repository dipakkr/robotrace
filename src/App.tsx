import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, AudioLines, Blocks, Box, Check, CheckCheck, ChevronDown, ChevronRight, Circle, CircleHelp, ClipboardCheck, Clock3, Code2, Download, Expand, FileJson, FolderOpen, Grid2X2, History, Layers3, ListChecks, Loader2, Mic, MousePointer2, Move3D, PanelLeftClose, Pause, Play, Plus, Radio, RotateCcw, Send, Settings2, ShieldCheck, Square, TriangleAlert, Volume2, X } from 'lucide-react';
import { RobotScene } from './components/RobotScene';
import { advanceWorld, createInitialWorld, DESTINATIONS, planCommand } from './sim/engine';
import type { ActionStep, CommandPlan, WorldState } from './sim/engine';
import ScenarioStudio from './components/ScenarioStudio';
import type { EnvironmentSpec } from './components/ScenarioStudio';
import { SCENARIOS } from './sim/scenarios';
import { draftSceneFromText } from './sim/scene-authoring';

type Entry = { id: string; role: 'assistant' | 'user' | 'system' | 'robot'; text: string; time: string };
type Event = { time: number; label: string; kind: 'command' | 'action' | 'success' | 'error' | 'control' };
type Sample = { time: number; world: WorldState };
type Episode = { id: string; title: string; scenarioId?: string; createdAt: string; duration: number; status: 'review' | 'approved'; outcome: 'completed' | 'stopped' | 'failed'; initialWorld: WorldState; samples: Sample[]; events: Event[]; completedActions: number; command: string };
type Recorder = { id: string; scenarioId: string; scenarioName: string; start: number; initialWorld: WorldState; samples: Sample[]; events: Event[]; command: string; completedActions: number; lastSample: number };
type Modal = 'connections' | 'help' | 'publish' | 'reset' | 'environments' | null;
const STORE_KEY = 'teachtrace.episodes.v1';
const clone = <T,>(value: T): T => structuredClone(value);
const timestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const timecode = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor(seconds % 1 * 10)}`;
const destinationLabel = (id: string) => ({ 'tray-a': 'Tray A', 'tray-b': 'Tray B', reject: 'Review', table: 'Worktable' })[id] ?? id;

function readEpisodes(): Episode[] {
  try { const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]'); return Array.isArray(parsed) ? parsed.slice(0, 6) : []; } catch { return []; }
}
function episodeRecord(episode: Episode) {
  return { schema: 'teachtrace.episode.v1', controller: 'teachtrace-kinematic-v1', simulation: { type: 'kinematic', grasp: 'idealized attachment', physicalContactValidated: false, policyTrained: false }, ...episode };
}
function downloadEpisode(episode: Episode) {
  const data = episodeRecord(episode);
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${episode.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [world, setWorld] = useState<WorldState>(createInitialWorld);
  const [environment, setEnvironment] = useState<EnvironmentSpec>(() => ({ id: 'baseline-sort', name: 'Baseline sorting', world: createInitialWorld(), instruction: 'Sort all parts' }));
  const environmentRef = useRef(environment);
  const [scenePrompt, setScenePrompt] = useState('');
  const [pendingEnvironment, setPendingEnvironment] = useState<EnvironmentSpec | null>(null);
  const worldRef = useRef(world);
  const [selectedId, setSelectedId] = useState<string | null>('robot');
  const [section, setSection] = useState<'scene' | 'episodes'>('scene');
  const [rightTab, setRightTab] = useState<'assistant' | 'mission'>('assistant');
  const [view, setView] = useState<'perspective' | 'top' | 'robot'>('perspective');
  const [showGrid, setShowGrid] = useState(true);
  const [showPath, setShowPath] = useState(true);
  const [command, setCommand] = useState('');
  const [entries, setEntries] = useState<Entry[]>([{ id: 'intro', role: 'assistant', text: 'Your workcell is ready. Give me a collection task, or try one of the commands below. I’ll show the plan before anything moves.', time: timestamp() }]);
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
  const [voiceState, setVoiceState] = useState<'disconnected' | 'connecting' | 'connected' | 'live' | 'error'>('disconnected');
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
  const liveRef = useRef(true);
  const finishRef = useRef<(outcome: Episode['outcome']) => void>(() => {});
  const sayRef = useRef<(text: string, role?: Entry['role']) => void>(() => {});
  const toolResolvers = useRef<((result: unknown) => void)[]>([]);
  const voiceHandler = useRef<(text: string) => Promise<{ completed: boolean; summary?: string; error?: string; world?: unknown }>>(async () => ({ completed: false }));

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
    if (recorderRef.current) recorderRef.current.events.push({ ...event, time: event.time - recorderRef.current.start });
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
    recorderRef.current = null; setRecording(false); setGuideStep(3);
    sayRef.current(`Episode recorded: ${episode.completedActions} verified action${episode.completedActions === 1 ? '' : 's'}, ${episode.samples.length} state samples. Review the recording before approving it.`);
  }, []);
  finishRef.current = finishRecording;

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
        if (result.done) {
          if (result.error) {
            narrationRef.current(`I stopped this action: ${result.error}`);
            setFailedStep(step.id); addEvent(result.error, 'error'); sayRef.current(result.error); queueRef.current = null; finishRef.current('failed');
            toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'failed', error: result.error }));
          } else {
            setCompletedSteps(previous => [...previous, step.id]); addEvent(step.label, 'success'); if (recorder) recorder.completedActions++;
            narrationRef.current(`Verified: ${step.label.replace(/^Move /, '')}.${queue.steps[queue.index + 1] ? ` Next, ${queue.steps[queue.index + 1].label.toLowerCase()}.` : ' All actions are complete.'}`);
            queue.index++;
            if (queue.index < queue.steps.length) {
              worldRef.current = { ...result.world, robot: { ...result.world.robot, mode: 'running' } }; setActiveStep(queue.index);
            } else {
              queueRef.current = null; setActiveStep(-1); addEvent('Task completed and placement verified', 'success');
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
    const current = worldRef.current;
    if (current.robot.mode === 'running') { replaceWorld({ ...current, robot: { ...current.robot, mode: 'paused' } }); addEvent('Operator paused motion', 'control'); say('Motion paused. The current pose is held.'); }
    else if (current.robot.mode === 'paused' && queueRef.current) { replaceWorld({ ...current, robot: { ...current.robot, mode: 'running' } }); addEvent('Operator resumed motion', 'control'); }
  };
  const stop = useCallback(() => {
    if (!queueRef.current && worldRef.current.robot.mode !== 'paused') return;
    queueRef.current = null; const current = worldRef.current;
    replaceWorld({ ...current, robot: { ...current.robot, mode: 'stopped', phase: 'Stopped by operator' } }); setActiveStep(-1); setPlan(null);
    addEvent('Operator stopped the run', 'control'); finishRef.current('stopped'); say('Stopped. The arm holds its current pose. Reset the scene before starting a new collection.');
    toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'cancelled', reason: 'operator_stop' }));
  }, [replaceWorld, addEvent, say]);
  const reset = () => {
    queueRef.current = null; if (recorderRef.current) finishRecording('stopped');
    toolResolvers.current.splice(0).forEach(resolve => resolve({ status: 'cancelled', reason: 'scene_reset' }));
    replaceWorld(clone(environmentRef.current.world)); setSteps([]); setActiveStep(-1); setCompletedSteps([]); setFailedStep(null); setPlan(null); setReplay(null); setEvents([]); setSampleCount(0); setActiveEpisodeId(null); setModal(null); setGuideStep(0); say(`Scene reset to ${environmentRef.current.name.toLowerCase()}.`);
  };
  const applyEnvironment = (next: EnvironmentSpec) => {
    if (queueRef.current || recorderRef.current) { setNotice('Finish or stop the current recording before replacing the environment.'); return; }
    environmentRef.current = clone(next); setEnvironment(clone(next));
    replaceWorld(clone(next.world)); queueRef.current = null; setSteps([]); setActiveStep(-1); setCompletedSteps([]); setFailedStep(null); setPlan(null); setReplay(null); setEvents([]); setSampleCount(0); setActiveEpisodeId(null); setGuideStep(0); setPendingEnvironment(null); setScenePrompt(''); setModal(null); setSelectedId('robot');
    say(`Loaded ${next.name.toLowerCase()} with ${next.world.objects.length} objects. Suggested task: “${next.instruction}”.`);
    narrationRef.current(`Environment ready: ${next.name}.`);
  };
  const runPlan = (selectedPlan = plan, instruction = planCommandText) => {
    if (!selectedPlan?.steps.length || queueRef.current || replay) return;
    if (worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') { say('Reset the scene before starting another run.'); return; }
    setSteps(selectedPlan.steps); setCompletedSteps([]); setFailedStep(null); setActiveStep(0); setPlan(null); setRightTab('mission'); setGuideStep(2);
    lastCommandRef.current = instruction;
    if (autoRecord) startRecording(instruction);
    addEvent(instruction, 'command');
    queueRef.current = { steps: selectedPlan.steps, index: 0 };
    replaceWorld({ ...worldRef.current, robot: { ...worldRef.current.robot, mode: 'running' } });
    say(`Executing ${selectedPlan.steps.length} action${selectedPlan.steps.length === 1 ? '' : 's'}. You can pause or stop at any time.`);
    narrationRef.current(`Starting the task. ${selectedPlan.steps[0].label}.`);
  };
  const submitCommand = (text: string) => {
    if (!text.trim()) return;
    setCommand(''); setRightTab('assistant'); say(text.trim(), 'user');
    if (replay) { say('You are reviewing a recording. Return to the live scene before sending a command.'); return; }
    if (/^(create|build|set up|setup|make|generate)\b/i.test(text.trim())) {
      if (queueRef.current || recording) { say('Finish or stop the current recording before creating a new environment.'); return; }
      const draft = draftSceneFromText(text);
      setScenePrompt(text); setPendingEnvironment(draft.world ? { id: 'custom', name: 'Custom workcell', world: draft.world, instruction: 'Sort all parts' } : null); setModal('environments');
      say(draft.error ?? `${draft.summary} Review the environment draft, then approve it.`); return;
    }
    if (/^(yes|approve|approve and run|run plan|execute plan|go ahead)[.!\s]*$/i.test(text.trim())) {
      if (pendingEnvironment && modal === 'environments') { applyEnvironment(pendingEnvironment); return; }
      if (plan) runPlan(plan, planCommandText); else say('There is no prepared plan to approve. Describe a task first.');
      return;
    }
    const parsed = planCommand(text, worldRef.current);
    if (parsed.control === 'pause') { if (worldRef.current.robot.mode === 'running') pause(); else say('There is no running motion to pause.'); return; }
    if (parsed.control === 'resume') { if (worldRef.current.robot.mode === 'paused') pause(); else say('There is no paused motion to resume.'); return; }
    if (parsed.control === 'stop') { stop(); return; }
    if (parsed.control === 'reset') { setModal('reset'); return; }
    if (queueRef.current) { say('A task is active. Pause or stop it before preparing another plan.'); return; }
    if (worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') { say('Reset the scene or load an environment before preparing another task.'); setPlan(null); return; }
    if (parsed.error) { say(parsed.error); setPlan(null); return; }
    setPlan(parsed); setPlanCommandText(text); setGuideStep(1); say(parsed.summary);
  };
  const selectedEpisode = episodes.find(episode => episode.id === activeEpisodeId) ?? episodes[0] ?? null;
  const voiceReady = voiceState === 'connected' || voiceState === 'live';
  const displayWorld = replay ? replay.episode.samples[replay.index]?.world ?? replay.episode.initialWorld : world;
  const object = displayWorld.objects.find(item => item.id === selectedId);
  const running = world.robot.mode === 'running';
  const busy = running || world.robot.mode === 'paused';
  const modeLabel = replay ? 'Replay' : ({ idle: completedSteps.length ? 'Completed' : 'Ready', running: 'Executing', paused: 'Paused', stopped: 'Stopped', error: 'Attention' })[world.robot.mode];
  const currentSamples = replay?.episode.samples ?? (recorderRef.current?.samples ?? selectedEpisode?.samples ?? []);
  const timelineEvents = replay?.episode.events ?? recorderRef.current?.events ?? selectedEpisode?.events ?? events;
  const shownDuration = replay ? replay.episode.samples[replay.index]?.time ?? 0 : world.simTime;
  const renderedSteps = replay ? planCommand(replay.episode.command, replay.episode.initialWorld).steps : steps.length ? steps : planCommand(environment.instruction, displayWorld).steps;
  const renderedCompleted = replay ? renderedSteps.filter(step => replay.episode.events.some(event => event.kind === 'success' && event.label === step.label && event.time <= shownDuration)).map(step => step.id) : completedSteps;
  const renderedActiveIndex = replay ? (shownDuration < replay.episode.duration ? renderedSteps.findIndex(step => !renderedCompleted.includes(step.id)) : -1) : activeStep;
  const timelineTime = replay ? shownDuration : recorderRef.current ? world.simTime - recorderRef.current.start : selectedEpisode?.duration ?? 0;
  const timelineTotal = Math.max(5, replay?.episode.duration ?? (recorderRef.current ? timelineTime : selectedEpisode?.duration ?? 0));
  const publish = async () => {
    if (!selectedEpisode) return;
    setPublishing(true);
    let destination = 'this browser';
    if (backendOnline) {
      try {
        const response = await fetch('/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(episodeRecord({ ...selectedEpisode, status: 'approved' })) });
        if (!response.ok) throw new Error('Episode service did not accept the record.');
        destination = 'the local episode service';
      } catch { setPublishing(false); setNotice('The episode service could not save the record. Export a JSON copy or retry.'); return; }
    }
    setEpisodes(previous => previous.map(episode => episode.id === selectedEpisode.id ? { ...episode, status: 'approved' } : episode));
    setPublishing(false); setPublishedTo(destination); setModal(null); setGuideStep(4); say(`Episode ${selectedEpisode.id} approved and saved to ${destination}. A JSON export includes its states, actions, and simulation limitations.`);
  };
  voiceHandler.current = async (text: string) => {
    if (/^(yes|approve|approve and run|run plan|execute plan|go ahead)[.!\s]*$/i.test(text.trim())) {
      if (pendingEnvironment && modal === 'environments') {
        if (queueRef.current || recorderRef.current) return { completed: false, error: 'A recording is active. Stop it before applying an environment.' };
        applyEnvironment(pendingEnvironment); return { completed: true, summary: 'The reviewed environment was applied.', world: worldRef.current };
      }
      if (!plan || queueRef.current || replay || worldRef.current.robot.mode === 'stopped' || worldRef.current.robot.mode === 'error') return { completed: false, error: 'No executable plan is awaiting approval.' };
      return new Promise(resolve => {
        toolResolvers.current.push(result => {
          const receipt = result as { status: string; error?: string; reason?: string; scene?: unknown };
          resolve({ completed: receipt.status === 'succeeded', summary: receipt.status === 'succeeded' ? 'All requested placements were verified by the simulator.' : 'Execution did not complete.', error: receipt.error ?? receipt.reason, world: worldRef.current });
        });
        submitCommand(text);
      });
    }
    if (/^(create|build|set up|setup|make|generate)\b/i.test(text.trim())) {
      const draft = draftSceneFromText(text); submitCommand(text);
      return { completed: false, summary: draft.error ?? 'A validated environment draft is awaiting operator approval. Ask for approval before calling approve.', world: worldRef.current };
    }
    const interpreted = planCommand(text, worldRef.current);
    submitCommand(text);
    if (interpreted.control && interpreted.control !== 'reset') return { completed: true, summary: `Control instruction handled: ${interpreted.control}.`, world: worldRef.current };
    return { completed: false, summary: interpreted.error ?? 'Plan prepared in the UI. Ask the operator to approve it, then call the command tool with "approve".', world: worldRef.current };
  };
  const connectVoice = async () => {
    if (!backendOnline) { setModal('connections'); return; }
    setVoiceState('connecting');
    try {
      const voice = await import('./integrations/voice');
      await voice.startVoiceSession(text => voiceHandler.current(text), {
        getWorld: () => worldRef.current,
        onStatus: (status, message) => { setVoiceState(status); if (message && status === 'error') setNotice(message); },
      });
      setVoiceState(previous => previous === 'live' ? previous : 'connected'); setModal(null); say('Agora RTC joined. The status will update when the conversational agent audio arrives.');
    } catch (error) { setVoiceState('error'); setNotice(error instanceof Error ? error.message : 'Voice session could not start. Check connection settings.'); setModal('connections'); }
  };
  const disconnectVoice = async () => { try { const voice = await import('./integrations/voice'); await voice.stopVoiceSession(); } finally { setVoiceState('disconnected'); } };

  return (
    <div className="studio">
      <header className="topbar">
        <a className="brand" href="#" onClick={event => event.preventDefault()} aria-label="TeachTrace home"><span className="brand-mark"><Blocks size={22} strokeWidth={1.7}/></span><span>teachtrace<span className="brand-dot">.</span></span></a>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><span>Demonstration lab</span><ChevronRight size={14}/><strong>Workcell 01</strong><ChevronDown size={13}/></div>
        <div className="topbar-actions"><span className="badge simulation-badge"><Box size={12}/> Simulation</span><button className="icon-button" title="Open setup and help" aria-label="Open help" onClick={() => setModal('help')}><CircleHelp size={18}/></button><button className="avatar" onClick={() => setModal('connections')} title="Connection settings">DL</button></div>
      </header>

      <div className="studio-body">
        <nav className="activity-rail" aria-label="Workspace navigation">
          <button className={section === 'scene' ? 'rail-button active' : 'rail-button'} title="Workcell" aria-label="Workcell" onClick={() => setSection('scene')}><Layers3 size={21}/></button>
          <button className={section === 'episodes' ? 'rail-button active' : 'rail-button'} title="Episodes" aria-label="Episodes" onClick={() => setSection('episodes')}><FolderOpen size={21}/>{episodes.length > 0 && <span className="rail-count">{episodes.length}</span>}</button>
          <button className="rail-button" title="Task specification" aria-label="Task specification" onClick={() => { setRightTab('mission'); setSection('scene'); }}><ListChecks size={21}/></button>
          <div className="rail-spacer"/>
          <button className="rail-button" title="Integration settings" aria-label="Integration settings" onClick={() => setModal('connections')}><Settings2 size={21}/></button>
          <button className="rail-button" title="About this prototype" aria-label="About this prototype" onClick={() => setModal('help')}><Code2 size={20}/></button>
        </nav>

        <aside className="scene-sidebar">
          <div className="sidebar-heading"><div><span className="eyebrow">COLLECTION WORKSPACE</span><h1>{section === 'scene' ? 'Workcell 01' : 'Episodes'}</h1></div><button className="icon-button" title="Show workcell" aria-label="Show workcell" onClick={() => setSection('scene')}><PanelLeftClose size={17}/></button></div>
          <div className="workspace-description"><span className="mini-robot"><Box size={17}/></span><div><strong>Tabletop manipulation</strong><span>TT-01 · Articulated arm</span></div></div>
          <div className="sidebar-tabs"><button className={section === 'scene' ? 'selected' : ''} onClick={() => setSection('scene')}>Scene</button><button className={section === 'episodes' ? 'selected' : ''} onClick={() => setSection('episodes')}>Episodes <span>{episodes.length}</span></button></div>
          {section === 'scene' ? <>
            <div className="tree-section-title">SCENE HIERARCHY <span>{3 + displayWorld.objects.length + DESTINATIONS.length}</span></div>
            <div className="scene-tree">
              <button className="tree-row root-row" onClick={() => setSelectedId('world')}><ChevronDown size={13}/><Layers3 size={16}/><span>World</span><span className="tree-muted">m</span></button>
              <button className={`tree-row nested ${selectedId === 'robot' ? 'is-selected' : ''}`} onClick={() => setSelectedId('robot')}><Box size={16}/><span>TT-01 robot</span><span className={`small-dot ${running ? 'orange' : 'green'}`}/></button>
              <button className={`tree-row nested ${selectedId === 'table' ? 'is-selected' : ''}`} onClick={() => setSelectedId('table')}><Grid2X2 size={16}/><span>Worktable</span><span className="tree-muted">fixed</span></button>
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
          </> : <div className="episode-list">{episodes.length ? episodes.map(episode => <button className={`episode-card ${selectedEpisode?.id === episode.id ? 'selected-episode' : ''}`} key={episode.id} onClick={() => { setActiveEpisodeId(episode.id); if (!busy && !recording) setReplay({ episode, index: 0, playing: false }); }}><div className="episode-card-top"><FileJson size={17}/><span>{episode.id}</span></div><strong>{episode.command || episode.title}</strong><div><span>{timecode(episode.duration)}</span><span>{episode.samples.length} samples</span></div><span className={`badge ${episode.status === 'approved' ? 'approved-badge' : ''}`}>{episode.status === 'approved' ? 'Approved' : 'Needs review'}</span></button>) : <div className="sidebar-empty"><History size={28}/><strong>Your first episode starts here</strong><p>Run a task with auto-record enabled. Review its trajectory, then approve or export it.</p></div>}</div>}
          <div className="sidebar-bottom"><ShieldCheck size={15}/><span>Local workcell · No hardware required</span></div>
        </aside>

        <main className="main-workspace">
          <div className="workspace-top"><div><div className="workspace-title"><h2>Workcell studio</h2><span className={`state-pill state-${replay ? 'replay' : world.robot.mode}`}><span/>{modeLabel}</span></div><button className="environment-switcher" onClick={() => { setScenePrompt(''); setModal('environments'); }}><Grid2X2 size={13}/>{environment.name}<ChevronDown size={12}/></button></div><div className="workspace-buttons"><button className="button button-secondary new-environment-button" onClick={() => { setScenePrompt(''); setModal('environments'); }}><Plus size={14}/><span>Environment</span></button><button className={`button ${recording ? 'record-active' : 'button-secondary'}`} disabled={!!replay || (recording && busy)} onClick={() => recording ? finishRecording(busy ? 'stopped' : 'completed') : startRecording()}><span className="record-dot"/>{recording ? 'Finish recording' : 'Record episode'}</button><button className="button button-danger" disabled={!busy} onClick={stop}><Square size={13} fill="currentColor"/> Stop</button></div></div>
          <div className="work-area">
            <section className="viewport-panel" aria-label="3D robot workcell">
              <div className="panel-toolbar"><div className="panel-title"><Box size={15}/><strong>3D WORKCELL</strong><span className="toolbar-divider"/><span>Scene 01</span></div><div className="viewport-controls"><button className={view === 'perspective' ? 'view-button selected' : 'view-button'} onClick={() => setView('perspective')}>Orbit</button><button className={view === 'top' ? 'view-button selected' : 'view-button'} onClick={() => setView('top')}>Top</button><button className={view === 'robot' ? 'view-button selected' : 'view-button'} onClick={() => setView('robot')}>Robot</button><span className="toolbar-divider"/><button className={`icon-button ${showGrid ? 'toggled' : ''}`} title="Toggle grid" aria-label="Toggle grid" onClick={() => setShowGrid(value => !value)}><Grid2X2 size={15}/></button><button className="icon-button" title="Toggle motion path" aria-label="Toggle motion path" onClick={() => setShowPath(value => !value)}><Activity size={15}/></button></div></div>
              <div className="viewport-canvas"><RobotScene world={displayWorld} selectedId={selectedId} onSelect={setSelectedId} view={view} showGrid={showGrid} showPath={showPath}/><div className="viewport-status"><span className="viewport-status-dot"/>{replay ? 'RECORDED REPLAY' : 'LOCAL SIMULATION'}<span className="viewport-status-time">{timecode(shownDuration)}</span></div><div className="viewport-corner-label">TT-01<span>TABLETOP WORKCELL</span></div><div className="scene-instruction"><MousePointer2 size={13}/><span>Drag to orbit · Scroll to zoom · Click to inspect</span></div>{busy && <div className="motion-overlay"><span className={running ? 'pulse-dot' : 'small-dot orange'}/><span>{world.robot.mode === 'paused' ? 'Motion paused' : world.robot.phase}</span><span className="motion-step">{Math.max(0, activeStep) + 1}/{steps.length}</span></div>}{replay && <button className="button return-live" onClick={() => setReplay(null)}><Radio size={13}/> Return to live scene</button>}</div>
              <div className="viewport-bottom"><div className="transport-controls"><button className="icon-button" title="Reset scene" aria-label="Reset scene" onClick={() => setModal('reset')}><RotateCcw size={16}/></button><button className="transport-play" title={world.robot.mode === 'paused' ? 'Resume' : busy ? 'Pause' : 'Prepare collection task'} aria-label={world.robot.mode === 'paused' ? 'Resume' : busy ? 'Pause' : 'Prepare collection task'} onClick={() => busy ? pause() : submitCommand(environment.instruction)}>{running ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="transport-label">{busy ? world.robot.mode === 'paused' ? 'Resume' : 'Pause' : 'Prepare task'}</span><span className="toolbar-divider"/><select aria-label="Simulation speed" value={world.robot.speed} disabled={!!replay} onChange={event => replaceWorld({ ...worldRef.current, robot: { ...worldRef.current.robot, speed: Number(event.target.value) } })}><option value={0.5}>0.5×</option><option value={1}>1× speed</option><option value={2}>2× speed</option><option value={3}>3× speed</option></select><ChevronDown size={11}/></div><span className="simulation-note"><span/> Kinematic · Idealized grasp</span></div>
            </section>

            <aside className="copilot-panel">
              <div className="copilot-heading"><div className="copilot-symbol"><AudioLines size={19}/></div><div><h2>Collection copilot</h2><span>{voiceState === 'live' ? 'Agora + Murf Falcon' : voiceState === 'connected' ? 'RTC joined · Waiting for agent' : 'Local command mode'}</span></div><button className={`icon-button ${narrationEnabled ? 'narration-on' : ''}`} title="Toggle robot announcements" aria-label="Toggle robot announcements" aria-pressed={narrationEnabled} onClick={() => setNarrationEnabled(value => !value)}><Volume2 size={16}/></button><button className="icon-button" title="Copilot connection settings" aria-label="Copilot connection settings" onClick={() => setModal('connections')}><Settings2 size={16}/></button></div>
              <div className="copilot-tabs"><button className={rightTab === 'assistant' ? 'active' : ''} onClick={() => setRightTab('assistant')}>Assistant</button><button className={rightTab === 'mission' ? 'active' : ''} onClick={() => setRightTab('mission')}>Task plan{steps.length > 0 && <span>{steps.length}</span>}</button></div>
              {rightTab === 'assistant' ? <div className="assistant-content"><div className="conversation"><div className="session-date">WORKCELL SESSION · TODAY</div>{entries.map(entry => <div key={entry.id} className={`message message-${entry.role}`}><div className="message-meta">{entry.role === 'user' ? 'YOU' : entry.role === 'system' ? 'SYSTEM' : entry.role === 'robot' ? 'ROBOT' : 'COPILOT'}<span>{entry.time}</span></div><p>{entry.text}</p></div>)}{plan && <div className="plan-preview"><div><ListChecks size={16}/><strong>Ready for your approval</strong></div><ol>{plan.steps.map(step => <li key={step.id}>{step.label}</li>)}</ol><div className="plan-check"><ShieldCheck size={13}/> Objects grounded in current scene</div><button className="button button-primary" onClick={() => runPlan()} disabled={busy || !!replay}><Play size={13} fill="currentColor"/> Approve & run</button><button className="text-button" onClick={() => { setPlan(null); say('Plan discarded. Describe a different task when you’re ready.'); }}>Discard plan</button></div>}<div ref={transcriptEnd}/></div>{entries.length < 4 && !plan && <div className="command-suggestions"><span className="eyebrow">TRY A COMMAND</span>{['Sort all parts', 'Move the red part to tray A', 'Move green to review'].map(text => <button key={text} onClick={() => submitCommand(text)}>{text}<Plus size={13}/></button>)}</div>}</div> : <div className="mission-content"><div className="task-brief"><span className="eyebrow">COLLECTION ASSIGNMENT · COL-042</span><h3>{steps.length || replay ? 'Active collection task' : 'Sort the sample parts'}</h3><p>{replay?.episode.command || lastCommandRef.current || environment.instruction}</p><div><span><Box size={12}/> {displayWorld.objects.length} parts</span><span><ClipboardCheck size={12}/> {renderedSteps.filter(step => step.kind === 'pick_place').length} checks</span></div></div><div className="mission-label">EXECUTION QUEUE <span>{renderedCompleted.length}/{renderedSteps.length}</span></div><div className="skill-list">{renderedSteps.map((step, index) => <div key={step.id} className={`skill-item ${renderedCompleted.includes(step.id) ? 'skill-done' : renderedActiveIndex === index ? 'skill-active' : ''}`}><div className="skill-icon">{renderedCompleted.includes(step.id) ? <Check size={13}/> : failedStep === step.id ? <X size={13}/> : renderedActiveIndex === index ? <Loader2 size={13} className={running ? 'spin' : ''}/> : <span>{index + 1}</span>}</div><div><strong>{step.label}</strong><span>{renderedCompleted.includes(step.id) ? 'Placement verified' : failedStep === step.id ? 'Action failed' : renderedActiveIndex === index ? displayWorld.robot.phase : 'Pick · transfer · release · verify'}</span></div></div>)}</div><div className="mission-label">OUTCOME CHECKS</div>{renderedSteps.filter(step => step.kind === 'pick_place').map(step => { const part = displayWorld.objects.find(item => item.id === step.objectId); const passed = part?.location === step.destination; return <div className="outcome-check" key={step.id}>{passed ? <CheckCheck size={15} className="success-text"/> : <Circle size={15}/>}<span>{part?.label} in {destinationLabel(step.destination ?? 'table')}</span><strong>{passed ? 'Passed' : 'Pending'}</strong></div>; })}<button className="button button-primary mission-run" disabled={busy || !!replay} onClick={() => submitCommand(environment.instruction)}><Play size={13} fill="currentColor"/> Prepare collection task</button></div>}
              <div className="robot-announcement"><Volume2 size={13}/><div><span>ROBOT ACTIVITY{narrationQueued ? ' · VOICE QUEUED' : voiceState !== 'live' ? ' · TEXT ONLY' : ''}</span><p>{robotAnnouncement}</p></div></div><div className="command-area"><form onSubmit={event => { event.preventDefault(); submitCommand(command); }}><input value={command} onChange={event => setCommand(event.target.value)} aria-label="Robot command" placeholder="Tell the workcell what to do…"/><button type="submit" className="send-button" aria-label="Send command" disabled={!command.trim()}><Send size={16}/></button></form><div className="voice-row"><button className={`voice-button ${voiceReady ? 'connected' : ''}`} disabled={voiceState === 'connecting'} onClick={() => voiceReady ? disconnectVoice() : connectVoice()}>{voiceState === 'connecting' ? <Loader2 size={14} className="spin"/> : <Mic size={14}/>}<span>{voiceState === 'live' ? 'Voice connected' : voiceState === 'connected' ? 'Waiting for agent' : voiceState === 'connecting' ? 'Connecting…' : 'Connect voice'}</span></button><span>{voiceReady ? 'Agora · Murf Falcon' : 'Agora setup required'}</span></div></div>
            </aside>
          </div>

          <section className="recording-panel" aria-label="Episode recording and playback"><div className="recording-header"><div><History size={15}/><strong>EPISODE TIMELINE</strong>{recording && <span className="recording-label"><span className="record-dot"/> Recording</span>}{replay && <span className="badge">Replay</span>}{!recording && !replay && <span className="timeline-hint">{selectedEpisode ? selectedEpisode.id : 'No episode recorded yet'}</span>}</div><div><label className="auto-record"><input type="checkbox" checked={autoRecord} onChange={event => setAutoRecord(event.target.checked)}/>Auto-record tasks</label><button className="icon-button" title="Export selected episode" aria-label="Export selected episode" disabled={!selectedEpisode || recording} onClick={() => selectedEpisode && downloadEpisode(selectedEpisode)}><Download size={15}/></button></div></div>
            <div className="timeline-body"><button className="timeline-play" aria-label={replay?.playing ? 'Pause replay' : 'Replay latest episode'} disabled={!selectedEpisode || busy || recording} onClick={() => { if (replay) setReplay({ ...replay, playing: !replay.playing, index: replay.index >= replay.episode.samples.length - 1 ? 0 : replay.index }); else if (selectedEpisode) setReplay({ episode: selectedEpisode, index: 0, playing: true }); }}>{replay?.playing ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}</button><span className="timeline-time">{timecode(timelineTime)}</span><div className="timeline-track"><div className="timeline-ruler">{[0, 1, 2, 3, 4, 5].map(index => <span key={index}>{timecode(index * Math.max(5, Math.ceil(timelineTotal / 5)))}</span>)}</div><div className="timeline-lanes">{currentSamples.length ? <div className="recorded-lane"><span>State trajectory</span><svg viewBox="0 0 500 25" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={currentSamples.filter((_, i) => i % Math.max(1, Math.floor(currentSamples.length / 90)) === 0).map((sample, index, samples) => `${index / Math.max(1, samples.length - 1) * 500},${22 - (sample.world.robot.position[1] - 0.75) * 17}`).join(' ')}/></svg></div> : <div className="empty-lane"><span>Run a task to capture its trajectory and action events.</span></div>}<div className="timeline-events">{timelineEvents.filter(event => event.kind !== 'command').map((event, index) => <span key={index} className={`timeline-event event-${event.kind}`} style={{ left: `${Math.min(99, event.time / (Math.max(5, Math.ceil(timelineTotal / 5)) * 5) * 100)}%` }} title={`${timecode(event.time)} · ${event.label}`} />)}</div>{replay && <input className="timeline-scrubber" type="range" min={0} max={Math.max(0, replay.episode.samples.length - 1)} value={replay.index} onChange={event => setReplay({ ...replay, index: Number(event.target.value), playing: false })} aria-label="Seek episode"/>}</div></div><div className="sample-counter"><strong>{replay?.episode.samples.length ?? (recording ? sampleCount : selectedEpisode?.samples.length ?? sampleCount)}</strong><span>samples</span></div></div>
            <div className="timeline-footer"><span><span className="small-dot green"/>{recording ? 'Capturing simulator states · up to 10 Hz' : selectedEpisode ? `${selectedEpisode.completedActions} verified actions · ${selectedEpisode.status === 'approved' ? 'Approved' : 'Awaiting review'}` : 'Recorder ready · States, actions, and outcomes'}</span>{selectedEpisode && !recording && <div><button className="text-button" disabled={busy || recording} onClick={() => setReplay({ episode: selectedEpisode, index: 0, playing: false })}>Review episode</button><button className="small-primary" disabled={selectedEpisode.status === 'approved' || busy} onClick={() => setModal('publish')}>{selectedEpisode.status === 'approved' ? 'Approved' : 'Approve episode'}<Check size={12}/></button></div>}</div>
          </section>
          <div className="workflow-strip">{['Describe task', 'Approve plan', 'Observe execution', 'Review episode', 'Save demonstration'].map((label, index) => <div className={guideStep > index ? 'workflow-done' : guideStep === index ? 'workflow-current' : ''} key={label}><span>{guideStep > index ? <Check size={10}/> : index + 1}</span>{label}{index < 4 && <ChevronRight size={11}/>}</div>)}</div>
        </main>
      </div>
      <footer className="statusbar"><div><span className="small-dot green"/>Local simulator ready<span className="statusbar-divider"/><span>World revision {displayWorld.revision}</span></div><div><span>{voiceReady ? 'Agora connected' : 'Agora not connected'}</span><span className="statusbar-divider"/><span>Simulation data · No physical robot</span><button onClick={() => setModal('connections')}><Settings2 size={12}/></button></div></footer>
      {notice && <div className="toast" role="status"><TriangleAlert size={17}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={15}/></button></div>}
      {modal && <div className="modal-backdrop" onClick={() => { setModal(null); setPendingEnvironment(null); }}><section className={`modal ${modal === 'environments' ? 'environment-modal' : ''}`} role="dialog" aria-modal="true" aria-label={modal === 'environments' ? 'Environment studio' : modal === 'connections' ? 'Connection setup' : modal === 'publish' ? 'Approve episode' : modal === 'reset' ? 'Reset scene' : 'About TeachTrace'} onClick={event => event.stopPropagation()}><button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setModal(null); setPendingEnvironment(null); }}><X size={19}/></button>
        {modal === 'environments' ? <ScenarioStudio initialPrompt={scenePrompt} onApply={applyEnvironment} onDraft={setPendingEnvironment}/> : modal === 'connections' ? <><div className="modal-symbol"><Mic size={24}/></div><span className="eyebrow">LIVE CONVERSATION</span><h2>Connect Agora + Murf</h2><p>The simulator works locally. Live voice needs your provider credentials and the local integration service.</p><div className="connection-status"><span className={`small-dot ${backendOnline ? 'green' : 'orange'}`}/><strong>{backendOnline ? 'Local integration service available' : 'Integration service is not running'}</strong></div><ol className="setup-steps"><li><strong>Create your provider credentials</strong><span>Agora App ID, App Certificate, REST credentials, Murf Falcon key, and an LLM key.</span></li><li><strong>Add them to .env.local</strong><span>Copy .env.example. Keep secrets on your computer and out of chat.</span></li><li><strong>Start the integration service</strong><code>npm run server</code><span>See server/SETUP.md for account setup and the HTTPS tool callback.</span></li></ol>{integration && <details className="integration-detail"><summary>Configuration status</summary><pre>{JSON.stringify(integration, null, 2)}</pre></details>}<button className="button button-primary full-width" disabled={!backendOnline || voiceState === 'connecting'} onClick={connectVoice}>{voiceState === 'connecting' ? <Loader2 className="spin" size={15}/> : <Mic size={15}/>} Start live voice session</button><a className="modal-link" href="https://console.agora.io/" target="_blank" rel="noreferrer">Open Agora console</a><a className="modal-link" href="https://murf.ai/api" target="_blank" rel="noreferrer">Murf API access</a></> : modal === 'publish' ? <><div className="modal-symbol"><ClipboardCheck size={24}/></div><span className="eyebrow">HUMAN REVIEW</span><h2>Approve this demonstration?</h2><p>Confirm you have reviewed the recorded run. Approval saves the episode with its simulator provenance and outcome.</p><div className="review-summary"><div><span>Episode</span><strong>{selectedEpisode?.id}</strong></div><div><span>Outcome</span><strong>{selectedEpisode?.outcome}</strong></div><div><span>State samples</span><strong>{selectedEpisode?.samples.length}</strong></div><div><span>Save destination</span><strong>{backendOnline ? 'Local episode service' : 'This browser'}</strong></div></div><p className="fine-print">Kinematic trajectories with idealized grasps. This recording does not validate physical contact or train a robot policy.</p><button className="button button-primary full-width" disabled={publishing} onClick={publish}>{publishing ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} Approve & save episode</button></> : modal === 'reset' ? <><div className="modal-symbol"><RotateCcw size={24}/></div><h2>Reset the workcell?</h2><p>This stops any active task and returns the robot and objects to their initial positions. Saved episodes remain available.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Keep current scene</button><button className="button button-primary" onClick={reset}>Reset scene</button></div></> : <><div className="modal-symbol"><Blocks size={24}/></div><span className="eyebrow">TEACHTRACE · PROTOTYPE</span><h2>A workbench you can talk to.</h2><p>Direct a tabletop robot, inspect its actions, and collect reviewable demonstration episodes. Built for a laptop, with no physical robot required.</p><div className="honesty-card"><strong>What is working</strong><p>Scene-grounded local commands, articulated motion, pick-and-place, pause/stop, state recording, replay, and JSON export.</p><strong>Simulation boundary</strong><p>Deterministic kinematics and idealized attachment grasps. No contact dynamics, learned robot policy, or real-world deployment claim.</p><strong>Live voice</strong><p>Agora Conversational AI and Murf Falcon require provider setup. The status bar reports the actual connection state.</p></div><div className="help-commands"><strong>Supported command examples</strong><code>Sort all parts</code><code>Move red and blue to tray A</code><code>Move green to review</code><code>Return red to table</code><code>Pause / Resume / Stop / Reset</code></div><button className="button button-primary full-width" onClick={() => setModal(null)}>Open workcell</button></>}
      </section></div>}
      <span className="sr-only" aria-live="polite">{world.robot.phase}. {publishedTo ? `Episode saved to ${publishedTo}.` : ''}</span>
    </div>
  );
}
