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
import { researchProjectMarker, researchPrompt, type ResearchStudyView, type ResearchTaskView } from '../src/researchSchema.js';
import { seedResearch } from '../prisma/seed-research.js';
import { seedCdxMarket } from '../prisma/seed-cdx-market.js';
import { researchTaskInput } from '../src/researchSchema.js';
import { seedTestUsers, type TestConfig } from './helpers.js';

const config: TestConfig = {
  adminUsername: 'admin', secret: 'research-tests-secret-at-least-32-characters',
  sitePassword: 'research-test-reader-password', siteHashed: false,
  adminPassword: 'research-test-admin-password', adminHashed: false,
  production: false, origin: 'http://localhost:5173',
};
let directory: string;
let db: PrismaClient;
let app: ReturnType<typeof createApp>;
let projectId: number;
let initialStudyId: number;
const identity = { title: '定向市场调研', researchObject: '测试用产品在目标区域的需求', goal: '核查需求与技术门槛' };

test('CDx report import preserves existing content and persists complete cited research without claiming human review', async () => {
  const beforeContent = await db.content.findMany({ orderBy: { id: 'asc' } });
  const beforeTemplate = await db.researchStudy.findUnique({ where: { id: initialStudyId }, include: { tasks: true } });
  const result = await seedCdxMarket(db);
  assert.equal(result.projectId, projectId);
  assert.equal(result.created, 6);
  assert.deepEqual(await db.content.findMany({ orderBy: { id: 'asc' } }), beforeContent);
  assert.deepEqual(await db.researchStudy.findUnique({ where: { id: initialStudyId }, include: { tasks: true } }), beforeTemplate);
  const admin = await login();
  const rows: ResearchStudyView[] = (await admin.get(`/api/research/studies/${projectId}`).expect(200)).body;
  const study = rows.find(row => row.id === result.studyId)!;
  assert.equal(study.status, 'in_review');
  assert.equal(study.tasks.length, 4);
  for (const task of study.tasks) {
    assert.equal(task.status, 'submitted');
    assert.equal(task.asOf, '2026-11-12');
    assert.ok(task.report.length > 800);
    assert.ok(task.sources.length >= 4);
    assert.ok(task.sources.every(source => !source.verified));
    assert.ok(researchTaskInput.safeParse(taskInput(task)).success);
    assert.equal((await admin.get(`/api/research/tasks/${task.id}/versions`).expect(200)).body.length, 1);
  }
  assert.equal(study.synthesis?.status, 'draft');
  assert.deepEqual(study.synthesis?.sourceTaskIds, study.tasks.map(task => task.id));
  const synthesis = study.synthesis!;
  for (const field of ['executiveSummary', 'marketOpportunity', 'targetUsers', 'feasibility', 'competition', 'risks'] as const) {
    const matches = [...synthesis[field].matchAll(/\[task#(\d+)\/([A-Za-z0-9_-]+)\]/g)];
    assert.ok(matches.length > 0);
    assert.ok(matches.every(match => study.tasks.some(task => task.id === Number(match[1]) && task.sources.some(source => source.id === match[2]))));
  }
  const exported = (await admin.get(`/api/research/studies/${study.id}/export`).expect(200)).body;
  assert.match(exported.markdown, /肿瘤伴随诊断/);
  assert.match(exported.markdown, /nhsa.gov.cn/);
  assert.match(exported.markdown, /BD机会/);
  const reader = await login('visitor');
  await db.projectAccess.deleteMany({ where: { projectId } });
  assert.deepEqual((await reader.get(`/api/research/studies/${projectId}`).expect(404)).body.error.code, 'NOT_FOUND');
});

test('CDx repeat import preserves renamed studies, edited reports and all versions', async () => {
  const result = await seedCdxMarket(db);
  await db.researchStudy.update({ where: { id: result.studyId }, data: { title: '负责人修改后的名称' } });
  const task = await db.researchTask.findFirstOrThrow({ where: { studyId: result.studyId } });
  await db.researchTask.update({ where: { id: task.id }, data: { report: '负责人保存的后续修订', revision: 2 } });
  const before = await db.researchStudy.findMany({ include: { tasks: { include: { versions: true } }, synthesis: { include: { versions: true } } } });
  assert.equal((await seedCdxMarket(db)).created, 0);
  assert.deepEqual(await db.researchStudy.findMany({ include: { tasks: { include: { versions: true } }, synthesis: { include: { versions: true } } } }), before);
});
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vault-research-'));
  const url = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  execFileSync(process.execPath, [resolve(projectRoot, 'backend/prisma/migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe', windowsHide: true,
  });
  db = new PrismaClient({ datasources: { db: { url } } });
  await db.$connect();
});
beforeEach(async () => {
  await db.user.deleteMany();
  await db.config.deleteMany({ where: { key: 'research.cdx-market.v1.studyId' } });
  await db.researchStudy.deleteMany();
  await db.content.updateMany({ data: { parentId: null } });
  await db.content.deleteMany();
  const seeded = await seedResearch(db);
  projectId = seeded.projectId;
  initialStudyId = seeded.studyId;
  await seedTestUsers(db, config);
  app = createApp(db, config);
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function login(username = 'admin') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username,
    password: username === 'admin' ? config.adminPassword : config.sitePassword }).expect(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof login>>;
function taskInput(task: ResearchTaskView, patch: Record<string, unknown> = {}) {
  const { revision, title, prompt, inputMaterials, status, report, sources, conclusions, limitations, openQuestions, asOf, assignedTo, notes } = task;
  return { revision, title, prompt, inputMaterials, status, report, sources, conclusions, limitations, openQuestions, asOf, assignedTo, notes, ...patch };
}
function evidence(task: ResearchTaskView) {
  return taskInput(task, {
    report: '隔离测试录入材料，仅用于验证证据链与状态控制，不构成真实市场研究。',
    sources: [{ id: 'S1', title: '测试台账记录一', publisher: '测试机构', published: '2026-10-01', url: 'https://www.who.int/publications', supports: '仅作为隔离测试来源字段', verified: true },
      { id: 'S2', title: '测试台账记录二', publisher: '第二测试机构', published: '未知', url: 'https://www.oecd.org/publications/', supports: '仅作为隔离测试来源字段', verified: false }],
    conclusions: [{ text: '隔离测试事实字段', type: 'verified_fact', sourceIds: ['S1'] },
      { text: '隔离测试多来源判断字段', type: 'multiple_sources', sourceIds: ['S1', 'S2'] },
      { text: '隔离测试假设字段，仍需验证', type: 'hypothesis', sourceIds: [] }],
    limitations: '此处是测试数据，未开展任何实际调研。', openQuestions: '需要实际调研和人工核验。', asOf: '2026-11-01',
  });
}
async function createStudy(admin: Agent): Promise<ResearchStudyView> {
  return (await admin.post('/api/research/studies').send({ ...identity, projectId }).expect(201)).body;
}
async function allSubmitted(admin: Agent) {
  const study = await createStudy(admin);
  const tasks: ResearchTaskView[] = [];
  for (const initial of study.tasks) {
    let task = (await admin.put(`/api/research/tasks/${initial.id}`).send(taskInput(initial, { status: 'ready' })).expect(200)).body;
    task = (await admin.put(`/api/research/tasks/${task.id}`).send({ ...evidence(task), status: 'running' }).expect(200)).body;
    assert.ok(task.startedAt);
    task = (await admin.post(`/api/research/tasks/${task.id}/submit`).send({ revision: task.revision }).expect(200)).body;
    assert.ok(task.completedAt);
    tasks.push(task);
  }
  return { ...study, tasks };
}
function synthesisBody(row: Record<string, unknown>, patch: Record<string, unknown> = {}) {
  const { executiveSummary, marketOpportunity, targetUsers, feasibility, competition, risks, recommendation, openQuestions, status, updatedAt } = row;
  return { executiveSummary, marketOpportunity, targetUsers, feasibility, competition, risks, recommendation, openQuestions, status, expectedUpdatedAt: updatedAt, ...patch };
}

test('seed is idempotent and preserves edited content, task data, history and grants', async () => {
  const firstTasks = await db.researchTask.findMany({ where: { studyId: initialStudyId } });
  assert.equal(firstTasks.length, 4);
  assert.ok(firstTasks.every(task => task.status === 'draft' && !task.report && (task.sources as unknown[]).length === 0));
  assert.equal(firstTasks[0].prompt, researchPrompt(firstTasks[0].kind as 'macro', '', ''));
  assert.equal(await db.researchTaskVersion.count(), 4);
  await db.content.update({ where: { id: projectId }, data: { title: '保留我的名称', description: `${researchProjectMarker}\n保留我的说明` } });
  await db.researchTask.update({ where: { id: firstTasks[0].id }, data: { notes: '保留我的笔记' } });
  const visitor = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.update({ where: { userId_projectId: { userId: visitor.id, projectId } }, data: { canEditResearch: true } });
  const repeated = await seedResearch(db);
  assert.equal(repeated.created, 0);
  assert.equal(repeated.projectId, projectId);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: projectId } })).title, '保留我的名称');
  assert.equal((await db.researchTask.findUniqueOrThrow({ where: { id: firstTasks[0].id } })).notes, '保留我的笔记');
  assert.equal((await db.projectAccess.findUniqueOrThrow({ where: { userId_projectId: { userId: visitor.id, projectId } } })).canEditResearch, true);
  assert.equal(await db.researchTaskVersion.count(), 4);
  const tutorial = await db.content.findFirstOrThrow({ where: { parentId: projectId, type: 'text' } });
  assert.match(tutorial.description, /不会自动启动子代理/);
  assert.match(tutorial.description, /3—8/);
});

