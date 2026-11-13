import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { bootstrapAdmin, bootstrapShare } from '../src/auth.js';
import { projectRoot } from '../src/config.js';
import { seedTestUsers, type TestConfig } from './helpers.js';

const config: TestConfig = { adminUsername: 'admin', secret: 'account-tests-secret-at-least-32-characters',
  adminPassword: 'admin-password-for-tests', sitePassword: 'visitor-password-for-tests',
  adminHashed: false, siteHashed: false, production: false, origin: 'http://localhost:5173' };
let db: PrismaClient;
let directory: string;
let mediaDirectory: string;
let mediaUrl: string;
let app: ReturnType<typeof createApp>;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vaultview-accounts-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  await mkdir(resolve(projectRoot, 'backend/media/demo'), { recursive: true });
  mediaDirectory = await mkdtemp(resolve(projectRoot, 'backend/media/demo/access-'));
  mediaUrl = `/media/demo/${basename(mediaDirectory)}`;
  for (const name of ['a.mp4', 'b.mp4', 'shared.png', 'unowned.png', 'key.bin', 'chunk.ts', '资料.md'])
    await writeFile(join(mediaDirectory, name), name === '资料.md' ? `[Shared](${mediaUrl}/shared.png)` : '0123456789ABCDEF');
  await writeFile(join(mediaDirectory, 'index.m3u8'), '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4,\nchunk.ts\n#EXT-X-ENDLIST\n');
  await writeFile(join(mediaDirectory, 'research.json'), JSON.stringify({ nested: { document: `${mediaUrl}/资料.md` } }));
});
beforeEach(async () => {
  await db.accessLog.deleteMany(); await db.user.deleteMany(); await db.config.deleteMany();
  await db.literaryWriter.deleteMany();
  await db.content.updateMany({ data: { parentId: null } }); await db.content.deleteMany();
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
  if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true });
});
async function login(username = 'admin', password = config.adminPassword!) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password }).expect(200);
  return agent;
}
async function grant(username: string, projectId: number) {
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  await db.projectAccess.create({ data: { userId: user.id, projectId } });
}
async function projects() {
  const root = await db.content.create({ data: { title: 'Scene', type: 'folder', description: 'PRIVATE ROOT', fileUrl: `${mediaUrl}/unowned.png` } });
  const a = await db.content.create({ data: { title: 'A', type: 'folder', isProject: true, parentId: root.id,
    description: '<!-- LITERATURE_PROJECT -->', topics: ['长期性', 'AI', 'work'] } });
  const b = await db.content.create({ data: { title: 'B', type: 'folder', isProject: true, parentId: root.id, topics: ['阶段性', 'health', 'science'] } });
  const docA = await db.content.create({ data: { title: 'A video', type: 'video', parentId: a.id, fileUrl: `${mediaUrl}/a.mp4`,
    hlsUrl: `${mediaUrl}/index.m3u8`, assetsJson: [`${mediaUrl}/research.json`] } });
  const docB = await db.content.create({ data: { title: 'B video', type: 'video', parentId: b.id, fileUrl: `${mediaUrl}/b.mp4`, coverUrl: `${mediaUrl}/shared.png` } });
  await db.literaryWriter.create({ data: { id: 'writer', projectId: a.id, data: { image: `${mediaUrl}/shared.png` } } });
  await grant('visitor', a.id);
  const passwordHash = await bcrypt.hash(config.sitePassword, 4);
  await db.user.create({ data: { username: 'visitor2', passwordHash, mustChangePassword: false } });
  await grant('visitor2', b.id);
  return { root, a, b, docA, docB };
}

test('bootstrap is one-time, requires first password change, preserves content and ignores later env changes', async () => {
  await db.user.deleteMany();
  const row = await db.content.create({ data: { title: 'Keep', type: 'text' } });
  await bootstrapAdmin(db, config);
  const initial = await db.user.findUniqueOrThrow({ where: { username: 'admin' } });
  assert.ok(initial.mustChangePassword);
  await bootstrapAdmin(db, { ...config, adminUsername: 'other', adminPassword: 'a-different-admin-password' });
  assert.equal(await db.user.count(), 1);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: initial.id } })).passwordHash, initial.passwordHash);
  const admin = await login();
  assert.equal((await admin.get('/api/auth/me').expect(200)).body.user.mustChangePassword, true);
  await admin.get('/api/contents').expect(403);
  await admin.get(`${mediaUrl}/a.mp4`).expect(403);
  await admin.post('/api/auth/change-password').send({ oldPassword: 'wrong', newPassword: 'new-private-password' }).expect(400);
  await admin.post('/api/auth/change-password').send({ oldPassword: config.adminPassword, newPassword: config.adminPassword }).expect(400);
  await admin.post('/api/auth/change-password').send({ oldPassword: config.adminPassword, newPassword: 'new-private-password' }).expect(200);
  await admin.get('/api/auth/me').expect(401);
  const changed = await login('admin', 'new-private-password');
  assert.equal((await changed.get('/api/auth/me').expect(200)).body.user.mustChangePassword, false);
  await changed.get(`/api/contents/${row.id}`).expect(200);
});

