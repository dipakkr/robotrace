import { useId } from 'react';
import type { ReactNode } from 'react';
import { ListChecks, Pause, Play, X } from 'lucide-react';
import type { CommandPlan } from '../sim/engine';
import './ApprovalReview.css';

export interface ApprovalReviewProps {
  plan: CommandPlan | null;
  countdown: number | null;
  autoEnabled: boolean;
  autoPaused: boolean;
  onToggleAuto: (value: boolean) => void;
  onPauseAuto: () => void;
  onApprove: () => void;
  onDiscard: () => void;
  blocked?: boolean;
  extra?: ReactNode;
}

/** Presentation only. The owning workflow decides which plans can auto-run. */
export default function ApprovalReview({
  plan, countdown, autoEnabled, autoPaused, onToggleAuto, onPauseAuto,
  onApprove, onDiscard, blocked = false, extra,
}: ApprovalReviewProps) {
  const headingId = useId();
  const preferenceId = useId();
  const hasSteps = Boolean(plan?.steps.length);
  const motionReady = hasSteps && !plan?.error && !plan?.control;
  const seconds = countdown !== null && Number.isFinite(countdown) ? Math.max(0, Math.ceil(countdown)) : null;
  const canCancel = motionReady && autoEnabled && !autoPaused && seconds !== null;
  const status = !motionReady ? null : blocked
    ? 'The workcell is busy or in replay. This motion cannot start yet.'
    : canCancel ? `Simulated motion starts in ${seconds} second${seconds === 1 ? '' : 's'}.`
      : autoPaused ? 'Countdown cancelled. This plan now waits for your approval.'
        : plan?.confirmationRequired ? 'This plan needs your explicit approval.'
          : autoEnabled ? 'Review the actions. Eligible simulated plans receive a 3-second cancellation window.'
            : 'Review the actions, then approve when you are ready.';

  return <section className="approval-review" aria-labelledby={headingId}>
    <header className="approval-review-heading"><ListChecks size={16} aria-hidden="true"/>
      <h3 id={headingId}>{hasSteps ? 'Review simulated motion' : extra ? 'Review required' : 'No pending review'}</h3>
      {hasSteps && <span className="approval-review-count">{plan!.steps.length} action{plan!.steps.length === 1 ? '' : 's'}</span>}
    </header>

    {status && <div className={`approval-review-status${canCancel ? ' is-counting' : ''}`}>
      <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
      {canCancel && <button type="button" className="review-action review-cancel" onClick={onPauseAuto}><Pause size={12} aria-hidden="true"/> Cancel countdown</button>}
    </div>}

    <div className="approval-review-content">
      {plan?.error && <p className="approval-review-error" role="alert">{plan.error}</p>}
      {hasSteps ? <>
        {plan?.summary && <p className="approval-review-summary">{plan.summary}</p>}
        <ol className="approval-review-steps" role="list" aria-label="Proposed actions in execution order">{plan!.steps.map((step, index) => <li key={`${step.id}-${index}`}>
          <span className="approval-review-step-number" aria-hidden="true">{index + 1}</span>
          <div><strong>{step.label}</strong><span>{step.kind === 'pick_place' ? 'Simulated pick · transfer · release · verify' : step.kind === 'home' ? 'Return the empty gripper to its home pose' : 'Wait in the simulated workcell'}</span></div>
        </li>)}</ol>
      </> : !extra && <p className="approval-review-empty">Give the copilot a task to prepare a motion plan. Scene changes, resets and evidence submissions appear here for separate approval.</p>}
      {extra && <div className="approval-review-extra">{extra}</div>}
    </div>

    <footer className="approval-review-footer">
      <div className="approval-review-actions">
        <button type="button" className="review-action review-approve" disabled={!motionReady || blocked} onClick={onApprove}><Play size={12} aria-hidden="true"/> Approve &amp; run</button>
        <button type="button" className="review-action review-discard" disabled={!plan || blocked} onClick={onDiscard}><X size={12} aria-hidden="true"/> Discard plan</button>
      </div>
      <label className="approval-review-preference" htmlFor={preferenceId}><input id={preferenceId} type="checkbox" checked={autoEnabled} onChange={event => onToggleAuto(event.target.checked)}/><span>Auto run simulation plans after 3 seconds</span></label>
      <p className="approval-review-boundary">Auto run applies only to eligible simulated motion. Scene changes, resets and evidence submissions always require explicit approval.</p>
    </footer>
  </section>;
}
