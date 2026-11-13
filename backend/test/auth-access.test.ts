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
import { bootstrapAdmin, bootstrapShare, createShareToken, createShortShareToken } from '../src/auth.js';
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

test('share bootstrap resolves the legacy castle selector after the project is renamed', async () => {
  const project = await db.content.create({ data: {
    title: '日常生活 | 学 | 德智体美用', type: 'folder', scene: 'life', isProject: true,
  } });
  await bootstrapShare(db, { ...config, shareProjectSelectors: ['爱的城堡'] });
  const user = await db.user.findUniqueOrThrow({ where: { username: 'user' } });
  assert.deepEqual((await db.projectAccess.findMany({ where: { userId: user.id } })).map(row => row.projectId), [project.id]);
});

test('single-page share links require the share password and return only the bound target', async () => {
  const root = await db.content.create({ data: { title: 'Share target root', type: 'folder' } });
  const allowed = await db.content.create({ data: { title: 'Allowed share project', type: 'folder', isProject: true, parentId: root.id, topics: ['长期性', 'family', 'life'] } });
  const hidden = await db.content.create({ data: { title: 'Hidden share project', type: 'folder', isProject: true, parentId: root.id, topics: ['阶段性', 'work', 'tools'] } });
  const note = await db.content.create({ data: { title: 'Only this note', type: 'text', parentId: allowed.id, description: '# Shared note' } });
  const hiddenNote = await db.content.create({ data: { title: 'Do not leak', type: 'text', parentId: hidden.id, description: 'secret' } });
  const owner = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.create({ data: { userId: owner.id, projectId: allowed.id } });
  await bootstrapShare(db, { ...config, shareUsername: 'user', sharePassword: '123456', shareHashed: false, shareProjectSelectors: [String(allowed.id)] });
  const admin = await login();
  const created = await admin.post('/api/share-links').send({ kind: 'content', contentId: note.id }).expect(201);
  assert.match(created.body.url, /\/s\/[A-Za-z0-9_-]{16}$/);
  assert.ok(created.body.url.length < 80);
  const token = new URL(created.body.url).pathname.split('/').at(-1);
  await request(app).post('/api/share-links/verify').send({ token, password: 'wrong-password' }).expect(401);
  const verified = await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
  assert.equal(verified.body.kind, 'content');
  assert.equal(verified.body.content.title, note.title);
  assert.equal(verified.body.content.description, note.description);
  assert.equal(JSON.stringify(verified.body).includes(hiddenNote.title), false);
  await request(app).post('/api/share-links/verify').send({ token: token + 'x', password: '123456' }).expect(401);
  await request(app).get(`/api/contents/${hiddenNote.id}`).expect(401);
});

test('single-page media cookie allows exact dependencies and never grants library identity', async () => {
  const { a, docA, docB } = await projects();
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(a.id)] });
  const token = await createShortShareToken(db, config, { kind: 'content', contentId: docA.id });
  const reader = request.agent(app);
  await reader.get(`${mediaUrl}/a.mp4`).expect(401);
  const verified = await reader.post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
  assert.equal(verified.body.content.id, docA.id);
  const cookies = verified.get('Set-Cookie') || [];
  assert.ok(cookies.some((cookie: string) => cookie.startsWith('yaocang_page_share=') && /HttpOnly/.test(cookie)));
  await reader.get(`${mediaUrl}/a.mp4`).set('Range', 'bytes=0-3').expect(206);
  for (const file of ['index.m3u8', 'chunk.ts', 'key.bin', 'research.json', encodeURIComponent('资料.md'), 'shared.png'])
    await reader.get(`${mediaUrl}/${file}`).expect(200);
  await reader.get(`${mediaUrl}/b.mp4`).expect(401);
  await reader.get('/api/contents').expect(401);
  await reader.get(`/api/contents/${docB.id}`).expect(401);
  await reader.get('/api/auth/me').expect(401);
  await reader.post('/api/share-links').send({ kind: 'content', contentId: docB.id }).expect(401);
  await reader.put(`/api/contents/${docA.id}`).send({ title: 'Denied', type: 'text' }).expect(401);
  await db.user.update({ where: { username: 'user' }, data: { enabled: false } });
  await reader.get(`${mediaUrl}/a.mp4`).expect(401);
});

