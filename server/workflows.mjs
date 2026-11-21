import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { taskGuideForEnvironment, taskGuideForWorld } from './task-guides.mjs';
import { recomputeEpisodeAcceptance } from './simulation.mjs';

const ENVIRONMENT_IDS = ['workbench', 'kitchen', 'lab'];
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const CUSTOM_ID = /^custom-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const queues = new Map();
const fileSystem = { mkdir, readFile, writeFile, rename, rm };
const emptyState = () => ({ schema: 'teachtrace.local-workflows.v1', submissions: {}, reports: {}, assignments: {} });
const text = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 2000) : fallback;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

function operatorSaveReview(episode) {
  const marked = episode.submissionMode !== undefined || episode.review?.source === 'operator-save';
  if (!marked) return null;
  const review = episode.review;
  if (episode.status !== 'review' || episode.submissionMode !== 'operator-save' || !review || typeof review !== 'object' || Array.isArray(review)
    || Object.keys(review).length !== 3 || !Object.keys(review).every(key => ['approved', 'identityVerified', 'source'].includes(key))
    || review.approved !== false || review.identityVerified !== false || review.source !== 'operator-save') {
    throw Object.assign(new Error('Direct operator save requires status review, submissionMode operator-save and exact unapproved, identity-unverified operator-save metadata.'), { status: 400 });
  }
  return { approved: false, identityVerified: false, source: 'operator-save' };
}

function initialAssignment(environmentId, guide = taskGuideForEnvironment(environmentId)) {
  return {
    id: environmentId, environmentId: guide.environmentId, title: guide.title, status: 'assigned',
    source: guide.source, sourceKind: guide.sourceKind, revision: guide.revision,
    instructions: guide.instructions, command: guide.command, acceptance: guide.acceptance, assignments: guide.assignments,
    ...(guide.provenance ? { provenance: guide.provenance } : {}),
  };
}

async function serviceReport(episode, episodeId, createdAt, assignmentId, guide, directReview) {
  const requiredCheckIds = ['task-inventory', ...guide.assignments.map(item => `target-${item.objectId}`), 'controller-settled', ...(assignmentId === 'kitchen' ? ['counter-cleared'] : [])];
  const verification = await recomputeEpisodeAcceptance(episode);
  const provided = verification.checks;
  const checks = provided.filter(check => check && typeof check === 'object').map(check => ({
    id: text(check.id), name: text(check.name), passed: typeof check.passed === 'boolean' ? check.passed : null, detail: text(check.detail),
  }));
  const missingCheckIds = requiredCheckIds.filter(id => checks.filter(check => check.id === id && typeof check.passed === 'boolean').length !== 1);
  const outcome = ['completed', 'failed', 'stopped'].includes(episode.outcome) ? episode.outcome : 'unknown';
  const failed = checks.some(check => check.passed === false) || ['failed', 'stopped'].includes(outcome);
  const status = failed ? 'failed' : verification.independentlyRecomputed && outcome === 'completed' && !missingCheckIds.length && checks.every(check => check.passed === true) ? 'passed' : 'unverified';
  const accepted = status === 'passed';
  const summary = `${directReview ? `Unreviewed record saved: ${guide.title}.` : `Reviewed ${guide.title} demonstration submitted.`} Recorded outcome: ${outcome}. Task acceptance: ${status}. ${accepted ? 'All required simulator checks were recomputed as passed on the local server.' : status === 'failed' ? 'The attempt or at least one recomputed acceptance check did not complete successfully.' : 'Required native recording evidence is incomplete; approval or posted check booleans do not prove task success.'}`;
  return {
    schema: 'teachtrace.service-report.v1', id: randomUUID(), assignmentId, episodeId, createdAt,
    title: guide.title, outcome, accepted, summary,
    ...(directReview ? { submissionMode: 'operator-save', review: directReview } : {}),
    acceptance: { status, checks, requiredCheckIds, missingCheckIds, criteria: guide.acceptance, ...verification },
    metrics: {
      completedActions: count(episode.completedActions),
      sampleCount: Array.isArray(episode.samples) ? episode.samples.length : 0,
      durationSeconds: Number.isFinite(episode.duration) && episode.duration >= 0 ? episode.duration : null,
    },
    source: guide.source, sourceKind: guide.sourceKind, revision: guide.revision, boundaries: guide.boundaries,
    ...(guide.provenance ? { provenance: guide.provenance } : {}),
    followUp: accepted ? 'Evidence is ready for the robotics team to inspect and export.' : 'Inspect the recorded attempt and acceptance checks before collecting a corrected demonstration.',
  };
}