test('seed detects marker conflicts without any partial inserts or overwrites', async () => {
  await db.content.create({ data: { title: '冲突标记', description: researchProjectMarker, type: 'text' } });
  const before = await db.content.count();
  await assert.rejects(seedResearch(db), /duplicated/);
  assert.equal(await db.content.count(), before);
  assert.equal(await db.researchStudy.count(), 1);
});

test('creation makes exactly four independent blank tasks; authenticated reader is read-only', async () => {
  await request(app).get(`/api/research/studies/${projectId}`).expect(401);
  const admin = await login();
  const reader = await login('visitor');
  const created = await createStudy(admin);
  assert.deepEqual(created.tasks.map(task => task.kind), ['macro', 'product_tech', 'competitors', 'clinical_need']);
  assert.ok(created.tasks.every(task => task.status === 'draft' && task.report === '' && task.sources.length === 0));
  const rows = (await reader.get(`/api/research/studies/${projectId}`).expect(200)).body as ResearchStudyView[];
  assert.equal(rows.find(study => study.id === created.id)?.canEdit, false);
  assert.equal((await reader.get(`/api/research/projects/${projectId}/access`).expect(200)).body.canEdit, false);
  const id = created.tasks[0].id;
  for (const route of [`/api/research/tasks/${id}/versions`, `/api/research/studies/${created.id}/tasks`, `/api/research/studies/${created.id}/synthesis/versions`, `/api/research/studies/${created.id}/export`]) await reader.get(route).expect(200);
  await reader.post('/api/research/studies').send({ ...identity, projectId }).expect(403);
  await reader.put(`/api/research/tasks/${id}`).send(taskInput(created.tasks[0])).expect(403);
  await reader.post(`/api/research/tasks/${id}/reset`).send({ revision: 1 }).expect(403);
  await reader.post(`/api/research/studies/${created.id}/archive`).send({}).expect(403);
  await reader.post(`/api/research/studies/${created.id}/synthesize`).send({}).expect(403);
  const visitor = await db.user.findUniqueOrThrow({ where: { username: 'visitor' } });
  await db.projectAccess.update({ where: { userId_projectId: { userId: visitor.id, projectId } }, data: { canEditResearch: true } });
  assert.equal((await reader.get(`/api/research/projects/${projectId}/access`)).body.canEdit, true);
  await reader.put(`/api/research/tasks/${id}`).send(taskInput(created.tasks[0], { notes: '授权编辑' })).expect(200);
  await db.projectAccess.deleteMany({ where: { userId: visitor.id } });
  for (const route of [`/api/research/studies/${projectId}`, `/api/research/projects/${projectId}/access`, `/api/research/tasks/${id}/versions`, `/api/research/studies/${created.id}/tasks`, `/api/research/studies/${created.id}/synthesis/versions`, `/api/research/studies/${created.id}/export`]) await reader.get(route).expect(404);
  await reader.post(`/api/research/tasks/${id}/submit`).send({ revision: 2 }).expect(404);
  await reader.put(`/api/research/studies/${created.id}`).send({ ...identity, expectedUpdatedAt: created.updatedAt }).expect(404);
});

