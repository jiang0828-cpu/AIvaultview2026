import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { projectRoot } from '../src/config.js';
import { emptyHealthWorkspace, healthDate, healthProjectMarker, healthProjectTitle, healthWorkspaceSchema, type ValidHealthWorkspace } from '../src/healthSchema.js';
import { seedTestUsers, type TestConfig } from './helpers.js';

const config: TestConfig = { adminUsername: 'admin', secret: 'health-tests-secret-at-least-32-characters',
  adminPassword: 'health-admin-password-tests', sitePassword: 'health-reader-password-tests',
  adminHashed: false, siteHashed: false, production: false, origin: 'http://localhost:5173' };
let db: PrismaClient;
let directory: string;
let app: ReturnType<typeof createApp>;
let projectId: number;
let otherProjectId: number;
let readerId: number;

function workspace(): ValidHealthWorkspace {
  return {
    members: [{ id: 'member-1', name: '测试成员', birthDate: '1990-05-06', relationship: '本人', management: 'general',
      conditions: '', allergies: '待核对', emergencyContact: '', doctor: '', hospital: '', doctorContact: '', goals: '',
      monitoringPlan: '', consent: true }],
    measurements: [{ id: 'measurement-1', memberId: 'member-1', kind: 'bloodPressure', measuredAt: '2026-11-10T08:00:00+08:00',
      value: 120, secondary: 80, context: '静坐5分钟后', source: 'self', note: '' }],
    actions: [{ id: 'action-1', memberId: 'member-1', title: '预约年度预防评估', category: 'prevention', dueDate: '2026-12-01',
      owner: '本人', focus: true, status: 'todo', evidence: '', obstacle: '' }],
    medications: [{ id: 'medication-1', memberId: 'member-1', name: '测试药名', strength: '', dose: '按医生处方', schedule: '',
      purpose: '', prescriber: '', notes: '', reviewDate: '' }],
    visits: [{ id: 'visit-1', memberId: 'member-1', date: '2026-12-01', institution: '测试社区中心', reason: '', questions: '',
      status: 'planned', outcome: '', nextDate: '' }],
    reviews: [{ id: 'review-1', memberId: 'member-1', date: '2026-11-10', changes: '', support: '', nextSteps: '', simplify: '' }],
  };
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vaultview-health-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  projectId = (await db.content.create({ data: { title: '健康管理测试', type: 'folder', scene: 'life', isProject: true,
    description: healthProjectMarker } })).id;
  otherProjectId = (await db.content.create({ data: { title: '其他项目', type: 'folder', scene: 'life', isProject: true } })).id;
  await seedTestUsers(db, config);
  const reader = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  readerId = reader.id;
  for (const username of ['reader2', 'denied']) {
    const row = await db.user.create({ data: { username, role: 'visitor', passwordHash: reader.passwordHash, mustChangePassword: false } });
    if (username === 'reader2') await db.projectAccess.create({ data: { userId: row.id, projectId } });
  }
  app = createApp(db, config);
});
beforeEach(async () => {
  await db.healthWorkspace.deleteMany();
  await db.projectAccess.upsert({ where: { userId_projectId: { userId: readerId, projectId } },
    create: { userId: readerId, projectId }, update: {} });
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function login(username = 'visitor', password = config.sitePassword) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password }).expect(200);
  return agent;
}
const endpoint = () => `/api/health/workspace?projectId=${projectId}`;

test('marker stays aligned with the shared frontend contract', async () => {
  const shared = await readFile(resolve(projectRoot, 'shared/health.ts'), 'utf8');
  assert.ok(shared.includes(`healthProjectMarker = '${healthProjectMarker}'`));
  assert.ok(shared.includes(`healthProjectTitle = '${healthProjectTitle}'`));
});

test('anonymous access and mutation are denied', async () => {
  await request(app).get(endpoint()).expect(401);
  await request(app).put(endpoint()).send({ version: 0, data: workspace() }).expect(401);
  await request(app).delete(endpoint()).send({ version: 0 }).expect(401);
});

