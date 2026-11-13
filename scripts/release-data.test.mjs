import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

test('release rehearsal rolls back and repeated merges preserve online trips while remapping new projects and owners', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vault-release-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    execFileSync(process.execPath, [resolve('backend/prisma/migrate.mjs')], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true });
    const root = await db.content.create({ data: { id: 1, title: 'Root', type: 'folder' } });
    const project = await db.content.create({ data: { id: 2, title: 'Project', type: 'folder', isProject: true, parentId: root.id } });
    await db.content.create({ data: { id: 3, title: 'Online only', type: 'folder', isProject: true } });
    const user = await db.user.create({ data: { username: 'admin', role: 'admin', passwordHash: 'unchanged', mustChangePassword: false } });
    const original = await db.tripPlan.create({ data: { userId: user.id, projectId: project.id, title: 'Existing', destination: 'City', startDate: '2026-11-13', endDate: '2026-11-15', itinerary: [], notes: 'Online edit' } });
    const input = { baseline: { content: [root, project], literaryWriter: [] }, local: {
      content: [root, project, { ...project, id: 3, title: 'New local project' }], literaryWriter: [], config: [],
      tripPlan: [{ ...original, userId: undefined, ownerUsername: 'admin', notes: 'Local edit' },
        { ...original, userId: undefined, projectId: 3, ownerUsername: 'admin', title: 'New trip' }],
    } };
    for (const key of ['researchStudy', 'researchTask', 'researchTaskVersion', 'researchSynthesis', 'researchSynthesisVersion', 'precisionBriefRun', 'precisionBriefTask', 'precisionBriefSource', 'precisionBriefItem']) input.local[key] = [];
    await writeFile(join(directory, 'data.json'), JSON.stringify(input));
    const run = (...args) => execFileSync(process.execPath, [resolve('scripts/apply-release-data.mjs'), directory, ...args], { env: { ...process.env, RELEASE_DATABASE_URL: url }, stdio: 'pipe', windowsHide: true });
    run('--check');
    assert.equal(await db.content.count(), 3);
    assert.equal(await db.tripPlan.count(), 1);
    run(); run();
    assert.equal(await db.tripPlan.count(), 2);
    assert.deepEqual(await db.tripPlan.findUnique({ where: { id: original.id } }), original);
    const imported = await db.tripPlan.findFirstOrThrow({ where: { title: 'New trip' }, include: { project: true } });
    assert.equal(imported.project.title, 'New local project');
    assert.notEqual(imported.projectId, 3);
    assert.equal(imported.userId, user.id);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, 'unchanged');
  } finally { await db.$disconnect(); await rm(directory, { recursive: true, force: true }); }
});