test('project and folder shares expose only the chosen subtree and its media without a library session', async () => {
  const { a, b, docA, docB } = await projects();
  const folder = await db.content.create({ data: { title: 'Shared folder', type: 'folder', parentId: a.id } });
  const note = await db.content.create({ data: { title: 'Folder note', type: 'text', parentId: folder.id, description: 'Scoped note' } });
  await bootstrapShare(db, config);
  const admin = await login();
  for (const root of [a, folder]) {
    const created = await admin.post('/api/share-links').send({ kind: 'project', contentId: root.id }).expect(201);
    assert.match(created.body.url, /\/s\/[A-Za-z0-9_-]{16}$/);
    const token = new URL(created.body.url).pathname.split('/').at(-1);
    const reader = request.agent(app);
    const result = await reader.post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
    assert.equal(result.body.kind, 'project');
    assert.equal(result.body.rootId, root.id);
    assert.equal(result.body.items.length, 1);
    assert.equal(result.body.items[0].parentId, null);
    const serialized = JSON.stringify(result.body);
    assert.ok(serialized.includes(note.title));
    assert.ok(!serialized.includes(b.title + '"'));
    assert.ok(!serialized.includes(docB.title));
    await reader.get('/api/contents').expect(401);
    await reader.get('/api/auth/me').expect(401);
    await reader.put(`/api/contents/${note.id}`).send({ title: 'Blocked' }).expect(401);
    await reader.get(`${mediaUrl}/b.mp4`).expect(401);
    await reader.get(`${mediaUrl}/unowned.png`).expect(401);
    await reader.get(`${mediaUrl}/a.mp4`).expect(root.id === a.id ? 200 : 401);
    assert.equal(serialized.includes(docA.title), root.id === a.id);
  }
});

test('project shares follow current content, reject inaccessible roots, and stop after the owner loses access', async () => {
  const { a, b, docA } = await projects();
  await bootstrapShare(db, config);
  const visitor = await login('visitor', config.sitePassword);
  await visitor.post('/api/share-links').send({ kind: 'project', contentId: b.id }).expect(404);
  await visitor.post('/api/share-links').send({ kind: 'project', contentId: docA.id }).expect(400);
  const created = await visitor.post('/api/share-links').send({ kind: 'project', contentId: a.id }).expect(201);
  const token = new URL(created.body.url).pathname.split('/').at(-1);
  await db.content.update({ where: { id: docA.id }, data: { title: 'Updated live document' } });
  const reader = request.agent(app);
  const result = await reader.post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
  assert.ok(JSON.stringify(result.body).includes('Updated live document'));
  const owner = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.deleteMany({ where: { userId: owner.id } });
  await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(404);
  await reader.get(`${mediaUrl}/a.mp4`).expect(404);
});

test('page snapshots preserve only supplied visible content, isolate resources, and never expose author metadata', async () => {
  const { a, docA, docB } = await projects();
  await bootstrapShare(db, config);
  const admin = await login();
  const page = { title: 'Current course page', nodes: [
    { tag: 'h2', attrs: {}, children: ['Visible lesson'] },
    { tag: 'p', attrs: {}, children: ['Only this view'] },
    { tag: 'img', attrs: { src: `${mediaUrl}/shared.png`, alt: 'Course image' }, children: [] },
  ] };
  const created = await admin.post('/api/share-links').send({ kind: 'page', contentId: a.id, page }).expect(201);
  const token = new URL(created.body.url).pathname.split('/').at(-1);
  const reader = request.agent(app);
  await reader.post('/api/share-links/verify').send({ token, password: 'bad-password' }).expect(401);
  const result = await reader.post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
  assert.equal(result.body.kind, 'page');
  assert.deepEqual(result.body.page.nodes, page.nodes);
  assert.ok(result.body.page.capturedAt);
  assert.equal(result.body.page.media, undefined);
  assert.equal(result.body.ownerId, undefined);
  assert.ok(!JSON.stringify(result.body).includes(docA.title));
  assert.ok(!JSON.stringify(result.body).includes(docB.title));
  await reader.get(`${mediaUrl}/shared.png`).expect(200);
  await reader.get(`${mediaUrl}/a.mp4`).expect(401);
  await reader.get('/api/contents').expect(401);
  await reader.get('/api/trip-plans?projectId=' + a.id).expect(401);
  await db.user.update({ where: { username: 'admin' }, data: { enabled: false } });
  await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(404);
  await reader.get(`${mediaUrl}/shared.png`).expect(401);
});

test('page snapshots reject executable markup, foreign resources, oversized and deeply nested input', async () => {
  const { a, b } = await projects();
  const visitor = await login('visitor', config.sitePassword);
  const send = (node: unknown, contentId = a.id) => visitor.post('/api/share-links').send({ kind: 'page', contentId, page: { title: 'Page', nodes: [node] } });
  for (const node of [
    { tag: 'script', attrs: {}, children: ['alert(1)'] },
    { tag: 'a', attrs: { href: 'javascript:alert(1)' }, children: ['Unsafe'] },
    { tag: 'img', attrs: { src: '//example.com/image.png' }, children: [] },
    { tag: 'img', attrs: { src: `${mediaUrl}/shared.png`, onerror: 'alert(1)' }, children: [] },
    { tag: 'div', attrs: { style: 'background-color:url(https://example.com)' }, children: [] },
    { tag: 'div', attrs: {}, children: ['x'.repeat(100001)] },
  ]) await send(node).expect(400);
  await send({ tag: 'img', attrs: { src: `${mediaUrl}/b.mp4` }, children: [] }).expect(403);
  await send('Cannot share inaccessible project', b.id).expect(404);
  let nested: unknown = 'Too deep';
  for (let index = 0; index < 100; index++) nested = { tag: 'div', attrs: {}, children: [nested] };
  await send(nested).expect(400);
  await visitor.post('/api/share-links').send({ kind: 'page', page: { title: 'Too large', nodes: Array(10).fill('x'.repeat(80000)) } }).expect(413);
});