test('state transitions, required completion, valid dates and source classifications are enforced', async () => {
  const admin = await login();
  const study = await createStudy(admin);
  let task = study.tasks[0];
  await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(409);
  await admin.put(`/api/research/tasks/${task.id}`).send(taskInput(task, { status: 'running' })).expect(409);
  await admin.post(`/api/research/tasks/${task.id}/submit`).send({ revision: task.revision }).expect(409);
  task = (await admin.put(`/api/research/tasks/${task.id}`).send(taskInput(task, { status: 'ready' })).expect(200)).body;
  task = (await admin.put(`/api/research/tasks/${task.id}`).send(taskInput(task, { status: 'running' })).expect(200)).body;
  await admin.post(`/api/research/tasks/${task.id}/submit`).send({ revision: task.revision }).expect(400);
  const valid = evidence(task);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, asOf: '2026-02-30' }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, sources: [{ ...valid.sources[0], url: 'javascript:alert(1)' }] }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, sources: [valid.sources[0], valid.sources[0]] }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, sources: [valid.sources[0], { ...valid.sources[1], url: `${valid.sources[0].url}#reprint` }] }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, conclusions: [{ text: '未知来源', type: 'single_source', sourceIds: ['MISSING'] }] }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, conclusions: [{ text: '错误分类', type: 'multiple_sources', sourceIds: ['S1'] }] }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, sources: valid.sources.map(source => ({ ...source, verified: false })) }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, status: 'submitted', sources: valid.sources.map(source => ({ ...source, url: 'https://example.com' })) }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, status: 'submitted', asOf: '2026-09-01' }).expect(400);
  await admin.put(`/api/research/tasks/${task.id}`).send({ ...valid, status: 'submitted', report: '待填写' }).expect(400);
  assert.equal((await db.researchTask.findUniqueOrThrow({ where: { id: task.id } })).revision, task.revision);
});