/** A persistent local workflow store. Assignment/report changes commit in one atomic rename. */
export function createWorkflowStore({ dataDirectory, fs = fileSystem }) {
  const directory = resolve(dataDirectory, '.assignments');
  const destination = resolve(directory, 'state.json');
  async function load() {
    try {
      const state = JSON.parse(await fs.readFile(destination, 'utf8'));
      if (state.schema !== 'teachtrace.local-workflows.v1' || !state.submissions || !state.reports) throw new Error('Invalid workflow record.');
      state.assignments ??= {};
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState();
      throw error;
    }
  }
  async function persist(state) {
    await fs.mkdir(directory, { recursive: true });
    const temporary = resolve(directory, `${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
      await fs.rename(temporary, destination);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  function serialize(operation) {
    const next = (queues.get(directory) ?? Promise.resolve()).catch(() => {}).then(operation);
    queues.set(directory, next);
    return next.finally(() => { if (queues.get(directory) === next) queues.delete(directory); });
  }
  async function current() {
    await queues.get(directory)?.catch(() => {});
    return load();
  }
  function assignmentFromState(environmentId, state) {
    const initial = ENVIRONMENT_IDS.includes(environmentId) ? initialAssignment(environmentId) : state.assignments[environmentId];
    if (!initial) return null;
    const submission = state.submissions[environmentId];
    if (!submission) return initial;
    return { ...initial, status: 'submitted', submittedAt: submission.submittedAt, episodeId: submission.episodeId, latestReport: state.reports[submission.reportId] };
  }
  return {
    async listAssignments() {
      const state = await current();
      return [...ENVIRONMENT_IDS, ...Object.keys(state.assignments).filter(id => CUSTOM_ID.test(id))].map(id => assignmentFromState(id, state));
    },
    async getAssignment(environmentId) {
      if (!ENVIRONMENT_IDS.includes(environmentId) && !(typeof environmentId === 'string' && CUSTOM_ID.test(environmentId))) return null;
      return assignmentFromState(environmentId, await current());
    },
    async assignmentForWorld(world) {
      const guide = taskGuideForWorld(world);
      const id = CUSTOM_ID.test(guide.id) ? guide.id : world?.environmentId;
      if (!ENVIRONMENT_IDS.includes(id) && !(typeof id === 'string' && CUSTOM_ID.test(id))) return null;
      return assignmentFromState(id, await current()) ?? initialAssignment(id, guide);
    },
    async getReport(id) {
      if (typeof id !== 'string' || !UUID.test(id)) return null;
      return (await current()).reports[id] ?? null;
    },
    async submitApprovedEpisode({ episode, episodeId, savedAt }) {
      const directReview = operatorSaveReview(episode);
      const environmentId = episode.initialWorld?.environmentId;
      const sourceGuide = taskGuideForWorld(episode.initialWorld);
      const guide = directReview && CUSTOM_ID.test(sourceGuide.id) ? {
        ...sourceGuide, source: 'RoboTrace operator-supplied scene SOP',
        sourceKind: sourceGuide.provenance?.source === 'ai-assisted-scene' ? 'unreviewed-ai-assisted-scene' : 'unreviewed-authored-scene',
        provenance: { ...sourceGuide.provenance, review: 'unreviewed' },
      } : sourceGuide;
      const assignmentId = CUSTOM_ID.test(guide.id) ? guide.id : environmentId;
      if ((!directReview && episode.status !== 'approved') || episode.schema !== 'teachtrace.episode.v1'
        || (!ENVIRONMENT_IDS.includes(environmentId) && !CUSTOM_ID.test(guide.id))) return null;
      if (!UUID.test(episodeId)) throw new Error('A server-generated episode identifier is required.');
      return serialize(async () => {
        const state = await load();
        if (CUSTOM_ID.test(assignmentId) && state.assignments[assignmentId]) {
          const previous = state.assignments[assignmentId];
          const next = initialAssignment(assignmentId, guide);
          if (['title', 'command', 'instructions', 'assignments'].some(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))) {
            throw Object.assign(new Error('This custom assignment identity already belongs to another scene task. Create a new scene identity before submission.'), { status: 409 });
          }
        }
        const report = await serviceReport(episode, episodeId, savedAt, assignmentId, guide, directReview);
        state.reports[report.id] = report;
        if (CUSTOM_ID.test(assignmentId)) state.assignments[assignmentId] = initialAssignment(assignmentId, guide);
        state.submissions[assignmentId] = { submittedAt: savedAt, episodeId, reportId: report.id };
        await persist(state);
        return { report, assignment: assignmentFromState(assignmentId, state) };
      });
    },
  };
}
