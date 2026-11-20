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
}
export interface VoiceConnection {
  sessionId: string;
  stop: () => Promise<void>;
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

export async function startVoiceSession(
  onCommand: (command: string) => Promise<VoiceCommandResult> | VoiceCommandResult,
  options: VoiceOptions = {},
): Promise<VoiceConnection> {
  if (activeConnection || connectionStarting) throw new Error('A voice session is already connected or starting.');
  const integration = await getIntegrationStatus();
  if (!integration.configured) {
    throw new Error(integration.available
      ? 'Agora + Murf voice needs server credentials and a public HTTPS tool callback. Configure .env.local and restart the API.'
      : 'Start the local API server to configure Agora + Murf voice. Typed commands remain available.');
  }
  options.onStatus?.('connecting');
  const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
  AgoraRTC.setLogLevel(3);
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  if (activeConnection || connectionStarting) throw new Error('Another voice connection has started.');
  connectionStarting = true;
  let microphone: Awaited<ReturnType<typeof AgoraRTC.createMicrophoneAudioTrack>> | undefined;
  let sessionId = '';
  let events: EventSource | undefined;
  let snapshotTimer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let agentAudioConnected = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    events?.close();
    clearInterval(snapshotTimer);
    microphone?.stop(); microphone?.close();
    await client.leave().catch(() => {});
    activeConnection = null;
    let remoteStopError = '';
    if (sessionId) {
      try { await jsonRequest('/api/voice/stop', { sessionId }); }
      catch { remoteStopError = 'Local audio stopped. Remote-agent shutdown could not be confirmed; check the Agora console.'; }
    }
    options.onStatus?.('disconnected', remoteStopError || undefined);
    if (remoteStopError) throw new Error(remoteStopError);
  };

  client.on('user-published', async (user, mediaType) => {
    if (mediaType !== 'audio' || stopped) return;
    try {
      await client.subscribe(user, mediaType);
      user.audioTrack?.play();
      agentAudioConnected = true;
      options.onStatus?.('live', 'Agora agent audio is connected; speech output uses Murf Falcon.');
    } catch { options.onStatus?.('error', 'Agent audio subscription failed.'); }
  });
  client.on('connection-state-change', state => {
    if (state === 'DISCONNECTED' && !stopped) options.onStatus?.('error', 'Agora RTC disconnected. End the session before reconnecting.');
  });

  try {
    microphone = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    const session = await jsonRequest<{ sessionId: string; appId: string; channel: string; token: string; uid: number }>('/api/voice/start', { world: options.getWorld?.() ?? null });
    sessionId = session.sessionId;
    events = new EventSource(`/api/voice/events?sessionId=${encodeURIComponent(sessionId)}`);
    events.addEventListener('command', async event => {
      const instruction = JSON.parse((event as MessageEvent<string>).data) as { id: string; command: string };
      let result: VoiceCommandResult;
      try {
        result = await onCommand(instruction.command);
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
    await client.publish([microphone]);
    if (!agentAudioConnected) options.onStatus?.('connected', 'RTC joined. Waiting for the conversational agent audio.');
    snapshotTimer = setInterval(() => {
      if (options.getWorld && !stopped) jsonRequest('/api/voice/context', { sessionId, world: options.getWorld() }).catch(() => {});
    }, 1000);
    activeConnection = { sessionId, stop };
    connectionStarting = false;
    return activeConnection;
  } catch (error) {
    connectionStarting = false;
    await stop().catch(() => {});
    options.onStatus?.('error', error instanceof Error ? error.message : 'Voice connection failed.');
    throw error;
  }
}

export async function stopVoiceSession(): Promise<void> {
  await activeConnection?.stop();
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
