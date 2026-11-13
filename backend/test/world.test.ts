import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { projectRoot } from '../src/config.js';
import { seedTestUsers, type TestConfig } from './helpers.js';
import { createApp } from '../src/app.js';
import { seedWorld } from '../prisma/seed-world.js';
import { worldChapters, worldDataDocument } from '../prisma/world.js';
import { calculateWorldEvidence, parseWorldReport, worldReportSchema } from '../src/worldSchema.js';
import { worldReport } from '../prisma/world-data.js';
import { worldReport002 } from '../prisma/world-002-data.js';
import { worldReport003 } from '../prisma/world-003-data.js';
import { worldChapters003, worldDataDocument003 } from '../prisma/world-003.js';
import { worldChapters002, worldDataDocument002 } from '../prisma/world-002.js';
import { upgradeWorldEvidence } from '../prisma/upgrade-world-evidence.js';
import { seedLivelihood } from '../prisma/seed-livelihood.js';
import { livelihoodDocuments } from '../prisma/livelihood.js';
import { livelihoodDataDocument001, livelihoodChapters001 } from '../prisma/livelihood-001.js';
import { livelihoodReport001 } from '../prisma/livelihood-001-data.js';
import { livelihoodDataMarker, livelihoodReportSchema, parseLivelihoodReport } from '../src/livelihoodSchema.js';
import { readableContents } from '../src/permissions.js';

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

test('livelihood is an independent repeatable project, preserves edits and requires its own grant', async () => {
  const first = await seedLivelihood(db);
  assert.equal(first.created, 10);
  const project = await db.content.findUniqueOrThrow({ where: { id: first.projectId }, include: { parent: true, children: true } });
  assert.equal(project.title, '碌碌无为');
  assert.equal(project.isProject, true);
  assert.equal(project.parent?.isProject, false);
  assert.equal(project.parent?.title, '系统管理');
  assert.equal(project.children.length, 4);
  assert.equal(project.children.filter((row) => row.type === 'text').length, 3);
  const issue = await db.content.findUniqueOrThrow({ where: { id: first.issue001Id }, include: { children: true } });
  assert.equal(issue.isProject, false);
  assert.equal(issue.children.length, 5);
  assert.deepEqual(parseLivelihoodReport(issue.children.find((row) => row.title === livelihoodDataDocument001.title)!.description), livelihoodReport001);
  const chapter = issue.children.find((row) => row.title === livelihoodChapters001[0].title)!;
  await db.content.update({ where: { id: chapter.id }, data: { description: '人工编辑首期正文', sortOrder: 30 } });
  assert.ok(livelihoodDocuments.every((document) => document.topics.length === 2));
  const document = project.children[0];
  await db.content.update({ where: { id: document.id }, data: { description: '人工编辑的栏目说明', sortOrder: 40 } });
  assert.equal((await seedLivelihood(db)).created, 0);
  const saved = await db.content.findUniqueOrThrow({ where: { id: document.id } });
  assert.equal(saved.description, '人工编辑的栏目说明');
  assert.equal(saved.sortOrder, 40);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: chapter.id } })).description, '人工编辑首期正文');
  const reader = await db.user.create({ data: { username: 'livelihood-isolated-reader', passwordHash: 'not-used-for-login' } });
  assert.ok(!(await readableContents(db, reader)).some((row) => row.id === project.id));
  await db.projectAccess.create({ data: { userId: reader.id, projectId: project.id } });
  const allowed = await readableContents(db, reader);
  assert.ok(allowed.some((row) => row.id === project.id));
  assert.ok(allowed.some((row) => row.id === document.id));
  assert.ok(allowed.some((row) => row.id === issue.id));
  assert.ok(allowed.some((row) => row.id === chapter.id));
  assert.ok(!allowed.some((row) => row.isProject && row.id !== project.id));
});

