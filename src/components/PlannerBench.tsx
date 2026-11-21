import { useEffect, useRef, useState } from 'react';
import { Check, Download, GitCompareArrows, Loader2, Plus, RefreshCw, Trash2, TriangleAlert, X } from 'lucide-react';
import { ENVIRONMENTS } from '../sim/environments';
import { DESTINATIONS, planCommand } from '../sim/engine';
import type { DestinationId, WorldState } from '../sim/engine';
import { evaluateCandidatePlan, validateCandidatePlan } from '../sim/candidate-plans';
import type { CandidatePlanResult } from '../sim/candidate-plans';
import './PlannerBench.css';

type DraftStep = { objectId: string; destination: DestinationId };
type PlannerModel = { id: string; label: string; access: string };
type ComparisonResult = CandidatePlanResult & { model?: string };
type Snapshot = { world: WorldState; instruction: string; capturedAt: string };
const clone = <T,>(value: T): T => structuredClone(value);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function initialSnapshot(world: WorldState): Snapshot {
  const custom = (world as WorldState & { customTask?: { instruction?: string } }).customTask;
  return { world: clone(world), instruction: custom?.instruction || ENVIRONMENTS.find(item => item.id === world.environmentId)?.instruction || 'Sort all parts', capturedAt: new Date().toISOString() };
}

