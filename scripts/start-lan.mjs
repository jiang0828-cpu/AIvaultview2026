import { spawn } from 'node:child_process';
import { openSync, closeSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });
const origin = new URL(process.env.FRONTEND_ORIGIN || 'http://localhost:5173');
const webPort = Number(origin.port || (origin.protocol === 'https:' ? 443 : 80));
const apiPort = Number(process.env.PORT || 3001);
const pythonPort = Number(process.env.COMPARE_PORT || 8001);
for (const port of [webPort, apiPort, pythonPort]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid LAN service port');
}
if (new Set([webPort, apiPort, pythonPort]).size !== 3) throw new Error('Service ports must be different');
mkdirSync(resolve(root, '.tmp'), { recursive: true });

function listening(port) {
  return new Promise(complete => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); complete(value); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

async function launch(name, port, command, args, cwd = root) {
  if (await listening(port)) {
    console.log(`${name}: port ${port} already listening; keeping the existing process.`);
    return;
  }
  const output = openSync(resolve(root, `.tmp/lan-${name}.log`), 'a');
  const errors = openSync(resolve(root, `.tmp/lan-${name}-error.log`), 'a');
  try {
    // Detached children keep running when this launcher or the terminal exits.
    const child = spawn(command, args, { cwd, env: process.env, detached: true, windowsHide: true, stdio: ['ignore', output, errors] });
    await new Promise((complete, reject) => { child.once('spawn', complete); child.once('error', reject); });
    child.unref();
    console.log(`${name}: started (PID ${child.pid}, port ${port}).`);
  } finally { closeSync(output); closeSync(errors); }
}

const python = resolve(root, process.platform === 'win32' ? 'python/.venv/Scripts/python.exe' : 'python/.venv/bin/python');
if (!existsSync(python)) throw new Error('Run npm run compare:install first.');
await launch('api', apiPort, process.execPath, ['--import', 'tsx', resolve(root, 'backend/src/server.ts')]);
await launch('python', pythonPort, python, ['-m', 'uvicorn', 'price_compare.main:app', '--app-dir', resolve(root, 'python'), '--host', '127.0.0.1', '--port', String(pythonPort)]);
await launch('web', webPort, process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0'], resolve(root, 'frontend'));
const endpoints = [origin.href, `http://127.0.0.1:${apiPort}/api/health`, `http://127.0.0.1:${pythonPort}/health`];
let ready = false;
const deadline = Date.now() + 45000;
while (Date.now() < deadline) {
  ready = (await Promise.all(endpoints.map(async url => {
    try { return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
  }))).every(Boolean);
  if (ready) break;
  await new Promise(complete => setTimeout(complete, 1000));
}
console.log(`LAN entry: ${origin.origin}/home`);
console.log('Logs: .tmp/lan-{web,api,python}*.log. Computer must remain awake; rerun npm run lan after reboot.');
if (!ready) {
  console.error('Services have not all passed health checks. Inspect the logs; this is not a successful readiness check.');
  process.exitCode = 1;
}
