import { AgoraCaptionDecoder, captionPacketBytes } from './voice-captions';
import type { VoiceTranscript } from './voice-captions';
import { directSpeechCommand, VoiceSpeechControlGate } from './voice-command-parser';
import type { SpeechControlObservation } from './voice-command-parser';
import { VoicePauseCommandGate } from './voice-pause-gate';
import { VoiceAudioRecorder } from './voice-audio-recorder';
import type { VoiceAudioSegment, VoiceRecordingStatus } from './voice-audio-recorder';
import type { VoiceCommandContext } from './voice-command-context';
export type { VoiceAudioSegment, VoiceRecordingStatus } from './voice-audio-recorder';
export type { VoiceCommandContext } from './voice-command-context';
/** Optional real Agora RTC + Conversational AI + Murf Falcon adapter.
 * No browser speech-recognition or speech-synthesis fallback is used here.
 */
export interface IntegrationStatus {
  available: boolean;
  configured: boolean;
  providers: { agora: boolean; murf: boolean; llm: boolean; publicCallback: boolean };
  missing: string[];
  publicUrlValid: boolean;
  liveVerified: boolean;
  dataset: boolean;
}

export type VoiceStatus = 'disconnected' | 'connecting' | 'connected' | 'live' | 'error';
export interface VoiceCommandResult {
  completed: boolean;
  summary?: string;
  error?: string;
  world?: unknown;
  [key: string]: unknown;
}
export interface VoiceOptions {
  getWorld?: () => unknown;
  onStatus?: (status: VoiceStatus, message?: string) => void;
  onTranscript?: (transcript: VoiceTranscript) => void;
  onSpeechControl?: (event: SpeechControlObservation) => void;
  recordAudio?: boolean;
  onAudioSegment?: (segment: VoiceAudioSegment) => void | Promise<void>;
  onRecordingStatus?: (status: VoiceRecordingStatus) => void;
  onAudioActivity?: (activity: VoiceAudioActivity) => void;
}
export interface VoiceAudioActivity { inputLevel: number; outputLevel: number; at: number; inputAvailable: boolean; outputAvailable: boolean }
export interface VoiceConnection {
  sessionId: string;
  stop: () => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
}

const unavailable: IntegrationStatus = {
  available: false, configured: false,
  providers: { agora: false, murf: false, llm: false, publicCallback: false },
  missing: [], publicUrlValid: false, liveVerified: false, dataset: false,
};

