import { useEffect, useRef, useState } from 'react';
import type { VerifiedSpeechTestCase } from '../data/speech-test-case';
import type { VoiceExperiment } from '../data/voice-experiment';
import './SpeechTestCases.css';

interface ConversationReview { status: 'issue' | 'no-issue' | 'uncertain' | 'unavailable'; reason: string; evidenceReplyIds: string[] }
interface Analysis {
  schema: string; sourceExperimentId: string; model: string; proposed: true;
  historySaved?: boolean; warning?: string; requestDurationMs: number; cases: (VerifiedSpeechTestCase & { conversationReview?: ConversationReview })[];
  coverage?: { totalUserRequests: number; coveredUserRequests: number; uncoveredSourceTurnIds: string[]; generatedCaseCount: number };
  limits?: string[];
}
export default function SpeechTestCases({ experiment, saved, autoGenerate }: { experiment: VoiceExperiment; saved: boolean; autoGenerate: boolean }) {
  const [caseFilter,setCaseFilter]=useState<'all'|'attention'|'passed'|'unknown'>('attention');
  const [analysis, setAnalysis] = useState<Analysis | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sequence = useRef(0);
  async function generate() {
    if (!saved || busy) return;
    const request = ++sequence.current; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/experiments/${experiment.id}/test-cases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewReplies: true }), signal: AbortSignal.timeout(180000) });
      const data = await response.json();
      if (!response.ok || data.sourceExperimentId !== experiment.id || !Array.isArray(data.cases)) throw new Error(data.error ?? 'Speech analysis was not confirmed.');
      if (request === sequence.current) setAnalysis(data);
    } catch (cause) { if (request === sequence.current) setError(cause instanceof Error ? cause.message : 'Speech analysis is unavailable.'); }
    finally { if (request === sequence.current) setBusy(false); }
  }
  useEffect(() => {
    const request = ++sequence.current;
    if (saved) void (async () => {
      try {
        const response = await fetch(`/api/experiments/${experiment.id}/test-cases`);
        if (request !== sequence.current) return;
        if (response.ok) { const data = await response.json(); const cached=data.analysis??(data.sourceExperimentId?data:null); if(request!==sequence.current)return; if(cached?.sourceExperimentId===experiment.id&&Array.isArray(cached.cases))setAnalysis(cached);else if(autoGenerate)void generate(); }
        else if (response.status === 404 && autoGenerate) void generate();
      } catch { if (request === sequence.current) setError('Saved speech analysis could not be loaded. The original recording is retained.'); }
    })();
    return () => { sequence.current++; };
  }, [experiment.id, saved, autoGenerate]);
  const exportAnalysis = () => {
    if (!analysis) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `robotrace-speech-tests-${experiment.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const cases = analysis?.cases ?? [], counts = { passed: cases.filter(item => item.verification.status === 'passed').length, failed: cases.filter(item => item.verification.status === 'failed').length, unknown: cases.filter(item => item.verification.status === 'not-evaluated').length };
  const attention=(item:Analysis['cases'][number])=>item.verification.status==='failed'||item.conversationReview?.status==='issue'||item.verification.expectationValidity?.status==='invalid';
  const orderedCases=cases.map((item,index)=>({item,index})).filter(({item})=>caseFilter==='all'||(caseFilter==='attention'?attention(item):caseFilter==='passed'?item.verification.status==='passed':item.verification.status==='not-evaluated')).sort((a,b)=>Number(attention(b.item))-Number(attention(a.item)));
  const original = (id: string) => experiment.transcripts.filter(turn => turn.speaker === 'user' && turn.final && turn.id === id).at(-1)?.text ?? 'No matching final request';
  return <section className="speech-test-cases" aria-label="Conversation-derived test cases">
    <header><div><h3>Conversation test cases</h3><p>Queries → proposed expectations → recorded behavior → measured checks</p></div><div>{!analysis && <button disabled={!saved || busy} onClick={() => void generate()}>{busy ? 'Generating and evaluating…' : 'Generate speech tests'}</button>}{analysis && <button onClick={exportAnalysis}>Export test cases</button>}</div></header>
    {busy && <p className="speech-qa-progress" role="status">Building cases from the saved conversation and scene, then checking the actual trace. The recording is already saved; no robot actions are executed.</p>}
    {error && <p className="speech-qa-error" role="alert">{error} <button onClick={() => void generate()} disabled={busy}>Retry analysis</button></p>}
    {!analysis && !busy && <p className="speech-qa-empty">{saved ? 'Use the configured LLM to propose cases for this recording. Each expectation remains visible for review.' : 'Save this recording to generate and retain conversation test cases.'}</p>}
    {analysis && <>
      {analysis.historySaved===false && <p className="speech-qa-error">{analysis.warning??'Analysis is not confirmed saved. Export these test cases before closing.'}</p>}
      <div className="speech-qa-coverage"><span><b>{analysis.coverage?.coveredUserRequests ?? '—'} / {analysis.coverage?.totalUserRequests ?? '—'}</b> recognized user turns classified</span><span><b>{cases.length}</b> generated cases</span><span><b>{counts.passed}</b> measured passes</span><span><b>{counts.failed}</b> measured failures</span><span><b>{counts.unknown}</b> not evaluated</span></div>
      <div className="speech-case-filters" role="group" aria-label="Filter generated test cases">{([{id:'attention',label:'Needs attention'},{id:'all',label:'All cases'},{id:'passed',label:'Measured passes'},{id:'unknown',label:'Not evaluated'}] as const).map(filter=><button key={filter.id} aria-pressed={caseFilter===filter.id} onClick={()=>setCaseFilter(filter.id)}>{filter.label}</button>)}</div>
      <p className="speech-qa-method">Expectations proposed by {analysis.model}; unreviewed. Coverage refers to this recorded conversation and does not establish complete scenario coverage. Conversation judgments are separate from measured checks.</p>
      {Boolean(analysis.coverage?.uncoveredSourceTurnIds.length) && <details><summary>Requests without a generated case · {analysis.coverage!.uncoveredSourceTurnIds.length}</summary>{analysis.coverage!.uncoveredSourceTurnIds.map(id => <p key={id}>{original(id)}</p>)}</details>}
      {orderedCases.length===0 && <p className="speech-qa-empty">No generated cases match this filter.</p>}
      {orderedCases.map(({item,index}) => <article key={`${item.sourceTurnId}-${index}`}>
        <div className="speech-case-heading"><span>CASE {String(index + 1).padStart(2, '0')}</span><strong data-status={item.verification.status}>{item.verification.status}</strong><small>{item.verification.association.confidence}</small></div>
        <h4>{original(item.sourceTurnId)}</h4>
        {item.verification.expectationValidity && item.verification.expectationValidity.status!=='supported' && <p className="speech-case-reason"><strong>Expectation needs review.</strong> {item.verification.expectationValidity.issues.join(' ')}</p>}
        <div className="speech-case-comparison"><div><h5>Expected · LLM proposal</h5><p>{item.expectedSummary}</p><small>{item.expectedBehavior}</small></div><div><h5>Observed · recording</h5><p>{item.verification.actualCommands.length ? item.verification.actualCommands.join(' → ') : 'No associated native action recorded'}</p>{item.verification.assistantReplies.map(reply => <blockquote key={reply.id}>{reply.text}</blockquote>)}</div></div>
        <div className="speech-predicate-list" aria-label="Observed predicate truth; separate from task verdict">{item.verification.checks.map((check, i) => <div key={i}><span data-result={check.passed === null ? 'unknown' : check.passed ? 'pass' : 'fail'}>{check.passed === null ? 'UNKNOWN' : check.passed ? 'TRUE' : 'FALSE'}</span><code>{check.predicate.type}</code><small>{check.detail}</small></div>)}</div>
        <p className="speech-case-reason">{item.verification.reason}</p>
        {item.conversationReview && <div className="speech-conversation-review"><strong>Conversation review · {item.conversationReview.status}</strong><p>{item.conversationReview.reason}</p><small>Unreviewed LLM judgment; it does not replace recorded-state checks.</small></div>}
      </article>)}
      <details><summary>Analysis scope and limitations</summary>{analysis.limits?.map((limit, i) => <p key={i}>{limit}</p>)}</details>
    </>}
  </section>;
}
