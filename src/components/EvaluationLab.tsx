import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Download, FlaskConical, Loader2, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { runEvaluationCampaign } from '../sim/evaluation';
import type { EvaluationCampaign } from '../sim/evaluation';
import { ENVIRONMENTS } from '../sim/environments';

export interface EvaluationLabProps {
  onResults?: (result: EvaluationCampaign) => void;
}

const expectedLabel = (outcome: 'completed' | 'failed') => outcome === 'completed' ? 'Completion' : 'Rejection';

/** Controller regression evidence; it does not benchmark an LLM or learned policy. */
export default function EvaluationLab({ onResults }: EvaluationLabProps) {
  const [campaign, setCampaign] = useState<EvaluationCampaign | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const run = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setCampaign(null);
    setError(null);
    // Yield so the browser paints the busy state before the synchronous controller run.
    timer.current = setTimeout(() => {
      timer.current = null;
      try {
        const result = runEvaluationCampaign();
        setCampaign(result);
        onResults?.(result);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'The evaluation could not finish. Run it again to retry.');
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    }, 30);
  };

  const exportCampaign = () => {
    if (!campaign || running) return;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(campaign, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'teachtrace-evaluation-campaign.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('The evaluation ran, but the browser could not prepare its download. Try exporting again.');
    }
  };

  const protectedCount = campaign?.cases.filter(result => result.checks.some(check => check.name.includes('preserved across'))).length ?? 0;

  return <section className="evaluation-lab scenario-studio" aria-labelledby="evaluation-title">
    <div className="modal-symbol" aria-hidden="true"><FlaskConical size={24}/></div>
    <span className="eyebrow">CONTROLLER EVALUATION LAB</span>
    <h2 id="evaluation-title">Change the scene. Check the result.</h2>
    <p>Nine reproducible cases run the same bounded planner and kinematic controller as the workcell: nominal tasks, changed source layouts, and unreachable requests across repair, kitchen, and laboratory environments.</p>
    <p className="evaluation-note">This checks simulated task logic and rejection handling. It does not benchmark an LLM, train a robot policy, or establish physical safety.</p>

    <div className="evaluation-actions">
      <button type="button" className="button button-primary" onClick={run} disabled={running} aria-describedby="evaluation-scope">
        {running ? <Loader2 size={15} className="spin" aria-hidden="true"/> : <ClipboardCheck size={15} aria-hidden="true"/>}
        {running ? 'Running evaluation…' : campaign ? 'Run evaluation again' : 'Run evaluation campaign'}
      </button>
      <button type="button" className="button button-secondary" disabled={!campaign || running} onClick={exportCampaign}>
        <Download size={15} aria-hidden="true"/> Export evaluation JSON
      </button>
    </div>
    <div className="evaluation-status" role="status" aria-live="polite" aria-atomic="true">
      {running ? 'Executing the controller cases. Results will appear when the campaign finishes.'
        : campaign ? `${campaign.summary.passed} of ${campaign.summary.total} cases matched expectations. ${campaign.summary.taskCompletions} tasks completed; ${campaign.summary.expectedRejections} expected rejections.`
        : 'Ready to run. Scores appear only after the controller executes.'}
    </div>
    {error && <p className="observed-error" role="alert"><TriangleAlert size={14} aria-hidden="true"/> {error}</p>}

    <div className="scenario-results" aria-busy={running}>
      {running && <div className="suite-loading"><Loader2 size={26} className="spin" aria-hidden="true"/><p>Running the actual scene fixtures and comparing their outcomes…</p></div>}
      {campaign && <>
        <div className="evaluation-summary" aria-label="Observed campaign results">
          <div className="evaluation-summary-card"><span>Cases matching expectations</span><strong>{campaign.summary.passed}/{campaign.summary.total}</strong></div>
          <div className="evaluation-summary-card"><span>Task completions</span><strong>{campaign.summary.taskCompletions}</strong></div>
          <div className="evaluation-summary-card"><span>Expected rejections</span><strong>{campaign.summary.expectedRejections}</strong></div>
        </div>
        <div className="suite-summary">
          {campaign.summary.failed ? <TriangleAlert size={23} aria-hidden="true"/> : <ShieldCheck size={23} aria-hidden="true"/>}
          <div><strong>{campaign.summary.failed ? `${campaign.summary.failed} case${campaign.summary.failed === 1 ? '' : 's'} need investigation` : 'Every case matched its expected outcome'}</strong>
            <p>A correctly refused request passes its regression check; it is not a completed task.</p></div>
        </div>
        <div className="evaluation-table-scroll" tabIndex={0} role="region" aria-label="Evaluation case results; scroll horizontally if needed">
          <table className="evaluation-table">
            <caption>Observed controller outcomes. Expand a case for its seed, instruction, checks, and error evidence.</caption>
            <thead><tr><th scope="col">Environment / case</th><th scope="col">Expected</th><th scope="col">Observed</th><th scope="col">Validation</th><th scope="col">Reference</th></tr></thead>
            <tbody>{campaign.cases.map(result => {
              const environment = ENVIRONMENTS.find(item => item.id === result.environmentId);
              const referenceChecks = result.checks.filter(check => check.name.includes('preserved across'));
              const observed = result.actualOutcome === 'completed' ? 'Completed'
                : result.expectedOutcome === 'failed' && result.passed ? 'Rejected as expected' : 'Failed attempt';
              return <tr key={result.id}>
                <th scope="row"><span className="evaluation-case-title">{environment?.name ?? result.environmentId}</span>
                  <details className="evaluation-case-details">
                    <summary>{result.perturbation === 'nominal' ? 'Nominal assignment' : result.perturbation === 'source-layout' ? 'Changed source layout' : 'Outside reach'}</summary>
                    <p><strong>Instruction:</strong> {result.instruction}<br/><strong>Seed:</strong> {result.seed}<br/><strong>Recorded controller actions:</strong> {result.completedActions}<br/><strong>Simulated duration:</strong> {result.simulatedDuration.toFixed(2)} s</p>
                    {result.error && <p className="observed-error"><strong>Observed error:</strong> {result.error}</p>}
                    <ul className="evaluation-checks">{result.checks.map((check, index) => <li key={`${check.name}-${index}`}>
                      {check.passed ? <Check size={12} aria-hidden="true"/> : <X size={12} aria-hidden="true"/>}
                      <span><strong>{check.name}: {check.passed ? 'passed' : 'failed'}</strong><br/>{check.detail}</span>
                    </li>)}</ul>
                  </details>
                </th>
                <td>{expectedLabel(result.expectedOutcome)}</td>
                <td>{observed}</td>
                <td><span className={result.passed ? 'result-pass' : 'result-fail'}>{result.passed ? 'Passed' : 'Failed'}</span></td>
                <td>{referenceChecks.length ? <span className={referenceChecks.every(check => check.passed) ? 'result-pass' : 'result-fail'}>{referenceChecks.every(check => check.passed) ? 'Preserved' : 'Disturbed'}</span> : 'Not assigned'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="evaluation-note">{protectedCount} laboratory cases include explicit protected-reference checks. The JSON retains each case’s seed, initial and final worlds, planned steps, actual outcome, checks, and controller limitations.</p>
      </>}
    </div>
    <div className="environment-boundary" id="evaluation-scope"><ShieldCheck size={14} aria-hidden="true"/><span>Idealized attachment grasps. No contact dynamics, learned policy, or demonstrated transfer to a physical robot.</span></div>
  </section>;
}
