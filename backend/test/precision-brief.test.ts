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
import { seedTestUsers, type TestConfig } from './helpers.js';
import { seedPrecisionBrief } from '../prisma/seed-precision-brief.js';
import { precisionBriefInputSchema, precisionBriefSections, validatePrecisionBriefForPublish, type PrecisionBriefInput } from '../src/precisionBriefSchema.js';
import { claimPrecisionBriefRun, publishPrecisionBrief, queuePrecisionBriefRun } from '../src/precisionBrief.js';

const config: TestConfig = { adminUsername: 'admin', secret: 'precision-tests-secret-at-least-32-characters', sitePassword: 'precision-test-reader-password', siteHashed: false,
  adminPassword: 'precision-test-admin-password', adminHashed: false, production: false, origin: 'http://localhost:5173' };
let directory: string, db: PrismaClient, app: ReturnType<typeof createApp>, projectId: number;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vault-precision-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true });
  db = new PrismaClient({ datasources: { db: { url } } });
});
beforeEach(async () => {
  await db.user.deleteMany();
  await db.content.updateMany({ data: { parentId: null } });
  await db.content.deleteMany();
  projectId = (await seedPrecisionBrief(db)).projectId;
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
after(async () => { await db?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });
async function login(username = 'admin') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username, password: username === 'admin' ? config.adminPassword : config.sitePassword }).expect(200);
  return agent;
}
function fixture(runKey = 'test-brief'): PrecisionBriefInput {
  const end = new Date(Date.now() - 60000), start = new Date(end.getTime() - 86400000);
  return { runKey, issueDate: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(end), windowStart: start.toISOString(), windowEnd: end.toISOString(), firstIssue: false,
    summary: '隔离测试：核对事实、关注点和业务点评。',
    tasks: precisionBriefSections.map(kind => ({ kind, status: kind === 'company' ? 'completed' : 'no_news', rawReport: '本次只验证结构和访问控制，不是真实行业调研。', coverage: '已检查本任务来源清单和指定时间窗口，无可发布消息的栏目明确记为无新增。', errorMessage: '' })),
    items: [{ section: 'company', title: '独立测试公告', message: '仅验证消息字段的存储与发布。', attention: '关注原始信息对应范围。', commentary: '业务点评与原始事实分开记录。', sourceIds: ['S1'], severity: 'normal', sortOrder: 0 }],
    sources: [{ key: 'S1', title: '独立测试来源元数据', publisher: '隔离测试机构', publishedAt: new Date(end.getTime() - 3600000).toISOString(), accessedAt: end.toISOString(), url: 'https://www.fda.gov/medical-devices', sourceType: 'official', verified: true }],
  };
}

test('precision project seed is independent, repeatable and preserves edited rules and access', async () => {
  const row = await db.content.findUniqueOrThrow({ where: { id: projectId }, include: { parent: true, children: true } });
  assert.equal(row.scene, 'work'); assert.equal(row.parent?.title, '事业工作'); assert.equal(row.isProject, true);
  assert.deepEqual(row.topics, ['精准医疗', 'AI']); assert.equal(row.children.length, 3);
  await db.content.update({ where: { id: row.children[0].id }, data: { description: row.children[0].description + '\n人工增补保留', sortOrder: 30 } });
  const grants = await db.projectAccess.count();
  assert.equal((await seedPrecisionBrief(db)).created, 0);
  assert.ok((await db.content.findUniqueOrThrow({ where: { id: row.children[0].id } })).description.endsWith('人工增补保留'));
  assert.equal(await db.projectAccess.count(), grants);
  assert.equal(await db.researchStudy.count(), 0);
});

