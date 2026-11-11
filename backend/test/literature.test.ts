import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { projectRoot, type AppConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { seedLiterature } from '../prisma/seed-literature.js';
import { literatureSources } from '../prisma/literature-sources.js';

let directory: string;
let db: PrismaClient;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'literature-tests-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  await db.$connect();
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('targeted initialization creates the literature space, preserves user edits and is repeatable', async () => {
  const unrelated = await db.content.create({ data: { title: 'Existing user project', type: 'folder', description: 'Keep this' } });
  const id = await seedLiterature(db);
  const project = await db.content.findUniqueOrThrow({ where: { id }, include: { children: true, parent: true } });
  assert.equal(project.parent?.title, '兴趣爱好');
  assert.equal(project.children.length, 7);
  assert.match(project.description, /<!-- LITERATURE_PROJECT -->/);
  assert.equal(project.children.filter((child) => child.fileUrl?.endsWith('.docx')).length, 2);
  assert.ok(project.children.every((child) => child.scene === 'hobbies'));
  assert.ok(project.children.every((child) => Array.isArray(child.topics) && child.topics.length <= 2));
  const edited = project.children[0];
  await db.content.update({ where: { id: edited.id }, data: { description: 'Editor revision' } });
  const count = await db.content.count();
  await db.content.update({ where: { id }, data: { topics: ['阶段性', 'literature', 'writers'] } });
  assert.equal(await seedLiterature(db), id);
  assert.deepEqual((await db.content.findUniqueOrThrow({ where: { id } })).topics, ['阶段性', 'literature', 'writers']);
  assert.equal(await db.content.count(), count);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: edited.id } })).description, 'Editor revision');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: unrelated.id } })).description, 'Keep this');
});

test('source archives retain substantial text and tables with authenticated original downloads', async () => {
  const config: AppConfig = { secret: 'literature-tests-long-secret-at-least-32-characters', sitePassword: 'test-site', adminPassword: 'test-admin', siteHashed: false, adminHashed: false, production: false, origin: 'http://localhost:5173' };
  const app = createApp(db, config);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ password: config.sitePassword }).expect(200);
  for (const source of literatureSources) {
    assert.ok(source.markdown.length > 2000);
    assert.match(source.markdown, /\| ---/);
    assert.match(source.markdown, /已知/);
    await request(app).get(source.fileUrl).expect(401);
    await agent.get(source.fileUrl).expect(200).expect('Content-Type', /wordprocessingml/);
    const file = await stat(resolve(projectRoot, 'backend', source.fileUrl.slice(1)));
    assert.ok(file.size > 10000);
  }
});