test('share bootstrap creates a read-only account with only configured project grants', async () => {
  const root = await db.content.create({ data: { title: 'Share root', type: 'folder' } });
  const allowed = await db.content.create({ data: { title: 'Allowed', type: 'folder', isProject: true, parentId: root.id, topics: ['长期性', 'family', 'life'] } });
  const hidden = await db.content.create({ data: { title: 'Hidden', type: 'folder', isProject: true, parentId: root.id, topics: ['阶段性', 'work', 'tools'] } });
  await db.content.create({ data: { title: 'Visible note', type: 'text', parentId: allowed.id, description: 'visible' } });
  await db.content.create({ data: { title: 'Hidden note', type: 'text', parentId: hidden.id, description: 'hidden' } });
  await bootstrapShare(db, { ...config, shareUsername: 'user', sharePassword: '123456', shareHashed: false, shareProjectSelectors: [String(allowed.id)] });
  await bootstrapShare(db, { ...config, shareUsername: 'user', sharePassword: 'different', shareHashed: false, shareProjectSelectors: [String(hidden.id)] });
  const share = await db.user.findUniqueOrThrow({ where: { username: 'user' } });
  assert.equal(share.role, 'share');
  assert.deepEqual((await db.projectAccess.findMany({ where: { userId: share.id } })).map(row => row.projectId), [allowed.id]);
  const agent = await login('user', '123456');
  const tree = (await agent.get('/api/contents').expect(200)).body;
  assert.ok(JSON.stringify(tree).includes('Allowed'));
  assert.equal(JSON.stringify(tree).includes('Hidden'), false);
  await agent.post('/api/contents').send({ title: 'Denied', type: 'text', parentId: allowed.id }).expect(403);
  await agent.post('/api/auth/change-password').send({ oldPassword: '123456', newPassword: 'new-share-password' }).expect(403);
  await agent.post('/api/log').send({ contentId: allowed.id, action: 'view_text' }).expect(201);
  const admin = await login();
  await admin.put(`/api/admin/users/${share.id}/projects`).send({ projectIds: [allowed.id], researchEditorProjectIds: [allowed.id] }).expect(400);
  await admin.put(`/api/admin/users/${share.id}/projects`).send({ projectIds: [] }).expect(200);
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(allowed.id)] });
  assert.equal(await db.projectAccess.count({ where: { userId: share.id } }), 0);
  await admin.post(`/api/admin/users/${share.id}/reset-password`).send({ password: '654321' }).expect(200);
  await agent.get('/api/auth/me').expect(401);
  const reset = await login('user', '654321');
  assert.equal((await reset.get('/api/auth/me').expect(200)).body.user.mustChangePassword, false);
});

test('legacy JWTs, expired database sessions, role selection and password-only login are rejected', async () => {
  const token = jwt.sign({ role: 'admin', version: 'legacy' }, config.secret,
    { issuer: 'yaocang', audience: 'yaocang-web', expiresIn: '30d' });
  await request(app).get('/api/contents').set('Cookie', `yaocang_session=${token}`).expect(401);
  await request(app).post('/api/auth/login').send({ password: config.adminPassword }).expect(400);
  await request(app).post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword, role: 'admin' }).expect(400);
  const admin = await login();
  await db.authSession.updateMany({ data: { expiresAt: new Date(0) } });
  await admin.get('/api/auth/me').expect(401);
});

