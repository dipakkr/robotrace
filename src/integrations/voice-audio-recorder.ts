export type VoiceAudioDirection = 'user' | 'assistant';
export interface VoiceAudioSegment {
  id: string; direction: VoiceAudioDirection; startedAt: number; endedAt: number;
  blob: Blob; mimeType: string; bytes: number;
}
export interface VoiceRecordingStatus { supported: boolean; state: 'ready' | 'recording' | 'paused' | 'stopped' | 'error'; error?: string }
type Recorder = Pick<MediaRecorder, 'state' | 'mimeType' | 'ondataavailable' | 'onstop' | 'onerror' | 'start' | 'stop'>;
type RecorderFactory = (stream: MediaStream, mimeType: string) => Recorder;
interface Options {
  onSegment: (segment: VoiceAudioSegment) => void | Promise<void>;
  onStatus?: (status: VoiceRecordingStatus) => void;
  recorderFactory?: RecorderFactory | null; streamFactory?: (track: MediaStreamTrack) => MediaStream;
  now?: () => number; rollMs?: number; maxBytes?: number; maxDurationMs?: number;
  scheduler?: { set: (callback: () => void, delay: number) => unknown; clear: (handle: unknown) => void };
}
interface Source { track: MediaStreamTrack; direction: VoiceAudioDirection; current?: Capture; ended: () => void }
interface Capture { source: Source; recorder: Recorder; startedAt: number; endedAt?: number; chunks: Blob[]; bytes: number;
  failed: boolean; finalized: boolean; stopping: boolean; done: Promise<void>; resolve: () => void; timer?: unknown }

/** Owns recorder instances, never the SDK's MediaStreamTracks. Clips are separate
 * captures with wall-clock observations; no sample-perfect A/V sync is asserted. */