test('authorized reader starts empty and can save and update every collection', async () => {
  const agent = await login();
  const initial = await agent.get(endpoint()).expect(200);
  assert.deepEqual(initial.body, { version: 0, updatedAt: null, data: emptyHealthWorkspace() });
  assert.match(initial.headers['cache-control'], /no-store/);
  const data = workspace();
  const saved = await agent.put(endpoint()).send({ version: 0, data }).expect(200);
  assert.equal(saved.body.version, 1);
  assert.ok(saved.body.updatedAt);
  assert.deepEqual(saved.body.data, data);
  data.members[0].name = '已更新';
  data.actions[0].status = 'done'; data.actions[0].evidence = '已经落实预约';
  data.visits[0].status = 'done'; data.visits[0].outcome = '医生已解释结果，下次按计划复查';
  const updated = await agent.put(endpoint()).send({ version: 1, data }).expect(200);
  assert.equal(updated.body.version, 2);
  assert.deepEqual((await agent.get(endpoint()).expect(200)).body.data, data);
});

test('same project users and administrators cannot read another account workspace', async () => {
  const owner = await login();
  await owner.put(endpoint()).send({ version: 0, data: workspace() }).expect(200);
  for (const [username, password] of [['reader2', config.sitePassword], ['admin', config.adminPassword!]]) {
    const agent = await login(username, password);
    assert.deepEqual((await agent.get(endpoint()).expect(200)).body.data, emptyHealthWorkspace());
    await agent.get(`${endpoint()}&userId=${readerId}`).expect(400);
    await agent.put(endpoint()).send({ version: 0, userId: readerId, data: workspace() }).expect(400);
  }
  assert.equal((await owner.get(endpoint()).expect(200)).body.data.members[0].name, '测试成员');
});

test('project permission and health marker are checked on each operation', async () => {
  const denied = await login('denied');
  await denied.get(endpoint()).expect(404);
  await denied.put(endpoint()).send({ version: 0, data: workspace() }).expect(404);
  await denied.delete(endpoint()).send({ version: 0 }).expect(404);
  const owner = await login();
  await owner.get(`/api/health/workspace?projectId=${otherProjectId}`).expect(404);
  await owner.put(endpoint()).send({ version: 0, data: workspace() }).expect(200);
  await db.projectAccess.delete({ where: { userId_projectId: { userId: readerId, projectId } } });
  await owner.get(endpoint()).expect(404);
  await owner.put(endpoint()).send({ version: 1, data: workspace() }).expect(404);
});

test('health workspaces remain isolated between separately authorized health projects', async () => {
  const second = await db.content.create({ data: { title: '另一健康项目', type: 'folder', scene: 'life', isProject: true,
    description: healthProjectMarker } });
  await db.projectAccess.create({ data: { userId: readerId, projectId: second.id } });
  const agent = await login();
  await agent.put(endpoint()).send({ version: 0, data: workspace() }).expect(200);
  const secondPath = `/api/health/workspace?projectId=${second.id}`;
  assert.equal((await agent.get(secondPath).expect(200)).body.version, 0);
  const data = workspace(); data.members[0].name = '另一项目成员';
  await agent.put(secondPath).send({ version: 0, data }).expect(200);
  await agent.delete(secondPath).send({ version: 1 }).expect(200);
  assert.equal((await agent.get(endpoint()).expect(200)).body.data.members[0].name, '测试成员');
});

test('concurrent and stale versions never overwrite newer health data', async () => {
  const agent = await login();
  const outcomes = await Promise.all([
    agent.put(endpoint()).send({ version: 0, data: workspace() }),
    agent.put(endpoint()).send({ version: 0, data: emptyHealthWorkspace() }),
  ]);
  assert.deepEqual(outcomes.map(item => item.status).sort(), [200, 409]);
  await agent.put(endpoint()).send({ version: 1, data: workspace() }).expect(200);
  await agent.put(endpoint()).send({ version: 1, data: emptyHealthWorkspace() }).expect(409);
  assert.equal((await agent.get(endpoint()).expect(200)).body.data.members.length, 1);
  await agent.delete(endpoint()).send({ version: 1 }).expect(409);
});

test('clearing removes sensitive data and keeps a revision tombstone against stale resurrection', async () => {
  const agent = await login();
  await agent.put(endpoint()).send({ version: 0, data: workspace() }).expect(200);
  const cleared = await agent.delete(endpoint()).send({ version: 1 }).expect(200);
  assert.equal(cleared.body.version, 2);
  assert.deepEqual(cleared.body.data, emptyHealthWorkspace());
  assert.deepEqual((await db.healthWorkspace.findFirstOrThrow()).data, emptyHealthWorkspace());
  await agent.put(endpoint()).send({ version: 0, data: workspace() }).expect(409);
  await agent.put(endpoint()).send({ version: 1, data: workspace() }).expect(409);
  await agent.put(endpoint()).send({ version: 2, data: workspace() }).expect(200);
  const other = await login('reader2');
  const emptyClear = await other.delete(endpoint()).send({ version: 0 }).expect(200);
  assert.equal(emptyClear.body.version, 0);
  await other.delete(endpoint()).send({ version: 99 }).expect(409);
});

