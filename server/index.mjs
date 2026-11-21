import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAgentConfig, configuration } from './config.mjs';
import { taskGuideForEnvironment, taskGuideForWorld } from './task-guides.mjs';
import { agoraAuthorization } from './auth.mjs';
import { createMobileEvidenceStore } from './mobile-store.mjs';
import { createMobileQaStore, validateMobileQaMetadata, mobileQaSummary } from './mobile-qa-store.mjs';
import { createExperimentStore, MAX_EXPERIMENT_AUDIO_BYTES } from './experiment-store.mjs';
import { physicalReportForRecord, renderPhysicalReportHtml } from './physical-report.mjs';
import { reanalyzeExperimentRecord } from './experiment-analysis.mjs';
import { generateSpeechTestCases } from './speech-test-cases.mjs';
import { createSpeechQaStore } from './speech-qa-store.mjs';
import { createWorkflowStore } from './workflows.mjs';
import { createPlannerService } from './planner-models.mjs';
import { generateMobileCandidate } from './mobile-planner.mjs';
import { interpretMobileCommand } from './mobile-intent.mjs';
import { draftPhotoRoom } from './room-draft.mjs';
import { evaluateMobilePlanOnServer, evaluatePlanOnServer } from './simulation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY_LIMIT = 1024 * 1024;

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function body(req, limit = BODY_LIMIT) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > limit) throw Object.assign(new Error(`Request exceeds ${limit / (1024 * 1024)} MiB.`), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
async function audioBody(req) {
  const chunks=[];let size=0;
  for await (const chunk of req) {const bytes=Buffer.from(chunk);size+=bytes.length;if(size>MAX_EXPERIMENT_AUDIO_BYTES)throw Object.assign(new Error('Audio clips must be at most 16 MiB.'),{status:413});chunks.push(bytes);}
  return Buffer.concat(chunks,size);
}

function authorized(header, secret) {
  const supplied = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createApiServer({ env = process.env, fetchImpl = fetch, dataDirectory = resolve(HERE, '../.local/episodes'), voiceTimings = {} } = {}) {
  const workflows = createWorkflowStore({ dataDirectory });
  const mobileEvidence = createMobileEvidenceStore({ dataDirectory });
  const mobileQa = createMobileQaStore({ dataDirectory });
  const experiments = createExperimentStore({ dataDirectory });
  const speechQa = createSpeechQaStore({dataDirectory,generate:(experiment,input)=>generateSpeechTestCases({env,fetchImpl,experiment,input})});
  const planner = createPlannerService({ env, fetchImpl });
  const sessions = new Map();
  const pendingStops = new Set();
  let sessionStarting = null;
  let sessionGeneration = 0;
  let resetInProgress = null;
  const grace = (value, fallback) => Number.isFinite(value) && value >= 1 ? value : fallback;
  const startupGraceMs = grace(voiceTimings.startupGraceMs, 20000);
  const reconnectGraceMs = grace(voiceTimings.reconnectGraceMs, 10000);
  const origin = env.FRONTEND_ORIGIN || 'http://localhost:5189';
  const allowedOrigins = new Set([origin]);
  try { const local = new URL(origin); if (local.hostname === 'localhost') { local.hostname = '127.0.0.1'; allowedOrigins.add(local.origin); } else if (local.hostname === '127.0.0.1') { local.hostname = 'localhost'; allowedOrigins.add(local.origin); } } catch { /* Invalid origins remain denied. */ }

  async function agora(path, payload) {
    const response = await fetchImpl(`https://api.agora.io/api/conversational-ai-agent/v2/projects/${env.AGORA_APP_ID}/${path}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: agoraAuthorization(env, payload), 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!response.ok) {
      // Never reflect provider responses: they may echo request credentials.
      throw Object.assign(new Error(`Agora rejected the request (HTTP ${response.status}). Check project activation, provider credentials, and the server configuration.`), { status: 502 });
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  function closeLocalSession(session) {
    session.closed = true;
    clearTimeout(session.disconnectCleanup);
    clearTimeout(session.expiry);
    sessions.delete(session.id);
    for (const pending of session.pending.values()) pending.resolve({ completed: false, error: 'Voice session closed; motion outcome is unconfirmed.' });
    session.pending.clear();
    for (const client of session.clients) client.end();
    session.clients.clear();
  }

  function stopSession(session) {
    if (session.stopping) return session.stopping;
    closeLocalSession(session);
    session.stopping = agora(`agents/${encodeURIComponent(session.agentId)}/leave`).finally(() => { pendingStops.delete(session.stopping); });
    pendingStops.add(session.stopping);
    return session.stopping;
  }

  function scheduleDisconnectCleanup(session, delay) {
    clearTimeout(session.disconnectCleanup);
    session.disconnectCleanup = setTimeout(() => {
      if (!session.closed && !session.clients.size) stopSession(session).catch(() => {});
    }, delay);
    session.disconnectCleanup.unref();
  }

  function resetVoiceSessions() {
    if (resetInProgress) return resetInProgress;
    sessionGeneration += 1;
    const starting = sessionStarting;
    for (const session of sessions.values()) stopSession(session);
    const stopping = [...pendingStops];
    resetInProgress = (async () => {
      const outcomes = await Promise.allSettled(stopping);
      // An invalidated join owns its lock until it returns and any late agent
      // has been stopped. A new start cannot overtake that cleanup.
      if (starting) await starting.done;
      return { reset: true, stopped: true, cleanupVerified: outcomes.every(outcome => outcome.status === 'fulfilled') && (starting?.cleanupVerified ?? true) };
    })().finally(() => { resetInProgress = null; });
    return resetInProgress;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const isTool = url.pathname.startsWith('/api/voice/tools/');
    const requestOrigin = req.headers.origin;
    // Local UI mutations are limited to the configured browser origin. Provider
    // callbacks use a separate per-session bearer credential instead of CORS.
    if (requestOrigin && !allowedOrigins.has(requestOrigin) && !isTool) {
      respond(res, 403, { error: 'Origin is not allowed.' }); return;
    }
    if (allowedOrigins.has(requestOrigin)) res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RoboTrace-Audio-Metadata');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.writeHead(204); res.end(); return;
    }

    let ownedStart = null;
    try {
      if (req.method === 'GET' && url.pathname === '/api/integrations/status') {
        respond(res, 200, { available: true, ...configuration(env), dataset: true }); return;
      }

      if (req.method === 'GET' && url.pathname === '/api/task-guide') {
        respond(res, 200, taskGuideForEnvironment(url.searchParams.get('environment'))); return;
      }

      if (req.method === 'GET' && url.pathname === '/api/planner/models') {
        respond(res, 200, { models: planner.models() }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/planner/plan') {
        respond(res, 200, await planner.plan(await body(req))); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/scenes/draft') {
        respond(res, 200, await planner.draft(await body(req))); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/rooms/draft') {
        respond(res,200,await draftPhotoRoom({env,fetchImpl,input:await body(req)}));return;
      }
      if (req.method === 'POST' && url.pathname === '/api/mobile-planner/plan') {
        const input = await body(req);
        respond(res, 200, await generateMobileCandidate({ env, fetchImpl, model: input.model, world: input.world, command: input.command, goal: input.goal })); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/mobile/interpret') {
        respond(res, 200, await interpretMobileCommand({ env, fetchImpl, input: await body(req) })); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/evaluations/mobile/history') {
        respond(res, 200, await mobileQa.list()); return;
      }
      const mobileQaRoute = url.pathname.match(/^\/api\/evaluations\/mobile\/history\/([^/]+)$/);
      if (req.method === 'GET' && mobileQaRoute) {
        const record = await mobileQa.get(mobileQaRoute[1]);
        respond(res, record ? 200 : 404, record ? { record } : { error: 'QA run not found.' }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/evaluations/mobile') {
        const input = await body(req);
        const qa = validateMobileQaMetadata(input?.qa);
        const evaluationInput = { ...input }; delete evaluationInput.qa;
        const result = await evaluateMobilePlanOnServer(evaluationInput);
        let qaRecord;
        try { const saved = await mobileQa.save(result, qa); const { checks, ...summary } = mobileQaSummary(saved); qaRecord = summary; }
        catch { qaRecord = { id: result.id, historySaved: false, warning: 'Evaluation completed, but local QA history could not be saved. Export the current result to retain it.' }; }
        respond(res, 200, { ...result, qaRecord }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/evaluations/plan') {
        respond(res, 200, await evaluatePlanOnServer(await body(req))); return;
      }

      if (req.method === 'POST' && url.pathname === '/api/experiments') {
        respond(res, 201, await experiments.save(await body(req, 20 * 1024 * 1024))); return;
      }
      const experimentAudio = url.pathname.match(/^\/api\/experiments\/([^/]+)\/audio\/([^/]+)$/);
      if (experimentAudio && req.method === 'POST') {
        let metadata;try {const raw=req.headers['x-robotrace-audio-metadata'];if(typeof raw!=='string'||raw.length>512)throw new Error();metadata=JSON.parse(raw);}catch {respond(res,400,{error:'Provide bounded audio direction and timestamps in X-RoboTrace-Audio-Metadata.'});return;}
        respond(res,201,await experiments.saveAudio(experimentAudio[1],experimentAudio[2],metadata,req.headers['content-type'],await audioBody(req)));return;
      }
      if (experimentAudio && req.method === 'GET') {
        const value=await experiments.audio(experimentAudio[1],experimentAudio[2]);if(!value){respond(res,404,{error:'Experiment audio not found.'});return;}
        res.writeHead(200,{'Content-Type':value.clip.mimeType,'Content-Length':value.bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(value.bytes);return;
      }
      if (req.method === 'GET' && url.pathname === '/api/experiments') {
        respond(res, 200, await experiments.list()); return;
      }
      const experimentExport = url.pathname.match(/^\/api\/experiments\/([^/]+)\/export\.jsonl$/);
      if (req.method === 'GET' && experimentExport) {
        const jsonl = await experiments.jsonl(experimentExport[1]);
        if (jsonl === null) { respond(res, 404, { error: 'Experiment recording not found.' }); return; }
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="robotrace-experiment-${experimentExport[1].toLowerCase()}.jsonl"` }); res.end(jsonl); return;
      }
      const speechTestCases = url.pathname.match(/^\/api\/experiments\/([^/]+)\/test-cases$/);
      if (['GET','POST'].includes(req.method) && speechTestCases) {
        const record = await experiments.get(speechTestCases[1]);
        if (!record) { respond(res,404,{error:'Experiment recording not found.'});return; }
        if(req.method==='GET'){respond(res,200,{analysis:await speechQa.get(record)});return;}
        respond(res,200,await speechQa.create(record,await body(req,4096)));return;
      }
      const experimentReevaluation = url.pathname.match(/^\/api\/experiments\/([^/]+)\/reevaluate$/);
      if (req.method === 'GET' && experimentReevaluation) {
        const record = await experiments.get(experimentReevaluation[1]);
        if (!record) { respond(res,404,{error:'Experiment recording not found.'});return; }
        respond(res,200,await reanalyzeExperimentRecord(record));return;
      }
      const physicalReportRoute = url.pathname.match(/^\/api\/experiments\/([^/]+)\/report\.(html|json)$/);
      if (req.method === 'GET' && physicalReportRoute) {
        const record = await experiments.get(physicalReportRoute[1]);
        if (!record) { respond(res,404,{error:'Experiment recording not found.'});return; }
        const report={...await physicalReportForRecord(record,await experiments.audioManifest(record.id)),llmQA:await speechQa.get(record)};
        const extension=physicalReportRoute[2];
        if(url.searchParams.get('download')==='1')res.setHeader('Content-Disposition',`attachment; filename="robotrace-physical-evaluation-${record.id}.${extension}"`);
        if(extension==='json'){respond(res,200,report);return;}
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(renderPhysicalReportHtml(report));return;
      }
      const experimentRoute = url.pathname.match(/^\/api\/experiments\/([^/]+)$/);
      if (req.method === 'GET' && experimentRoute) {
        const record = await experiments.get(experimentRoute[1]);
        respond(res, record ? 200 : 404, record ? { record, audioManifest: await experiments.audioManifest(record.id) } : { error: 'Experiment recording not found.' }); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/mobile/episodes') {
        respond(res, 200, { episodes: await mobileEvidence.list() }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/mobile/episodes') {
        respond(res, 201, await mobileEvidence.submit(await body(req, 8 * 1024 * 1024))); return;
      }
      const mobileRecordRoute = url.pathname.match(/^\/api\/mobile\/episodes\/([^/]+)$/);
      if (req.method === 'GET' && mobileRecordRoute) {
        const record = await mobileEvidence.get(mobileRecordRoute[1]);
        respond(res, record ? 200 : 404, record ? { record } : { error: 'Mobile record not found.' }); return;
      }

      if (req.method === 'GET' && url.pathname === '/api/assignments') {
        respond(res, 200, { assignments: await workflows.listAssignments() }); return;
      }
      const assignmentRoute = url.pathname.match(/^\/api\/assignments\/([^/]+)$/);
      if (req.method === 'GET' && assignmentRoute) {
        const assignment = await workflows.getAssignment(assignmentRoute[1]);
        respond(res, assignment ? 200 : 404, assignment ?? { error: 'Assignment not found.' }); return;
      }
      const reportRoute = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
      if (req.method === 'GET' && reportRoute) {
        const report = await workflows.getReport(reportRoute[1]);
        respond(res, report ? 200 : 404, report ?? { error: 'Report not found.' }); return;
      }

      if (url.pathname === '/api/episodes' && req.method === 'POST') {
        const episode = await body(req);
        if (!episode || typeof episode !== 'object' || Array.isArray(episode) || Object.keys(episode).length === 0) {
          respond(res, 400, { error: 'An episode object is required.' }); return;
        }
        const id = randomUUID();
        const savedAt = new Date().toISOString();
        const record = { id, savedAt, episode };
        await mkdir(dataDirectory, { recursive: true });
        const destination = resolve(dataDirectory, `${id}.json`);
        await writeFile(`${destination}.tmp`, JSON.stringify(record, null, 2), { mode: 0o600 });
        await rename(`${destination}.tmp`, destination);
        let workflow;
        try { workflow = await workflows.submitApprovedEpisode({ episode, episodeId: id, savedAt }); }
        catch (error) {
          // Do not acknowledge a reviewed submission if its assignment/report
          // commit fails. The prior assignment state remains intact.
          await rm(destination, { force: true }).catch(() => {});
          throw error;
        }
        respond(res, 201, { id, savedAt, saved: true, storage: 'local-server', ...(workflow ?? {}) }); return;
      }

      if (url.pathname === '/api/episodes' && req.method === 'GET') {
        await mkdir(dataDirectory, { recursive: true });
        const names = (await readdir(dataDirectory)).filter(name => /^[\da-f-]+\.json$/i.test(name));
        const entries = await Promise.all(names.slice(-100).map(async name => {
          const record = JSON.parse(await readFile(resolve(dataDirectory, name), 'utf8'));
          return { id: record.id, savedAt: record.savedAt, title: record.episode.title || record.episode.command || 'Recorded episode' };
        }));
        respond(res, 200, { episodes: entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) }); return;
      }

      const episodeRoute = url.pathname.match(/^\/api\/episodes\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i);
      if (episodeRoute && req.method === 'GET') {
        try {
          const record = JSON.parse(await readFile(resolve(dataDirectory, `${episodeRoute[1]}.json`), 'utf8'));
          respond(res, 200, record);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          respond(res, 404, { error: 'Episode not found.' });
        }
        return;
      }

      if (url.pathname === '/api/voice/start' && req.method === 'POST') {
        const status = configuration(env);
        if (!status.configured) {
          respond(res, 503, { error: 'Live Agora + Murf voice is not configured. The local simulator remains available.', ...status }); return;
        }
        if (sessions.size || sessionStarting || resetInProgress || pendingStops.size) { respond(res, 409, { error: 'A voice session is active, starting, or resetting. End or reset it before starting another.' }); return; }
        let finishStart;
        ownedStart = { generation: sessionGeneration, cleanupVerified: true, done: new Promise(resolveStart => { finishStart = resolveStart; }), finish: () => finishStart() };
        sessionStarting = ownedStart;
        const input = await body(req);
        const tokenModule = await import('agora-token');
        const tokens = tokenModule.default || tokenModule;
        const id = randomUUID();
        const channel = `teachtrace-${id}`;
        const toolSecret = randomUUID() + randomUUID();
        const token = uid => tokens.RtcTokenBuilder.buildTokenWithUid(env.AGORA_APP_ID, env.AGORA_APP_CERTIFICATE, channel, uid, tokens.RtcRole.PUBLISHER, 3600, 3600);
        const agentToken = token(1001);
        const clientToken = token(1002);
        const result = await agora('join', buildAgentConfig({ env, id, channel, agentToken, toolSecret }));
        if (typeof result.agent_id !== 'string') throw Object.assign(new Error('Agora did not return an agent ID.'), { status: 502 });
        if (ownedStart.generation !== sessionGeneration || res.destroyed) {
          try { await agora(`agents/${encodeURIComponent(result.agent_id)}/leave`); }
          catch { ownedStart.cleanupVerified = false; }
          if (!res.destroyed) respond(res, 409, { error: 'Voice start was cancelled by a reset. Start a new session after reset completes.' });
          return;
        }
        const session = {
          id, agentId: result.agent_id, toolSecret, clients: new Set(), pending: new Map(), cache: new Map(),
          world: input.world || null, worldUpdatedAt: Date.now(),
          lastAnnouncementAt: 0, lastAnnouncementText: '', announcementPending: false,
        };
        session.expiry = setTimeout(() => { stopSession(session).catch(() => {}); }, 30 * 60 * 1000);
        session.expiry.unref();
        sessions.set(id, session);
        scheduleDisconnectCleanup(session, startupGraceMs);
        respond(res, 201, { sessionId: id, appId: env.AGORA_APP_ID, channel, uid: 1002, token: clientToken, expiresIn: 3600, providers: { transport: 'Agora RTC', conversation: 'Agora Conversational AI', tts: 'Murf Falcon' } }); return;
      }

      if (url.pathname === '/api/voice/reset' && req.method === 'POST') {
        respond(res, 200, await resetVoiceSessions()); return;
      }

      if (url.pathname === '/api/voice/stop' && req.method === 'POST') {
        const { sessionId } = await body(req);
        const session = sessions.get(sessionId);
        if (session) await stopSession(session);
        respond(res, 200, { stopped: true }); return;
      }

      if (url.pathname === '/api/voice/announce' && req.method === 'POST') {
        const { sessionId, text } = await body(req);
        const session = sessions.get(sessionId);
        if (!session) { respond(res, 404, { spoken: false, accepted: false, error: 'Voice session not found.' }); return; }
        const message = typeof text === 'string' ? text.trim() : '';
        if (!message || message.length > 300 || Buffer.byteLength(message, 'utf8') > 512) {
          respond(res, 400, { spoken: false, accepted: false, error: 'Progress text must be 1–300 characters and at most 512 UTF-8 bytes.' }); return;
        }
        const now = Date.now();
        if (session.announcementPending || now - session.lastAnnouncementAt < 1600
          || (message === session.lastAnnouncementText && now - session.lastAnnouncementAt < 10000)) {
          respond(res, 200, { spoken: false, accepted: false, suppressed: true, reason: 'Progress announcements are rate-limited and duplicate-filtered.' }); return;
        }
        session.announcementPending = true;
        session.lastAnnouncementAt = now;
        session.lastAnnouncementText = message;
        try {
          // APPEND preserves an in-flight conversational/tool turn. INTERRUPT
          // would cancel the agent's thought process while our tool is waiting.
          await agora(`agents/${encodeURIComponent(session.agentId)}/speak`, {
            text: message, priority: 'APPEND', interruptable: true,
          });
          // 'spoken' is the compatibility flag for an accepted speak request,
          // not proof of audible playback. The explicit fields prevent the UI
          // from treating REST acceptance as a verified audio-completion event.
          respond(res, 202, { spoken: true, accepted: true, queued: true, playbackVerified: false, priority: 'APPEND' }); return;
        } finally { session.announcementPending = false; }
      }

      if (url.pathname === '/api/voice/context' && req.method === 'POST') {
        const { sessionId, world } = await body(req);
        const session = sessions.get(sessionId);
        if (!session) { respond(res, 404, { error: 'Voice session not found.' }); return; }
        session.world = world; session.worldUpdatedAt = Date.now();
        respond(res, 200, { updated: true }); return;
      }

      if (url.pathname === '/api/voice/events' && req.method === 'GET') {
        const session = sessions.get(url.searchParams.get('sessionId'));
        if (!session) { respond(res, 404, { error: 'Voice session not found.' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        session.clients.add(res);
        clearTimeout(session.disconnectCleanup);
        res.write('event: ready\ndata: {}\n\n');
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
        res.on('close', () => {
          clearInterval(heartbeat);
          session.clients.delete(res);
          if (!session.closed && !session.clients.size) scheduleDisconnectCleanup(session, reconnectGraceMs);
        });
        return;
      }

      if (url.pathname === '/api/voice/ack' && req.method === 'POST') {
        const { sessionId, commandId, result } = await body(req);
        const session = sessions.get(sessionId);
        const pending = session?.pending.get(commandId);
        if (!pending) { respond(res, 404, { error: 'Command is no longer awaiting an outcome.' }); return; }
        if (!result || typeof result.completed !== 'boolean') { respond(res, 400, { error: 'Result must include a completed boolean.' }); return; }
        pending.resolve(result);
        respond(res, 200, { acknowledged: true }); return;
      }

      const match = url.pathname.match(/^\/api\/voice\/tools\/([\da-f-]+)\/(context|command)$/i);
      if (match && req.method === 'POST') {
        const session = sessions.get(match[1]);
        if (!session || !authorized(req.headers.authorization, session.toolSecret)) {
          respond(res, 401, { error: 'Invalid tool-session credential.' }); return;
        }
        if (match[2] === 'context') {
          respond(res, 200, { taskGuide: taskGuideForWorld(session.world), assignment: await workflows.assignmentForWorld(session.world), world: session.world, ageMs: Date.now() - session.worldUpdatedAt, connected: session.clients.size > 0 }); return;
        }
        const { command, toolCallId } = await body(req);
        if (typeof command !== 'string' || !command.trim() || command.length > 500 || typeof toolCallId !== 'string') {
          respond(res, 400, { error: 'A command of 1–500 characters and toolCallId are required.' }); return;
        }
        if (session.cache.has(toolCallId)) { respond(res, 200, await session.cache.get(toolCallId)); return; }
        if (!session.clients.size) { respond(res, 409, { completed: false, error: 'The simulator client is not connected.' }); return; }
        const commandId = randomUUID();
        const outcome = new Promise(resolveOutcome => {
          const timeout = setTimeout(() => {
            session.pending.delete(commandId);
            resolveOutcome({ completed: false, error: 'Simulator outcome timed out. The command may still be running. Retrieve fresh state before taking further action.' });
          }, 40000);
          const resolveResult = result => { clearTimeout(timeout); session.pending.delete(commandId); resolveOutcome(result); };
          session.pending.set(commandId, { resolve: resolveResult });
        });
        if (session.cache.size >= 100) session.cache.delete(session.cache.keys().next().value);
        session.cache.set(toolCallId, outcome);
        for (const client of session.clients) client.write(`event: command\ndata: ${JSON.stringify({ id: commandId, command })}\n\n`);
        const result = await outcome;
        // A valid tool exchange may prepare a plan or report a failed motion.
        // Keep its structured result available to the conversational model.
        respond(res, 200, result); return;
      }

      respond(res, 404, { error: 'Endpoint not found.' });
    } catch (error) {
      if (ownedStart && ownedStart.generation !== sessionGeneration) ownedStart.cleanupVerified = false;
      respond(res, error.status || 500, { error: error.status ? error.message : 'The local API could not complete this request.' });
    } finally {
      if (ownedStart) {
        if (sessionStarting === ownedStart) sessionStarting = null;
        ownedStart.finish();
      }
    }
  });
  server.closeVoiceSessions = async () => {
    await resetVoiceSessions();
  };
  server.on('close', () => { for (const session of sessions.values()) closeLocalSession(session); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.API_PORT || 8787);
  const toolsPort = Number(process.env.API_TOOLS_PORT || 8788);
  const server = createApiServer();
  // Only authenticated provider tool callbacks are exposed to a public tunnel.
  // Local UI/dataset/session endpoints remain on a separate loopback listener.
  const toolsServer = http.createServer((req, res) => {
    if (!req.url?.startsWith('/api/voice/tools/')) {
      respond(res, 404, { error: 'This listener accepts authenticated voice tool callbacks only.' }); return;
    }
    server.emit('request', req, res);
  });
  server.listen(port, '127.0.0.1', () => console.log(`RoboTrace local API: http://127.0.0.1:${port} (voice ${configuration().configured ? 'configured; not live-verified' : 'not configured'})`));
  toolsServer.listen(toolsPort, '127.0.0.1', () => console.log(`RoboTrace tool-only listener: http://127.0.0.1:${toolsPort}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    await server.closeVoiceSessions();
    toolsServer.close();
    server.close(() => process.exit(0));
  });
}