test('immutable task revisions, optimistic edits, explicit reopen and target change protection', async () => {
  const admin = await login();
  const study = await allSubmitted(admin);
  const old = study.tasks[0];
  await admin.put(`/api/research/tasks/${old.id}`).send(taskInput(old, { report: '不能直接覆盖' })).expect(409);
  const started = (await admin.get(`/api/research/studies/${projectId}`)).body.find((item: ResearchStudyView) => item.id === study.id);
  const guarded = await admin.put(`/api/research/studies/${study.id}`).send({ ...identity, researchObject: '新对象', expectedUpdatedAt: started.updatedAt }).expect(409);
  assert.equal(guarded.body.error.code, 'RESEARCH_STARTED');
  const reviewed = (await admin.put(`/api/research/tasks/${old.id}`).send(taskInput(old, { status: 'reviewed' })).expect(200)).body;
  const reopened = (await admin.post(`/api/research/tasks/${old.id}/reset`).send({ revision: reviewed.revision }).expect(200)).body;
  assert.equal(reopened.report, old.report);
  assert.equal(reopened.status, 'draft');
  assert.equal(reopened.startedAt, null);
  await admin.put(`/api/research/tasks/${old.id}`).send(taskInput(old, { status: 'draft' })).expect(409);
  await admin.post(`/api/research/tasks/${old.id}/reset`).send({ revision: old.revision }).expect(409);
  const versions = (await admin.get(`/api/research/tasks/${old.id}/versions`).expect(200)).body;
  assert.equal(versions.length, reopened.revision);
  assert.equal(versions.find((version: { version: number }) => version.version === old.revision).snapshot.status, 'submitted');
  assert.equal(versions.find((version: { version: number }) => version.version === 1).snapshot.report, '');
  const updated = (await admin.put(`/api/research/tasks/${reopened.id}`).send(taskInput(reopened, { prompt: '保留自定义提示词' })).expect(200)).body;
  for (const task of study.tasks.slice(1)) await admin.post(`/api/research/tasks/${task.id}/reset`).send({ revision: task.revision }).expect(200);
  const readyToChange = (await admin.get(`/api/research/studies/${projectId}`)).body.find((item: ResearchStudyView) => item.id === study.id);
  const changed = (await admin.put(`/api/research/studies/${study.id}`).send({ ...identity, researchObject: '新对象', expectedUpdatedAt: readyToChange.updatedAt }).expect(200)).body;
  assert.equal(changed.tasks[0].prompt, '保留自定义提示词');
  assert.equal(changed.tasks[0].revision, updated.revision);
  assert.match(changed.tasks[1].prompt, /新对象/);
});