test('users get only their own project, sanitized ancestors, scoped writers and attributed access logs', async () => {
  const { root, a, b, docA, docB } = await projects();
  const one = await login('visitor', config.sitePassword);
  const two = await login('visitor2', config.sitePassword);
  const tree = (await one.get('/api/contents').expect(200)).body;
  assert.equal(tree[0].id, root.id);
  assert.equal(tree[0].description, ''); assert.equal(tree[0].fileUrl, null);
  assert.equal(tree[0].navigationOnly, true);
  assert.deepEqual(tree[0].children.map((row: { id: number }) => row.id), [a.id]);
  await one.get(`/api/contents/${root.id}`).expect(404);
  await one.get(`/api/contents/${docB.id}`).expect(404);
  await two.get(`/api/contents/${docA.id}`).expect(404);
  await two.get(`/api/contents/${docB.id}`).expect(200);
  await one.get(`/api/literature/${a.id}/writers`).expect(200);
  await two.get(`/api/literature/${a.id}/writers`).expect(404);
  await one.post('/api/log').send({ contentId: docB.id, action: 'download' }).expect(404);
  await one.post('/api/log').send({ contentId: docA.id, action: 'download' }).expect(201);
  assert.equal((await db.accessLog.findFirstOrThrow({ where: { contentId: docA.id } })).userId,
    (await db.user.findUniqueOrThrow({ where: { username: 'visitor' } })).id);
  const admin = await login(); await admin.get(`/api/contents/${b.id}`).expect(200);
});

test('media enforces exact-file ownership, JSON and Unicode Markdown dependencies, shared assets, HLS and Range', async () => {
  await projects();
  const one = await login('visitor', config.sitePassword);
  const two = await login('visitor2', config.sitePassword);
  await one.get(`${mediaUrl}/a.mp4`).set('Range', 'bytes=0-3').expect(206).expect('Content-Range', 'bytes 0-3/16');
  await one.head(`${mediaUrl}/a.mp4`).expect(200);
  await one.get(`${mediaUrl}/b.mp4`).expect(404);
  await two.get(`${mediaUrl}/a.mp4`).expect(404);
  for (const filename of ['research.json', '资料.md', 'shared.png', 'index.m3u8', 'key.bin', 'chunk.ts'])
    await one.get(`${mediaUrl}/${encodeURIComponent(filename)}`).expect(200);
  await two.get(`${mediaUrl}/shared.png`).expect(200);
  await two.get(`${mediaUrl}/chunk.ts`).expect(404);
  await one.get(`${mediaUrl}/unowned.png`).expect(404);
  await one.get(`${mediaUrl}/%252e%252e/unowned.png`).expect(404);
  await one.get(`${mediaUrl}/%5c..%5cunowned.png`).expect(404);
  await one.get(`${mediaUrl}/.hidden`).expect(404);
  const admin = await login(); await admin.get(`${mediaUrl}/unowned.png`).expect(200);
});

test('grant replacement and removal take effect for existing sessions and direct URLs immediately', async () => {
  const { a, b, docA, docB } = await projects();
  const one = await login('visitor', config.sitePassword);
  const admin = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await admin.put(`/api/admin/users/${user.id}/projects`).send({ projectIds: [b.id, b.id] }).expect(200);
  await one.get(`/api/contents/${docA.id}`).expect(404);
  await one.get(`${mediaUrl}/a.mp4`).expect(404);
  await one.get(`/api/contents/${docB.id}`).expect(200);
  await admin.put(`/api/admin/users/${user.id}/projects`).send({ projectIds: [docA.id] }).expect(400);
  assert.deepEqual((await admin.get(`/api/admin/users/${user.id}/projects`).expect(200)).body.projectIds, [b.id]);
  await admin.put(`/api/admin/users/${user.id}/projects`).send({ projectIds: [] }).expect(200);
  assert.deepEqual((await one.get('/api/contents').expect(200)).body, []);
  await one.get(`/api/contents/${a.id}`).expect(404);
});

