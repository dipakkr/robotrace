import { useEffect, useState } from 'react';
import { Box, Check, ClipboardCheck, Code2, Grid2X2, Loader2, Plus, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SCENARIOS, runScenarioHeadless } from '../sim/scenarios';
import type { ScenarioRun } from '../sim/scenarios';
import { draftSceneFromText } from '../sim/scene-authoring';
import { WORKPLACE_CASES } from '../sim/workplace-cases';
import VariationLab from './VariationLab';
import AiSceneComposer from './AiSceneComposer';
import { ENVIRONMENTS } from '../sim/environments';
import type { WorldState } from '../sim/engine';

type Draft = ReturnType<typeof draftSceneFromText>;
export type EnvironmentSpec = { id: string; name: string; world: WorldState; instruction: string };

export default function ScenarioStudio({ initialPrompt = '', preparedDraft, currentWorld, currentInstruction, onApply, onDraft }: {
  initialPrompt?: string;
  currentWorld?: WorldState;
  currentInstruction?: string;
  preparedDraft?: EnvironmentSpec | null;
  onApply: (environment: EnvironmentSpec) => void;
  onDraft?: (environment: EnvironmentSpec | null) => void;
}) {
  const [tab, setTab] = useState<'library' | 'regression' | 'describe' | 'results' | 'ai' | 'stories' | 'variations'>(preparedDraft?.world.customTask ? 'ai' : initialPrompt ? 'describe' : 'library');
  const [prompt, setPrompt] = useState(initialPrompt || 'Create a workcell with two red blocks and one blue block');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [results, setResults] = useState<ScenarioRun[]>([]);
  const [testing, setTesting] = useState(false);
  const makeDraft = (text: string) => {
    const next = draftSceneFromText(text); setDraft(next);
    onDraft?.(next.world ? { id: 'custom', name: 'Custom workcell', world: next.world, instruction: 'Sort all parts' } : null);
  };
  useEffect(() => { if (initialPrompt) { setPrompt(initialPrompt); setTab('describe'); makeDraft(initialPrompt); } }, [initialPrompt]);
  useEffect(() => { if (preparedDraft?.world.customTask) setTab('ai'); }, [preparedDraft]);
  const runSuite = () => {
    setTesting(true); setTab('results');
    setTimeout(() => { setResults(SCENARIOS.map(scenario => runScenarioHeadless(scenario))); setTesting(false); }, 30);
  };
  const exportResults = () => {
    const payload = { schema: 'teachtrace.scenario-suite.v1', generatedAt: new Date().toISOString(), validation: 'Deterministic kinematic controller checks; no learned policy or physical safety validation.', results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'teachtrace-scenario-results.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="scenario-studio">
    <div className="modal-symbol"><Grid2X2 size={24}/></div>
    <span className="eyebrow">ENVIRONMENT STUDIO</span>
    <h2>Create. Run. Inspect.</h2>
    <p>Choose a workplace and its collection task, describe a supported workcell, or inspect the controller checks. Loading a scene replaces the current setup.</p>
    <div className="environment-tabs">{currentWorld && <button className={tab === 'variations' ? 'selected' : ''} onClick={() => setTab('variations')}>Generate variations</button>}<button className={tab === 'stories' ? 'selected' : ''} onClick={() => setTab('stories')}>Household scenarios</button><button className={tab === 'library' ? 'selected' : ''} onClick={() => setTab('library')}>Workplace environments</button><button className={tab === 'regression' ? 'selected' : ''} onClick={() => setTab('regression')}>Controller checks</button><button className={tab === 'describe' ? 'selected' : ''} onClick={() => setTab('describe')}>Describe a scene</button><button className={tab === 'ai' ? 'selected' : ''} onClick={() => { setTab('ai'); }}>AI scene + reference</button><button className={tab === 'results' ? 'selected' : ''} onClick={() => setTab('results')}>Test results{results.length > 0 && ` (${results.length})`}</button></div>
    {tab === 'variations' && currentWorld && <VariationLab world={currentWorld} instruction={currentInstruction ?? 'Complete scene task'} onApply={onApply}/>}
    {tab === 'stories' && <div className="scenario-library workplace-library">{WORKPLACE_CASES.map(story => <article className="scenario-card workplace-card" key={story.id}><div className="scenario-card-copy"><h3>{story.name}</h3><p>{story.description}</p><p>{story.brief}</p><p className="environment-instruction"><strong>Voice task</strong><br/>{story.instruction}</p>{story.interruption && <p className="fine-print">Human scenario: enter the workspace during transfer, then clear and explicitly resume.</p>}<button className="button button-secondary" onClick={() => onApply({ id: story.id, name: story.name, world: story.world, instruction: story.instruction })}>Load household scenario</button></div></article>)}</div>}
    {tab === 'library' && <div className="scenario-library workplace-library">{ENVIRONMENTS.map(environment => {
      const world = environment.world();
      const destinationCount = new Set(environment.targets.filter(target => !target.unchanged).map(target => target.destination)).size;
      return <article className="scenario-card workplace-card" key={environment.id}>
        <div className={`scenario-thumbnail scenario-thumb-${environment.id}`} aria-hidden="true"><div className="thumb-arm"/><div className="thumb-table"><i/><i/><i/><span/><span/></div><span className="scene-number">{environment.id.toUpperCase()}</span></div>
        <div className="scenario-card-copy">
          <h3>{environment.name}</h3><p>{environment.description}</p>
          <p className="environment-instruction"><strong>Voice task</strong><br/>{environment.instruction}</p>
          <ul className="environment-targets">{environment.targets.map(target => {
            const object = world.objects.find(item => item.id === target.objectId);
            const destination = world.destinationLabels?.[target.destination] ?? target.destination;
            return <li key={target.objectId}><Check size={11}/><span>{object?.label ?? target.objectId} {target.unchanged ? `stays on ${destination}` : `→ ${destination}`}</span></li>;
          })}</ul>
          <div><span className="expected-result">{world.objects.length} objects · {destinationCount} destinations</span><button className="text-button" onClick={() => onApply({ id: environment.id, name: environment.name, world, instruction: environment.instruction })}>Load workplace <Plus size={13}/></button></div>
        </div>
      </article>;
    })}</div>}
    {tab === 'regression' && <><div className="scenario-library">{SCENARIOS.map((scenario, index) => <article className="scenario-card" key={scenario.id}><div className={`scenario-thumbnail scenario-thumb-${scenario.id}`}><div className="thumb-arm"/><div className="thumb-table"><i/><i/><i/><span/><span/></div><span className="scene-number">0{index + 1}</span></div><div className="scenario-card-copy"><h3>{scenario.name}</h3><p>{scenario.description}</p><div><span className={`expected-result ${scenario.expectedOutcome === 'failed' ? 'expected-failure' : ''}`}>{scenario.expectedOutcome === 'failed' ? 'Expected rejection' : 'Expected completion'}</span><button className="text-button" onClick={() => onApply({ id: scenario.id, name: scenario.name, world: scenario.world(), instruction: scenario.instruction })}>Load test scene <Plus size={13}/></button></div></div></article>)}</div><div className="scenario-suite-action"><div><strong>Validate the controller across four scenarios</strong><p>Runs the same planner and executor with explicit pass/fail checks.</p></div><button className="button button-primary" onClick={runSuite}><ClipboardCheck size={14}/> Run test suite</button></div></>}
    {tab === 'ai' && <AiSceneComposer initialPrompt={initialPrompt || undefined} preparedDraft={preparedDraft?.world.customTask ? preparedDraft : undefined} onApply={onApply} onDraft={onDraft}/>}
    {tab === 'describe' && <div className="scene-composer"><label htmlFor="scene-description">DESCRIBE THE ENVIRONMENT</label><textarea id="scene-description" value={prompt} onChange={event => { setPrompt(event.target.value); setDraft(null); onDraft?.(null); }} rows={3}/><div className="scene-examples">{['Create a workcell with two red blocks and one blue block', 'Create an empty workcell', 'Create a reach-limit test'].map(text => <button key={text} onClick={() => { setPrompt(text); makeDraft(text); }}>{text}</button>)}</div><div className="supported-assets"><Box size={14}/><span>One arm · Fixed table and trays · Up to six red, blue, or green rigid blocks</span></div><button className="button button-secondary" disabled={!prompt.trim()} onClick={() => makeDraft(prompt)}><Code2 size={14}/> Generate scene draft</button>{draft && <div className={`scene-draft ${draft.error ? 'draft-error' : ''}`}><div>{draft.error ? <TriangleAlert size={16}/> : <ShieldCheck size={16}/>}<strong>{draft.error ? 'The scene needs a change' : 'Validated scene draft'}</strong></div><p>{draft.error ?? draft.summary}</p>{!draft.error && <><ul>{draft.changes.map(change => <li key={change}><Check size={12}/>{change}</li>)}</ul><button className="button button-primary full-width" onClick={() => draft.world && onApply({ id: 'custom', name: 'Custom workcell', world: draft.world, instruction: 'Sort all parts' })}>Apply environment</button></>}</div>}</div>}
    {tab === 'results' && <div className="scenario-results">{testing ? <div className="suite-loading"><Loader2 size={25} className="spin"/><p>Executing the scenario checks…</p></div> : results.length ? <><div className="suite-summary"><ShieldCheck size={23}/><div><strong>{results.filter(result => result.passed).length}/{results.length} scenarios matched their expected outcome</strong><p>Expected rejections count as a passing validation check.</p></div></div>{results.map(result => <article className="scenario-result" key={result.scenarioId}><div><strong>{SCENARIOS.find(scenario => scenario.id === result.scenarioId)?.name}</strong><span className={result.passed ? 'result-pass' : 'result-fail'}>{result.passed ? 'Passed' : 'Failed'}</span></div><p>Expected: {result.expectedOutcome} · Observed: {result.actualOutcome} · {result.completedActions} completed actions</p>{result.error && <p className="observed-error">{result.error}</p>}<ul>{result.checks.map(check => <li key={check.name}><Check size={11}/>{check.name}: {check.passed ? 'passed' : 'failed'}</li>)}</ul></article>)}<button className="button button-secondary full-width" onClick={exportResults}>Export validation results</button></> : <div className="suite-loading"><ClipboardCheck size={28}/><p>Run the scenario suite to compare actual outcomes with the acceptance rules.</p><button className="button button-primary" onClick={runSuite}>Run test suite</button></div>}</div>}
    <div className="environment-boundary"><ShieldCheck size={13}/><span>Bounded kinematic scenes. Checks cover task logic, reach, and placement occupancy.</span></div>
  </div>;
}
