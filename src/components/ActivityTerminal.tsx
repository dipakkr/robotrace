import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './ActivityTerminal.css';
export interface TerminalEntry {
  id: string;
  time: string | number;
  kind: 'command' | 'context' | 'plan' | 'action' | 'check' | 'tool' | 'system' | 'error' | 'success' | 'warning';
  text: string;
}
export interface ActivityTerminalProps { entries: TerminalEntry[]; status?: string; title?: string; toolbar?: ReactNode; children?: ReactNode }
/** Actual supplied events only; auto-follow does not pull an operator away from older lines. */
export default function ActivityTerminal({ entries, status, title = 'Live activity', toolbar, children }: ActivityTerminalProps) {
  const log = useRef<HTMLDivElement>(null), follow = useRef(true);
  const [following, setFollowing] = useState(true);
  const signature = entries.map(entry => `${entry.id}:${entry.text}`).join('|');
  useLayoutEffect(() => { if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight; }, [signature]);
  const latest = () => { follow.current = true; setFollowing(true); if (log.current) log.current.scrollTop = log.current.scrollHeight; };
  return <section className="activity-terminal" aria-label={title}>
    <header className="activity-terminal-heading"><strong>{title}</strong>{status&&<span title={status}>{status}</span>}{toolbar&&<div className="activity-terminal-toolbar">{toolbar}</div>}</header>
    <div className="activity-terminal-log" ref={log} role="log" aria-label="Robot activity log" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => {
      if (!log.current) return; const next = log.current.scrollHeight - log.current.scrollTop - log.current.clientHeight < 24;
      follow.current = next; setFollowing(next);
    }}>{entries.length?entries.map(entry=><div className={`terminal-line terminal-${entry.kind}`} key={entry.id} data-kind={entry.kind}><time>{typeof entry.time==='number'?(Number.isFinite(entry.time)?`${entry.time.toFixed(1)}s`:'—'):entry.time}</time><span className="terminal-kind">{entry.kind}</span><span className="terminal-text">{entry.text}</span></div>):<p className="terminal-empty">Waiting for a task.</p>}</div>
    {!following&&<button type="button" className="terminal-follow" onClick={latest}>Latest activity ↓</button>}
    {children&&<div className="activity-terminal-tools">{children}</div>}
  </section>;
}
