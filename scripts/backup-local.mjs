import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const root = process.cwd();
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const output = resolve('output/backups', version);
await mkdir(output, { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error || result.status) throw new Error(`${command} failed; inspect locally without sharing private output.`);
  return result.stdout;
}
function archive(target, args) {
  if (process.platform === 'win32') {
    const posix = value => value.replace(/^([a-z]):/i, (_, drive) => `/${drive.toLowerCase()}`).replaceAll('\\', '/');
    run('C:/Program Files/Git/bin/bash.exe', ['-c', '/usr/bin/tar -I /usr/bin/gzip -cf "$1" "${@:2}"',
      'backup', posix(target), ...args.map(posix)]);
  } else run('tar', ['-czf', target, ...args]);
}
const files = [...new Set(run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  .split('\0').filter(Boolean))];
const existing = [];
for (const file of files) {
  try { if ((await stat(file)).isFile()) existing.push(file); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(join(output, 'source-files.txt'), existing.join('\n') + '\n');
run('git', ['bundle', 'create', join(output, 'history.bundle'), '--all']);
archive(join(output, 'source.tar.gz'), ['-T', join(output, 'source-files.txt')]);
// Ignored media, environment and a consistent SQLite snapshot are private backups.
const db = new PrismaClient();
try {
  const target = join(output, 'vaultview.db').replaceAll('\\', '/');
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
} finally { await db.$disconnect(); }
archive(join(output, 'private-media-and-config.tar.gz'), ['.env', 'backend/media']);
const hashes = [];
for (const name of ['history.bundle', 'source.tar.gz', 'vaultview.db', 'private-media-and-config.tar.gz']) {
  const buffer = await readFile(join(output, name));
  hashes.push(`${createHash('sha256').update(buffer).digest('hex')}  ${name}`);
}
await writeFile(join(output, 'SHA256SUMS'), hashes.join('\n') + '\n');
await writeFile(join(output, 'manifest.json'), JSON.stringify({ version, sourceFiles: existing.length,
  note: 'Private local backup. Contains credentials and personal data; do not publish or commit.' }, null, 2));
console.log(JSON.stringify({ output, sourceFiles: existing.length, complete: true }));