test('concurrent clearing uses revision checks and returns a conflict to the stale operation', async () => {
  const agent = await login();
  await agent.put(endpoint()).send({ version: 0, data: workspace() }).expect(200);
  const outcomes = await Promise.all([
    agent.delete(endpoint()).send({ version: 1 }),
    agent.delete(endpoint()).send({ version: 1 }),
  ]);
  assert.deepEqual(outcomes.map(item => item.status).sort(), [200, 409]);
  assert.equal((await agent.get(endpoint()).expect(200)).body.version, 2);
});

test('strict schema rejects bad dates, unconsented members, duplicates and orphaned records', async () => {
  const agent = await login();
  assert.equal(healthDate.safeParse('2025-02-29').success, false);
  assert.equal(healthDate.safeParse('2024-02-29').success, true);
  const mutations: Array<(data: ValidHealthWorkspace) => void> = [
    data => { data.members[0].birthDate = '2026-02-30'; },
    data => { data.members[0].consent = false; },
    data => { data.members.push({ ...data.members[0] }); },
    data => { data.measurements[0].memberId = 'missing'; },
    data => { data.measurements[0].measuredAt = '2026-02-30T12:00:00Z'; },
    data => { data.measurements[0].measuredAt = '2026-11-10T08:00'; },
    data => { data.members = []; },
    data => { data.actions[0].owner = ' '; },
    data => { data.actions[0].dueDate = ''; },
    data => { data.actions[0].status = 'done'; },
    data => { data.visits[0].status = 'done'; },
    data => { data.visits[0].nextDate = '2026-13-01'; },
  ];
  for (const mutate of mutations) {
    const data = workspace(); mutate(data);
    await agent.put(endpoint()).send({ version: 0, data }).expect(400);
  }
  await agent.put(endpoint()).send({ version: 0, data: { ...workspace(), userId: readerId } }).expect(400);
  assert.equal(await db.healthWorkspace.count(), 0);
});

test('measurement validation preserves zero activity and sleep but checks units and blood pressure pairs', () => {
  for (const kind of ['activity', 'sleep'] as const) {
    const data = workspace();
    data.measurements[0] = { ...data.measurements[0], kind, value: 0, secondary: null };
    assert.equal(healthWorkspaceSchema.parse(data).measurements[0].value, 0);
  }
  for (const [kind, value, secondary] of [['bloodPressure', 120, null], ['bloodPressure', 100, 120],
    ['sleep', 25, null], ['activity', -1, null], ['temperature', 70, null], ['weight', 10, 80]] as const) {
    const data = workspace(); data.measurements[0] = { ...data.measurements[0], kind, value, secondary };
    assert.equal(healthWorkspaceSchema.safeParse(data).success, false);
  }
});

test('three unfinished focus items and workspace limits keep the action list manageable', () => {
  const data = workspace();
  data.actions = Array.from({ length: 4 }, (_, index) => ({ ...data.actions[0], id: `action-${index}` }));
  assert.equal(healthWorkspaceSchema.safeParse(data).success, false);
  data.actions[0].status = 'done'; data.actions[0].evidence = '已完成';
  assert.equal(healthWorkspaceSchema.safeParse(data).success, true);
  const oversize = workspace();
  oversize.measurements = Array.from({ length: 100 }, (_, index) => ({ ...oversize.measurements[0], id: `measure-${index}`, note: '详'.repeat(1000) }));
  assert.equal(healthWorkspaceSchema.safeParse(oversize).success, false);
  const tooMany = workspace();
  tooMany.members = Array.from({ length: 13 }, (_, index) => ({ ...tooMany.members[0], id: `member-${index}` }));
  assert.equal(healthWorkspaceSchema.safeParse(tooMany).success, false);
});

test('action recurrence accepts explicit schedules and rejects unsupported values', () => {
  for (const recurrence of ['none', 'daily', 'weekly'] as const) {
    const data = workspace();
    data.actions[0].recurrence = recurrence;
    assert.equal(healthWorkspaceSchema.parse(data).actions[0].recurrence, recurrence);
  }
  const data = workspace();
  assert.equal(healthWorkspaceSchema.safeParse({ ...data,
    actions: [{ ...data.actions[0], recurrence: 'hourly' }] }).success, false);
});
