import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { VoiceTranscript } from '../integrations/voice-captions';
import type { VoiceStatus } from '../integrations/voice';
import './VoiceConversation.css';

export default function VoiceConversation({ entries, status, paused = false, controls }: { entries: VoiceTranscript[]; status: VoiceStatus; paused?: boolean; controls?: ReactNode }) {
  const userTail = useRef<HTMLDivElement>(null), assistantTail = useRef<HTMLDivElement>(null);
  useEffect(() => { userTail.current?.scrollIntoView({ block: 'nearest' }); assistantTail.current?.scrollIntoView({ block: 'nearest' }); }, [entries]);
  const connected = status === 'live' || status === 'connected';
  return <section className="voice-conversation" data-voice-status={status} data-paused={paused} aria-label="Live voice conversation">
    <header><strong>Live conversation</strong><span data-connected={connected}>{paused ? 'Simulation paused' : status === 'live' ? 'Simulation ready · audio live' : status === 'connected' ? 'Starting agent audio…' : status === 'connecting' ? 'Starting simulation…' : 'Simulation stopped'}</span>{controls && <div className="voice-simulation-controls">{controls}</div>}</header>
    <div className="voice-conversation-columns">{(['user', 'assistant'] as const).map(speaker => <div className="voice-speaker-pane" key={speaker}>
      <div className="voice-speaker-heading">{speaker === 'user' ? 'YOU' : 'ASSISTANT'}</div>
      <div className="voice-conversation-log" role="log" aria-label={`${speaker === 'user' ? 'Your' : 'Assistant'} speech transcript`} aria-live="polite" aria-relevant="additions text">
        {!entries.some(entry => entry.speaker === speaker) && <p className="voice-conversation-empty">{connected ? speaker === 'user' ? 'Speak to the assistant…' : 'Waiting for agent transcript…' : 'Connect voice to begin.'}</p>}
        {entries.filter(entry => entry.speaker === speaker).map(entry => <div className={`voice-conversation-row voice-speaker-${entry.speaker}`} key={entry.id} data-final={entry.final}>
          <small>{entry.interrupted ? 'interrupted' : entry.final ? 'final' : 'streaming'}</small><p>{entry.text}{!entry.final && <i aria-label="Transcript in progress">▍</i>}</p>
        </div>)}<div ref={speaker === 'user' ? userTail : assistantTail}/>
      </div>
    </div>)}</div><footer>English / Hindi / Hinglish input · English spoken replies</footer>
  </section>;
}
