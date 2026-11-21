import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECRET_FIELDS = [
  'MURF_API_KEY', 'LLM_API_KEY',
];
const OPTIONAL_SECRET_FIELDS = ['AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET'];
const HEX_FIELDS = ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE'];

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function publicCallbackShape(value) {
  if (!present(value)) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const loopback = host === 'localhost' || host.endsWith('.localhost')
      || /^127\./.test(host) || ['0.0.0.0', '[::]', '[::1]'].includes(host)
      || /^\[::ffff:(?:127\.|7f[\da-f]{2}:)/i.test(host);
    return url.protocol === 'https:' && !loopback && !url.username
      && !url.password && !url.search && !url.hash && url.pathname === '/';
  } catch {
    return false;
  }
}

/** Presence/local-shape checks only. Never returns any supplied configuration value. */
export function diagnostics(env = {}) {
  const checks = [];
  for (const name of HEX_FIELDS) {
    const exists = present(env[name]);
    const valid = exists && /^[\da-f]{32}$/i.test(env[name].trim());
    checks.push({
      name, present: exists, valid,
      status: !exists ? 'missing' : valid ? 'format-valid' : 'invalid-format',
      message: !exists ? 'Missing.' : valid
        ? 'Present; 32-character hexadecimal format matches. Account access is unverified.'
        : 'Expected a 32-character hexadecimal value. Value is not displayed.',
    });
  }
  for (const name of [...SECRET_FIELDS, ...OPTIONAL_SECRET_FIELDS]) {
    const exists = present(env[name]);
    const optional = OPTIONAL_SECRET_FIELDS.includes(name);
    checks.push({
      name, present: exists, valid: null, optional,
      status: exists ? 'present-unverified' : optional ? 'optional-unset' : 'missing',
      message: exists ? 'Present. Provider validity is unverified.' : optional ? 'Optional; certificate-based REST authentication is available.' : 'Missing.',
    });
  }
  const callbackExists = present(env.PUBLIC_API_BASE_URL);
  const callbackValid = publicCallbackShape(env.PUBLIC_API_BASE_URL);
  checks.push({
    name: 'PUBLIC_API_BASE_URL', present: callbackExists, valid: callbackValid,
    status: !callbackExists ? 'missing' : callbackValid ? 'format-valid' : 'invalid-format',
    message: !callbackExists ? 'Missing.' : callbackValid
      ? 'HTTPS origin shape matches. Public routing is unverified.'
      : 'Use an HTTPS origin without credentials, query, fragment, or an API path; loopback is not valid.',
  });
  const missing = checks.filter(check => !check.present && !check.optional).map(check => check.name);
  const invalid = checks.filter(check => check.present && check.valid === false).map(check => check.name);
  return {
    ready: missing.length === 0 && invalid.length === 0,
    liveVerified: false,
    checks, missing, invalid,
    notes: [
      'No paid provider API calls are made by this doctor.',
      'A local format check does not prove credentials, account access, credits, or provider connectivity.',
      'Agora REST uses a fresh certificate-signed token unless both optional Customer ID and Customer Secret are present for Basic authentication.',
      'The local UI/API uses ports 5189/8787. Forward only the authenticated tool listener on port 8788 to an HTTPS tunnel.',
      'Keep provider values in ignored .env.local. Never paste them into chat or client-side VITE_ variables.',
    ],
  };
}

function localPort(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 65535 ? number : fallback;
}

/** Optional GETs are restricted to loopback; response values/errors are never returned. */
export async function checkLocalHealth(env = {}, fetchImpl = fetch) {
  const targets = [
    { name: 'Local UI', path: 'http://127.0.0.1:5189/', type: 'ui' },
    { name: 'Local API', path: `http://127.0.0.1:${localPort(env.API_PORT, 8787)}/api/integrations/status`, type: 'api' },
  ];
  return Promise.all(targets.map(async target => {
    try {
      const response = await fetchImpl(target.path, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(1500),
      });
      let recognized = false;
      if (response.ok) {
        if (target.type === 'ui') recognized = (await response.text()).includes('RoboTrace');
        else {
          const data = await response.json();
          recognized = data?.available === true && typeof data?.configured === 'boolean';
        }
      }
      return { name: target.name, reachable: response.ok, recognized, status: response.status };
    } catch {
      return { name: target.name, reachable: false, recognized: false, status: null };
    }
  }));
}

export async function runDoctor({ env = process.env, args = [], fetchImpl = fetch, write = console.log } = {}) {
  const known = new Set(['--check', '--health', '--json', '--help']);
  if (args.some(arg => !known.has(arg))) {
    write('Unknown option. Use --check, --health, --json, or --help.');
    return 2;
  }
  if (args.includes('--help')) {
    write('Usage: npm run doctor -- [--check] [--health] [--json]');
    write('--check exits nonzero for missing/invalid configuration, or failed requested local-health checks.');
    write('--health makes GET requests only to the local UI/API. No provider calls are made.');
    return 0;
  }
  const result = diagnostics(env);
  if (args.includes('--health')) result.health = await checkLocalHealth(env, fetchImpl);
  if (args.includes('--json')) write(JSON.stringify(result, null, 2));
  else {
    write('RoboTrace configuration doctor — values are never displayed.');
    for (const check of result.checks) {
      const mark = !check.present && check.optional ? 'OPTIONAL' : !check.present || check.valid === false ? 'NEEDS SETUP' : 'OK';
      write(`[${mark}] ${check.name}: ${check.message}`);
    }
    for (const health of result.health ?? []) {
      write(`[${health.reachable && health.recognized ? 'OK' : 'UNAVAILABLE'}] ${health.name}: ${health.recognized ? 'RoboTrace service recognized.' : 'Service not recognized or unavailable.'}`);
    }
    write(result.ready ? 'Local configuration checks passed. Live voice is still unverified.' : 'Configuration is incomplete. Follow docs/ACCOUNT_SETUP_CHECKLIST.md.');
    for (const note of result.notes) write(note);
  }
  const unhealthy = result.health?.some(health => !health.reachable || !health.recognized) ?? false;
  return args.includes('--check') && (!result.ready || unhealthy) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await runDoctor({ args: process.argv.slice(2) });
}