test('precision publication validates five areas, dates, real URLs, references, duplicates and content lengths', () => {
  assert.equal(validatePrecisionBriefForPublish(fixture()).success, true);
  const reject = (change: (value: PrecisionBriefInput) => void) => { const value = fixture(); change(value); assert.equal(validatePrecisionBriefForPublish(value).success, false); };
  reject(value => value.tasks.pop());
  reject(value => { value.tasks[4].kind = 'science'; });
  reject(value => { value.items[0].sourceIds = []; });
  reject(value => { value.items[0].sourceIds = ['MISSING']; });
  reject(value => { value.items[0].message = '长'.repeat(301); });
  reject(value => { value.items[0].commentary = 'TODO'; });
  reject(value => { value.sources[0].publishedAt = '2026-99-99'; });
  reject(value => { value.sources[0].publishedAt = new Date(Date.now() + 86400000).toISOString(); });
  reject(value => { value.sources[0].publishedAt = new Date(Date.now() - 86400000 * 10).toISOString(); });
  reject(value => { value.sources[0].url = 'https://example.com/news'; });
  reject(value => { value.sources[0].url = 'not a URL'; });
  reject(value => { value.sources[0].verified = false; });
  reject(value => { value.items.push({ ...value.items[0] }); });
  reject(value => { value.items.push({ ...value.items[0], title: '同一事件的不同标题' }); });
  reject(value => { value.tasks[1].coverage = '待补充'; });
  reject(value => { value.tasks[1].status = 'failed'; value.tasks[1].errorMessage = '无法抓取'; });
  const malformed = { ...fixture(), sources: [{ ...fixture().sources[0], url: 'bad' }] };
  assert.doesNotThrow(() => precisionBriefInputSchema.safeParse(malformed));
});

test('published current is atomic, same-key idempotent, empty areas explicit and failures preserve previous', async () => {
  const input = fixture('published-a');
  const first = await publishPrecisionBrief(db, projectId, input);
  assert.equal(first.status, 'published'); assert.equal(first.isCurrent, true); assert.equal(first.tasks.length, 5);
  assert.deepEqual(first.tasks.map(task => task.kind), precisionBriefSections);
  assert.equal((await publishPrecisionBrief(db, projectId, input)).id, first.id);
  const failed = fixture('failed-b'); failed.items[0].sourceIds = ['unknown'];
  await assert.rejects(publishPrecisionBrief(db, projectId, failed), /未知/);
  assert.equal((await db.precisionBriefRun.findFirstOrThrow({ where: { isCurrent: true } })).id, first.id);
  assert.equal((await db.precisionBriefRun.findFirstOrThrow({ where: { runKey: 'failed-b' } })).status, 'failed');
  const newer = fixture('published-c'); newer.windowEnd = new Date(Date.parse(input.windowEnd) + 1000).toISOString();
  newer.windowStart = new Date(Date.parse(input.windowStart) + 1000).toISOString();
  const next = await publishPrecisionBrief(db, projectId, newer);
  assert.notEqual(next.id, first.id); assert.equal(await db.precisionBriefRun.count({ where: { isCurrent: true } }), 1);
  assert.equal((await db.precisionBriefRun.findUniqueOrThrow({ where: { id: first.id } })).isCurrent, false);
});

test('admin API rejects same-key revisions and historical replays without losing current data', async () => {
  const admin = await login();
  const endpoint = `/api/precision-brief/projects/${projectId}/publish`;
  const input = fixture('api-version-a');
  const first = (await admin.post(endpoint).send(input).expect(200)).body;
  assert.equal((await admin.post(endpoint).send(input).expect(200)).body.id, first.id);
  for (const revised of [{ ...input, summary: '修订摘要需使用新版本键。' },
    { ...input, items: [{ ...input.items[0], message: '修订消息不能静默返回旧版。' }] }]) {
    const response = await admin.post(endpoint).send(revised).expect(409);
    assert.equal(response.body.error.code, 'BRIEF_CONTENT_CONFLICT');
  }
  assert.equal((await db.precisionBriefRun.findUniqueOrThrow({ where: { id: first.id } })).summary, input.summary);
  const second = (await admin.post(endpoint).send({ ...input, runKey: 'api-version-b', summary: '新版本内容正式发布。' }).expect(200)).body;
  await admin.post(endpoint).send(input).expect(409);
  assert.equal((await db.precisionBriefRun.findFirstOrThrow({ where: { isCurrent: true } })).id, second.id);
});

test('retry queue is claimable once and completing it preserves window and five task results', async () => {
  const input = fixture();
  const queued = await queuePrecisionBriefRun(db, projectId, { issueDate: input.issueDate, windowStart: new Date(input.windowStart), windowEnd: new Date(input.windowEnd), firstIssue: false });
  assert.equal(queued.tasks.length, 5); assert.ok(queued.tasks.every(task => task.status === 'queued'));
  const running = await claimPrecisionBriefRun(db, queued.id);
  assert.equal(running.status, 'running'); assert.ok(running.tasks.every(task => task.startedAt));
  await assert.rejects(claimPrecisionBriefRun(db, queued.id), /排队/);
  const published = await publishPrecisionBrief(db, projectId, { ...input, runId: queued.id, runKey: queued.runKey });
  assert.equal(published.id, queued.id); assert.equal(published.status, 'published'); assert.ok(published.tasks.every(task => task.completedAt));
});