/** Explicitly requested plan comparisons; every candidate executes on the same frozen scene. */
export default function PlannerBench({ world }: { world: WorldState }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => initialSnapshot(world));
  const [humanSteps, setHumanSteps] = useState<DraftStep[]>([]);
  const [objectId, setObjectId] = useState(() => world.objects[0]?.id ?? '');
  const [destination, setDestination] = useState<DestinationId>('tray-a');
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [models, setModels] = useState<PlannerModel[]>([]);
  const [model, setModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<'human' | 'baseline' | 'llm' | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const modelRequest = useRef<AbortController | null>(null);
  const planRequest = useRef<AbortController | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frozen = snapshot.world;
  const definition = ENVIRONMENTS.find(item => item.id === frozen.environmentId);
  const labelFor = (id: DestinationId) => frozen.destinationLabels?.[id] ?? (id === 'table' ? 'Worktable' : DESTINATIONS.find(item => item.id === id)?.label ?? id);
  const humanValidation = validateCandidatePlan(humanSteps, frozen);
  const available = frozen.objects.filter(object => !humanSteps.some(step => step.objectId === object.id));

  async function refreshModels() {
    modelRequest.current?.abort();
    const controller = new AbortController();
    modelRequest.current = controller;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const response = await fetch('/api/planner/models', { signal: controller.signal });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Could not retrieve configured planner models.');
      if (!isRecord(payload) || !Array.isArray(payload.models)) throw new Error('The planner model list was not in the expected format.');
      const list = payload.models.filter((item): item is PlannerModel => isRecord(item) && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.access === 'string');
      if (alive.current && !controller.signal.aborted) {
        setModels(list);
        setModel(previous => list.some(item => item.id === previous) ? previous : list[0]?.id ?? '');
      }
    } catch (cause) {
      if (alive.current && !controller.signal.aborted) setModelsError(cause instanceof Error ? cause.message : 'Could not load planner models.');
    } finally {
      if (alive.current && !controller.signal.aborted) setModelsLoading(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    void refreshModels();
    return () => {
      alive.current = false;
      modelRequest.current?.abort();
      planRequest.current?.abort();
      if (pendingTimer.current !== null) clearTimeout(pendingTimer.current);
    };
  }, []);

  function useCurrentScene() {
    if (lock.current) return;
    setSnapshot(initialSnapshot(world));
    setHumanSteps([]);
    setObjectId(world.objects[0]?.id ?? '');
    setDestination('tray-a');
    setResults([]);
    setError(null);
  }

  function addStep() {
    if (!objectId || humanSteps.length >= 6 || !available.some(object => object.id === objectId)) return;
    setHumanSteps(previous => [...previous, { objectId, destination }]);
    setObjectId(available.find(object => object.id !== objectId)?.id ?? '');
  }

  function runLocal(source: 'human' | 'baseline') {
    if (lock.current) return;
    lock.current = true;
    setRunning(source);
    setError(null);
    pendingTimer.current = setTimeout(() => {
      pendingTimer.current = null;
      try {
        const baseline = source === 'baseline' ? planCommand(snapshot.instruction, frozen) : null;
        const steps = source === 'human' ? humanSteps
          : baseline?.error ? { plannerError: baseline.error }
          : baseline?.steps.filter(step => step.kind === 'pick_place').map(step => ({ objectId: step.objectId, destination: step.destination })) ?? [];
        const result = evaluateCandidatePlan({ world: frozen, steps, source,
          label: source === 'human' ? `Human plan ${results.filter(item => item.source === 'human').length + 1}` : 'Bounded command planner', instruction: snapshot.instruction });
        if (baseline?.error) { result.error = baseline.error; result.planErrors.push(baseline.error); }
        if (alive.current) setResults(previous => [...previous, result]);
      } catch (cause) {
        if (alive.current) setError(cause instanceof Error ? cause.message : 'The candidate could not be evaluated.');
      } finally {
        lock.current = false;
        if (alive.current) setRunning(null);
      }
    }, 30);
  }

  async function runAI() {
    if (lock.current || !model || !snapshot.instruction.trim()) return;
    lock.current = true;
    setRunning('llm');
    setError(null);
    const controller = new AbortController();
    planRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/planner/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ model, environmentId: frozen.environmentId ?? 'custom', world: frozen, instruction: snapshot.instruction }) });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : `The planner request failed (${response.status}).`);
      if (!isRecord(payload) || typeof payload.model !== 'string' || !Number.isFinite(payload.requestDurationMs) || typeof payload.requestDurationMs !== 'number' || payload.requestDurationMs < 0 || !Array.isArray(payload.steps)) throw new Error('The planner response did not contain a model, measured request duration, and candidate steps.');
      const result = evaluateCandidatePlan({ world: frozen, steps: payload.steps, source: 'llm', label: payload.model,
        instruction: snapshot.instruction, requestDurationMs: payload.requestDurationMs });
      if (alive.current && !controller.signal.aborted) setResults(previous => [...previous, { ...result, model: payload.model as string }]);
    } catch (cause) {
      if (alive.current) setError(controller.signal.aborted ? 'The planner request timed out or was cancelled. No result was added. You can explicitly retry.'
        : cause instanceof Error ? cause.message : 'The AI planner could not return a candidate.');
    } finally {
      clearTimeout(timeout);
      if (planRequest.current === controller) planRequest.current = null;
      lock.current = false;
      if (alive.current) setRunning(null);
    }
  }

  function exportComparison() {
    try {
      const payload = { schema: 'teachtrace.planner-comparison.v1', generatedAt: new Date().toISOString(),
        snapshotCapturedAt: snapshot.capturedAt, environmentId: frozen.environmentId ?? null,
        instruction: snapshot.instruction, initialWorld: frozen, controller: 'teachtrace-kinematic-v1',
        scope: { comparison: 'Task-plan candidates on one frozen kinematic scene', physicalContactValidated: false, policyTrained: false,
          requestTiming: 'Provider API request duration when returned; not robot execution speed or physical policy performance.' }, results };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'teachtrace-planner-comparison.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('The browser could not prepare the comparison download.'); }
  }

  return <section className="planner-bench" aria-labelledby="planner-bench-title">
    <span className="bench-eyebrow"><GitCompareArrows size={14} aria-hidden="true"/> PLAN COMPARISON</span>
    <h2 id="planner-bench-title">One scene. Different decisions.</h2>
    <p className="bench-intro">Compare your explicit plan, the bounded command planner, and an AI model on the same frozen scene. The shared controller executes each candidate and checks the task outcome.</p>
    <div className="bench-snapshot"><div><strong>{definition?.name ?? 'Custom workcell'}</strong><span>{frozen.objects.length} objects · Scene revision {frozen.revision} · Frozen at {new Date(snapshot.capturedAt).toLocaleTimeString()}</span></div>
      <button type="button" className="bench-button" onClick={useCurrentScene} disabled={Boolean(running)}><RefreshCw size={13} aria-hidden="true"/> Use current scene</button></div>
    <label className="bench-field bench-instruction"><span>Instruction for every candidate</span><textarea rows={2} value={snapshot.instruction} disabled={Boolean(running)} onChange={event => { setSnapshot(previous => ({ ...previous, instruction: event.target.value })); setResults([]); setError(null); }}/></label>
    <p className="bench-note">Changing the instruction or using the current scene starts a new comparison and clears prior results. Checks use the scene’s saved task assignment; editing the prompt does not rewrite acceptance. Evaluations leave the live workcell unchanged.</p>

    <div className="bench-builders">
      <section className="bench-card" aria-labelledby="human-plan-title"><h3 id="human-plan-title">Your plan</h3><p>Choose exact objects and destinations, in order. Include only the objects you intend to move.</p>
        <div className="bench-step-controls"><label className="bench-field"><span>Object</span><select value={objectId} disabled={Boolean(running) || !available.length} onChange={event => setObjectId(event.target.value)}><option value="">Choose object</option>{available.map(object => <option value={object.id} key={object.id}>{object.label} · {object.id}</option>)}</select></label>
          <label className="bench-field"><span>Destination</span><select value={destination} disabled={Boolean(running)} onChange={event => setDestination(event.target.value as DestinationId)}>{(['tray-a', 'tray-b', 'reject', 'table'] as const).map(id => <option value={id} key={id}>{labelFor(id)}</option>)}</select></label>
          <button type="button" className="bench-button" disabled={Boolean(running) || !objectId || humanSteps.length >= 6} onClick={addStep}><Plus size={13} aria-hidden="true"/> Add step</button></div>
        <ol className="bench-draft">{humanSteps.map((step, index) => <li key={step.objectId}><span>{frozen.objects.find(object => object.id === step.objectId)?.label ?? step.objectId} <span aria-hidden="true">→</span> {labelFor(step.destination)}</span><button type="button" className="bench-remove" aria-label={`Remove step ${index + 1}`} disabled={Boolean(running)} onClick={() => { setHumanSteps(previous => previous.filter((_, i) => i !== index)); if (!objectId) setObjectId(step.objectId); }}><Trash2 size={13} aria-hidden="true"/></button></li>)}</ol>
        {!humanSteps.length && <p className="bench-empty">No steps added. An empty plan is evaluated as a no-op against the actual task state.</p>}
        {!humanValidation.valid && <ul className="bench-errors">{humanValidation.errors.map((message, index) => <li key={index}>{message}</li>)}</ul>}
        <button type="button" className="bench-button bench-primary" disabled={Boolean(running) || !snapshot.instruction.trim()} onClick={() => runLocal('human')}>{running === 'human' && <Loader2 size={13} className="spin" aria-hidden="true"/>} Evaluate human plan</button>
      </section>
      <section className="bench-card" aria-labelledby="ai-plan-title"><h3 id="ai-plan-title">AI and baseline</h3><p>The baseline uses the existing command parser. AI asks the selected configured model for a new structured plan.</p>
        <button type="button" className="bench-button" disabled={Boolean(running) || !snapshot.instruction.trim()} onClick={() => runLocal('baseline')}>{running === 'baseline' && <Loader2 size={13} className="spin" aria-hidden="true"/>} Evaluate bounded baseline</button>
        <div className="bench-model-field"><label className="bench-field"><span>AI planner model</span><select value={model} disabled={Boolean(running) || modelsLoading || !models.length} onChange={event => setModel(event.target.value)}>{!models.length && <option value="">{modelsLoading ? 'Loading configured models…' : 'No configured model available'}</option>}{models.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><button type="button" className="bench-button" aria-label="Refresh planner models" onClick={() => void refreshModels()} disabled={modelsLoading || Boolean(running)}><RefreshCw size={13} aria-hidden="true"/></button></div>
        {modelsError && <p className="bench-error" role="alert">{modelsError}</p>}
        {!modelsLoading && !modelsError && !models.length && <p className="bench-note">Configure the server’s LLM provider to enable AI planning. Human and baseline evaluation remain available.</p>}
        {models.length > 0 && <p className="bench-note">Configured access is not proof that a model request will succeed. Each click makes one provider request and may incur API usage.</p>}
        <button type="button" className="bench-button bench-primary" disabled={Boolean(running) || modelsLoading || !model || !snapshot.instruction.trim()} onClick={() => void runAI()}>{running === 'llm' && <Loader2 size={13} className="spin" aria-hidden="true"/>} Generate and evaluate AI plan</button>
      </section>
    </div>
    <div className="bench-status" role="status" aria-live="polite">{running === 'llm' ? 'Waiting for the selected model, then evaluating its returned plan…' : running ? 'Executing the candidate in the frozen simulator…' : `${results.length} candidate result${results.length === 1 ? '' : 's'} recorded.`}</div>
    {error && <p className="bench-error" role="alert"><TriangleAlert size={14} aria-hidden="true"/> {error}</p>}
    {results.length > 0 && <><div className="bench-results-heading"><h3>Observed comparison</h3><button type="button" className="bench-button" disabled={Boolean(running)} onClick={exportComparison}><Download size={13} aria-hidden="true"/> Export comparison JSON</button></div>
      <div className="bench-table-scroll" tabIndex={0} role="region" aria-label="Planner comparison results"><table className="bench-table"><caption>Task acceptance comes from simulator checks, independently of the planner’s claimed success.</caption><thead><tr><th scope="col">Candidate</th><th scope="col">Plan valid</th><th scope="col">Task accepted</th><th scope="col">Actions</th><th scope="col">LLM request</th></tr></thead><tbody>{results.map((result, index) => <tr key={`${result.id}-${index}`}><th scope="row"><details><summary>{result.label}<small>{result.source === 'llm' ? 'AI model' : result.source === 'human' ? 'Human authored' : 'Bounded baseline'}</small></summary><p>Controller outcome: {result.outcome} · Simulated duration: {result.simulatedDuration.toFixed(2)} s</p>
        {result.error && <p className="bench-error">{result.error}</p>}{result.planErrors.length > 0 && <ul className="bench-errors">{result.planErrors.map((message, i) => <li key={i}>{message}</li>)}</ul>}
        <ol className="bench-result-steps">{result.steps.map(step => <li key={step.id}>{step.label}</li>)}</ol><ul className="bench-checks">{result.checks.map((check, i) => <li key={`${check.id}-${i}`}>{check.passed ? <Check size={12} aria-hidden="true"/> : <X size={12} aria-hidden="true"/>}<span><strong>{check.name}: {check.passed ? 'passed' : 'failed'}</strong><br/>{check.detail}</span></li>)}</ul></details></th>
        <td><span className={result.planValid ? 'bench-pass' : 'bench-fail'}>{result.planValid ? 'Yes' : 'No'}</span></td><td><span className={result.taskAccepted ? 'bench-pass' : 'bench-fail'}>{result.taskAccepted ? 'Yes' : 'No'}</span></td><td>{result.completedActions}</td><td>{result.requestDurationMs === undefined ? <span title="No LLM request was made">—</span> : `${Math.round(result.requestDurationMs)} ms`}</td></tr>)}</tbody></table></div></>}
    <p className="bench-scope">This compares task-level decisions on a bounded kinematic controller. It does not benchmark learned robot policies, validate contact physics, or measure real-world robot performance. LLM request time is not robot execution time.</p>
  </section>;
}
