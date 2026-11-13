import { mkdir, readdir, lstat, copyFile, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve, join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

const root = process.cwd();
dotenv.config({ path: resolve(root, '.env') });
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const output = resolve(root, 'output/deploy', version);
const release = join(output, 'staging/release');
const data = join(output, 'staging/private');
await mkdir(release, { recursive: true });
await mkdir(join(data, 'data'), { recursive: true });

async function copy(source, target) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Package cannot include a symbolic link: ${relative(root, source)}`);
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const name of await readdir(source)) await copy(join(source, name), join(target, name));
  } else if (info.isFile()) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  } else throw new Error('Unsupported package entry.');
}
function tar(directory, archive, entries) {
  const result = spawnSync('tar', ['-czf', archive, '-C', directory, ...entries], {
    encoding: 'utf8', windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`Archive creation failed: ${result.error?.message || result.stderr}`);
}

for (const name of ['package.json', 'package-lock.json', '.env.example', 'backend/package.json',
  'backend/dist/src', 'backend/prisma/schema.prisma', 'backend/prisma/migrations',
  'frontend/package.json', 'frontend/dist', 'deploy/vault.trialmatch.xin'])
  await copy(resolve(root, name), resolve(release, name));
for (const name of ['frontend/dist/index.html', 'backend/dist/src/server.js']) await lstat(resolve(release, name));

const db = new PrismaClient();
let counts;
try {
  const target = resolve(data, 'data/vaultview.db').replaceAll('\\', '/');
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  const snapshot = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
  try {
    const integrity = await snapshot.$queryRawUnsafe('PRAGMA integrity_check');
    if (integrity[0]?.integrity_check !== 'ok') throw new Error('Database snapshot failed integrity check.');
    if (!await snapshot.user.count({ where: { role: 'admin', enabled: true } })) throw new Error('No enabled administrator to migrate.');
    await snapshot.authSession.deleteMany();
    counts = { contents: await snapshot.content.count(), projects: await snapshot.content.count({ where: { isProject: true } }),
      users: await snapshot.user.count(), writers: await snapshot.literaryWriter.count(), tripPlans: await snapshot.tripPlan.count() };
  } finally { await snapshot.$disconnect(); }
} finally { await db.$disconnect(); }

await copy(resolve(root, 'backend/media'), resolve(data, 'media'));
tar(release, join(output, 'vaultview-release.tar.gz'), ['.']);
tar(data, join(output, 'vaultview-private-data.tar.gz'), ['data', 'media']);
await copy(resolve(root, 'deploy/vault.trialmatch.xin/install-first.sh'), join(output, 'install-first.sh'));
await chmod(join(output, 'vaultview-private-data.tar.gz'), 0o600);
const hashes = [];
const files = [];
for (const name of ['vaultview-release.tar.gz', 'vaultview-private-data.tar.gz', 'install-first.sh']) {
  const buffer = await readFile(join(output, name));
  hashes.push(`${createHash('sha256').update(buffer).digest('hex')}  ${name}`);
  files.push({ name, bytes: buffer.length });
}
await writeFile(join(output, 'SHA256SUMS'), `${hashes.join('\n')}\n`);
await writeFile(join(output, 'manifest.json'), JSON.stringify({ version, hostname: 'vault.trialmatch.xin', counts, files,
  note: 'Private data contains password hashes and private content. Transfer using authenticated SSH; never expose as a public download.' }, null, 2));
console.log(JSON.stringify({ output, version, counts, files }, null, 2));
