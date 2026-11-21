import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tsImport } from 'tsx/esm/api';
const { advanceWorld, planCommand } = await tsImport('../src/sim/engine.ts', import.meta.url);
const { WORKPLACE_CASES } = await tsImport('../src/sim/workplace-cases.ts', import.meta.url);
const { worldForCommand } = await tsImport('../src/sim/command-task.ts', import.meta.url);
const { taskForWorld } = await tsImport('../src/sim/scene-spec.ts', import.meta.url);

function execute(source, instruction) {
  const plan = planCommand(instruction, source); assert.equal(plan.error, undefined);
  const initial = worldForCommand(source, plan, instruction);
  let world = structuredClone(initial), lastSample = initial.simTime;
  const samples = [{ time: 0, world: structuredClone(initial) }], events = [];
  for (const step of plan.steps) {
    let done = false;
    for (let tick = 0; tick < 1000; tick++) {
      const result = advanceWorld(world, step, 1 / 30); world = result.world; assert.equal(result.error, undefined);
      if (world.simTime - lastSample >= .099 || result.done) { samples.push({ time: world.simTime - initial.simTime, world: structuredClone(world) }); lastSample = world.simTime; }
      if (result.done) { done = true; events.push({ time: world.simTime - initial.simTime, kind: 'success', label: step.label }); break; }
    }
    assert.equal(done, true);
  }
  const definition = taskForWorld(initial), checks = definition.successChecks(world);
  assert.ok(checks.every(check => check.passed));
  return { schema: 'teachtrace.episode.v1', id: 'ep-followup-' + crypto.randomUUID(), title: instruction, command: instruction,
    status: 'review', outcome: 'completed', initialWorld: initial, samples, events, completedActions: plan.steps.length,
    duration: world.simTime - initial.simTime, createdAt: new Date().toISOString(), checks,
    summary: { completedActions: plan.steps.length, sampleCount: samples.length, outcome: 'completed', taskAcceptancePassed: true } };
}
const result = { schema: 'teachtrace.followup-save-smoke.v1', startedAt: new Date().toISOString(), paidRequests: 0, writes: 0 };
try {
  const first = execute(WORKPLACE_CASES[0].world, 'Clear the after-meal counter');
  const second = execute(first.samples.at(-1).world, 'Move all cups from sink to drying rack');
  assert.notEqual(second.initialWorld.customTask.id, first.initialWorld.customTask.id);
  const review = { approved: false, identityVerified: false, source: 'operator-save' };
  result.writes++;
  const response = await fetch('http://127.0.0.1:8787/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...second, submissionMode: 'operator-save', review }), signal: AbortSignal.timeout(20000) });
  const receipt = await response.json();
  assert.equal(response.status, 201, JSON.stringify(receipt)); assert.equal(receipt.saved, true);
  assert.equal(receipt.report.accepted, true, JSON.stringify(receipt.report)); assert.deepEqual(receipt.report.review, review);
  assert.equal(receipt.report.acceptance.independentlyRecomputed, true);
  result.savedId = receipt.id; result.report = receipt.report; result.passed = true;
} catch (error) { result.passed = false; result.failure = error.message; process.exitCode = 1; }
result.finishedAt = new Date().toISOString(); await mkdir('.local/qa', { recursive: true });
await writeFile('.local/qa/followup-save-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, savedId: result.savedId, writes: result.writes, paidRequests: result.paidRequests, failure: result.failure }, null, 2));