test('moving and renaming content changes ownership, rejects nested projects, and preserves explicit project identity', async () => {
  const { a, b, docA } = await projects();
  const admin = await login(); const one = await login('visitor', config.sitePassword);
  const two = await login('visitor2', config.sitePassword);
  await admin.put(`/api/contents/${a.id}`).send({ title: 'Renamed research', type: 'folder', isProject: true,
    topics: a.topics, parentId: a.parentId, description: a.description }).expect(200);
  await one.get(`/api/contents/${a.id}`).expect(200);
  await admin.put(`/api/contents/${a.id}`).send({ title: 'Renamed research', type: 'folder', isProject: true,
    topics: a.topics, parentId: b.id }).expect(400);
  await admin.put(`/api/contents/${docA.id}`).send({ title: docA.title, type: 'video', fileUrl: docA.fileUrl, parentId: b.id }).expect(200);
  await one.get(`/api/contents/${docA.id}`).expect(404); await one.get(`${mediaUrl}/a.mp4`).expect(404);
  await two.get(`/api/contents/${docA.id}`).expect(200); await two.get(`${mediaUrl}/a.mp4`).expect(200);
  await admin.put(`/api/contents/${docA.id}`).send({ title: docA.title, type: 'video', fileUrl: docA.fileUrl }).expect(200);
  await two.get(`/api/contents/${docA.id}`).expect(404);
});

test('admin user management protects hashes, validates passwords and restricts management to administrators', async () => {
  const admin = await login(); const visitor = await login('visitor', config.sitePassword);
  for (const path of ['/api/admin/users', '/api/admin/projects']) await visitor.get(path).expect(403);
  const response = await admin.post('/api/admin/users').send({ username: 'Reader.New', password: 'temporary-password-123' }).expect(201);
  assert.equal(response.body.username, 'reader.new'); assert.equal(response.body.mustChangePassword, true);
  assert.equal(response.body.passwordHash, undefined);
  await admin.post('/api/admin/users').send({ username: 'READER.NEW', password: 'temporary-password-123' }).expect(409);
  for (const password of ['short', '中'.repeat(25)])
    await admin.post('/api/admin/users').send({ username: 'invalid', password }).expect(400);
  await admin.post('/api/admin/users').send({ username: 'invalid', password: 'temporary-password-123', role: 'owner' }).expect(400);
  assert.ok((await admin.get('/api/admin/users').expect(200)).body.every((row: object) => !('passwordHash' in row)));
  const fresh = await login('reader.new', 'temporary-password-123');
  await fresh.get('/api/contents').expect(403);
});

test('logout revokes only current session while password change revokes every session', async () => {
  const one = await login('visitor', config.sitePassword); const two = await login('visitor', config.sitePassword);
  const sessions = await db.authSession.findMany(); assert.equal(sessions.length, 2);
  await one.post('/api/auth/logout').send({}).expect(200);
  await one.get('/api/auth/me').expect(401); await two.get('/api/auth/me').expect(200);
  const three = await login('visitor', config.sitePassword);
  await two.post('/api/auth/change-password').send({ oldPassword: config.sitePassword, newPassword: 'new-visitor-password' }).expect(200);
  await two.get('/api/auth/me').expect(401); await three.get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(401);
  await login('visitor', 'new-visitor-password');
});

test('reset, disable, rename and role changes revoke sessions; final enabled admin cannot be removed', async () => {
  const admin = await login(); const visitor = await login('visitor', config.sitePassword);
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  const owner = await db.user.findUniqueOrThrow({ where: { username: 'admin' } });
  for (const patch of [{ enabled: false }, { role: 'visitor' }])
    await admin.patch(`/api/admin/users/${owner.id}`).send(patch).expect(409);
  await admin.post(`/api/admin/users/${owner.id}/reset-password`).send({ password: 'new-admin-password' }).expect(400);
  await admin.post(`/api/admin/users/${user.id}/reset-password`).send({ password: 'reset-visitor-password' }).expect(200);
  await visitor.get('/api/auth/me').expect(401);
  const reset = await login('visitor', 'reset-visitor-password');
  await reset.get('/api/contents').expect(403);
  await reset.post('/api/auth/change-password').send({ oldPassword: 'reset-visitor-password', newPassword: 'changed-visitor-password' }).expect(200);
  const active = await login('visitor', 'changed-visitor-password');
  await admin.patch(`/api/admin/users/${user.id}`).send({ enabled: false }).expect(200);
  await active.get('/api/auth/me').expect(401);
  await request(app).post('/api/auth/login').send({ username: 'visitor', password: 'changed-visitor-password' }).expect(401);
  await admin.patch(`/api/admin/users/${user.id}`).send({ enabled: true, role: 'admin' }).expect(200);
  const promoted = await login('visitor', 'changed-visitor-password');
  await promoted.get('/api/admin/users').expect(200);
  await admin.patch(`/api/admin/users/${user.id}`).send({ username: 'newadmin' }).expect(200);
  await promoted.get('/api/auth/me').expect(401);
  const renamed = await login('newadmin', 'changed-visitor-password');
  await admin.patch(`/api/admin/users/${owner.id}`).send({ role: 'visitor' }).expect(200);
  await admin.get('/api/admin/users').expect(401);
  await renamed.patch(`/api/admin/users/${user.id}`).send({ enabled: false }).expect(409);
});

