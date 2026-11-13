import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import { mergeFields, sameTrip } from './release-merge.mjs';

const payload = resolve(process.argv[2]);
const input = JSON.parse(await readFile(resolve(payload, 'data.json'), 'utf8'));
const env = process.env.RELEASE_DATABASE_URL ? {} : dotenv.parse(await readFile('/etc/vaultview/vaultview.env'));
const db = new PrismaClient({ datasources: { db: { url: process.env.RELEASE_DATABASE_URL || env.DATABASE_URL } } });
const dryRun = process.argv.includes('--check');
const stats = { created: 0, updated: 0, preservedConflicts: [], missingOnline: 0, relatedCreated: 0, relatedPreserved: [], tripsCreated: 0, tripsPreserved: 0 };
const map = new Map();
const models = ['researchStudy', 'researchTask', 'researchTaskVersion', 'researchSynthesis', 'researchSynthesisVersion',
  'precisionBriefRun', 'precisionBriefTask', 'precisionBriefSource', 'precisionBriefItem'];
function normalized(row) { return JSON.parse(JSON.stringify(row)); }
function values(row, model) {
  const data = { ...row };
  for (const key of ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'publishedAt', 'windowStart', 'windowEnd', 'accessedAt'])
    if (data[key] && !(model === 'precisionBriefSource' && key === 'publishedAt')) data[key] = new Date(data[key]);
  for (const key of ['topics', 'imagesJson', 'assetsJson'])
    if (key in data && data[key] === null) data[key] = Prisma.DbNull;
  return data;
}
class PreviewComplete extends Error {}
try {
  await db.$transaction(async tx => {
    const base = new Map(input.baseline.content.map(row => [row.id, row]));
    const pending = [...input.local.content];
    const online = new Map((await tx.content.findMany()).map(row => [row.id, normalized(row)]));
    for (const row of input.local.content) if (base.has(row.id) && online.has(row.id)) map.set(row.id, row.id);
    const processed = new Set();
    while (pending.length) {
      let progress = false;
      for (let index = 0; index < pending.length;) {
        const source = pending[index];
        if (source.parentId && !processed.has(source.parentId) && pending.some(row => row.id === source.parentId)) { index++; continue; }
        pending.splice(index, 1);
        progress = true;
        processed.add(source.id);
        if (source.parentId && !map.has(source.parentId)) { stats.missingOnline++; continue; }
        const local = { ...source, parentId: source.parentId ? map.get(source.parentId) : null };
        if (base.has(source.id)) {
          const remote = online.get(source.id);
          if (!remote) { stats.missingOnline++; continue; }
          const result = mergeFields(base.get(source.id), local, remote);
          if (result.conflicts.length) stats.preservedConflicts.push({ contentId: source.id, fields: result.conflicts });
          if (Object.keys(result.changes).length) {
            await tx.content.update({ where: { id: source.id }, data: values(result.changes) });
            stats.updated++;
          }
        } else {
          const existing = await tx.content.findFirst({ where: { parentId: local.parentId, title: local.title, type: local.type } });
          if (existing) { map.set(source.id, existing.id); continue; }
          const data = values(local);
          if (await tx.content.findUnique({ where: { id: source.id } })) delete data.id;
          const created = await tx.content.create({ data });
          map.set(source.id, created.id);
          stats.created++;
        }
      }
      if (!progress) throw new Error('Local content has an unresolved parent cycle');
    }
    const final = await tx.content.findMany();
    const byId = new Map(final.map(row => [row.id, row]));
    for (const row of final) {
      const seen = new Set([row.id]);
      let parent = row.parentId ? byId.get(row.parentId) : null;
      while (parent) {
        if (seen.has(parent.id)) throw new Error('Merged content would create a cycle');
        if (row.isProject && parent.isProject) throw new Error('Merged content would nest projects');
        seen.add(parent.id);
        parent = parent.parentId ? byId.get(parent.parentId) : null;
      }
    }
    const writerBase = new Map(input.baseline.literaryWriter.map(row => [row.id, row]));
    for (const row of input.local.literaryWriter) {
      if (!map.has(row.projectId)) continue;
      const local = { ...row, projectId: map.get(row.projectId) };
      const existing = await tx.literaryWriter.findUnique({ where: { id: row.id } });
      if (existing && writerBase.has(row.id)) {
        const result = mergeFields(writerBase.get(row.id), local, normalized(existing));
        if (Object.keys(result.changes).length) await tx.literaryWriter.update({ where: { id: row.id }, data: values(result.changes) });
      } else if (!existing && !writerBase.has(row.id)) await tx.literaryWriter.create({ data: values(local) });
    }
    // Research tables were introduced after the original release. Copy only into
    // completely empty groups; existing online research always takes priority.
    for (const group of [models.slice(0, 5), models.slice(5)]) {
      const counts = await Promise.all(group.map(model => tx[model].count()));
      if (counts.some(Boolean)) { stats.relatedPreserved.push(group[0]); continue; }
      for (const model of group) for (const row of input.local[model]) {
        const data = values(row, model);
        if ('projectId' in data) {
          if (!map.has(data.projectId)) throw new Error('Research references an unavailable project');
          data.projectId = map.get(data.projectId);
        }
        await tx[model].create({ data });
        stats.relatedCreated++;
      }
    }
    for (const row of input.local.config) {
      const sourceId = Number(row.key.split('.').at(-1));
      if (!map.has(sourceId)) continue;
      const key = `precisionBrief.schedule.${map.get(sourceId)}`;
      if (!await tx.config.findUnique({ where: { key } })) await tx.config.create({ data: { key, value: row.value } });
    }
    for (const source of input.local.tripPlan || []) {
      const { ownerUsername, ...trip } = source;
      delete trip.id;
      const user = await tx.user.findUnique({ where: { username: ownerUsername } });
      const projectId = map.get(trip.projectId);
      if (!user || user.role !== 'admin' || !projectId) throw new Error('Trip owner or target project cannot be resolved safely');
      const matches = await tx.tripPlan.findMany({ where: { userId: user.id, projectId } });
      if (matches.some(row => sameTrip(row, trip))) { stats.tripsPreserved++; continue; }
      await tx.tripPlan.create({ data: values({ ...trip, userId: user.id, projectId }) });
      stats.tripsCreated++;
    }
    if (dryRun) throw new PreviewComplete();
  }, { maxWait: 10000, timeout: 60000 });
} catch (error) {
  if (!(error instanceof PreviewComplete)) throw error;
} finally { await db.$disconnect(); }
await writeFile(resolve(payload, dryRun ? 'merge-preview.json' : 'merge-result.json'), JSON.stringify(stats, null, 2));
console.log(JSON.stringify({ dryRun, ...stats }));
