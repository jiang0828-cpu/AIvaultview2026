import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { projectRoot } from '../src/config.js';
import { seedInvestment, investmentDocuments } from '../prisma/investment.js';
import { seedTestUsers, type TestConfig } from './helpers.js';

const config: TestConfig = { adminUsername: 'admin', secret: 'investment-tests-secret-at-least-32-characters', adminPassword: 'admin-password-for-tests', sitePassword: 'visitor-password-for-tests', adminHashed: false, siteHashed: false, production: false, origin: 'http://localhost:5173' };
let db: PrismaClient;
let directory: string;
let app: ReturnType<typeof createApp>;
let projectId: number;
const originalFetch = globalThis.fetch;
let calls: { url: string; options?: RequestInit }[];
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vault-investment-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true });
  db = new PrismaClient({ datasources: { db: { url } } });
  projectId = (await seedInvestment(db)).projectId;
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
});
after(async () => { globalThis.fetch = originalFetch; await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });
async function login() { const agent = request.agent(app); await agent.post('/api/auth/login').send({ username: 'visitor', password: config.sitePassword }).expect(200); return agent; }

test('investment rejects anonymous and invalid project requests', async () => {
  await request(app).get(`/api/investment/state?projectId=${projectId}`).expect(401);
  const visitor = await login();
  await visitor.get('/api/investment/state?projectId=999999').expect(404);
  assert.equal(calls.length, 0);
});
test('proxy owns identity and sends only to loopback investment service', async () => {
  const visitor = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await visitor.get(`/api/investment/state?projectId=${projectId}&demo=true`).set('X-User-Id', '999').expect(200);
  assert.match(calls[0].url, /^http:\/\/127\.0\.0\.1:\d+\/investment\/state\?demo=true$/);
  const headers = new Headers(calls[0].options?.headers);
  assert.equal(headers.get('X-User-Id'), String(user.id));
  assert.equal(headers.get('X-Project-Id'), String(projectId));
  assert.ok(headers.get('Authorization')?.startsWith('Bearer '));
  assert.equal(calls[0].options?.redirect, 'error');
});
test('current project grant is checked on every investment request', async () => {
  const visitor = await login();
  const user = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.delete({ where: { userId_projectId: { userId: user.id, projectId } } });
  await visitor.get(`/api/investment/review?projectId=${projectId}`).expect(404);
  assert.equal(calls.length, 0);
  await db.projectAccess.create({ data: { userId: user.id, projectId } });
});
test('service outage and validation use controlled errors', async () => {
  const visitor = await login();
  globalThis.fetch = async () => { throw new Error('private diagnostic'); };
  const failed = await visitor.get(`/api/investment/state?projectId=${projectId}`).expect(503);
  assert.equal(failed.body.error.code, 'INVESTMENT_UNAVAILABLE');
  assert.ok(!JSON.stringify(failed.body).includes('diagnostic'));
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: [{ input: 'private account data' }] }), { status: 422 });
  const invalid = await visitor.put(`/api/investment/account?projectId=${projectId}`).send({ cash: -1 }).expect(400);
  assert.ok(!JSON.stringify(invalid.body).includes('private account data'));
});
test('sharing identity cannot read a private investment ledger even with a project grant', async () => {
  const visitor = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  const shared = await db.user.create({ data: { username: 'readonly-invest', role: 'share', passwordHash: visitor.passwordHash, mustChangePassword: false,
    grants: { create: { projectId } } } });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: shared.username, password: config.sitePassword }).expect(200);
  await agent.get(`/api/investment/state?projectId=${projectId}`).expect(403);
  assert.equal(calls.length, 0);
});
test('import shape and delete keys validate before forwarding', async () => {
  const visitor = await login();
  await visitor.post(`/api/investment/import?projectId=${projectId}`).send({ kind: 'users', format: 'json', data: [] }).expect(400);
  await visitor.post(`/api/investment/import?projectId=${projectId}`).send({ kind: 'positions', format: 'json', data: [{ code: 'ABC' }], userId: 99 }).expect(400);
  await visitor.delete(`/api/investment/products/invalid%20key?projectId=${projectId}`).send({}).expect(400);
  assert.equal(calls.length, 0);
});
test('investment seed is idempotent and preserves edited documents', async () => {
  const docs = await db.content.findMany({ where: { parentId: projectId }, orderBy: { sortOrder: 'asc' } });
  assert.equal(docs.length, investmentDocuments.length);
  await db.content.update({ where: { id: docs[0].id }, data: { description: '个人已编辑文档，marker已去除' } });
  const result = await seedInvestment(db);
  assert.equal(result.projectId, projectId);
  assert.equal(result.documentsCreated, 0);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: docs[0].id } })).description, '个人已编辑文档，marker已去除');
  const lastDoc = docs[7];
  const editedBody = '个人补充的复盘条件，不应被初始化覆盖';
  await db.content.update({ where: { id: lastDoc.id }, data: { description: editedBody } });
  const appended = await seedInvestment(db);
  assert.equal(appended.documentsUpdated, 1);
  const withNotes = (await db.content.findUniqueOrThrow({ where: { id: lastDoc.id } })).description;
  assert.ok(withNotes.startsWith(editedBody));
  assert.ok(withNotes.includes('<!-- INVESTMENT_SYNC_NOTES -->'));
  const repeated = await seedInvestment(db);
  assert.equal(repeated.documentsCreated, 0);
  assert.equal(repeated.documentsUpdated, 0);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: lastDoc.id } })).description, withNotes);
});

test('automatic refresh requires project access and rejects client identity fields', async () => {
  await request(app).post(`/api/investment/refresh?projectId=${projectId}`).send({}).expect(401);
  const visitor = await login();
  await visitor.post(`/api/investment/refresh?projectId=${projectId}`).send({ userId: 999 }).expect(400);
  assert.equal(calls.length, 0);
  await visitor.post(`/api/investment/refresh?projectId=${projectId}`).send({}).expect(200);
  assert.match(calls[0].url, /\/investment\/refresh\?/);
  assert.equal(calls[0].options?.method, 'POST');
});