test('traceable synthesis, human review, stale blocking, safe export and archive retention', async () => {
  const admin = await login();
  const study = await allSubmitted(admin);
  let result = (await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(200)).body;
  await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(409);
  assert.match(result.executiveSummary, /未执行新的研究或自动推理/);
  assert.match(result.executiveSummary, new RegExp(`task#${study.tasks[0].id}/S1`));
  assert.match(result.executiveSummary, /已核实事实/);
  assert.match(result.recommendation, /^待人工总控/);
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(result, { status: 'reviewed' })).expect(400);
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(result, { competition: '[task#9999/S1]' })).expect(400);
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(result, { status: 'reviewed', recommendation: '人工判断', risks: '没有来源的判断' })).expect(400);
  const reference = `[task#${study.tasks[0].id}/S1]`;
  result = (await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(result, { status: 'reviewed', recommendation: '人工判断：继续核验需求再决策。', risks: `${result.risks}\n${reference}` })).expect(200)).body;
  const exported = (await admin.get(`/api/research/studies/${study.id}/export`).expect(200)).body;
  assert.match(exported.markdown, /人工已审核/);
  assert.match(exported.markdown, /来源台账/);
  assert.match(exported.markdown, /https:\/\/www.who.int\/publications/);
  assert.match(exported.filename, /\.md$/);
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(result, { expectedUpdatedAt: '2020-01-01T00:00:00.000Z' })).expect(409);
  const task = study.tasks[0];
  const reopened = (await admin.post(`/api/research/tasks/${task.id}/reset`).send({ revision: task.revision }).expect(200)).body;
  const stale = (await admin.get(`/api/research/studies/${projectId}`)).body.find((item: ResearchStudyView) => item.id === study.id);
  assert.equal(stale.synthesis.status, 'stale');
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(stale.synthesis, { status: 'draft' })).expect(409);
  await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(409);
  assert.match((await admin.get(`/api/research/studies/${study.id}/export`)).body.markdown, /已过期/);
  let again = (await admin.put(`/api/research/tasks/${reopened.id}`).send(taskInput(reopened, { status: 'ready' })).expect(200)).body;
  again = (await admin.put(`/api/research/tasks/${again.id}`).send(taskInput(again, { status: 'running' })).expect(200)).body;
  await admin.post(`/api/research/tasks/${again.id}/submit`).send({ revision: again.revision }).expect(200);
  const regenerated = (await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(200)).body;
  assert.equal(regenerated.status, 'draft');
  assert.match(regenerated.recommendation, /^待人工总控/);
  const synthesisVersions = (await admin.get(`/api/research/studies/${study.id}/synthesis/versions`).expect(200)).body;
  assert.ok(synthesisVersions.some((version: { snapshot: { recommendation: string; status: string } }) => version.snapshot.recommendation === '人工判断：继续核验需求再决策。' && version.snapshot.status === 'reviewed'));
  assert.ok(synthesisVersions.some((version: { snapshot: { status: string } }) => version.snapshot.status === 'stale'));
  const historyBefore = await db.researchTaskVersion.count();
  await admin.post(`/api/research/studies/${study.id}/archive`).send({}).expect(200);
  await admin.put(`/api/research/tasks/${reopened.id}`).send(taskInput(reopened)).expect(409);
  assert.equal(await db.researchTaskVersion.count(), historyBefore);
  await admin.get(`/api/research/studies/${study.id}/export`).expect(200);
});

test('research marker is required even on otherwise readable projects', async () => {
  const admin = await login();
  const ordinary = await db.content.create({ data: { title: '普通项目', isProject: true, type: 'folder' } });
  await admin.post('/api/research/studies').send({ ...identity, projectId: ordinary.id }).expect(404);
  await admin.get(`/api/research/studies/${ordinary.id}`).expect(404);
  await admin.get(`/api/research/projects/${ordinary.id}/access`).expect(404);
  const template = (await admin.get(`/api/research/studies/${projectId}`)).body.find((study: ResearchStudyView) => study.id === initialStudyId);
  await admin.put(`/api/research/tasks/${template.tasks[0].id}`).send(taskInput(template.tasks[0], { status: 'ready' })).expect(400);
});

