import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { VoiceTranscript } from '../integrations/voice-captions';
import type { VoiceStatus, VoiceAudioActivity } from '../integrations/voice';
import './VoiceConversation.css';

export default function VoiceConversation({ entries, status, paused = false, controls, audioActivity }: { entries: VoiceTranscript[]; status: VoiceStatus; paused?: boolean; controls?: ReactNode; audioActivity?: VoiceAudioActivity | null }) {
  const userTail = useRef<HTMLDivElement>(null), assistantTail = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const transcriptId = useId();
  useEffect(() => { userTail.current?.scrollIntoView({ block: 'nearest' }); assistantTail.current?.scrollIntoView({ block: 'nearest' }); }, [entries]);
  const connected = status === 'live' || status === 'connected';
  return <section className="voice-conversation" data-voice-status={status} data-paused={paused} data-collapsed={collapsed} aria-label="Live voice conversation">
    <header><strong>Live voice</strong><span data-connected={connected}>{paused ? 'Simulation paused' : status === 'live' ? 'Agora RTC connected' : status === 'connected' ? 'Starting agent audio…' : status === 'connecting' ? 'Starting simulation…' : 'Simulation stopped'}</span><div className="voice-header-actions"><button className="voice-transcript-toggle" type="button" aria-expanded={!collapsed} aria-controls={transcriptId} aria-label={collapsed ? 'Expand transcripts' : 'Collapse transcripts'} onClick={() => setCollapsed(value => !value)}><span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> Transcripts</button>{controls && <div className="voice-simulation-controls">{controls}</div>}</div></header>
    <div className="voice-transcript-content" id={transcriptId} hidden={collapsed}><div className="voice-conversation-columns">{(['user', 'assistant'] as const).map(speaker => <div className="voice-speaker-pane" key={speaker}>
      <div className="voice-speaker-heading">{speaker === 'user' ? 'MICROPHONE INPUT' : 'MURF FALCON TTS'}<small>{speaker === 'user' ? 'Recognized speech · ASR' : 'Assistant output · via Agora RTC'}</small></div>
      <div className="voice-audio-activity" data-direction={speaker}>
        <meter min={0} max={1} value={connected && !paused ? (speaker === 'user' ? audioActivity?.inputLevel : audioActivity?.outputLevel) ?? 0 : 0} aria-label={speaker === 'user' ? 'Microphone audio level' : 'Assistant RTC audio level'}/>
        <span>{paused ? 'Paused' : connected && (speaker === 'user' ? audioActivity?.inputAvailable : audioActivity?.outputAvailable) ? 'Track connected' : connected ? 'Waiting for track' : 'Track offline'}</span>
      </div>
      <div className="voice-conversation-log" role="log" aria-label={`${speaker === 'user' ? 'Your' : 'Assistant'} speech transcript`} aria-live="polite" aria-relevant="additions text">
        {!entries.some(entry => entry.speaker === speaker) && <p className="voice-conversation-empty">{connected ? speaker === 'user' ? 'Speak to the assistant…' : 'Waiting for agent transcript…' : 'Connect voice to begin.'}</p>}
        {entries.filter(entry => entry.speaker === speaker).map(entry => <div className={`voice-conversation-row voice-speaker-${entry.speaker}`} key={entry.id} data-final={entry.final}>
          <small>{entry.interrupted ? 'interrupted' : entry.final ? 'final' : 'streaming'}</small><p>{entry.text}{!entry.final && <i aria-label="Transcript in progress">▍</i>}</p>
        </div>)}<div ref={speaker === 'user' ? userTail : assistantTail}/>
      </div>
    </div>)}</div><footer>Input → action → speech</footer></div>
  </section>;
}