test('precision API hides drafts and raw tasks from readers, project editors can inspect but only admin manages', async () => {
  const published = await publishPrecisionBrief(db, projectId, fixture());
  const admin = await login(), visitor = await login('visitor');
  await request(app).get(`/api/precision-brief/projects/${projectId}/current`).expect(401);
  const visible = (await visitor.get(`/api/precision-brief/projects/${projectId}/current`).expect(200)).body;
  assert.equal(visible.run.id, published.id); assert.equal(visible.run.tasks.length, 0); assert.equal(visible.run.validation, null);
  await visitor.get(`/api/precision-brief/projects/${projectId}/runs`).expect(403);
  await visitor.get(`/api/precision-brief/runs/${published.id}`).expect(403);
  await visitor.get(`/api/precision-brief/runs/${published.id}/sources`).expect(403);
  await visitor.post(`/api/precision-brief/projects/${projectId}/publish`).send(fixture('unauthorized')).expect(403);
  await visitor.post(`/api/precision-brief/runs/${published.id}/retry`).send({}).expect(403);
  await db.projectAccess.updateMany({ where: { projectId }, data: { canEditResearch: true } });
  assert.equal((await visitor.get(`/api/precision-brief/runs/${published.id}`).expect(200)).body.tasks.length, 5);
  await visitor.post(`/api/precision-brief/runs/${published.id}/retry`).send({}).expect(403);
  const queued = (await admin.post(`/api/precision-brief/runs/${published.id}/retry`).send({}).expect(201)).body;
  assert.equal(queued.status, 'queued'); assert.equal(queued.tasks.length, 5);
  const runs = (await admin.get(`/api/precision-brief/projects/${projectId}/runs`).expect(200)).body;
  assert.equal(runs.runs.length, 2);
  assert.equal((await admin.get(`/api/precision-brief/runs/${published.id}/sources`).expect(200)).body.length, 1);
  await admin.post(`/api/precision-brief/runs/${published.id}/rollback`).send({}).expect(200);
  await db.projectAccess.deleteMany();
  await visitor.get(`/api/precision-brief/projects/${projectId}/current`).expect(404);
});

test('failed source collection publishes nothing and current response sanitizes the failure details', async () => {
  const good = await publishPrecisionBrief(db, projectId, fixture('good'));
  const failed = fixture('bad'); failed.tasks[0].status = 'failed'; failed.tasks[0].errorMessage = '内部详细采集错误';
  await assert.rejects(publishPrecisionBrief(db, projectId, failed));
  const visitor = await login('visitor');
  const response = (await visitor.get(`/api/precision-brief/projects/${projectId}/current`).expect(200)).body;
  assert.equal(response.run.id, good.id); assert.equal(response.lastAttempt.status, 'failed');
  assert.ok(!JSON.stringify(response).includes('内部详细采集错误'));
});

test('current exposes only a validated project schedule and tolerates invalid config', async () => {
  const visitor = await login('visitor');
  const endpoint = `/api/precision-brief/projects/${projectId}/current`;
  const read = async () => (await visitor.get(endpoint).expect(200)).body;
  await db.config.create({ data: { key: 'precisionBrief.unrelated.secret', value: 'private-config-value' } });
  assert.equal((await read()).schedule, null);
  const key = `precisionBrief.schedule.${projectId}`;
  const schedule = { automationId: 'pm', enabled: true, configuredAt: new Date().toISOString(), timezone: 'Asia/Shanghai', hour: 9 };
  await db.config.create({ data: { key, value: JSON.stringify(schedule) } });
  const valid = await read();
  assert.deepEqual(valid.schedule, schedule);
  assert.ok(!JSON.stringify(valid).includes('private-config-value'));
  for (const value of ['{', JSON.stringify({ ...schedule, hour: 8 }), JSON.stringify({ ...schedule, enabled: 'true' }), JSON.stringify({ ...schedule, configuredAt: 'invalid' }), JSON.stringify({ ...schedule, secret: 'private-config-value' })]) {
    await db.config.update({ where: { key }, data: { value } });
    assert.equal((await read()).schedule, null);
  }
});