test('trip sharing binds the owner and project and exposes one trip without its sibling records', async () => {
  const { a, b } = await projects();
  const owner = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  const trip = await db.tripPlan.create({ data: { userId: owner.id, projectId: a.id, title: 'Shared trip', destination: 'Nanjing', startDate: '2026-11-13', endDate: '2026-11-14', itinerary: [], notes: 'One itinerary' } });
  await db.tripPlan.create({ data: { userId: owner.id, projectId: a.id, title: 'Private sibling', destination: 'Private', startDate: '2026-11-13', endDate: '2026-11-14', itinerary: [] } });
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(a.id)] });
  const reader = await login('visitor', config.sitePassword);
  const admin = await login();
  await admin.post('/api/share-links').send({ kind: 'trip', projectId: a.id, tripId: trip.id }).expect(404);
  await reader.post('/api/share-links').send({ kind: 'trip', projectId: b.id, tripId: trip.id }).expect(404);
  const created = await reader.post('/api/share-links').send({ kind: 'trip', projectId: a.id, tripId: trip.id }).expect(201);
  const token = new URL(created.body.url).pathname.split('/').at(-1);
  const shared = await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
  assert.equal(shared.body.plan.id, trip.id);
  assert.equal(shared.body.plan.notes, trip.notes);
  assert.equal(shared.body.plan.userId, undefined);
  assert.equal(JSON.stringify(shared.body).includes('Private sibling'), false);
  const expired = jwt.sign({ share: true, kind: 'trip', projectId: a.id, tripId: trip.id }, config.secret,
    { expiresIn: -1, issuer: 'yaocang-share', audience: 'yaocang-share-link' });
  await request(app).post('/api/share-links/verify').send({ token: expired, password: '123456' }).expect(401);
});

test('share password failures are bounded per IP across different signed targets', async () => {
  const { a, docA, docB } = await projects();
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(a.id)] });
  for (let index = 0; index < 5; index++) {
    const token = createShareToken(config, { kind: 'content', contentId: index % 2 ? docA.id : docB.id });
    await request(app).post('/api/share-links/verify').send({ token, password: 'wrong' }).expect(401);
  }
  const token = createShareToken(config, { kind: 'content', contentId: docA.id });
  const result = await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(429);
  assert.ok(Number(result.headers['retry-after']) > 0);
});

test('short shares survive app recreation, preserve expiry checks and accept legacy links', async () => {
  const { a, docA } = await projects();
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(a.id)] });
  const target = { kind: 'content' as const, contentId: docA.id };
  const legacy = createShareToken(config, target);
  const code = await createShortShareToken(db, config, target);
  assert.match(code, /^[A-Za-z0-9_-]{16}$/);
  assert.notEqual(await createShortShareToken(db, config, target), code);
  app = createApp(db, config);
  for (const token of [code, legacy]) {
    const verified = await request(app).post('/api/share-links/verify').send({ token, password: '123456' }).expect(200);
    assert.equal(verified.body.content.id, docA.id);
  }
  const expired = jwt.sign({ share: true, ...target }, config.secret,
    { expiresIn: -1, issuer: 'yaocang-share', audience: 'yaocang-share-link' });
  await db.config.update({ where: { key: `share.link.${code}` }, data: { value: expired } });
  await request(app).post('/api/share-links/verify').send({ token: code, password: '123456' }).expect(401);
  await db.config.delete({ where: { key: `share.link.${code}` } });
  await request(app).post('/api/share-links/verify').send({ token: code, password: '123456' }).expect(401);
});

test('six-digit share codes accept surrounding paste spaces and full-width IME digits', async () => {
  const { a, docA } = await projects();
  await bootstrapShare(db, { ...config, shareProjectSelectors: [String(a.id)] });
  const token = createShareToken(config, { kind: 'content', contentId: docA.id });
  for (const password of [' 123456\r\n', '１２３４５６', '\u3000１２３４５６\u3000'])
    await request(app).post('/api/share-links/verify').send({ token, password }).expect(200);
  for (const password of ['123 456', '123457', '密码：123456'])
    await request(app).post('/api/share-links/verify').send({ token, password }).expect(401);
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