test('livelihood seed rolls back missing-document inserts on issue data conflicts', async () => {
  const seeded = await seedLivelihood(db);
  const column = await db.content.findFirstOrThrow({ where: { parentId: seeded.projectId, type: 'text' } });
  const record = await db.content.findFirstOrThrow({ where: { parentId: seeded.issue001Id, title: livelihoodDataDocument001.title } });
  await db.content.delete({ where: { id: column.id } });
  try {
    for (const conflict of [{ type: 'folder', description: record.description }, { type: 'text', description: 'unmarked manual data' }]) {
      await db.content.update({ where: { id: record.id }, data: conflict });
      const before = await db.content.count();
      await assert.rejects(seedLivelihood(db), /Content type or data marker conflict/);
      assert.equal(await db.content.count(), before);
      assert.equal(await db.content.count({ where: { title: column.title, parentId: seeded.projectId } }), 0);
    }
  } finally {
    await db.content.update({ where: { id: record.id }, data: { type: record.type, description: record.description } });
    await db.content.create({ data: {
      ...column,
      topics: column.topics ?? Prisma.DbNull,
      imagesJson: column.imagesJson ?? Prisma.DbNull,
      assetsJson: column.assetsJson ?? Prisma.DbNull,
    } });
  }
});

test('livelihood report rejects broken references, incomplete layers and ambiguous source identities', () => {
  assert.ok(livelihoodReportSchema.safeParse(livelihoodReport001).success);
  assert.ok(livelihoodReport001.sources.length >= 12);
  for (const section of livelihoodReport001.sections) assert.ok(section.body.length >= 650);
  const brokenReference = structuredClone(livelihoodReport001);
  brokenReference.pathways[0].sourceIds = ['missing-source'];
  assert.equal(livelihoodReportSchema.safeParse(brokenReference).success, false);
  const duplicateSource = structuredClone(livelihoodReport001);
  duplicateSource.sources.push(duplicateSource.sources[0]);
  assert.equal(livelihoodReportSchema.safeParse(duplicateSource).success, false);
  const futureSource = structuredClone(livelihoodReport001);
  futureSource.sources[0].published = '2099-01-01';
  assert.equal(livelihoodReportSchema.safeParse(futureSource).success, false);
  const repeatedLayer = structuredClone(livelihoodReport001);
  repeatedLayer.sections[3].id = repeatedLayer.sections[0].id;
  assert.equal(livelihoodReportSchema.safeParse(repeatedLayer).success, false);
  assert.equal(parseLivelihoodReport(livelihoodDataMarker + '{invalid'), null);
  assert.equal(parseLivelihoodReport(JSON.stringify(livelihoodReport001)), null);
  const impossibleDate = structuredClone(livelihoodReport001);
  impossibleDate.asOf = '2026-99-99';
  assert.equal(livelihoodReportSchema.safeParse(impossibleDate).success, false);
  impossibleDate.asOf = '2026-02-29';
  assert.equal(livelihoodReportSchema.safeParse(impossibleDate).success, false);
  const unknownMarker = structuredClone(livelihoodReport001);
  unknownMarker.sections[0].body += '\n[DOES_NOT_EXIST]';
  assert.equal(livelihoodReportSchema.safeParse(unknownMarker).success, false);
  const unknownContact = structuredClone(livelihoodReport001);
  unknownContact.pathways[0].contactIds = ['missing-contact'];
  assert.equal(livelihoodReportSchema.safeParse(unknownContact).success, false);
});

test('world project creates a full issue under system, remains repeatable and preserves edits', async () => {
  const unrelated = await db.content.create({ data: { title: 'User notes', type: 'text', description: 'Keep me' } });
  const result = await seedWorld(db);
  assert.equal(result.created, 26);
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
  const third = project.children.find((item) => item.id === result.issue003Id)!;
  assert.ok(third.sortOrder > second.sortOrder);
  assert.equal(third.children.length, 7);
  assert.deepEqual(parseWorldReport(third.children.find((item) => item.title === worldDataDocument003.title)!.description), worldReport003);
  const thirdDoc = third.children.find((item) => item.title === worldChapters003[0].title)!;
  await db.content.update({ where: { id: thirdDoc.id }, data: { description: 'Manual third issue edits' } });
  const doc = issue.children.find((item) => item.title === worldChapters[0].title)!;
  await db.content.update({ where: { id: doc.id }, data: { description: 'Editor changes' } });
  const secondDoc = second.children.find((item) => item.title === worldChapters002[0].title)!;
  await db.content.update({ where: { id: secondDoc.id }, data: { description: 'Updated investigation' } });
  assert.equal((await seedWorld(db)).created, 0);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: doc.id } })).description, 'Editor changes');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: unrelated.id } })).description, 'Keep me');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: secondDoc.id } })).description, 'Updated investigation');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: thirdDoc.id } })).description, 'Manual third issue edits');
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

