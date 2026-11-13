import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient, type Prisma } from '@prisma/client';
import request from 'supertest';
import { projectRoot } from '../src/config.js';
import { seedTestUsers, type TestConfig } from './helpers.js';
import { createApp } from '../src/app.js';
import { seedLiterature } from '../prisma/seed-literature.js';
import { seedWriters } from '../prisma/seed-writers.js';
import { writers } from '../prisma/writers/index.js';
import { writerSchema } from '../prisma/writers/schema.js';

let directory: string;
let db: PrismaClient;
let projectId: number;
const config: TestConfig = { adminUsername: 'admin', secret: 'writers-test-secret-at-least-32-characters', sitePassword: 'test-site', adminPassword: 'test-admin', siteHashed: false, adminHashed: false, production: false, origin: 'http://localhost:5173' };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'writer-tests-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  projectId = await seedLiterature(db);
  await seedTestUsers(db, config);
});
after(async () => { await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });

test('100 substantial and uniquely identified profiles have scoped sources and 1–2 topics', () => {
  assert.equal(writers.length, 100);
  assert.equal(new Set(writers.map((writer) => writer.id)).size, 100);
  assert.deepEqual(Object.fromEntries(['CN', 'GR', 'GB', 'FR', 'DE', 'RU', 'JP', 'IT'].map((code) => [code, writers.filter((writer) => writer.country === code).length])), { CN: 30, GR: 10, GB: 15, FR: 12, DE: 8, RU: 10, JP: 8, IT: 7 });
  for (const profile of writers) assert.ok(writerSchema.safeParse(profile).success, profile.id);
  for (const id of ['homer', 'cao-xueqin', 'guan-hanqing', 'murasaki-shikibu', 'sei-shonagon'])
    assert.equal(writers.find((writer) => writer.id === id)?.birthYear, null);
  assert.equal(writers.find((writer) => writer.id === 'mo-yan')?.birthYear, 1956);
});

test('targeted seed is repeatable, retains editorial changes and rejects unrelated projects', async () => {
  assert.deepEqual(await seedWriters(db, projectId), { created: 100, total: 100 });
  const revised = { ...writers[0], summary: '人工修改保留：这是一份需要在重复导入中保持不被覆盖的档案简介。' };
  await db.literaryWriter.update({ where: { id: revised.id }, data: { data: revised as Prisma.InputJsonValue } });
  assert.deepEqual(await seedWriters(db, projectId), { created: 0, total: 100 });
  assert.deepEqual((await db.literaryWriter.findUniqueOrThrow({ where: { id: revised.id } })).data, revised);
  const other = await db.content.create({ data: { title: 'Other', type: 'folder' } });
  await assert.rejects(() => seedWriters(db, other.id), /Not a literature project/);
  const otherLiterature = await db.content.create({ data: { title: 'Other literature', type: 'folder', description: '<!-- LITERATURE_PROJECT -->' } });
  await assert.rejects(() => seedWriters(db, otherLiterature.id), /belongs to another project/);
  assert.equal(await db.literaryWriter.count({ where: { projectId: otherLiterature.id } }), 0);
});

test('writer API requires a session, scopes by project and returns complete profiles', async () => {
  const app = createApp(db, config);
  await request(app).get(`/api/literature/${projectId}/writers`).expect(401);
  const visitor = request.agent(app);
  await visitor.post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(200);
  const response = await visitor.get(`/api/literature/${projectId}/writers`).expect(200).expect('Cache-Control', 'no-store');
  assert.equal(response.body.length, 100);
  for (const profile of response.body) assert.ok(writerSchema.safeParse(profile).success);
  const unrelated = await db.content.create({ data: { title: 'Private unrelated', type: 'folder' } });
  await visitor.get(`/api/literature/${unrelated.id}/writers`).expect(404);
  await visitor.get('/api/literature/99999999/writers').expect(404);
  await visitor.get('/api/literature/invalid/writers').expect(400);
});

test('admin cannot accidentally delete a populated writer collection', async () => {
  const app = createApp(db, config);
  const visitor = request.agent(app);
  await visitor.post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(200);
  await visitor.delete(`/api/contents/${projectId}`).send({}).expect(403);
  const admin = request.agent(app);
  await admin.post('/api/auth/login').send({ username: 'admin', password: config.adminPassword }).expect(200);
  await db.content.deleteMany({ where: { parentId: projectId } });
  const blocked = await admin.delete(`/api/contents/${projectId}`).send({}).expect(409);
  assert.equal(blocked.body.error.code, 'HAS_WRITERS');
  assert.equal(await db.literaryWriter.count({ where: { projectId } }), 100);
});
