import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { projectRoot, type AppConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { seedWorld } from '../prisma/seed-world.js';
import { worldChapters, worldDataDocument } from '../prisma/world.js';
import { calculateWorldEvidence, parseWorldReport, worldReportSchema } from '../src/worldSchema.js';
import { worldReport } from '../prisma/world-data.js';
import { worldReport002 } from '../prisma/world-002-data.js';
import { worldChapters002, worldDataDocument002 } from '../prisma/world-002.js';
import { upgradeWorldEvidence } from '../prisma/upgrade-world-evidence.js';

let directory: string;
let db: PrismaClient;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'world-tests-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
});
after(async () => { await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });

test('world project creates a full issue under system, remains repeatable and preserves edits', async () => {
  const unrelated = await db.content.create({ data: { title: 'User notes', type: 'text', description: 'Keep me' } });
  const result = await seedWorld(db);
  assert.equal(result.created, 18);
  const project = await db.content.findUniqueOrThrow({ where: { id: result.projectId }, include: { parent: true, children: { include: { children: true } } } });
  assert.equal(project.title, '观天下'); assert.equal(project.scene, 'system');
  assert.equal(project.parent?.title, '系统管理');
  const issue = project.children.find((item) => item.id === result.issueId)!;
  assert.equal(issue.children.length, 7);
  assert.deepEqual(parseWorldReport(issue.children.find((item) => item.title === worldDataDocument.title)!.description), worldReport);
  const second = project.children.find((item) => item.id === result.issue002Id)!;
  assert.ok(second.sortOrder > issue.sortOrder);
  assert.equal(second.children.length, 7);
  assert.deepEqual(parseWorldReport(second.children.find((item) => item.title === worldDataDocument002.title)!.description), worldReport002);
  assert.ok(worldChapters002.every((chapter) => second.children.some((item) => item.title === chapter.title && item.description === chapter.description)));
  const doc = issue.children.find((item) => item.title === worldChapters[0].title)!;
  await db.content.update({ where: { id: doc.id }, data: { description: 'Editor changes' } });
  const secondDoc = second.children.find((item) => item.title === worldChapters002[0].title)!;
  await db.content.update({ where: { id: secondDoc.id }, data: { description: 'Updated investigation' } });
  assert.equal((await seedWorld(db)).created, 0);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: doc.id } })).description, 'Editor changes');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: unrelated.id } })).description, 'Keep me');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: secondDoc.id } })).description, 'Updated investigation');
  await db.content.delete({ where: { id: doc.id } });
  assert.equal((await seedWorld(db)).created, 1);
});

test('data validates source references, dates and chart axes while separating estimates', () => {
  assert.ok(worldReportSchema.safeParse(worldReport).success);
  assert.equal(worldReport.lenses.length, 6);
  assert.ok(worldChapters.every((chapter) => chapter.description.length > 850));
  assert.ok(worldReport.metrics.some((metric) => metric.kind === 'observed'));
  assert.ok(worldReport.charts.some((chart) => chart.rows.some((row) => row.kind === 'forecast')));
  assert.equal(worldReport.evidenceReview?.records.find((record) => record.id === 'ai')?.kind, 'statement');
  const broken = structuredClone(worldReport); broken.metrics[0].sourceIds = ['missing'];
  assert.equal(worldReportSchema.safeParse(broken).success, false);
  const axis = structuredClone(worldReport); axis.charts[0].max = 1;
  assert.equal(worldReportSchema.safeParse(axis).success, false);
  const future = structuredClone(worldReport); future.sources[0].published = '2027-01-01';
  assert.equal(worldReportSchema.safeParse(future).success, false);
  assert.equal(parseWorldReport('<!-- WORLD_DATA_V1 -->{broken'), null);
  const futureEvent = structuredClone(worldReport002);
  futureEvent.timeline!.at(-1)!.status = 'confirmed';
  assert.equal(worldReportSchema.safeParse(futureEvent).success, false);
  const brokenTimeline = structuredClone(worldReport002);
  brokenTimeline.timeline![0].sourceIds = ['missing'];
  assert.equal(worldReportSchema.safeParse(brokenTimeline).success, false);
});

test('evidence calculations, dependency references and revised dates remain reproducible', () => {
  for (const report of [worldReport, worldReport002]) {
    const review = report.evidenceReview!;
    assert.ok(review.records.length >= 8); assert.ok(review.claims.length >= 4);
    assert.ok(review.records.every((record) => record.basis && record.origin && record.sourceIds.length));
    assert.ok(review.claims.every((claim) => claim.counter && claim.verify));
    const broken = structuredClone(report);
    broken.evidenceReview!.calculations[0].right = 'missing';
    assert.equal(worldReportSchema.safeParse(broken).success, false);
    const claim = structuredClone(report);
    claim.evidenceReview!.claims[0].recordIds = ['missing'];
    assert.equal(worldReportSchema.safeParse(claim).success, false);
  }
  const first = worldReport.evidenceReview!;
  assert.equal(calculateWorldEvidence(first.calculations[0], first.records).toFixed(1), '1.7');
  const second = worldReport002.evidenceReview!;
  assert.equal(calculateWorldEvidence(second.calculations[0], second.records).toFixed(2), '92.52');
  assert.equal(calculateWorldEvidence(second.calculations[1], second.records).toFixed(2), '105.85');
  assert.equal(calculateWorldEvidence(second.calculations[2], second.records).toFixed(2), '-4.27');
  const zero = structuredClone(worldReport002);
  zero.evidenceReview!.records.find((record) => record.id === 'rev-now')!.value = 0;
  assert.equal(worldReportSchema.safeParse(zero).success, false);
  const period = structuredClone(worldReport);
  period.evidenceReview!.records.find((record) => record.id === 'consumption')!.period = '2025年前三季度';
  assert.equal(worldReportSchema.safeParse(period).success, false);
  assert.equal(worldReport002.metrics.find((metric) => metric.label === '数据中心占总营收')!.kind, 'calculated');
  assert.ok(worldReport002.timeline!.some((event) => event.date === '2026-11-04' && event.sourceIds.includes('HOUSELETTER')));
  assert.ok(worldReport002.timeline!.some((event) => event.date === '2026-01-15' && event.sourceIds.includes('BISRULE')));
});

