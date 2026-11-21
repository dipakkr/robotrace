import { spawn, spawnSync } from 'node:child_process';
import { access, chmod, mkdir, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = resolve(PROJECT, '.local');
const CONFIG = resolve(LOCAL, 'cloudflared-quick.yml');
const ENV_FILE = resolve(PROJECT, '.env.local');
const services = {
  api: { pid: 'api.pid', log: 'api.log', ports: [8787, 8788] },
  preview: { pid: 'preview.pid', log: 'preview.log', ports: [5189] },
  tunnel: { pid: 'callback-tunnel.pid', log: 'callback-tunnel.log', ports: [] },
};
class DemoError extends Error {}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** PID text alone is never authority to adopt or signal a process. */
export function ownedProcess({ command, cwd, kind, project }) {
  if (typeof command !== 'string' || typeof cwd !== 'string' || cwd !== project) return false;
  const root = escape(project);
  if (kind === 'api') return new RegExp(`^(?:\\S*/)?node\\s+(?:--env-file(?:-if-exists)?=(?:\\.env\\.local|${root}/\\.env\\.local)\\s+)?(?:${root}/)?server/index\\.mjs(?:\\s|$)`).test(command.trim());
  if (kind === 'preview') return new RegExp(`^(?:\\S*/)?node\\s+(?:${root}/)?node_modules/(?:\\.bin/vite|vite/bin/vite\\.js)(?:\\s|$)`).test(command.trim())
    && /(?:^|\s)--port(?:=|\s+)5189(?:\s|$)/.test(command);
  if (kind === 'tunnel') {
    const config = escape(resolve(project, '.local/cloudflared-quick.yml'));
    return /^(?:\S*\/)?cloudflared\s/.test(command.trim()) && /(?:^|\s)tunnel(?:\s|$)/.test(command)
      && /(?:^|\s)--url(?:=|\s+)http:\/\/(?:127\.0\.0\.1|localhost):8788(?:\s|$)/.test(command)
      && new RegExp(`(?:^|\\s)--config(?:=|\\s+)(?:"${config}"|'${config}'|${config}|\\.local/cloudflared-quick\\.yml)(?:\\s|$)`).test(command);
  }
  return false;
}

export function callbackOrigin(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/'
      || host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || ['0.0.0.0', '[::]', '[::1]'].includes(host)
      || /^\[::ffff:(?:127\.|7f[\da-f]{2}:)/i.test(host)) return null;
    return url.origin;
  } catch { return null; }
}

export function callbackFromLog(log) {
  if (typeof log !== 'string') return null;
  const candidates = [...log.matchAll(/https:\/\/([a-z\d](?:[a-z\d-]*[a-z\d])?\.trycloudflare\.com)(?![a-z\d.-])/gi)].filter(match => match[1].toLowerCase() !== 'api.trycloudflare.com');
  return candidates.length ? callbackOrigin(candidates.at(-1)[0]) : null;
}

export function callbackFromEnv(contents) {
  const matches = [...contents.matchAll(/^[ \t]*(?:export[ \t]+)?PUBLIC_API_BASE_URL[ \t]*=[ \t]*([^\r\n]*)/gm)];
  if (!matches.length) return null;
  const value = matches.at(-1)[1].trim().replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/, '$2');
  return callbackOrigin(value);
}

/** Preserve every other setting byte-for-byte, including credentials and comments. */
export function updateCallbackEnv(contents, callback) {
  const origin = callbackOrigin(callback);
  if (!origin) throw new DemoError('The callback must be a public HTTPS origin.');
  const pattern = /^([ \t]*(?:export[ \t]+)?PUBLIC_API_BASE_URL[ \t]*=)[^\r\n]*/gm;
  if (pattern.test(contents)) { pattern.lastIndex = 0; return contents.replace(pattern, (_, prefix) => `${prefix}${origin}`); }
  const newline = contents.includes('\r\n') ? '\r\n' : '\n';
  return `${contents}${contents && !contents.endsWith('\n') ? newline : ''}PUBLIC_API_BASE_URL=${origin}${newline}`;
}

