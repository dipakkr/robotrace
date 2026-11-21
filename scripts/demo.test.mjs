import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedProcess, callbackOrigin, callbackFromLog, callbackFromEnv, updateCallbackEnv, runDemo } from './demo.mjs';

const project = '/workspace/RoboTrace';
const owns = (kind, command, cwd = project) => ownedProcess({ kind, command, cwd, project });

test('API ownership requires both the exact project cwd and the actual Node server command', () => {
  assert.equal(owns('api', '/opt/bin/node --env-file-if-exists=.env.local server/index.mjs'), true);
  assert.equal(owns('api', `node --env-file=.env.local ${project}/server/index.mjs`), true);
  assert.equal(owns('api', 'node server/index.mjs', '/workspace/another-project'), false);
  assert.equal(owns('api', 'node other-server.mjs'), false);
  assert.equal(owns('api', 'node -e "console.log(\'server/index.mjs\')"'), false);
  assert.equal(owns('api', 'python node server/index.mjs'), false);
  assert.equal(owns('api', 'node /other/server/index.mjs'), false);
});

test('preview adoption requires project Vite plus the exact requested port', () => {
  assert.equal(owns('preview', `node ${project}/node_modules/.bin/vite --host 0.0.0.0 --port 5189`), true);
  assert.equal(owns('preview', `node ${project}/node_modules/vite/bin/vite.js --host 127.0.0.1 --port=5189 --strictPort`), true);
  assert.equal(owns('preview', `node ${project}/node_modules/.bin/vite --port 5188`), false);
  assert.equal(owns('preview', 'node /other/node_modules/.bin/vite --port 5189'), false);
  assert.equal(owns('preview', `node ${project}/node_modules/.bin/vite --port 51890`), false);
});

test('tunnel ownership requires project-specific config and only the tool listener target', () => {
  const base = `/opt/bin/cloudflared tunnel --config ${project}/.local/cloudflared-quick.yml --url http://127.0.0.1:8788 --no-autoupdate`;
  assert.equal(owns('tunnel', base), true);
  assert.equal(owns('tunnel', 'cloudflared --config .local/cloudflared-quick.yml tunnel --url http://localhost:8788'), true);
  assert.equal(owns('tunnel', base.replace('8788', '8787')), false);
  assert.equal(owns('tunnel', base.replace(`${project}/.local/cloudflared-quick.yml`, '/users/person/.cloudflared/config.yml')), false);
  assert.equal(owns('tunnel', base, '/workspace/other'), false);
  assert.equal(owns('tunnel', 'cloudflared tunnel --url http://127.0.0.1:8788'), false);
});

test('ownership also handles spaces in the verified project cwd without shell interpolation', () => {
  const spaced = '/workspace/Teach Trace';
  assert.equal(ownedProcess({ kind: 'preview', cwd: spaced, project: spaced, command: `node ${spaced}/node_modules/vite/bin/vite.js --port 5189` }), true);
  assert.equal(ownedProcess({ kind: 'tunnel', cwd: spaced, project: spaced, command: `cloudflared tunnel --config "${spaced}/.local/cloudflared-quick.yml" --url http://127.0.0.1:8788` }), true);
});

test('callback parsing accepts actual quick tunnel hosts and excludes API hosts or suffix tricks', () => {
  const log = 'Starting quick tunnel\nhttps://api.trycloudflare.com/tunnel\n| https://first-working-tunnel.trycloudflare.com |\nhttps://last-working-tunnel.trycloudflare.com\n';
  assert.equal(callbackFromLog(log), 'https://last-working-tunnel.trycloudflare.com');
  assert.equal(callbackFromLog('https://foo.trycloudflare.com.evil.example'), null);
  assert.equal(callbackFromLog('https://api.trycloudflare.com/tunnel'), null);
  assert.equal(callbackFromLog('No callback available'), null);
});

test('callback origins refuse loopback, embedded credentials, paths and injected settings', () => {
  assert.equal(callbackOrigin('https://demo.trycloudflare.com/'), 'https://demo.trycloudflare.com');
  for (const value of ['http://demo.example', 'https://localhost', 'https://127.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://user:secret@demo.example', 'https://demo.example/api', 'https://demo.example?key=secret', 'https://demo.example/\nLLM_API_KEY=secret']) assert.equal(callbackOrigin(value), null);
});

test('callback update preserves all other secrets, comments and line endings exactly', () => {
  const before = '# Local configuration\r\nLLM_API_KEY=private-sentinel\r\nAGORA_APP_CERTIFICATE=another-private-sentinel\r\nPUBLIC_API_BASE_URL=https://old.trycloudflare.com\r\n# End\r\n';
  const after = updateCallbackEnv(before, 'https://new.trycloudflare.com');
  assert.equal(after, before.replace('https://old.trycloudflare.com', 'https://new.trycloudflare.com'));
  assert.equal(callbackFromEnv(after), 'https://new.trycloudflare.com');
  assert.equal(callbackFromEnv('PUBLIC_API_BASE_URL="https://quoted.trycloudflare.com" # comment\n'), 'https://quoted.trycloudflare.com');
  assert.equal(updateCallbackEnv('LLM_API_KEY=secret', 'https://new.trycloudflare.com'), 'LLM_API_KEY=secret\nPUBLIC_API_BASE_URL=https://new.trycloudflare.com\n');
  assert.equal(updateCallbackEnv('PUBLIC_API_BASE_URL=x\nPUBLIC_API_BASE_URL=y\n', 'https://new.trycloudflare.com'), 'PUBLIC_API_BASE_URL=https://new.trycloudflare.com\nPUBLIC_API_BASE_URL=https://new.trycloudflare.com\n');
});

test('unknown launcher arguments print only static usage, without touching processes or reflecting values', async () => {
  const output = [];
  const code = await runDemo({ args: ['private-secret-sentinel'], write: value => output.push(value) });
  assert.equal(code, 2);
  assert.equal(output.join('').includes('private-secret-sentinel'), false);
  assert.match(output[0], /start\|status\|restart-api\|stop/);
});
