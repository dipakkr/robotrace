import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';

/** Health-only fallback for venue DNS failures. Never carries credentials or disables TLS. */
export async function callbackDnsHealth(value, { timeoutMs = 1800, resolve4, requestImpl = request } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !/^[a-z\d](?:[a-z\d-]*[a-z\d])?\.trycloudflare\.com$/i.test(url.hostname) ||
      url.pathname !== '/api/voice/tools/00000000-0000-0000-0000-000000000000/context' || url.search || url.hash) return false;
    const resolver = new Resolver({ timeout: Math.max(1, Math.min(700, timeoutMs)), tries: 1 });
    resolver.setServers(['1.1.1.1']);
    const addresses = await (resolve4 ?? resolver.resolve4.bind(resolver))(url.hostname);
    const address = addresses[0];
    if (typeof address !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
    return await new Promise(resolve => {
      const req = requestImpl(url, {
        method: 'POST', servername: url.hostname, rejectUnauthorized: true, autoSelectFamily: false,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
      }, res => { res.resume(); resolve(res.statusCode === 401); });
      req.on('error', () => resolve(false));
      req.setTimeout(Math.max(1, timeoutMs), () => { req.destroy(); resolve(false); });
      req.end('{}');
    });
  } catch { return false; }
}