test('project deletion cascades grants without deleting users', async () => {
  const empty = await db.content.create({ data: { title: 'Empty project', type: 'folder', isProject: true } });
  await grant('visitor', empty.id);
  const admin = await login(); await admin.delete(`/api/contents/${empty.id}`).send({}).expect(204);
  assert.equal(await db.projectAccess.count(), 0); assert.equal(await db.user.count(), 2);
});

test('concurrent administrator changes cannot disable every enabled administrator', async () => {
  const admin = await login();
  const second = (await admin.post('/api/admin/users').send({ username: 'secondadmin', role: 'admin', password: 'second-admin-password' }).expect(201)).body;
  const first = await db.user.findUniqueOrThrow({ where: { username: 'admin' } });
  const responses = await Promise.all([
    admin.patch(`/api/admin/users/${first.id}`).send({ enabled: false }),
    admin.patch(`/api/admin/users/${second.id}`).send({ enabled: false }),
  ]);
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.ok(responses.every(response => [200, 401, 409].includes(response.status)));
  assert.equal(await db.user.count({ where: { enabled: true, role: 'admin' } }), 1);
});

test('a password reset during login cannot issue a session for the old password', async () => {
  const nextHash = await bcrypt.hash('changed-during-login', 4);
  let changed = false;
  const racingDb = db.$extends({ query: { user: { async findUnique({ args, query }) {
    const user = await query(args);
    if (args.where.username === 'visitor' && !changed) {
      changed = true;
      await db.user.update({ where: { username: 'visitor' }, data: { passwordHash: nextHash, mustChangePassword: true } });
    }
    return user;
  } } } });
  const racingApp = createApp(racingDb as unknown as PrismaClient, config);
  await request(racingApp).post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(401);
  assert.equal(await db.authSession.count(), 0);
});

test('trusted same-host proxy attributes logs to clients and separates IP limits; default ignores forwarded IP', async () => {
  const proxied = createApp(db, { ...config, trustProxy: 'loopback' });
  for (let index = 0; index < 5; index++) {
    await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.1')
      .send({ username: `missing${index}`, password: 'invalid-password' }).expect(401);
  }
  await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.1')
    .send({ username: 'admin', password: config.adminPassword }).expect(429);
  await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.2')
    .send({ username: 'admin', password: config.adminPassword }).expect(200);
  assert.equal((await db.accessLog.findFirstOrThrow({ where: { action: 'login' } })).ip, '192.0.2.2');
  await request(app).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.99')
    .send({ username: 'visitor', password: config.sitePassword }).expect(200);
  const visitor = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  assert.notEqual((await db.accessLog.findFirstOrThrow({ where: { userId: visitor.id } })).ip, '192.0.2.99');
});

test('research editor grants are a subset of read access and old grant clients preserve editor permissions', async () => {
  const { a, b } = await projects();
  const admin = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  const route = `/api/admin/users/${user.id}/projects`;
  await admin.put(route).send({ projectIds: [a.id], researchEditorProjectIds: [b.id] }).expect(400);
  assert.equal((await db.projectAccess.findUniqueOrThrow({ where: { userId_projectId: { userId: user.id, projectId: a.id } } })).canEditResearch, false);
  await admin.put(route).send({ projectIds: [a.id], researchEditorProjectIds: [a.id] }).expect(200);
  assert.deepEqual((await admin.get(route).expect(200)).body.researchEditorProjectIds, [a.id]);
  await admin.put(route).send({ projectIds: [a.id, b.id] }).expect(200);
  assert.deepEqual((await admin.get(route).expect(200)).body.researchEditorProjectIds, [a.id]);
  await admin.put(route).send({ projectIds: [a.id, b.id], researchEditorProjectIds: [] }).expect(200);
  assert.deepEqual((await admin.get(route).expect(200)).body.researchEditorProjectIds, []);
  await admin.put(route).send({ projectIds: [a.id], researchEditorProjectIds: [a.id] }).expect(200);
  await admin.put(route).send({ projectIds: [] }).expect(200);
  assert.equal(await db.projectAccess.count({ where: { userId: user.id } }), 0);
});