test('review upgrade previews, preserves manual edits and metadata, and is repeatable', async () => {
  const { issueId, issue002Id } = await seedWorld(db);
  const original = JSON.parse(await readFile(resolve(projectRoot, 'research/world-evidence/baseline-v1.json'), 'utf8')) as {
    rows: { documents: { title: string; description: string }[] }[];
  };
  for (const [index, id] of [issueId, issue002Id].entries()) {
    const nodes = await db.content.findMany({ where: { OR: [{ id }, { parentId: id }] } });
    for (const node of nodes) {
      const baseline = original.rows[index].documents.find((item) => item.title === node.title)!;
      await db.content.update({ where: { id: node.id }, data: { description: baseline.description } });
    }
  }
  const modified = await db.content.findFirstOrThrow({ where: { parentId: issueId, title: worldChapters[0].title } });
  await db.content.update({ where: { id: modified.id }, data: { description: 'User edited policy analysis', sortOrder: 48 } });
  const metadata = await db.content.findFirstOrThrow({ where: { parentId: issueId, title: worldChapters[1].title } });
  await db.content.update({ where: { id: metadata.id }, data: { topics: ['保留标签'], sortOrder: 49 } });
  const preview = await upgradeWorldEvidence(db);
  assert.equal(preview.changes.length, 14);
  assert.equal(preview.conflicts[0].id, modified.id);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: metadata.id } })).description, original.rows[0].documents.find((item) => item.title === metadata.title)!.description);
  await assert.rejects(upgradeWorldEvidence(db, true, () => { throw new Error('Backup write failed'); }), /Backup write failed/);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: metadata.id } })).description, original.rows[0].documents.find((item) => item.title === metadata.title)!.description);
  let backup: { id: number; before: string; after: string }[] = [];
  const applied = await upgradeWorldEvidence(db, true, (changes) => { backup = changes.map((change) => ({ ...change })); });
  assert.equal(applied.changes.length, 14);
  assert.deepEqual(backup, applied.changes);
  const saved = await db.content.findUniqueOrThrow({ where: { id: metadata.id } });
  assert.equal(saved.description, worldChapters[1].description);
  assert.deepEqual(saved.topics, ['保留标签']); assert.equal(saved.sortOrder, 49);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: modified.id } })).description, 'User edited policy analysis');
  assert.equal((await upgradeWorldEvidence(db, true)).changes.length, 0);
});

test('issue text, structured data and local image retain authentication; admins can edit chapters', async () => {
  const config: AppConfig = { secret: 'world-test-secret-at-least-32-characters-long', sitePassword: 'world-site-test', adminPassword: 'world-admin-test', siteHashed: false, adminHashed: false, production: false, origin: 'http://localhost:5173' };
  const app = createApp(db, config); const { issueId } = await seedWorld(db);
  const docs = await db.content.findMany({ where: { parentId: issueId } });
  const chapter = docs.find((item) => item.title === worldChapters[0].title)!;
  await request(app).get(`/api/contents/${chapter.id}`).expect(401);
  await request(app).get('/media/projects/world/earth-night.jpg').expect(401);
  const visitor = request.agent(app);
  await visitor.post('/api/auth/login').send({ password: config.sitePassword }).expect(200);
  await visitor.get(`/api/contents/${chapter.id}`).expect(200);
  await visitor.get('/media/projects/world/earth-night.jpg').expect(200).expect('Content-Type', /image\/jpeg/);
  await visitor.put(`/api/contents/${chapter.id}`).send({ ...chapter, description: 'No' }).expect(403);
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ role: 'admin', password: config.adminPassword }).expect(200);
  await admin.put(`/api/contents/${chapter.id}`).send({ title: chapter.title, type: chapter.type, scene: 'system', topics: ['政策', '宏观分析'], description: '经人工编辑的政策正文', parentId: issueId, sortOrder: 1 }).expect(200);
  const saved = await visitor.get(`/api/contents/${chapter.id}`).expect(200);
  assert.equal(saved.body.description, '经人工编辑的政策正文');
  assert.ok((await stat(resolve(projectRoot, 'backend/media/projects/world/earth-night.jpg'))).size > 10000);
});
