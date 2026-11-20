import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAgentConfig, configuration, TASK_GUIDE } from './config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY_LIMIT = 1024 * 1024;

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > BODY_LIMIT) throw Object.assign(new Error('Request exceeds 1 MiB.'), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}

function authorized(header, secret) {
  const supplied = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createApiServer({ env = process.env, fetchImpl = fetch, dataDirectory = resolve(HERE, '../.local/episodes') } = {}) {
  const sessions = new Map();
  let sessionStarting = false;
  const origin = env.FRONTEND_ORIGIN || 'http://localhost:5189';
  const allowedOrigins = new Set([origin]);
  try { const local = new URL(origin); if (local.hostname === 'localhost') { local.hostname = '127.0.0.1'; allowedOrigins.add(local.origin); } else if (local.hostname === '127.0.0.1') { local.hostname = 'localhost'; allowedOrigins.add(local.origin); } } catch { /* Invalid origins remain denied. */ }

  async function agora(path, payload) {
    const credentials = Buffer.from(`${env.AGORA_CUSTOMER_ID}:${env.AGORA_CUSTOMER_SECRET}`).toString('base64');
    const response = await fetchImpl(`https://api.agora.io/api/conversational-ai-agent/v2/projects/${env.AGORA_APP_ID}/${path}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
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
    for (const pending of session.pending.values()) pending.resolve({ completed: false, error: 'Voice session closed; motion outcome is unconfirmed.' });
    session.pending.clear();
    for (const client of session.clients) client.end();
    clearTimeout(session.expiry);
    sessions.delete(session.id);
  }

  async function stopSession(session) {
    try { await agora(`agents/${encodeURIComponent(session.agentId)}/leave`); }
    finally { closeLocalSession(session); }
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.writeHead(204); res.end(); return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/integrations/status') {
        respond(res, 200, { available: true, ...configuration(env), dataset: true }); return;
      }

      if (req.method === 'GET' && url.pathname === '/api/task-guide') {
        respond(res, 200, TASK_GUIDE); return;
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
        respond(res, 201, { id, savedAt, saved: true, storage: 'local-server' }); return;
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

      if (url.pathname === '/api/voice/start' && req.method === 'POST') {
        const status = configuration(env);
        if (!status.configured) {
          respond(res, 503, { error: 'Live Agora + Murf voice is not configured. The local simulator remains available.', ...status }); return;
        }
        if (sessions.size || sessionStarting) { respond(res, 409, { error: 'A voice session is already active or starting. End it before starting another.' }); return; }
        sessionStarting = true;
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
        const session = {
          id, agentId: result.agent_id, toolSecret, clients: new Set(), pending: new Map(), cache: new Map(),
          world: input.world || null, worldUpdatedAt: Date.now(),
        };
        session.expiry = setTimeout(() => { stopSession(session).catch(() => {}); }, 30 * 60 * 1000);
        session.expiry.unref();
        sessions.set(id, session);
        sessionStarting = false;
        respond(res, 201, { sessionId: id, appId: env.AGORA_APP_ID, channel, uid: 1002, token: clientToken, expiresIn: 3600, providers: { transport: 'Agora RTC', conversation: 'Agora Conversational AI', tts: 'Murf Falcon' } }); return;
      }

      if (url.pathname === '/api/voice/stop' && req.method === 'POST') {
        const { sessionId } = await body(req);
        const session = sessions.get(sessionId);
        if (session) await stopSession(session);
        respond(res, 200, { stopped: true }); return;
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
        res.write('event: ready\ndata: {}\n\n');
        session.clients.add(res);
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
        req.on('close', () => { clearInterval(heartbeat); session.clients.delete(res); });
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
          respond(res, 200, { taskGuide: TASK_GUIDE, world: session.world, ageMs: Date.now() - session.worldUpdatedAt, connected: session.clients.size > 0 }); return;
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
      if (url.pathname === '/api/voice/start') sessionStarting = false;
      respond(res, error.status || 500, { error: error.status ? error.message : 'The local API could not complete this request.' });
    }
  });
  server.closeVoiceSessions = async () => {
    await Promise.allSettled([...sessions.values()].map(stopSession));
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
  server.listen(port, '127.0.0.1', () => console.log(`TeachTrace local API: http://127.0.0.1:${port} (voice ${configuration().configured ? 'configured; not live-verified' : 'not configured'})`));
  toolsServer.listen(toolsPort, '127.0.0.1', () => console.log(`TeachTrace tool-only listener: http://127.0.0.1:${toolsPort}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    await server.closeVoiceSessions();
    toolsServer.close();
    server.close(() => process.exit(0));
  });
}