test('research records prevent deleting a project or removing its project identity after archive', async () => {
  const admin = await login();
  await admin.post(`/api/research/studies/${initialStudyId}/archive`).send({}).expect(200);
  // Remove the tutorial so the research retention guard is exercised directly.
  await db.content.deleteMany({ where: { parentId: projectId } });
  const project = await db.content.findUniqueOrThrow({ where: { id: projectId } });
  const tasksBefore = await db.researchTask.count({ where: { studyId: initialStudyId } });
  const versionsBefore = await db.researchTaskVersion.count();
  const grantsBefore = await db.projectAccess.count({ where: { projectId } });
  const converted = await admin.put(`/api/contents/${projectId}`).send({
    title: project.title, type: 'folder', isProject: false, scene: project.scene,
    topics: ['business', 'AI'], description: project.description, parentId: project.parentId,
  }).expect(409);
  assert.equal(converted.body.error.code, 'HAS_RESEARCH');
  const deleted = await admin.delete(`/api/contents/${projectId}`).send({}).expect(409);
  assert.equal(deleted.body.error.code, 'HAS_RESEARCH');
  const editableProject = {
    title: project.title, type: 'folder', isProject: true, scene: project.scene,
    topics: project.topics, description: project.description, parentId: project.parentId,
  };
  const missingMarker = await admin.put(`/api/contents/${projectId}`).send({ ...editableProject, description: '去掉工作台入口标记的说明' }).expect(409);
  assert.equal(missingMarker.body.error.code, 'HAS_RESEARCH');
  const lifeRoot = await db.content.create({ data: { title: '生活测试目录', type: 'folder', scene: 'life' } });
  const movedScene = await admin.put(`/api/contents/${projectId}`).send({ ...editableProject, scene: 'work', parentId: lifeRoot.id }).expect(409);
  assert.equal(movedScene.body.error.code, 'HAS_RESEARCH');
  const unmoved = await db.content.findUniqueOrThrow({ where: { id: projectId } });
  assert.equal(unmoved.parentId, project.parentId);
  assert.equal(unmoved.scene, 'work');
  const renamed = (await admin.put(`/api/contents/${projectId}`).send({ ...editableProject,
    title: '人工修改的研究项目名称', description: `${researchProjectMarker}\n人工更新说明，保留调研入口。`,
  }).expect(200)).body;
  assert.equal(renamed.title, '人工修改的研究项目名称');
  assert.match(renamed.description, /人工更新说明/);
  assert.equal((await db.content.findUniqueOrThrow({ where: { id: projectId } })).isProject, true);
  assert.equal((await db.researchStudy.findUniqueOrThrow({ where: { id: initialStudyId } })).status, 'archived');
  assert.equal(await db.researchTask.count({ where: { studyId: initialStudyId } }), tasksBefore);
  assert.equal(await db.researchTaskVersion.count(), versionsBefore);
  assert.equal(await db.projectAccess.count({ where: { projectId } }), grantsBefore);
  await admin.get(`/api/research/studies/${initialStudyId}/export`).expect(200);
});

test('study identity uses a monotonic concurrency token and preserves the winning edit', async () => {
  const admin = await login();
  const study = await createStudy(admin);
  const updated = (await admin.put(`/api/research/studies/${study.id}`).send({ ...identity, researchObject: '编辑者一的新对象', expectedUpdatedAt: study.updatedAt }).expect(200)).body;
  assert.ok(new Date(updated.updatedAt).getTime() > new Date(study.updatedAt).getTime());
  const versionsAfterWinning = await db.researchTaskVersion.count();
  const conflict = await admin.put(`/api/research/studies/${study.id}`).send({ ...identity, researchObject: '编辑者二的旧页面覆盖', expectedUpdatedAt: study.updatedAt }).expect(409);
  assert.equal(conflict.body.error.code, 'REVISION_CONFLICT');
  assert.equal(await db.researchTaskVersion.count(), versionsAfterWinning);
  const persisted = await db.researchStudy.findUniqueOrThrow({ where: { id: study.id } });
  assert.equal(persisted.researchObject, '编辑者一的新对象');
  const again = (await admin.put(`/api/research/studies/${study.id}`).send({ ...identity, researchObject: '使用最新版本继续编辑', expectedUpdatedAt: updated.updatedAt }).expect(200)).body;
  assert.ok(new Date(again.updatedAt).getTime() > new Date(updated.updatedAt).getTime());
});