export class VoiceAudioRecorder {
  readonly supported: boolean;
  private factory: RecorderFactory | null;
  private mimeType = '';
  private sources = new Map<MediaStreamTrack, Source>();
  private captures = new Set<Capture>();
  private paused = false; private stopped = false; private failed = false;
  private stopPromise: Promise<void> | null = null; private durationTimer?: unknown;
  private readonly now: () => number; private readonly scheduler: NonNullable<Options['scheduler']>;
  private readonly rollMs: number; private readonly maxBytes: number; private readonly maxDurationMs: number;
  constructor(private options: Options) {
    this.now = options.now ?? Date.now;
    this.scheduler = options.scheduler ?? { set: (callback, delay) => setTimeout(callback, delay), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };
    this.rollMs = Math.min(60000, Math.max(1000, options.rollMs ?? 60000));
    this.maxBytes = Math.min(16 * 1024 * 1024, Math.max(1, options.maxBytes ?? 16 * 1024 * 1024));
    this.maxDurationMs = Math.min(30 * 60 * 1000, Math.max(1000, options.maxDurationMs ?? 30 * 60 * 1000));
    if (options.recorderFactory !== undefined) this.factory = options.recorderFactory;
    else if (typeof MediaRecorder === 'undefined' || typeof MediaStream === 'undefined') this.factory = null;
    else {
      this.mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported?.(type)) ?? '';
      this.factory = (stream, mimeType) => new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    }
    this.supported = Boolean(this.factory);
    this.status(this.supported ? 'ready' : 'error', this.supported ? undefined : 'This browser does not support voice audio recording.');
  }
  private status(state: VoiceRecordingStatus['state'], error?: string) {
    try { this.options.onStatus?.({ supported: this.supported, state, ...(error ? { error } : {}) }); } catch { /* Status consumers cannot interrupt teardown. */ }
  }
  addTrack(direction: VoiceAudioDirection, track: MediaStreamTrack) {
    if (!this.supported || this.stopped || this.failed || this.sources.has(track) || track.readyState === 'ended') return;
    if (this.sources.size >= 8) { this.fail('Voice recording reached its track limit.'); return; }
    const source: Source = { track, direction, ended: () => { this.sources.delete(track); if (source.current) void this.finish(source.current); track.removeEventListener('ended', source.ended); } };
    this.sources.set(track, source); track.addEventListener('ended', source.ended);
    if (!this.paused) this.begin(source);
  }
  private begin(source: Source) {
    if (this.paused || this.stopped || this.failed || !this.factory || source.track.readyState === 'ended') return;
    if (this.captures.size >= 8) { this.fail('Voice audio segments could not be delivered quickly enough.'); return; }
    let recorder: Recorder;
    try { recorder = this.factory((this.options.streamFactory ?? (track => new MediaStream([track])))(source.track), this.mimeType); }
    catch { this.fail('Voice audio recording could not start.'); return; }
    let resolve!: () => void;
    const capture: Capture = { source, recorder, startedAt: this.now(), chunks: [], bytes: 0, failed: false, finalized: false, stopping: false,
      done: new Promise<void>(done => { resolve = done; }), resolve: () => resolve() };
    source.current = capture; this.captures.add(capture);
    recorder.ondataavailable = event => {
      if (capture.finalized || capture.failed || !event.data?.size) return;
      if (capture.bytes + event.data.size > this.maxBytes) { capture.failed = true; this.fail('A voice audio segment exceeded the 16 MiB capture limit.'); return; }
      capture.chunks.push(event.data); capture.bytes += event.data.size;
    };
    recorder.onstop = () => { void this.finalize(capture); };
    recorder.onerror = () => { capture.failed = true; this.fail('A browser voice audio recorder failed.'); };
    try { recorder.start(1000); }
    catch { capture.failed = true; void this.finalize(capture); this.fail('Voice audio recording could not start.'); return; }
    if (this.failed || this.stopped) return;
    if (this.durationTimer === undefined) this.durationTimer = this.scheduler.set(() => { this.fail('Voice audio recording reached the 30-minute session limit.'); }, this.maxDurationMs);
    capture.timer = this.scheduler.set(() => {
      if (source.current !== capture || this.paused || this.stopped || this.failed) return;
      void this.finish(capture); this.begin(source);
    }, this.rollMs);
    this.status('recording');
  }
  private finish(capture: Capture): Promise<void> {
    if (capture.stopping || capture.finalized) return capture.done;
    capture.stopping = true; capture.endedAt = this.now();
    if (capture.timer !== undefined) this.scheduler.clear(capture.timer);
    if (capture.source.current === capture) capture.source.current = undefined;
    // A source can end before the browser dispatches its final data/stop events.
    // Wait for that stop event rather than dropping the trailing audio blob.
    if (capture.recorder.state === 'inactive') return capture.done;
    try { capture.recorder.stop(); }
    catch { capture.failed = true; this.status('error', 'A voice audio segment could not be finalized.'); this.failed = true; void this.finalize(capture); }
    return capture.done;
  }
  private async finalize(capture: Capture) {
    if (capture.finalized) return;
    capture.finalized = true;
    if (capture.timer !== undefined) this.scheduler.clear(capture.timer);
    if (capture.source.current === capture) capture.source.current = undefined;
    try {
      const mimeType = capture.recorder.mimeType || capture.chunks[0]?.type || '';
      if (!capture.failed && capture.bytes) {
        if (!mimeType.startsWith('audio/')) { this.fail('The browser did not identify the recorded audio format.'); return; }
        const blob = new Blob(capture.chunks, { type: mimeType });
        await this.options.onSegment({ id: crypto.randomUUID(), direction: capture.source.direction, startedAt: capture.startedAt, endedAt: capture.endedAt ?? this.now(), blob, mimeType, bytes: blob.size });
      }
    } catch { this.fail('A voice audio segment could not be delivered to the experiment recorder.'); }
    finally {
      capture.chunks = []; capture.recorder.ondataavailable = null; capture.recorder.onstop = null; capture.recorder.onerror = null;
      this.captures.delete(capture); capture.resolve();
    }
  }
  private fail(error: string) {
    if (!this.failed) { this.failed = true; this.status('error', error); }
    void this.stop();
  }
  async pause() {
    if (this.stopped || this.failed || !this.supported) return;
    this.paused = true;
    await Promise.all([...this.captures].map(capture => this.finish(capture)));
    if (!this.stopped && !this.failed) this.status('paused');
  }
  resume() {
    if (!this.paused || this.stopped || this.failed || !this.supported) return;
    this.paused = false;
    for (const source of this.sources.values()) this.begin(source);
  }
  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopped = true;
    if (this.durationTimer !== undefined) this.scheduler.clear(this.durationTimer);
    for (const source of this.sources.values()) source.track.removeEventListener('ended', source.ended);
    this.sources.clear();
    const pending = [...this.captures].map(capture => this.finish(capture));
    this.stopPromise = Promise.all(pending).then(() => { if (!this.failed && this.supported) this.status('stopped'); });
    return this.stopPromise;
  }
}
