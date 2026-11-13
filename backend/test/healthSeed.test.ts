import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { seedHealth, healthDocuments } from '../prisma/health.js';
import { healthProjectMarker, healthProjectTitle } from '../src/healthSchema.js';
import { projectRoot } from '../src/config.js';

let db: PrismaClient;
let directory: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vaultview-health-seed-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
});

after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('health seed creates one life project and nine ordered guides without private health data', async () => {
  const result = await seedHealth(db);
  assert.equal(result.created, healthDocuments.length + 2);
  const project = await db.content.findUniqueOrThrow({ where: { id: result.projectId }, include: { parent: true, children: { orderBy: { sortOrder: 'asc' } } } });
  assert.equal(project.title, healthProjectTitle);
  assert.equal(project.isProject, true);
  assert.equal(project.scene, 'life');
  assert.ok(project.description.includes(healthProjectMarker));
  assert.equal(project.parent?.title, '生活场景');
  assert.equal(project.parent?.parentId, null);
  assert.deepEqual(project.topics, ['长期性', 'health', 'family']);
  assert.deepEqual(project.children.map(row => row.title), healthDocuments.map(guide => guide.title));
  assert.ok(project.children.every(row => row.type === 'text' && !row.isProject));
  assert.equal(await db.projectAccess.count(), 0);
  assert.ok(healthDocuments.every(guide => guide.body.includes('2026-11-12')));
});

test('health seed is repeatable and preserves edited text, title and marker-free guides', async () => {
  const first = await seedHealth(db);
  const guides = await db.content.findMany({ where: { parentId: first.projectId }, orderBy: { sortOrder: 'asc' } });
  await db.content.update({ where: { id: guides[0].id }, data: { description: '<!-- FAMILY_HEALTH_DOC:start -->\n\n本人整理的启用方式', title: '已编辑启用方式' } });
  await db.content.update({ where: { id: guides[1].id }, data: { description: '保留移除标记后的正文' } });
  const second = await seedHealth(db);
  assert.equal(second.created, 0);
  assert.equal(second.projectId, first.projectId);
  assert.equal(await db.content.count({ where: { parentId: first.projectId } }), healthDocuments.length);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: guides[0].id } })).title, '已编辑启用方式');
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: guides[1].id } })).description, '保留移除标记后的正文');
});

test('conflicting health guide type is rejected without overwriting content', async () => {
  const result = await seedHealth(db);
  const guide = await db.content.findFirstOrThrow({ where: { parentId: result.projectId, title: healthDocuments[2].title } });
  await db.content.update({ where: { id: guide.id }, data: { type: 'folder' } });
  await assert.rejects(seedHealth(db), /guide type conflict/);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: guide.id } })).type, 'folder');
  await db.content.update({ where: { id: guide.id }, data: { type: 'text' } });
});

test('duplicate project markers are rejected without merging unrelated projects', async () => {
  const result = await seedHealth(db);
  const clone = await db.content.create({ data: { title: 'Unrelated content', type: 'text', description: healthProjectMarker } });
  await assert.rejects(seedHealth(db), /marker is duplicated/);
  assert.equal(await db.content.count({ where: { parentId: result.projectId } }), healthDocuments.length);
  await db.content.delete({ where: { id: clone.id } });
});
