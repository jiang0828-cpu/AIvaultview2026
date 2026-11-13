import { mkdir, readdir, lstat, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const baselineRoot = resolve('output/deploy/20261111T085831Z/staging/private');
const baselineReleaseData = process.env.BASELINE_RELEASE_DATA;
const sourceRoot = resolve(process.env.RELEASE_SOURCE_ROOT || '.');
const snapshot = process.env.LOCAL_RELEASE_SNAPSHOT;
const codeOnly = process.argv.includes('--code-only');
const revision = process.env.RELEASE_SOURCE_REVISION || process.env.GITHUB_SHA;
if (codeOnly && !/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('Code-only releases require an exact source commit SHA.');
if (!codeOnly && !snapshot) throw new Error('Set LOCAL_RELEASE_SNAPSHOT to the verified local backup database.');
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const output = resolve('output/deploy', version);
const release = join(output, 'release');
const payload = join(output, 'payload');
await mkdir(release, { recursive: true });
await mkdir(payload, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function copy(source, target) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error('Refusing symbolic link in release');
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const name of await readdir(source)) {
      if (['__pycache__', '.venv', 'data', '.pytest_cache'].includes(name)) continue;
      await copy(join(source, name), join(target, name));
    }
  } else if (info.isFile()) {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  } else throw new Error('Unsupported release entry');
}
for (const name of ['package.json', 'package-lock.json', '.env.example', 'backend/package.json', 'backend/dist/src',
  'backend/prisma/schema.prisma', 'backend/prisma/migrations', 'frontend/package.json', 'frontend/dist',
  'python/price_compare', 'python/requirements.txt', 'deploy/vault.trialmatch.xin'])
  await copy(resolve(sourceRoot, name), resolve(release, name));
for (const name of ['apply-release-data.mjs', 'release-merge.mjs', 'verify-production.mjs'])
  await copy(resolve(sourceRoot, 'scripts', name), resolve(release, 'scripts', name));

const url = file => `file:${resolve(file).replaceAll('\\', '/')}`;
const local = codeOnly ? null : new PrismaClient({ datasources: { db: { url: url(snapshot) } } });
const previousRelease = !codeOnly && baselineReleaseData
  ? JSON.parse(await readFile(resolve(baselineReleaseData), 'utf8')) : null;
if (previousRelease && (!Array.isArray(previousRelease.local?.content) || !Array.isArray(previousRelease.local?.literaryWriter)))
  throw new Error('Previous release data is missing the required baseline tables.');
const baseline = codeOnly || previousRelease ? null
  : new PrismaClient({ datasources: { db: { url: url(join(baselineRoot, 'data/vaultview.db')) } } });
const data = { version, baseline: { content: [], literaryWriter: [] }, local: { content: [], literaryWriter: [], config: [], tripPlan: [] } };
const relatedModels = ['researchStudy', 'researchTask', 'researchTaskVersion', 'researchSynthesis', 'researchSynthesisVersion',
  'precisionBriefRun', 'precisionBriefTask', 'precisionBriefSource', 'precisionBriefItem'];
for (const table of relatedModels) data.local[table] = [];
try {
  if (!codeOnly) {
    for (const table of ['content', 'literaryWriter']) {
      data.baseline[table] = previousRelease ? previousRelease.local[table] : await baseline[table].findMany();
      data.local[table] = await local[table].findMany();
    }
    for (const table of relatedModels) data.local[table] = await local[table].findMany();
    // Only project schedule settings; never copy account initialization or secrets.
    data.local.config = await local.config.findMany({ where: { key: { startsWith: 'precisionBrief.schedule.' } } });
    // Only the administrator's explicitly requested trip records; no user hashes,
    // sessions, health workspaces or other users' private data enter the payload.
    data.local.tripPlan = (await local.tripPlan.findMany({ where: { user: { username: 'admin', role: 'admin' } },
      include: { user: { select: { username: true } } } })).map(({ userId: _userId, user, ...row }) => ({ ...row, ownerUsername: user.username }));
  }
} finally { await local?.$disconnect(); await baseline?.$disconnect(); }
await writeFile(join(payload, 'data.json'), JSON.stringify(data));
const media = [];
async function mediaFiles(directory, prefix = '') {
  for (const name of await readdir(directory)) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const file = join(directory, name);
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error('Unexpected media symbolic link');
    if (info.isDirectory()) await mediaFiles(file, relative);
    else if (info.isFile()) {
      const current = hash(await readFile(file));
      let previous = null;
      try { previous = hash(await readFile(join(baselineRoot, 'media', relative))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (current === previous) continue;
      await copy(file, join(payload, 'media', relative));
      media.push({ path: relative, hash: current, baseline: previous });
    }
  }
}
if (!codeOnly) await mediaFiles(resolve(sourceRoot, 'backend/media'));
await writeFile(join(payload, 'media.json'), JSON.stringify(media));
function tar(directory, target) {
  const result = spawnSync('tar', ['-czf', target, '-C', directory, '.'], { encoding: 'utf8', windowsHide: true });
  if (result.status || result.error) throw new Error('Release archive failed');
}
await writeFile(join(release, 'release-manifest.json'), JSON.stringify({ version, mode: codeOnly ? 'code-only' : 'content-upgrade', revision: revision || null }, null, 2));
tar(release, join(output, 'vaultview-upgrade.tar.gz'));
tar(payload, join(output, 'vaultview-content-update.tar.gz'));
await copy(resolve(sourceRoot, 'deploy/vault.trialmatch.xin/upgrade.sh'), join(output, 'upgrade.sh'));
const files = ['vaultview-upgrade.tar.gz', 'vaultview-content-update.tar.gz', 'upgrade.sh'];
await writeFile(join(output, 'SHA256SUMS'), (await Promise.all(files.map(async name => `${hash(await readFile(join(output, name)))}  ${name}`))).join('\n') + '\n');
await writeFile(join(output, 'manifest.json'), JSON.stringify({ version, mode: codeOnly ? 'code-only' : 'content-upgrade', revision: revision || null, counts: Object.fromEntries(Object.entries(data.local).map(([key, rows]) => [key, rows.length])), media: media.length }, null, 2));
console.log(JSON.stringify({ output, version, contents: data.local.content.length, projects: data.local.content.filter(row => row.isProject).length, mediaUpdates: media.length }));