async function jsonRequest<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Local API returned HTTP ${response.status}.`);
  return data as T;
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  try { return await jsonRequest<IntegrationStatus>('/api/integrations/status'); }
  catch { return { ...unavailable }; }
}

let activeConnection: VoiceConnection | null = null;
let connectionStarting = false;
let voiceGeneration = 0;
let pendingStop: (() => Promise<void>) | null = null;
let pendingPause: ((paused: boolean) => Promise<void>) | null = null;
let requestedVoicePause = false;
let captureCaptionPackets = false;
let captionDiagnostics = { frames: 0, decoded: 0, sizes: [] as number[], types: [] as string[], samples: [] as { bytes: number; base64: string }[] };
let speechControlDiagnostics: SpeechControlObservation[] = [];
/** Explicit local test instrumentation; no tokens, client objects or REST payloads. */
export function enableVoiceCaptionDiagnostics(enabled: boolean) { captureCaptionPackets = enabled; }
export function getVoiceCaptionDiagnostics() { return structuredClone(captionDiagnostics); }
export function getVoiceSpeechControlDiagnostics() { return structuredClone(speechControlDiagnostics); }

export async function startVoiceSession(
  onCommand: (command: string, context?: VoiceCommandContext) => Promise<VoiceCommandResult> | VoiceCommandResult,
  options: VoiceOptions = {},
): Promise<VoiceConnection> {
  if (activeConnection || connectionStarting) throw new Error('A voice session is already connected or starting.');
  connectionStarting = true;
  requestedVoicePause = false;
  captionDiagnostics = { frames: 0, decoded: 0, sizes: [], types: [], samples: [] };
  speechControlDiagnostics = [];
  const generation = voiceGeneration;
  let client: import('agora-rtc-sdk-ng').IAgoraRTCClient;
  try {
    const integration = await getIntegrationStatus();
    if (!integration.configured) throw new Error(integration.available
      ? 'Agora + Murf voice needs server credentials and a public HTTPS tool callback. Configure .env.local and restart the API.'
      : 'Start the local API server to configure Agora + Murf voice. Typed commands remain available.');
    if (generation !== voiceGeneration) throw new Error('Voice connection cancelled.');
    options.onStatus?.('connecting');
    const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
    if (generation !== voiceGeneration) throw new Error('Voice connection cancelled.');
    AgoraRTC.setLogLevel(3);
    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  } catch (error) { connectionStarting = false; throw error; }
  let microphone: import('agora-rtc-sdk-ng').IMicrophoneAudioTrack | undefined;
  let sessionId = '';
  let events: EventSource | undefined;
  let snapshotTimer: ReturnType<typeof setInterval> | undefined;
  let audioActivityTimer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let agentAudioConnected = false;
  const captions = new AgoraCaptionDecoder();
  const pauseGate = new VoicePauseCommandGate();
  pauseGate.setPaused(requestedVoicePause);
  const remoteAudio = new Set<import('agora-rtc-sdk-ng').IRemoteAudioTrack>();
  const reportAudioActivity = (closing = false) => {
    if (!options.onAudioActivity) return;
    const level = (track: { getVolumeLevel: () => number }) => { try { const value = track.getVolumeLevel(); return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; } catch { return 0; } };
    const available = (track: { getMediaStreamTrack: () => MediaStreamTrack }) => { try { return track.getMediaStreamTrack().readyState === 'live'; } catch { return false; } };
    const inputAvailable = !closing && Boolean(microphone && available(microphone));
    const outputs = closing ? [] : [...remoteAudio].filter(available);
    const activity = { inputLevel: inputAvailable && microphone && !pauseGate.paused ? level(microphone) : 0, outputLevel: !pauseGate.paused ? Math.max(0, ...outputs.map(level)) : 0, at: Date.now(), inputAvailable, outputAvailable: outputs.length > 0 };
    try { options.onAudioActivity(activity); } catch { /* A visual telemetry subscriber must not interrupt owned audio cleanup. */ }
  };
  const audioRecorder = options.recordAudio && options.onAudioSegment ? new VoiceAudioRecorder({ onSegment: options.onAudioSegment, onStatus: options.onRecordingStatus }) : null;
  if (options.recordAudio && !options.onAudioSegment) options.onRecordingStatus?.({ supported: typeof MediaRecorder !== 'undefined', state: 'error', error: 'Audio recording needs an experiment segment receiver.' });
  const remoteVolume = (volume: number) => { for (const track of remoteAudio) { try { track.setVolume(volume); } catch { remoteAudio.delete(track); } } };
  let pauseOperation = Promise.resolve();
  const dispatchCommand = (command: string, context?: VoiceCommandContext) => {
    const reason = pauseGate.blockReason(command);
    return reason ? { completed: false, status: 'paused', error: reason } : onCommand(command, context);
  };
  const speechControls = new VoiceSpeechControlGate(dispatchCommand, event => { speechControlDiagnostics.push(event); speechControlDiagnostics = speechControlDiagnostics.slice(-100); options.onSpeechControl?.(event); }, undefined, options.getWorld);
  const setPaused = (paused: boolean) => {
    requestedVoicePause = paused;
    const changed = pauseGate.paused !== paused;
    pauseGate.setPaused(paused); if (changed) speechControls.clear();
    if (paused) remoteVolume(0);
    const recordingFlush = paused ? audioRecorder?.pause() : undefined;
    pauseOperation = pauseOperation.catch(() => {}).then(async () => {
      if (stopped || generation !== voiceGeneration) return;
      await microphone?.setMuted(paused);
      if (recordingFlush) await recordingFlush;
      if (!paused && !stopped && !requestedVoicePause) audioRecorder?.resume();
      if (!stopped && !requestedVoicePause) remoteVolume(100);
    });
    return pauseOperation;
  };
  pendingPause = setPaused;

  const onPageHide = () => {
    if (sessionId && !stopped) navigator.sendBeacon('/api/voice/stop', new Blob([JSON.stringify({ sessionId })], { type: 'application/json' }));
  };
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('pagehide', onPageHide);
    events?.close();
    captions.clear();
    speechControls.clear();
    pauseGate.clear(); remoteAudio.clear();
    if (pendingPause === setPaused) pendingPause = null;
    clearInterval(snapshotTimer);
    clearInterval(audioActivityTimer); reportAudioActivity(true);
    // Stop recorders synchronously, then release SDK tracks. Wait for their final
    // data events and receiver callbacks before announcing a disconnected session.
    const recordingFlush = audioRecorder?.stop();
    microphone?.stop(); microphone?.close();
    await client.leave().catch(() => {});
    if (recordingFlush) await recordingFlush;
    if (activeConnection?.stop === stop) activeConnection = null;
    let remoteStopError = '';
    if (sessionId) {
      try { await jsonRequest('/api/voice/stop', { sessionId }); }
      catch { remoteStopError = 'Local audio stopped. Remote-agent shutdown could not be confirmed; check the Agora console.'; }
    }
    options.onStatus?.('disconnected', remoteStopError || undefined);
    if (remoteStopError) throw new Error(remoteStopError);
  };

  pendingStop = stop;
  // Install before join: greetings and both speakers arrive on this RTC stream.
  client.on('stream-message', (_uid, payload) => {
    if (stopped || generation !== voiceGeneration) return;
    captionDiagnostics.frames++;
    const packet = captionPacketBytes(payload);
    if (captionDiagnostics.sizes.length < 64) captionDiagnostics.sizes.push(packet?.byteLength ?? -1);
    if (captionDiagnostics.types.length < 64) captionDiagnostics.types.push(typeof payload === 'string' ? 'string' : Object.prototype.toString.call(payload));
    if (captureCaptionPackets && packet && captionDiagnostics.samples.length < 8) {
      const sample = packet.slice(0, 4096); let encoded = ''; for (const byte of sample) encoded += String.fromCharCode(byte);
      captionDiagnostics.samples.push({ bytes: packet.byteLength, base64: btoa(encoded) });
    }
    const transcript = captions.receive(payload);
    if (transcript) {
      captionDiagnostics.decoded++;
      const scoped = { ...transcript, id: `${sessionId}:${transcript.id}` };
      pauseGate.observe(scoped);
      const direct = directSpeechCommand(scoped.text, scoped.final);
      if (!direct || !pauseGate.blockReason(direct.command)) speechControls.receive(scoped);
      options.onTranscript?.(scoped);
    }
  });
  client.on('user-published', async (user, mediaType) => {
    if (mediaType !== 'audio' || stopped) return;
    try {
      await client.subscribe(user, mediaType);
      if (stopped || generation !== voiceGeneration) return;
      if (user.audioTrack) { remoteAudio.add(user.audioTrack); audioRecorder?.addTrack('assistant', user.audioTrack.getMediaStreamTrack()); user.audioTrack.setVolume(pauseGate.paused ? 0 : 100); user.audioTrack.play(); }
      agentAudioConnected = true;
      options.onStatus?.('live', 'Agora agent audio is connected; speech output uses Murf Falcon.');
    } catch { if (!stopped && generation === voiceGeneration) options.onStatus?.('error', 'Agent audio subscription failed.'); }
  });
  client.on('connection-state-change', state => {
    if (state === 'DISCONNECTED' && !stopped) options.onStatus?.('error', 'Agora RTC disconnected. End the session before reconnecting.');
  });

  try {
    const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
    microphone = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    if (options.onAudioActivity) { reportAudioActivity(); audioActivityTimer = setInterval(() => { if (!stopped && generation === voiceGeneration) reportAudioActivity(); }, 150); }
    audioRecorder?.addTrack('user', microphone.getMediaStreamTrack());
    if (pauseGate.paused) await microphone.setMuted(true);
    if (stopped || generation !== voiceGeneration) throw new Error('Voice connection cancelled.');
    const session = await jsonRequest<{ sessionId: string; appId: string; channel: string; token: string; uid: number }>('/api/voice/start', { world: options.getWorld?.() ?? null });
    sessionId = session.sessionId;
    if (stopped || generation !== voiceGeneration) { await jsonRequest('/api/voice/stop', { sessionId }); throw new Error('Voice connection cancelled.'); }
    window.addEventListener('pagehide', onPageHide);
    events = new EventSource(`/api/voice/events?sessionId=${encodeURIComponent(sessionId)}`);
    events.addEventListener('command', async event => {
      if (stopped || generation !== voiceGeneration) return;
      const instruction = JSON.parse((event as MessageEvent<string>).data) as { id: string; command: string };
      let result: VoiceCommandResult;
      try {
        const pausedReason = pauseGate.blockReason(instruction.command);
        result = pausedReason ? { completed: false, status: 'paused', error: pausedReason } : await speechControls.executeTool(instruction.command, instruction.id);
        if (!result || typeof result.completed !== 'boolean') {
          result = { completed: false, error: 'The simulator did not report a verified command outcome.' };
        }
      } catch (error) {
        result = { completed: false, error: error instanceof Error ? error.message : 'The simulator could not execute this instruction.' };
      }
      await jsonRequest('/api/voice/ack', { sessionId, commandId: instruction.id, result }).catch(() => {});
    });
    events.onerror = () => { if (!stopped) options.onStatus?.('error', 'Simulator command bridge disconnected. Voice motion outcomes may be unconfirmed.'); };
    await client.join(session.appId, session.channel, session.token, session.uid);
    if (stopped || generation !== voiceGeneration) throw new Error('Voice connection cancelled.');
    await client.publish([microphone]);
    if (stopped || generation !== voiceGeneration) throw new Error('Voice connection cancelled.');
    if (!agentAudioConnected) options.onStatus?.('connected', 'RTC joined. Waiting for the conversational agent audio.');
    snapshotTimer = setInterval(() => {
      if (options.getWorld && !stopped) jsonRequest('/api/voice/context', { sessionId, world: options.getWorld() }).catch(() => {});
    }, 1000);
    activeConnection = { sessionId, stop, setPaused };
    pendingStop = null;
    connectionStarting = false;
    return activeConnection;
  } catch (error) {
    const cancelled = stopped || generation !== voiceGeneration;
    await stop().catch(() => {});
    // A reset can happen while microphone creation or RTC join is awaiting.
    // Dispose resources that arrive after the first idempotent stop completed.
    try { microphone?.stop(); microphone?.close(); } catch { /* Already closed. */ }
    await client.leave().catch(() => {});
    if (pendingStop === stop) pendingStop = null;
    connectionStarting = false;
    if (!cancelled) options.onStatus?.('error', error instanceof Error ? error.message : 'Voice connection failed.');
    throw error;
  }
}

export async function stopVoiceSession(): Promise<void> {
  voiceGeneration++;
  if (activeConnection) await activeConnection.stop();
  else await pendingStop?.();
}

/** Keep RTC joined while muting both microphone publication and remote playback. */
export async function setVoiceSessionPaused(paused: boolean): Promise<void> {
  if (activeConnection) return activeConnection.setPaused(paused);
  if (pendingPause) return pendingPause(paused);
  if (connectionStarting) { requestedVoicePause = paused; return; }
  throw new Error('No voice session is connected to pause or resume.');
}

export interface VoiceAnnouncementResult {
  /** True means Agora accepted the TTS request; it does not verify playback. */
  spoken: boolean;
  accepted?: boolean;
  queued?: boolean;
  playbackVerified?: false;
  suppressed?: boolean;
  reason?: string;
}

/** Send a trusted simulator milestone through the existing Murf Falcon voice.
 * APPEND avoids interrupting tool inference; speech can be delayed until the
 * current conversational turn ends. Never use this as a playback acknowledgment.
 */
export async function announceVoiceProgress(text: string): Promise<VoiceAnnouncementResult> {
  if (!activeConnection) return { spoken: false, accepted: false, reason: 'Voice is not connected.' };
  if (!text.trim() || text.length > 300 || new TextEncoder().encode(text.trim()).length > 512) {
    return { spoken: false, accepted: false, reason: 'Progress announcement exceeds its length limit.' };
  }
  try {
    return await jsonRequest<VoiceAnnouncementResult>('/api/voice/announce', { sessionId: activeConnection.sessionId, text });
  } catch (error) {
    return { spoken: false, accepted: false, reason: error instanceof Error ? error.message : 'Voice progress request failed.' };
  }
}

export async function saveEpisodeToServer(episode: unknown): Promise<{ id: string; savedAt: string; saved: boolean; storage: string }> {
  return jsonRequest('/api/episodes', episode);
}

// Release the remote session when Vite replaces this module during development.
if (import.meta.hot) import.meta.hot.dispose(() => { void stopVoiceSession().catch(() => {}); });
