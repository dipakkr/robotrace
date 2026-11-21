import { useEffect, useRef, useState } from 'react';
import { Download, Play, RefreshCw, X } from 'lucide-react';
import type { VoiceExperiment, VoiceExperimentReport } from '../data/voice-experiment';
import type { ExperimentResult } from '../hooks/useVoiceExperiment';
import type { MobileTestAttempt } from '../data/mobile-test-comparison';
import MobileKitchenScene from './MobileKitchenScene';
import PhotoHallScene from './PhotoHallScene';
import ExperimentTrajectory from './ExperimentTrajectory';
import PhysicalEvaluationOverview from './PhysicalEvaluationOverview';
import SpeechTestCases from './SpeechTestCases';
import './ExperimentConsole.css';

interface Summary { id: string; startedAt: number; endedAt: number; savedAt: string; report: VoiceExperimentReport }
interface Clip { id: string; direction: string; startedAt: number; endedAt: number; bytes: number; mimeType: string; sha256: string }
interface Selected { experiment: VoiceExperiment; report: VoiceExperimentReport; saved: boolean; audio: Clip[]; savedReport?: VoiceExperimentReport; reassessed?: boolean }
function exactRecordedRefusals(experiment:VoiceExperiment,row:VoiceExperimentReport['rows'][number]) {
  const requestIds=new Set(experiment.events.filter(event=>event.type==='command-requested'&&(event.data.userTurnId===row.source.id||(row.source.kind==='operator-text'&&event.id===row.source.id))).map(event=>event.id));
  return experiment.events.filter(event=>event.type==='request-failed'&&typeof event.data.commandEventId==='string'&&requestIds.has(event.data.commandEventId)&&typeof event.data.error==='string');
}
export default function ExperimentConsole({ onClose, onBenchmarks, latest }: { onClose: () => void; onBenchmarks: () => void; latest: ExperimentResult | null }) {
  const [runs, setRuns] = useState<Summary[]>([]), [selected, setSelected] = useState<Selected | null>(latest ? { experiment: latest.experiment, report: latest.report, saved: latest.status === 'saved', audio: [] } : null);
  const selectionRequest = useRef(0);
  const [requestFilter,setRequestFilter] = useState<'all'|'failed'|'passed'|'unscored'>('all');
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [replay, setReplay] = useState<{ attempt: MobileTestAttempt; frame: number; playing: boolean } | null>(null);
  async function load() {
    setLoading(true); setError('');
    try { const response = await fetch('/api/experiments'); const data = await response.json(); if (!response.ok || !Array.isArray(data.experiments)) throw new Error(data.error ?? 'Experiment history could not be loaded.'); setRuns(data.experiments); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Experiment history is unavailable.'); }
    finally { setLoading(false); }
  }
  async function inspect(id: string) {
    const request = ++selectionRequest.current;
    setLoading(true); setError('');
    try { const response = await fetch(`/api/experiments/${id}`); const data = await response.json(); if (!response.ok || !data.record?.experiment) throw new Error(data.error ?? 'This experiment could not be opened.'); if (request !== selectionRequest.current) return; setSelected({ experiment: data.record.experiment, report: data.record.report, saved: true, audio: data.audioManifest ?? [] }); setReplay(null); }
    catch (cause) { if (request === selectionRequest.current) setError(cause instanceof Error ? cause.message : 'Recording unavailable.'); }
    finally { if (request === selectionRequest.current) setLoading(false); }
  }
  async function reassess() {
    if(!selected?.saved)return;
    const id=selected.experiment.id,request=++selectionRequest.current;setLoading(true);setError('');
    try{const response=await fetch(`/api/experiments/${id}/reevaluate`);const data=await response.json();if(!response.ok||data.report?.experimentId!==id)throw new Error(data.error??'Re-evaluation could not be completed.');if(request!==selectionRequest.current)return;setSelected(current=>current?.experiment.id===id?{...current,report:data.report,savedReport:data.savedReport,reassessed:true}:current);setRequestFilter('failed');}
    catch(cause){if(request===selectionRequest.current)setError(cause instanceof Error?cause.message:'Re-evaluation is unavailable.');}
    finally{if(request===selectionRequest.current)setLoading(false);}
  }
  useEffect(() => () => { selectionRequest.current++; }, []);
  useEffect(() => { void load(); if (latest?.status === 'saved') void inspect(latest.experiment.id); }, []);
  useEffect(() => {
    if (!replay?.playing) return;
    const timer = setInterval(() => setReplay(current => current ? { ...current, frame: Math.min(current.frame + 1, current.attempt.payload.trajectory.length - 1), playing: current.frame + 1 < current.attempt.payload.trajectory.length - 1 } : null), 100);
    return () => clearInterval(timer);
  }, [replay?.playing]);
  const report = selected?.report;
  const requestRows = report?.rows.filter(row=>requestFilter==='all'||(requestFilter==='failed'?(row.status==='failed'||row.status==='request-failed'):row.status===requestFilter)).slice().sort((a,b)=>Number(b.status==='failed'||b.status==='request-failed')-Number(a.status==='failed'||a.status==='request-failed'))??[];
  const replayWorld = replay?.attempt.payload.trajectory[replay.frame]?.world;
  return <div className="experiment-console-backdrop"><section className="experiment-console" role="dialog" aria-modal="true" aria-label="Voice experiment QA console">
    <header><div><span>ROBOTRACE / RUN REPORTS</span><h2>Instruction-following evaluation</h2></div><button className="icon-button" aria-label="Close experiment QA" onClick={onClose}><X size={18}/></button></header>
    <p className="experiment-intro">Start a simulation, speak naturally, then Stop simulation. Review the request, executed action and recorded route. Failed supported requests and unscored language remain separate.</p>
    <div className="experiment-console-actions"><button onClick={() => void load()} disabled={loading}><RefreshCw size={12}/>Refresh recordings</button><button onClick={onBenchmarks}>Planner benchmarks</button><a href="/voice-experiment-analysis.html" target="_blank" rel="noreferrer">Open standalone JSONL inspector</a><small>Previous benchmark runs are separate from these recorded experiments.</small></div>
    {error && <p className="experiment-error" role="alert">{error}</p>}
    <div className="experiment-console-layout"><aside aria-label="Recorded experiments"><h3>Experiments</h3>{!runs.length && <p className="experiment-empty">{loading ? 'Loading recordings…' : 'No saved experiments yet. Your next Start → Stop session will appear here.'}</p>}{runs.map(run => <button className="experiment-run" data-selected={selected?.experiment.id === run.id} key={run.id} onClick={() => void inspect(run.id)}><strong>{new Date(run.startedAt).toLocaleTimeString()}</strong><span>{run.report.counts.passed} passed · {run.report.counts.failed} failed · {run.report.counts.unscored} unscored</span><small>{run.report.attemptCount} robot actions · {Math.max(0, (run.endedAt - run.startedAt) / 1000).toFixed(0)} s · {run.id.slice(0, 8)}</small></button>)}</aside>
      <main>{!selected ? <div className="experiment-welcome"><h3>Record the next experiment</h3><p>For example, ask “Move forward one meter.” A refusal or zero movement must not become a successful test. The report compares the recorded request with the actual executed distance and goal.</p><p>Unclear speech and questions without a defined gold answer stay unscored.</p></div> : <>
        <div className="experiment-report-heading"><div><h3>Run {selected.experiment.id.slice(0, 8)}</h3><span>{selected.reassessed ? 'Current rules reanalysis · source unchanged' : selected.saved ? 'Saved assessment · Unreviewed' : 'Current browser recording · not confirmed saved'} · {new Date(selected.experiment.startedAt).toLocaleString()}</span></div>{selected.saved && <a href={`/api/experiments/${selected.experiment.id}/export.jsonl`} download><Download size={12}/>{selected.reassessed?'Original trace JSONL':'Export JSONL'}</a>}</div>
        {selected.saved && <div className="physical-report-actions"><button disabled={loading} onClick={()=>void reassess()}>Re-evaluate recorded run</button><a href={`/api/experiments/${selected.experiment.id}/report.html`} target="_blank" rel="noreferrer">Open evaluation report</a><a href={`/api/experiments/${selected.experiment.id}/report.html?download=1`} download><Download size={12}/>Download report</a><a href={`/api/experiments/${selected.experiment.id}/report.json`} download><Download size={12}/>Evaluation JSON</a><small>Share the standalone HTML report, or open it and choose Print / Save as PDF. Recorded evidence and historical grades remain unchanged.</small></div>}
        <p className="experiment-revision-note">Assessment rules: {report!.evaluatorRevision ?? 'historical · unversioned'}. {String(report!.evaluatorRevision) !== 'robotrace-request-eval.4' ? 'This is a historical assessment. Re-evaluate to apply current rules; the original recording and grade stay unchanged.' : 'Recognized speech is compared with recorded execution. Recognition accuracy is not independently scored.'}</p>

        {report!.recording.truncated && <p className="experiment-error">This recording reached a data bound. It is marked truncated and cannot establish an overall pass.</p>}
        <SpeechTestCases key={`speech-${selected.experiment.id}`} experiment={selected.experiment} saved={selected.saved} autoGenerate={latest?.status==='saved'&&latest.experiment.id===selected.experiment.id}/>
        <PhysicalEvaluationOverview key={`route-${selected.experiment.id}`} experiment={selected.experiment} savedReport={selected.report}/>
        <ExperimentTrajectory key={selected.experiment.id} experiment={selected.experiment}/>
        <details className="experiment-details"><summary>Rule evaluator totals · {report!.evaluatorRevision??'historical'}</summary><div className="experiment-metrics">{[{ name: 'Rule checks passed', value: report!.counts.passed }, { name: 'Rule checks failed', value: report!.counts.failed }, { name: 'Outside rule coverage', value: report!.counts.unscored }, { name: 'Cancelled', value: report!.counts.cancelled }, { name: 'Executed recordings', value: report!.attemptCount }].map(metric => <div key={metric.name}><strong>{metric.value}</strong><span>{metric.name}</span></div>)}</div></details>
        <div className="experiment-request-header"><h3>Deterministic request checks</h3><div role="group" aria-label="Filter evaluation requests">{(['all','failed','passed','unscored'] as const).map(filter=><button key={filter} aria-pressed={requestFilter===filter} onClick={()=>setRequestFilter(filter)}>{filter==='all'?'All requests':filter==='failed'?'Failures':filter==='passed'?'Passed':'Unscored'}</button>)}</div></div><div className="experiment-table-scroll"><table><thead><tr><th>Recognized request</th><th>Expected</th><th>Executed / measured</th><th>Result</th></tr></thead><tbody>{requestRows.map(row => <tr key={row.id}><td><q>{row.source.text}</q><small>{row.id} · +{((row.source.at - selected.experiment.startedAt) / 1000).toFixed(1)} s · {row.source.kind}</small></td><td>{row.expected?.kind === 'relative-motion' ? `${row.expected.meters} m ${row.expected.direction}` : row.expected?.kind === 'task-goal' ? row.expected.label : 'No unambiguous action label'}</td><td>{row.observed.command ?? 'No associated robot action'}<small>Path {row.observed.pathDistanceMeters.toFixed(3)} m · net {row.observed.netDisplacementMeters.toFixed(3)} m</small><small>{row.association.confidence}</small>{row.observed.attemptId && <button className="experiment-inline" onClick={() => { const attempt = selected.experiment.attempts.find(item => item.id === row.observed.attemptId); if (attempt) setReplay({ attempt, frame: 0, playing: false }); }}>Replay action</button>}</td><td><strong className={`experiment-result-${row.status}`}>{row.status}</strong><small>{row.reason}</small>{exactRecordedRefusals(selected.experiment,row).map(event=><small key={event.id}>Recorded refusal · exact request-ID link: {String(event.data.error)}</small>)}</td></tr>)}</tbody></table>{!requestRows.length && <p className="experiment-empty">No recorded requests match this filter. A missing or unclear request is not counted as a pass.</p>}</div>
        <details className="experiment-details"><summary>Executed actions and task checks · {selected.experiment.attempts.length}</summary>{selected.experiment.attempts.map(attempt => { const analysis = report!.nativeAttempts.find(item => item.id === attempt.id); return <div className="experiment-native-action" key={attempt.id}><span>{attempt.command}<small>{analysis?.accepted ? 'Recorded task checks passed' : 'Recorded task not accepted'} · {analysis?.metrics.distanceTravelled.toFixed(2)} m · {analysis?.metrics.durationSeconds.toFixed(1)} s</small></span><button onClick={() => setReplay({ attempt, frame: 0, playing: false })}>Replay</button></div>; })}</details>
        {replay && replayWorld && <section className="experiment-replay"><h3>{replay.attempt.command}</h3><div>{selected.experiment.environmentId === 'photo-hall' ? <PhotoHallScene world={replayWorld}/> : <MobileKitchenScene world={replayWorld}/>}</div><footer><button onClick={() => setReplay(value => value ? { ...value, playing: !value.playing } : null)}><Play size={12}/>{replay.playing ? 'Pause replay' : 'Play replay'}</button><input type="range" aria-label="Seek experiment action" min={0} max={replay.attempt.payload.trajectory.length - 1} value={replay.frame} onChange={event => setReplay(value => value ? { ...value, frame: Number(event.target.value), playing: false } : null)}/><span>{(replay.attempt.payload.trajectory[replay.frame].time - replay.attempt.payload.initialWorld.simTime).toFixed(2)} s</span></footer></section>}
        {selected.reassessed && selected.savedReport && <details className="experiment-details"><summary>Original saved assessment · preserved</summary><p>{selected.savedReport.evaluatorRevision??'Unversioned rules'} · {selected.savedReport.counts.passed} passed / {selected.savedReport.counts.failed} failed / {selected.savedReport.counts.unscored} unscored. Reanalysis did not change the stored record.</p></details>}
        <details className="experiment-details"><summary>Conversation snapshots · {selected.experiment.transcripts.length}</summary>{selected.experiment.transcripts.filter(turn => turn.final).map((turn, index) => <p key={`${turn.id}-${index}`}><strong>{turn.speaker === 'user' ? 'You' : 'Assistant'}</strong> {turn.text}</p>)}</details>
        <details className="experiment-details"><summary>Audio clips · {selected.audio.length}</summary><p>Tracks are captured separately with wall-clock timestamps. They are not presented as sample-synchronized audio/video.</p>{selected.audio.map(clip => <div className="experiment-audio" key={clip.id}><strong>{clip.direction === 'user' ? 'User microphone' : 'Assistant RTC audio'} · +{((clip.startedAt - selected.experiment.startedAt) / 1000).toFixed(1)} s</strong><audio controls preload="none" src={`/api/experiments/${selected.experiment.id}/audio/${clip.id}`}/><a href={`/api/experiments/${selected.experiment.id}/audio/${clip.id}`} download={`robotrace-${clip.direction}-${clip.id}.${clip.mimeType.includes('mp4') ? 'mp4' : clip.mimeType.includes('ogg') ? 'ogg' : 'webm'}`}>Download clip</a><small>{clip.bytes} bytes · SHA-256 {clip.sha256}</small></div>)}</details>
        <p className="experiment-basis">{report!.basis} Original spoken words can differ from ASR output; ambiguous language and uncertain associations remain explicit.</p>
      </>}</main></div>
  </section></div>;
}