async function binary(name) {
  for (const folder of (process.env.PATH || '').split(delimiter)) {
    const candidate = resolve(folder || '.', name);
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* Try the next PATH entry. */ }
  }
  throw new DemoError(`Required executable ${name} is missing from PATH. Install it before starting the demo.`);
}

function commandOutput(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 1500, maxBuffer: 32000 });
  return result.status === 0 ? result.stdout : '';
}

async function inspect(pid, kind, runtime) {
  if (!Number.isSafeInteger(pid) || pid <= 1 || pid === process.pid) return false;
  const command = commandOutput(runtime.ps, ['-p', String(pid), '-o', 'command=']).trim();
  if (!command) return false;
  const listing = commandOutput(runtime.lsof, ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  const path = listing.split('\n').find(line => line.startsWith('n'))?.slice(1);
  let cwd;
  try { cwd = path ? await realpath(path) : null; } catch { return false; }
  return ownedProcess({ command, cwd, kind, project: runtime.project });
}

async function trackedPid(kind) {
  try {
    const value = (await readFile(resolve(LOCAL, services[kind].pid), 'utf8')).trim();
    return /^\d+$/.test(value) ? Number(value) : null;
  } catch { return null; }
}

function listeners(port, runtime) {
  return [...new Set(commandOutput(runtime.lsof, ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN']).trim().split(/\s+/).filter(value => /^\d+$/.test(value)).map(Number))];
}

async function findOwned(kind, runtime) {
  const candidates = new Set([await trackedPid(kind)]);
  for (const port of services[kind].ports) for (const pid of listeners(port, runtime)) candidates.add(pid);
  if (kind === 'preview') candidates.add(62242);
  for (const pid of candidates) if (await inspect(pid, kind, runtime)) return pid;
  return null;
}

async function checkPorts(kind, runtime, acceptedPid = null) {
  for (const port of services[kind].ports) {
    for (const pid of listeners(port, runtime)) {
      if (pid !== acceptedPid || !await inspect(pid, kind, runtime)) throw new DemoError(`Port ${port} is occupied by a process this launcher does not own. Close that service yourself; the launcher will not force-kill it.`);
    }
  }
}

async function health(url, type, deadline) {
  try {
    const response = await fetch(url, {
      method: type === 'callback' ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(1800, deadline - Date.now()))),
      ...(type === 'callback' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
    });
    if (type === 'callback') return response.status === 401;
    if (!response.ok) return false;
    if (type === 'preview') return (await response.text()).includes('RoboTrace');
    const value = await response.json();
    return value?.available === true && typeof value.configured === 'boolean';
  } catch { return false; }
}

async function waitUntil(check, deadline, failure) {
  while (Date.now() < deadline) { if (await check()) return; await delay(Math.min(350, Math.max(1, deadline - Date.now()))); }
  throw new DemoError(failure);
}

async function stopOwned(kind, runtime, deadline) {
  const pid = await findOwned(kind, runtime);
  if (!pid) return false;
  // Recheck immediately before signaling, guarding stale PID files and reuse.
  if (!await inspect(pid, kind, runtime)) throw new DemoError(`The ${kind} process changed ownership. Nothing was stopped.`);
  try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw new DemoError(`Could not stop the owned ${kind} service.`); }
  await waitUntil(async () => !await inspect(pid, kind, runtime), Math.min(deadline, Date.now() + 24000), `The owned ${kind} service is still shutting down. Wait a moment and retry; no force-kill was sent.`);
  const recorded = await trackedPid(kind);
  if (recorded === pid) await rm(resolve(LOCAL, services[kind].pid), { force: true });
  return true;
}

async function spawnOwned(kind, runtime) {
  const childEnv = { ...process.env };
  let executable = process.execPath, args;
  if (kind === 'api') {
    delete childEnv.PUBLIC_API_BASE_URL;
    childEnv.API_PORT = '8787'; childEnv.API_TOOLS_PORT = '8788';
    args = ['--env-file-if-exists=.env.local', 'server/index.mjs'];
  } else if (kind === 'preview') args = [resolve(PROJECT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5189', '--strictPort'];
  else {
    executable = runtime.cloudflared;
    for (const key of Object.keys(childEnv)) if (key.startsWith('TUNNEL_')) delete childEnv[key];
    await writeFile(CONFIG, '{}\n', { mode: 0o600 });
    args = ['tunnel', '--config', CONFIG, '--url', 'http://127.0.0.1:8788', '--protocol', 'http2', '--no-autoupdate', '--loglevel', 'info', '--transport-loglevel', 'warn', '--metrics', '127.0.0.1:0', '--grace-period', '2s'];
  }
  const log = await open(resolve(LOCAL, services[kind].log), kind === 'tunnel' ? 'w' : 'a', 0o600);
  let child;
  try {
    child = spawn(executable, args, { cwd: runtime.project, detached: true, env: childEnv, stdio: ['ignore', log.fd, log.fd] });
    await new Promise((resolveSpawn, reject) => { child.once('spawn', resolveSpawn); child.once('error', reject); });
    child.unref();
    await writeFile(resolve(LOCAL, services[kind].pid), `${child.pid}\n`, { mode: 0o600 });
  } finally { await log.close(); }
  return child.pid;
}

async function ensureService(kind, runtime, deadline, write) {
  let pid = await findOwned(kind, runtime);
  await checkPorts(kind, runtime, pid);
  if (!pid) { write(`Starting ${kind}…`); pid = await spawnOwned(kind, runtime); }
  else { write(`Reusing owned ${kind} service.`); await writeFile(resolve(LOCAL, services[kind].pid), `${pid}\n`, { mode: 0o600 }); }
  const url = kind === 'api' ? 'http://127.0.0.1:8787/api/integrations/status' : 'http://127.0.0.1:5189/';
  await waitUntil(async () => await health(url, kind, deadline) && (kind !== 'api' || await health('http://127.0.0.1:8788/api/voice/tools/00000000-0000-0000-0000-000000000000/context', 'callback', deadline)), deadline, `The ${kind} service did not become healthy. Inspect its ignored .local/${services[kind].log} and run status.`);
  await checkPorts(kind, runtime, pid);
}

async function envContents() {
  try { return await readFile(ENV_FILE, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

async function callbackLog() {
  try {
    const file = await open(resolve(LOCAL, services.tunnel.log), 'r');
    try { const stat = await file.stat(); const bytes = Buffer.alloc(Math.min(stat.size, 262144)); await file.read(bytes, 0, bytes.length, Math.max(0, stat.size - bytes.length)); return bytes.toString(); }
    finally { await file.close(); }
  } catch { return ''; }
}

async function ensureTunnel(runtime, deadline, write) {
  let contents = await envContents();
  const existing = callbackFromEnv(contents);
  const probe = origin => health(`${origin}/api/voice/tools/00000000-0000-0000-0000-000000000000/context`, 'callback', deadline);
  if (existing && await probe(existing)) { write('Reusing the configured callback: authenticated tool routing responds HTTP 401.'); return; }
  let pid = await findOwned('tunnel', runtime);
  if (pid) {
    const logged = callbackFromLog(await callbackLog());
    if (logged && await probe(logged)) {
      if (logged !== existing) { await saveCallback(contents, logged); await stopOwned('api', runtime, deadline); await ensureService('api', runtime, deadline, write); }
      write('Reusing the owned callback tunnel.'); return;
    }
    write('Replacing an unhealthy owned callback tunnel.');
    await stopOwned('tunnel', runtime, deadline);
  }
  runtime.cloudflared = await binary('cloudflared');
  write('Starting a callback tunnel to port 8788 only…');
  pid = await spawnOwned('tunnel', runtime);
  let callback;
  await waitUntil(async () => {
    if (!await inspect(pid, 'tunnel', runtime)) throw new DemoError('The callback tunnel exited. Inspect .local/callback-tunnel.log; your global Cloudflare configuration was not modified.');
    callback = callbackFromLog(await callbackLog());
    return callback && await probe(callback);
  }, deadline, 'The callback tunnel was not ready within 45 seconds. Inspect .local/callback-tunnel.log and retry start.');
  contents = await envContents();
  await saveCallback(contents, callback);
  write('Callback verified; updating only its local configuration and restarting the owned API…');
  await stopOwned('api', runtime, deadline);
  await ensureService('api', runtime, deadline, write);
}

async function saveCallback(contents, callback) {
  const temporary = resolve(LOCAL, `env-update-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, updateCallbackEnv(contents, callback), { mode: 0o600, flag: 'wx' });
    await rename(temporary, ENV_FILE); await chmod(ENV_FILE, 0o600);
  } finally { await rm(temporary, { force: true }); }
}

async function status(runtime, deadline, write) {
  const callback = callbackFromEnv(await envContents());
  const [api, tools, preview, publicRoute] = await Promise.all([
    health('http://127.0.0.1:8787/api/integrations/status', 'api', deadline),
    health('http://127.0.0.1:8788/api/voice/tools/00000000-0000-0000-0000-000000000000/context', 'callback', deadline),
    health('http://127.0.0.1:5189/', 'preview', deadline),
    callback ? health(`${callback}/api/voice/tools/00000000-0000-0000-0000-000000000000/context`, 'callback', deadline) : false,
  ]);
  for (const kind of ['api', 'preview', 'tunnel']) write(`${kind}: ${await findOwned(kind, runtime) ? 'owned process found' : 'no owned process found'}`);
  write(`HTTP health: API ${api ? 'OK' : 'unavailable'}; tools ${tools ? 'OK (401)' : 'unavailable'}; preview ${preview ? 'OK' : 'unavailable'}; callback ${!callback ? 'not configured' : publicRoute ? 'OK (401 authentication required)' : 'unavailable'}.`);
  write('Status checks make no voice, LLM, Murf, or paid provider requests.');
  return api && tools && preview && publicRoute;
}

export async function runDemo({ args = process.argv.slice(2), write = console.log } = {}) {
  const [action = 'status'] = args;
  if (args.length > 1 || !['start', 'status', 'restart-api', 'stop'].includes(action)) { write('Usage: node scripts/demo.mjs start|status|restart-api|stop'); return 2; }
  const deadline = Date.now() + 45000;
  let lock;
  try {
    const runtime = { project: await realpath(PROJECT), ps: await binary('ps'), lsof: await binary('lsof') };
    await mkdir(LOCAL, { recursive: true });
    if (action === 'status') return await status(runtime, deadline, write) ? 0 : 1;
    try { lock = await open(resolve(LOCAL, 'demo.lock'), 'wx', 0o600); }
    catch { throw new DemoError('Another demo command may be running. Wait for it to finish. If it crashed, remove only .local/demo.lock and retry.'); }
    await lock.writeFile(`${process.pid}\n`);
    if (action === 'stop') {
      for (const kind of ['tunnel', 'preview', 'api']) write(`${kind}: ${await stopOwned(kind, runtime, deadline) ? 'owned service stopped' : 'no owned service to stop'}.`);
      return 0;
    }
    if (action === 'restart-api') {
      await stopOwned('api', runtime, deadline);
      await ensureService('api', runtime, deadline, write);
      write('API restart complete. Voice sessions must be reconnected.'); return 0;
    }
    await access(resolve(PROJECT, 'node_modules/vite/bin/vite.js')).catch(() => { throw new DemoError('Vite is not installed. Run npm install in this project before starting the demo.'); });
    await ensureService('api', runtime, deadline, write);
    await ensureService('preview', runtime, deadline, write);
    await ensureTunnel(runtime, deadline, write);
    write('Demo ready: http://127.0.0.1:5189/ — services remain running after this command exits.');
    return 0;
  } catch (error) { write(error instanceof DemoError ? error.message : 'The demo command could not complete. Check project permissions, available executables, and ignored .local service logs. Configuration values are never displayed.'); return 1; }
  finally { if (lock) { await lock.close(); await rm(resolve(LOCAL, 'demo.lock'), { force: true }); } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runDemo();
