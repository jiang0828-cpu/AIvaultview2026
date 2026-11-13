import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { projectRoot } from '../src/config.js';
import { compareProjectMarker } from '../src/compare.js';
import { seedCompare, compareDocuments } from '../prisma/compare.js';
import { seedTestUsers, type TestConfig } from './helpers.js';

const config: TestConfig = { adminUsername: 'admin', secret: 'compare-tests-secret-at-least-32-characters',
  adminPassword: 'admin-password-for-tests', sitePassword: 'visitor-password-for-tests',
  adminHashed: false, siteHashed: false, production: false, origin: 'http://localhost:5173' };
let db: PrismaClient;
let directory: string;
let app: ReturnType<typeof createApp>;
let projectId: number;
const originalFetch = globalThis.fetch;
type Captured = { url: string; options?: RequestInit };
let captured: Captured[];
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vaultview-compare-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  projectId = (await seedCompare(db)).projectId;
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
beforeEach(() => {
  captured = [];
  globalThis.fetch = async (input, options) => {
    captured.push({ url: String(input), options });
    return new Response(JSON.stringify({ runId: 'run_test', status: 'completed', offers: [], recommendations: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function login(username = 'visitor', password = config.sitePassword) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password }).expect(200);
  return agent;
}

test('comparison endpoints reject unauthenticated requests without reaching Python', async () => {
  for (const path of ['providers', 'runs', 'favorites', 'imports'])
    await request(app).get(`/api/compare/${path}?projectId=${projectId}`).expect(401);
  await request(app).post(`/api/compare/search?projectId=${projectId}`).send({ query: 'phone' }).expect(401);
  assert.equal(captured.length, 0);
});

test('authenticated proxy uses session identity and a fixed loopback URL', async () => {
  const visitor = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await visitor.post(`/api/compare/search?projectId=${projectId}`)
    .set('X-User-Id', '9999').set('X-Project-Id', '9999').set('Authorization', 'Bearer attacker')
    .send({ query: 'iPhone 16', brand: 'Apple', model: 'iPhone 16', specs: { storage: '256GB' }, mode: 'demo' }).expect(200);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, `http://127.0.0.1:${process.env.COMPARE_PORT || 8001}/search`);
  const headers = new Headers(captured[0].options?.headers);
  assert.equal(headers.get('X-User-Id'), String(user.id));
  assert.equal(headers.get('X-Project-Id'), String(projectId));
  const expectedToken = process.env.COMPARE_INTERNAL_TOKEN || createHash('sha256').update(`price-compare:${config.secret}`).digest('hex');
  assert.equal(headers.get('Authorization'), `Bearer ${expectedToken}`);
  assert.equal(captured[0].options?.redirect, 'error');
  assert.ok(captured[0].options?.signal);
});

test('project marker, current grants and project identity are enforced on every call', async () => {
  const visitor = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.deleteMany({ where: { userId: user.id, projectId } });
  await visitor.get(`/api/compare/runs?projectId=${projectId}`).expect(404);
  await db.projectAccess.create({ data: { userId: user.id, projectId } });
  await visitor.get(`/api/compare/runs?projectId=${projectId}`).expect(200);
  const other = await db.content.create({ data: { title: 'Ordinary', type: 'folder', isProject: true, scene: 'life' } });
  await db.projectAccess.create({ data: { userId: user.id, projectId: other.id } });
  await visitor.get(`/api/compare/providers?projectId=${other.id}`).expect(404);
  await db.content.update({ where: { id: other.id }, data: { description: compareProjectMarker, isProject: false } });
  await visitor.get(`/api/compare/providers?projectId=${other.id}`).expect(404);
  await db.content.delete({ where: { id: other.id } });
  assert.equal(captured.length, 1);
});

test('body owner spoofing and invalid fields are rejected', async () => {
  const visitor = await login();
  for (const input of [{ query: 'phone', userId: 123 }, { query: 'phone', projectId }, { query: 'phone', budgetMax: -1 },
    { query: 'phone', platforms: ['unknown'] }, { query: 'phone', mode: 'silently-live' }])
    await visitor.post(`/api/compare/search?projectId=${projectId}`).send(input).expect(400);
  await visitor.post(`/api/compare/import?projectId=${projectId}`)
    .send({ format: 'manual', data: { title: 'phone', user_id: 123 } }).expect(400);
  await visitor.get('/api/compare/runs?projectId=invalid').expect(400);
  assert.equal(captured.length, 0);
});

test('daily goods search accepts bounded package fields and preserves them through the proxy', async () => {
  const visitor = await login();
  const body = { query: '纯牛奶', brand: null, model: null, category: 'drink',
    packCount: 12, netWeight: 250, unit: 'ml', demoScenario: 'drink', mode: 'demo' };
  await visitor.post(`/api/compare/search?projectId=${projectId}`).send(body).expect(200);
  assert.deepEqual(JSON.parse(String(captured[0].options?.body)), body);
  for (const patch of [{ packCount: 0 }, { netWeight: -1 }, { unit: 'litre-guess' }, { category: 'medicine' }])
    await visitor.post(`/api/compare/search?projectId=${projectId}`).send({ ...body, ...patch }).expect(400);
  assert.equal(captured.length, 1);
});

test('favorite offer IDs accept numeric and string forms while staying scoped', async () => {
  const visitor = await login();
  await visitor.post(`/api/compare/favorites?projectId=${projectId}`).send({ offerId: 123, note: 'numeric' }).expect(200);
  await visitor.post(`/api/compare/favorites?projectId=${projectId}`).send({ offerId: '123', note: 'string' }).expect(200);
  assert.deepEqual(captured.map(item => JSON.parse(String(item.options?.body)).offerId), ['123', '123']);
});

test('history, favorites and imports preserve scope and normalized paths', async () => {
  const visitor = await login();
  await visitor.get(`/api/compare/runs/run_abc?projectId=${projectId}`).expect(200);
  await visitor.get(`/api/compare/favorites?projectId=${projectId}`).expect(200);
  await visitor.post(`/api/compare/favorites?projectId=${projectId}`).send({ offerId: 'offer_abc', note: 'check warranty' }).expect(200);
  await visitor.put(`/api/compare/favorites/favorite_abc?projectId=${projectId}`).send({ note: 'verified' }).expect(200);
  await visitor.post(`/api/compare/import?projectId=${projectId}`).send({ format: 'csv', data: 'title,platform\nphone,jd' }).expect(200);
  await visitor.put(`/api/compare/imports/import_abc?projectId=${projectId}`).send({ title: 'revised phone', platform: 'jd' }).expect(200);
  await visitor.delete(`/api/compare/imports/import_abc?projectId=${projectId}`).send({}).expect(200);
  assert.deepEqual(captured.map(item => new URL(item.url).pathname), ['/runs/run_abc', '/favorites', '/favorites', '/favorites/favorite_abc', '/imports', '/imports/import_abc', '/imports/import_abc']);
  assert.equal(new Set(captured.map(item => new Headers(item.options?.headers).get('X-User-Id'))).size, 1);
});

test('service outage and unsafe upstream errors use a generic JSON error', async () => {
  const visitor = await login();
  globalThis.fetch = async () => { throw new Error('sensitive upstream diagnostic'); };
  const outage = await visitor.get(`/api/compare/providers?projectId=${projectId}`).expect(503);
  assert.equal(outage.body.error.code, 'COMPARE_UNAVAILABLE');
  assert.ok(!JSON.stringify(outage.body).includes('sensitive'));
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'private token diagnostics' }), { status: 500 });
  const broken = await visitor.get(`/api/compare/providers?projectId=${projectId}`).expect(503);
  assert.ok(!JSON.stringify(broken.body).includes('private'));
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '记录不存在' } }), { status: 404 });
  const missing = await visitor.get(`/api/compare/runs/other_user_run?projectId=${projectId}`).expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
});

test('comparison seed is idempotent and preserves edits', async () => {
  const first = await seedCompare(db);
  assert.equal(first.created, 0);
  const documents = await db.content.findMany({ where: { parentId: first.projectId } });
  assert.equal(documents.length, compareDocuments.length);
  await db.content.update({ where: { id: documents[0].id }, data: { description: '# Personal edit without marker' } });
  const second = await seedCompare(db);
  assert.equal(second.created, 0);
  assert.equal(await db.content.count({ where: { parentId: first.projectId } }), compareDocuments.length);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: documents[0].id } })).description, '# Personal edit without marker');
});
