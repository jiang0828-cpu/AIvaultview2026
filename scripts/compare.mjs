import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(root, '.env') });
const windows = process.platform === 'win32';
const venv = resolve(root, 'python/.venv');
const python = resolve(venv, windows ? 'Scripts/python.exe' : 'bin/python');
const task = process.argv[2] || 'dev';

async function run(command, args, env = {}) {
  return new Promise((complete, reject) => {
    const child = spawn(command, args, {
      cwd: root, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONPATH: resolve(root, 'python'), ...env },
    });
    const signals = ['SIGINT', 'SIGTERM'];
    const stop = signal => child.kill(signal);
    for (const signal of signals) process.on(signal, stop);
    child.on('error', reject);
    child.on('exit', code => {
      for (const signal of signals) process.off(signal, stop);
      if (code === 0) complete();
      else reject(new Error(`Python task ${task} exited with code ${code ?? 'signal'}.`));
    });
  });
}

try {
  if (task === 'install') {
    if (!existsSync(python)) await run(process.env.PYTHON_BIN || 'python', ['-m', 'venv', venv]);
    await run(python, ['-m', 'pip', 'install', '-r', 'python/requirements.txt']);
  } else {
    if (!existsSync(python)) throw new Error('Run npm run compare:install first (requires Python 3.11+).');
    if (task === 'test') await run(python, ['-m', 'pytest', 'python/price_compare/tests', '-q']);
    else if (task === 'lint') await run(python, ['-m', 'ruff', 'check', 'python']);
    else if (task === 'typecheck') await run(python, ['-m', 'mypy', '--config-file', 'python/pyproject.toml', 'python/price_compare']);
    else if (task === 'dev') {
      const port = Number(process.env.COMPARE_PORT || 8001);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('COMPARE_PORT must be between 1024 and 65535.');
      await run(python, ['-m', 'uvicorn', 'price_compare.main:app', '--app-dir', 'python', '--host', '127.0.0.1', '--port', String(port)]);
    } else throw new Error(`Unknown comparison task: ${task}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Comparison task failed.');
  process.exitCode = 1;
}
