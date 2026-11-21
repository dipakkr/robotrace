import { useRef, useState } from 'react';
import { VoiceExperimentRecorder, buildVoiceExperimentReport, voiceExperimentJSONL } from '../data/voice-experiment';
import type { VoiceExperiment, VoiceExperimentReport, VoiceAttemptMetadata } from '../data/voice-experiment';
import type { MobileTestAttempt } from '../data/mobile-test-comparison';
import type { MobileWorld } from '../sim/mobile-navigation';
import type { VoiceTranscript } from '../integrations/voice-captions';
import type { VoiceAudioSegment, VoiceRecordingStatus } from '../integrations/voice';

export interface ExperimentResult { experiment: VoiceExperiment; report: VoiceExperimentReport; status: 'draft' | 'saving' | 'saved' | 'error'; error?: string; audioSaved?: number; audioErrors?: string[] }
const download = (filename: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** One recording per voice simulation session; audio arrives before SDK shutdown resolves. */
export function useVoiceExperiment() {
  const recorder = useRef(new VoiceExperimentRecorder());
  const currentId = useRef<string | null>(null), startedAt = useRef(0);
  const clips = useRef(new Map<string, VoiceAudioSegment[]>());
  const snapshots = useRef(new Map<string, string>());
  const pending = useRef(new Map<string, VoiceExperiment>());
  const lastSample = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ events: 0, transcripts: 0, attempts: 0, clips: 0, elapsedSeconds: 0 });
  const [audioStatus, setAudioStatus] = useState<VoiceRecordingStatus | null>(null);
  const [last, setLast] = useState<ExperimentResult | null>(null);

  const begin = (world: MobileWorld) => {
    if (recorder.current.active) return currentId.current!;
    const now = Date.now(), id = recorder.current.begin(world, now);
    currentId.current = id; startedAt.current = now; snapshots.current.clear(); clips.current.set(id, []);
    setActiveId(id); setCounts({ events: 0, transcripts: 0, attempts: 0, clips: 0, elapsedSeconds: 0 });
    recorder.current.event('session-started', { environment: (world as MobileWorld & { environmentId?: string }).environmentId ?? 'mobile-kitchen', source: 'voice-simulation', audioRequested: true }, world.simTime, now);
    return id;
  };
  const event = (type: string, data: Record<string, unknown>, simTime?: number) => {
    const id = recorder.current.event(type, data, simTime);
    if (id) setCounts(value => ({ ...value, events: value.events + 1 }));
    return id;
  };
  const transcript = (turn: VoiceTranscript) => {
    if (!recorder.current.active || turn.receivedAt < startedAt.current) return;
    const key = JSON.stringify([turn.text, turn.final, turn.interrupted]);
    if (snapshots.current.get(turn.id) === key) return;
    snapshots.current.set(turn.id, key); recorder.current.transcript(turn);
    setCounts(value => ({ ...value, transcripts: value.transcripts + 1 }));
  };
  const sample = (world: MobileWorld) => {
    const now = Date.now();
    if (!recorder.current.active || now - lastSample.current < 200) return;
    lastSample.current = now; recorder.current.worldSample(world, now);
    setCounts(value => ({ ...value, elapsedSeconds: Math.max(0, (now - startedAt.current) / 1000) }));
  };
  const attempt = (record: MobileTestAttempt, metadata?: VoiceAttemptMetadata) => {
    if (!recorder.current.active) return;
    recorder.current.attempt(record, metadata); setCounts(value => ({ ...value, attempts: value.attempts + 1 }));
  };
  const audio = (segment: VoiceAudioSegment) => {
    const id = currentId.current;
    if (!id || !recorder.current.active) return;
    const recordings = clips.current.get(id) ?? [];
    if (recordings.some(clip => clip.id === segment.id)) return;
    recordings.push(segment); clips.current.set(id, recordings);
    event('audio-segment', { id: segment.id, direction: segment.direction, startedAt: segment.startedAt, endedAt: segment.endedAt, mimeType: segment.mimeType, bytes: segment.bytes });
    setCounts(value => ({ ...value, clips: recordings.length }));
  };
  const recordingStatus = (status: VoiceRecordingStatus) => {
    setAudioStatus(status);
    if (recorder.current.active) event('audio-recording-status', { ...status });
  };
  const save = async (experiment: VoiceExperiment) => {
    const report = buildVoiceExperimentReport(experiment);
    pending.current.set(experiment.id, experiment);
    setLast({ experiment, report, status: 'saving' });
    try {
      const response = await fetch('/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ experiment }), signal: AbortSignal.timeout(30000) });
      const result = await response.json();
      if (!response.ok || result.saved !== true || result.id !== experiment.id) throw new Error(result.error ?? 'The experiment service did not confirm this recording.');
      let audioSaved = 0; const audioErrors: string[] = [];
      for (const segment of clips.current.get(experiment.id) ?? []) {
        try {
          const uploaded = await fetch(`/api/experiments/${experiment.id}/audio/${segment.id}`, { method: 'POST', headers: { 'Content-Type': segment.mimeType, 'X-RoboTrace-Audio-Metadata': JSON.stringify({ direction: segment.direction, startedAt: segment.startedAt, endedAt: segment.endedAt }) }, body: segment.blob, signal: AbortSignal.timeout(30000) });
          const receipt = await uploaded.json();
          if (!uploaded.ok || !receipt.saved) throw new Error(receipt.error ?? 'Audio upload was not confirmed.');
          audioSaved++;
        } catch (error) { audioErrors.push(`${segment.direction}: ${error instanceof Error ? error.message : 'Audio upload failed.'}`); }
      }
      if (!audioErrors.length) pending.current.delete(experiment.id);
      setLast({ experiment, report: result.report, status: 'saved', audioSaved, audioErrors });
      return true;
    } catch (error) { setLast({ experiment, report, status: 'error', error: error instanceof Error ? error.message : 'The experiment could not be saved.' }); return false; }
  };
  const finish = async (world: MobileWorld) => {
    if (!recorder.current.active) return null;
    event('session-stopped', { source: 'simulation-session', reviewStatus: 'unreviewed' }, world.simTime);
    const experiment = recorder.current.end(world); currentId.current = null; setActiveId(null);
    pending.current.set(experiment.id, experiment);
    setLast({ experiment, report: buildVoiceExperimentReport(experiment), status: 'draft' });
    return experiment;
  };
  const exportLast = () => { if (last) download(`robotrace-experiment-${last.experiment.id}.jsonl`, voiceExperimentJSONL(last.experiment, last.report), 'application/x-ndjson'); };
  return { activeId, counts, audioStatus, last, begin, event, transcript, sample, attempt, audio, recordingStatus, finish, exportLast,
    get active() { return recorder.current.active; },
    retry: () => last ? save(last.experiment) : Promise.resolve(false),
    discard: () => { if (last) { pending.current.delete(last.experiment.id); clips.current.delete(last.experiment.id); setLast(null); } },
  };
}