test('response layer is optional and rejects unknown sources, duplicate IDs and non-actionable entries', () => {
  const response = { id: 'verify', title: '独立核验', actor: '审核负责人', objective: '降低冒充风险', trigger: '高风险转账',
    actions: ['已知号码回拨', '双人授权'], limitation: '账号可能同时被控', metric: '核验覆盖率', sourceIds: ['NBS26'] };
  assert.ok(worldReportSchema.safeParse({ ...worldReport, responses: [response] }).success);
  assert.equal(worldReportSchema.safeParse({ ...worldReport, responses: [{ ...response, sourceIds: ['unknown'] }] }).success, false);
  assert.equal(worldReportSchema.safeParse({ ...worldReport, responses: [response, response] }).success, false);
  assert.equal(worldReportSchema.safeParse({ ...worldReport, responses: [{ ...response, actions: ['只需小心'] }] }).success, false);
});

test('third issue keeps measurable responses and does not confuse AI attribution with reported fraud', () => {
  const review = worldReport003.evidenceReview!;
  assert.ok(worldReport003.sources.length >= 10);
  assert.ok(review.records.length >= 12);
  assert.ok(review.claims.length >= 5);
  assert.equal(worldReport003.responses?.length, 6);
  assert.equal(calculateWorldEvidence(review.calculations[0], review.records).toFixed(2), '40.74');
  assert.equal(calculateWorldEvidence(review.calculations[1], review.records).toFixed(2), '456.67');
  assert.match(worldReport003.boundary, /非AI归因/);
  assert.ok(worldReport003.responses!.every((response) => response.actions.length >= 2 && response.metric && response.limitation));
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
  const config: TestConfig = { adminUsername: 'admin', secret: 'world-test-secret-at-least-32-characters-long', sitePassword: 'world-site-test', adminPassword: 'world-admin-test', siteHashed: false, adminHashed: false, production: false, origin: 'http://localhost:5173' };
  const app = createApp(db, config); const { issueId } = await seedWorld(db);
  await seedTestUsers(db, config);
  const docs = await db.content.findMany({ where: { parentId: issueId } });
  const chapter = docs.find((item) => item.title === worldChapters[0].title)!;
  await request(app).get(`/api/contents/${chapter.id}`).expect(401);
  await request(app).get('/media/projects/world/earth-night.jpg').expect(401);
  const visitor = request.agent(app);
  await visitor.post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(200);
  await visitor.get(`/api/contents/${chapter.id}`).expect(200);
  await visitor.get('/media/projects/world/earth-night.jpg').expect(200).expect('Content-Type', /image\/jpeg/);
  await visitor.put(`/api/contents/${chapter.id}`).send({ ...chapter, description: 'No' }).expect(403);
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: config.adminPassword }).expect(200);
  await admin.put(`/api/contents/${chapter.id}`).send({ title: chapter.title, type: chapter.type, scene: 'system', topics: ['政策', '宏观分析'], description: '经人工编辑的政策正文', parentId: issueId, sortOrder: 1 }).expect(200);
  const saved = await visitor.get(`/api/contents/${chapter.id}`).expect(200);
  assert.equal(saved.body.description, '经人工编辑的政策正文');
  assert.ok((await stat(resolve(projectRoot, 'backend/media/projects/world/earth-night.jpg'))).size > 10000);
});