test('maximum length task evidence produces editable annotated summaries and retains full originals', async () => {
  const admin = await login();
  const study = await createStudy(admin);
  const text = `原文含引用样式 [task#9999/S1]，${'研'.repeat(2970)}`.slice(0, 3000);
  for (const initial of study.tasks) {
    let task = (await admin.put(`/api/research/tasks/${initial.id}`).send(taskInput(initial, { status: 'ready' })).expect(200)).body;
    const basic = evidence(task);
    const sources = Array.from({ length: 8 }, (_, index) => ({ ...basic.sources[0], id: `S${index + 1}`, url: `https://www.who.int/publications/test-${index + 1}` }));
    task = (await admin.put(`/api/research/tasks/${task.id}`).send({ ...basic, status: 'running', sources,
      conclusions: Array.from({ length: 8 }, () => ({ text, type: 'multiple_sources', sourceIds: sources.map(source => source.id) })),
      limitations: '限'.repeat(5000), openQuestions: '问'.repeat(5000),
    }).expect(200)).body;
    await admin.post(`/api/research/tasks/${task.id}/submit`).send({ revision: task.revision }).expect(200);
  }
  const generated = (await admin.post(`/api/research/studies/${study.id}/synthesize`).send({}).expect(200)).body;
  assert.match(generated.executiveSummary, /摘录/);
  assert.match(generated.executiveSummary, /其他来源见/);
  assert.ok(generated.risks.length < 15000);
  assert.ok(generated.openQuestions.every((question: string) => question.length < 3000));
  const draftBody = synthesisBody(generated);
  assert.ok(Buffer.byteLength(JSON.stringify(draftBody)) < 512 * 1024);
  const draft = (await admin.put(`/api/research/studies/${study.id}/synthesis`).send(draftBody).expect(200)).body;
  const reference = `[task#${study.tasks[0].id}/S1]`;
  await admin.put(`/api/research/studies/${study.id}/synthesis`).send(synthesisBody(draft, { status: 'reviewed', recommendation: '人工判断：先补足证据，再决定进入路径。', risks: `${draft.risks}\n${reference}` })).expect(200);
  const stored = (await admin.get(`/api/research/studies/${study.id}/tasks`).expect(200)).body;
  assert.ok(stored.every((task: ResearchTaskView) => task.conclusions.length === 8 && task.conclusions[0].text === text && task.conclusions[0].sourceIds.length === 8 && task.limitations.length === 5000 && task.openQuestions.length === 5000));
});

test('large valid task payloads retain eighty full sources and fifty thousand report characters', async () => {
  const admin = await login();
  const study = await createStudy(admin);
  const initial = study.tasks[0];
  const sources = Array.from({ length: 80 }, (_, index) => ({
    id: `S${index + 1}`, title: '源'.repeat(300), publisher: '机'.repeat(160),
    published: '未知', url: `https://www.who.int/publications/${index + 1}?query=${'a'.repeat(1950)}`,
    supports: '据'.repeat(2000), verified: false,
  }));
  const payload = taskInput(initial, {
    prompt: '示'.repeat(15000), inputMaterials: '料'.repeat(15000), report: '报'.repeat(50000), sources,
    conclusions: Array.from({ length: 8 }, () => ({ text: '论'.repeat(3000), type: 'inference', sourceIds: ['S1'] })),
    limitations: '限'.repeat(5000), openQuestions: '问'.repeat(5000), notes: '记'.repeat(5000),
  });
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  assert.ok(bytes > 512 * 1024 && bytes < 3 * 1024 * 1024);
  const saved = (await admin.put(`/api/research/tasks/${initial.id}`).send(payload).expect(200)).body;
  assert.equal(saved.sources.length, 80);
  assert.equal(saved.sources[79].supports, sources[79].supports);
  assert.equal(saved.report, payload.report);
  assert.equal(saved.prompt, payload.prompt);
  const history = (await admin.get(`/api/research/tasks/${initial.id}/versions`).expect(200)).body;
  assert.equal(history[0].snapshot.report, payload.report);
  assert.equal(history[0].snapshot.sources.length, 80);
});
