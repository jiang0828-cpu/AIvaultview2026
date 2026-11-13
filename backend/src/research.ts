import type { Express } from 'express';
import { Prisma, type PrismaClient, type ResearchTask, type ResearchSynthesis, type User } from '@prisma/client';
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { fail, idOf, wrap } from './http.js';
import { requireContent } from './permissions.js';
import {
  conclusionLabels, researchDefinitions, researchKinds, researchProjectMarker, researchPrompt,
  researchStudyInput, researchTaskInput, type ResearchTaskView, type ResearchSource,
  type ResearchConclusion, type ResearchSynthesisView,
} from './researchSchema.js';

type Tx = Prisma.TransactionClient;
const revisionInput = z.object({ revision: z.number().int().positive() }).strict();
const studyUpdateInput = researchStudyInput.extend({ expectedUpdatedAt: z.string().datetime() });
const synthesisInput = z.object({
  expectedUpdatedAt: z.string().datetime(), status: z.enum(['draft', 'reviewed']),
  executiveSummary: z.string().trim().max(100000), marketOpportunity: z.string().trim().max(30000),
  targetUsers: z.string().trim().max(15000), feasibility: z.string().trim().max(15000),
  competition: z.string().trim().max(15000), risks: z.string().trim().max(15000),
  recommendation: z.string().trim().max(10000), openQuestions: z.array(z.string().trim().min(1).max(3000)).max(80),
}).strict();

export function researchTaskView(row: ResearchTask): ResearchTaskView {
  return { ...row, kind: z.enum(researchKinds).parse(row.kind),
    status: z.enum(['draft', 'ready', 'running', 'submitted', 'reviewed']).parse(row.status),
    sources: row.sources as ResearchSource[], conclusions: row.conclusions as ResearchConclusion[],
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null };
}
function synthesisView(row: ResearchSynthesis): ResearchSynthesisView {
  return { ...row, openQuestions: row.openQuestions as string[], sourceTaskIds: row.sourceTaskIds as number[],
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

async function projectAccess(tx: Tx, user: User, projectId: number, write = false) {
  const current = await tx.user.findUnique({ where: { id: user.id } });
  if (!current?.enabled) fail(404, 'NOT_FOUND', '项目不存在或无权访问');
  const project = await requireContent(tx as PrismaClient, current, projectId);
  if (!project.isProject || !project.description.includes(researchProjectMarker))
    fail(404, 'NOT_FOUND', '市场调研项目不存在或无权访问');
  const grant = await tx.projectAccess.findUnique({ where: { userId_projectId: { userId: current.id, projectId } } });
  const canEdit = current.role === 'admin' || (current.role !== 'share' && grant?.canEditResearch === true);
  if (write && !canEdit) fail(403, 'RESEARCH_READ_ONLY', '当前账号仅可阅读此调研项目');
  return canEdit;
}
async function studyAccess(tx: Tx, user: User, studyId: number, write = false) {
  const study = await tx.researchStudy.findUnique({ where: { id: studyId } });
  if (!study) fail(404, 'NOT_FOUND', '调研轮次不存在或无权访问');
  const canEdit = await projectAccess(tx, user, study.projectId, write);
  if (write && study.status === 'archived') fail(409, 'ARCHIVED', '已归档轮次仅可阅读和导出');
  return { study, canEdit };
}
async function taskAccess(tx: Tx, user: User, taskId: number, write = false) {
  const task = await tx.researchTask.findUnique({ where: { id: taskId } });
  if (!task) fail(404, 'NOT_FOUND', '子任务不存在或无权访问');
  await studyAccess(tx, user, task.studyId, write);
  return task;
}
async function studyView(tx: Tx, id: number, canEdit: boolean) {
  const row = await tx.researchStudy.findUniqueOrThrow({ where: { id }, include: { tasks: true, synthesis: true } });
  return { ...row, canEdit: canEdit && row.status !== 'archived',
    tasks: researchKinds.flatMap(kind => row.tasks.filter(task => task.kind === kind).map(researchTaskView)),
    synthesis: row.synthesis ? synthesisView(row.synthesis) : null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
async function snapshot(tx: Tx, task: ResearchTask) {
  // A revision is immutable; the initial state and every committed replacement are retained.
  await tx.researchTaskVersion.upsert({ where: { taskId_version: { taskId: task.id, version: task.revision } },
    create: { taskId: task.id, version: task.revision, snapshot: researchTaskView(task) as unknown as Prisma.InputJsonValue }, update: {} });
}
async function snapshotSynthesis(tx: Tx, row: ResearchSynthesis) {
  const value = synthesisView(row);
  const last = await tx.researchSynthesisVersion.findFirst({ where: { synthesisId: row.id }, orderBy: { id: 'desc' } });
  if (!last || !isDeepStrictEqual(last.snapshot, value))
    await tx.researchSynthesisVersion.create({ data: { synthesisId: row.id, snapshot: value as unknown as Prisma.InputJsonValue } });
}
function nextTimestamp(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}
async function updateStudyStatus(tx: Tx, studyId: number, status: string) {
  const study = await tx.researchStudy.findUniqueOrThrow({ where: { id: studyId } });
  return tx.researchStudy.update({ where: { id: studyId }, data: { status, updatedAt: nextTimestamp(study.updatedAt) } });
}
async function invalidate(tx: Tx, studyId: number) {
  const result = await tx.researchSynthesis.findUnique({ where: { studyId } });
  if (result && result.status !== 'stale') {
    await snapshotSynthesis(tx, result);
    await snapshotSynthesis(tx, await tx.researchSynthesis.update({ where: { id: result.id }, data: { status: 'stale', updatedAt: nextTimestamp(result.updatedAt) } }));
  }
  const active = await tx.researchTask.count({ where: { studyId, status: { not: 'draft' } } });
  await updateStudyStatus(tx, studyId, active ? 'in_progress' : 'draft');
}
function unchangedResult(task: ResearchTask, input: z.infer<typeof researchTaskInput>) {
  return Object.entries(input).filter(([key]) => key !== 'revision' && key !== 'status')
    .every(([key, value]) => isDeepStrictEqual(task[key as keyof ResearchTask], value));
}
function complete(task: ResearchTask) {
  const input = researchTaskInput.parse({ ...editableTask(task), status: 'submitted' });
  const placeholder = /^(?:待填写|待补充|待调研|示例|TODO|TBD|placeholder|未填写)[。.!！]?$/i;
  if ([input.report, input.limitations, input.openQuestions, ...input.conclusions.map(item => item.text)].some(text => placeholder.test(text.trim())))
    fail(400, 'INCOMPLETE_RESEARCH', '占位内容不能作为已完成的调研结果');
  for (const source of input.sources) {
    const hostname = new URL(source.url).hostname.toLowerCase();
    if (/^(?:www\.)?example\.(?:com|org|net)$/.test(hostname) || /(?:^|\.)(?:test|invalid|example)$/.test(hostname) || hostname === 'localhost')
      fail(400, 'INCOMPLETE_RESEARCH', '示例来源地址不能作为已完成的调研证据');
    if (source.published !== '未知' && source.published > input.asOf)
      fail(400, 'SOURCE_AFTER_CUTOFF', '来源发布日期不能晚于数据截止日期');
  }
  return input;
}
function editableTask(task: ResearchTask) {
  const { revision, title, prompt, inputMaterials, status, report, sources, conclusions, limitations, openQuestions, asOf, assignedTo, notes } = task;
  return { revision, title, prompt, inputMaterials, status, report, sources, conclusions, limitations, openQuestions, asOf, assignedTo, notes };
}
async function replaceTask(tx: Tx, old: ResearchTask, revision: number, data: Prisma.ResearchTaskUpdateManyMutationInput) {
  if (old.revision !== revision) fail(409, 'REVISION_CONFLICT', '任务已被其他编辑修改，请刷新后重试');
  await snapshot(tx, old);
  const result = await tx.researchTask.updateMany({ where: { id: old.id, revision }, data: { ...data, revision: { increment: 1 } } });
  if (result.count !== 1) fail(409, 'REVISION_CONFLICT', '任务已被其他编辑修改，请刷新后重试');
  const updated = await tx.researchTask.findUniqueOrThrow({ where: { id: old.id } });
  await snapshot(tx, updated);
  await invalidate(tx, old.studyId);
  return researchTaskView(updated);
}
async function completedTasks(tx: Tx, studyId: number) {
  const tasks = await tx.researchTask.findMany({ where: { studyId }, orderBy: { id: 'asc' } });
  if (tasks.length !== 4 || researchKinds.some(kind => tasks.filter(task => task.kind === kind).length !== 1) ||
    tasks.some(task => !['submitted', 'reviewed'].includes(task.status)))
    fail(409, 'RESEARCH_INCOMPLETE', '四类子任务必须全部提交或审核后才能汇总');
  tasks.forEach(complete);
  return tasks;
}
function refs(task: ResearchTask, conclusion: ResearchConclusion) {
  const references = conclusion.sourceIds.slice(0, 3).map(id => `[task#${task.id}/${id}]`).join(' ');
  return `${references}${conclusion.sourceIds.length > 3 ? `（其他来源见 task#${task.id} ）` : ''}`;
}
function excerpt(text: string, limit: number, taskId: number) {
  // User-authored text is kept in the task; source reference syntax below is generated separately.
  const digest = text.slice(0, limit).replaceAll('task#', 'task＃');
  return `${digest}\n【${text.length > limit ? '摘录；' : ''}完整原文见 task#${taskId} 】`;
}
function evidenceText(tasks: ResearchTask[]) {
  return tasks.map(task => `### ${task.title.replaceAll('task#', 'task＃')}\n${(task.conclusions as ResearchConclusion[]).map((item, index) =>
    `- C${index + 1}【${conclusionLabels[item.type]}】${excerpt(item.text, 800, task.id)} ${refs(task, item)}`).join('\n')}`).join('\n\n');
}
function validateSynthesisReferences(input: z.infer<typeof synthesisInput>, tasks: ResearchTask[]) {
  const allowed = new Set(tasks.flatMap(task => [`task#${task.id}`, ...(task.sources as ResearchSource[]).map(source => `task#${task.id}/${source.id}`)]));
  const fields = [input.executiveSummary, input.marketOpportunity, input.targetUsers, input.feasibility, input.competition, input.risks, input.recommendation, ...input.openQuestions];
  for (const text of fields) {
    for (const match of text.matchAll(/\[?(task#[^\s\]，。；,;]+)\]?/g)) {
      if (!allowed.has(match[1])) fail(400, 'INVALID_SOURCE_REFERENCE', '汇总包含不存在的任务或来源引用');
    }
  }
  if (input.status === 'reviewed' && (!input.recommendation || fields.slice(0, 6).some(value => !value)))
    fail(400, 'INCOMPLETE_SYNTHESIS', '审核前须填写各判断维度及总控建议');
  if (input.status === 'reviewed' && input.recommendation.startsWith('待人工总控'))
    fail(400, 'INCOMPLETE_SYNTHESIS', '请由人工总控填写建议后再审核');
  if (input.status === 'reviewed' && fields.slice(0, 6).some(text => !Array.from(text.matchAll(/\[(task#\d+\/[A-Za-z0-9_-]+)\]/g)).some(match => allowed.has(match[1]))))
    fail(400, 'EVIDENCE_REQUIRED', '摘要、市场、用户、可行性、竞争与风险各维度均须保留有效的来源引用');
}
async function requireResearchIdentity(tx: Tx, studyId: number) {
  const study = await tx.researchStudy.findUniqueOrThrow({ where: { id: studyId } });
  if (!study.researchObject.trim() || !study.goal.trim())
    fail(400, 'RESEARCH_IDENTITY_REQUIRED', '请先填写研究对象和目标，再分派或提交任务');
}
function inlineMarkdown(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');
}
function exportMarkdown(study: Awaited<ReturnType<typeof studyView>>) {
  const lines = [`# ${inlineMarkdown(study.title)}`, '', `研究对象：${inlineMarkdown(study.researchObject || '未填写')}`, `研究目标：${inlineMarkdown(study.goal || '未填写')}`, `轮次状态：${study.status}`, '',
    '> 本工作台不调用 LLM 或任务 API。以下为人工录入的研究资料及证据归并；事实、推断及总控决策须人工核查。', ''];
  if (study.synthesis) {
    const result = study.synthesis;
    lines.push(`## 总控报告（${result.status === 'stale' ? '已过期，须重新汇总并审核' : result.status === 'reviewed' ? '人工已审核' : '待人工审核'}）`, '');
    for (const [title, body] of [['执行摘要', result.executiveSummary], ['市场规模、机会与增长逻辑', result.marketOpportunity], ['目标用户', result.targetUsers], ['技术与产品可行性', result.feasibility], ['竞争格局', result.competition], ['风险与局限', result.risks], ['商业模式、进入路径与决策建议', result.recommendation]]) lines.push(`### ${title}`, '', body, '');
    lines.push('### 待验证问题', '', ...result.openQuestions.map(value => `- ${value}`), '');
  } else lines.push('## 总控报告', '', '尚未汇总。四类任务全部提交后可归并证据，供人工总控审核。', '');
  for (const task of study.tasks) {
    lines.push(`## ${task.title}`, '', `任务：task#${task.id}；状态：${task.status}；版本：${task.revision}；数据截止：${task.asOf || '未填写'}`, '', task.report, '', '### 类型化结论', '',
      ...task.conclusions.map((item, index) => `- C${index + 1}【${conclusionLabels[item.type]}】${item.text} ${item.sourceIds.map(id => `[task#${task.id}/${id}]`).join(' ')}`), '', '### 来源台账', '');
    for (const source of task.sources) lines.push(`- [task#${task.id}/${source.id}] ${inlineMarkdown(source.title)}｜${inlineMarkdown(source.publisher)}｜${source.published}｜${source.verified ? '人工已核查' : '未核查'}`,
      `  [原文](<${new URL(source.url).href.replace(/>/g, '%3E').replace(/</g, '%3C')}>)`, `  支持内容：${inlineMarkdown(source.supports)}`);
    lines.push('', '### 研究局限', '', task.limitations, '', '### 待验证问题', '', task.openQuestions, '');
  }
  return lines.join('\n');
}

export function registerResearch(app: Express, db: PrismaClient) {
  app.get('/api/research/projects/:id/access', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => ({ canEdit: await projectAccess(tx, res.locals.user, idOf(req.params.id)) })));
  }));
  app.get('/api/research/studies/:projectId', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const projectId = idOf(req.params.projectId);
      const canEdit = await projectAccess(tx, res.locals.user, projectId);
      const studies = await tx.researchStudy.findMany({ where: { projectId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
      return Promise.all(studies.map(study => studyView(tx, study.id, canEdit)));
    }));
  }));
  app.post('/api/research/studies', wrap(async (req, res) => {
    const { projectId, ...input } = researchStudyInput.extend({ projectId: z.number().int().positive() }).parse(req.body);
    res.status(201).json(await db.$transaction(async tx => {
      await projectAccess(tx, res.locals.user, projectId, true);
      const study = await tx.researchStudy.create({ data: { ...input, projectId,
        tasks: { create: researchDefinitions.map(item => ({ kind: item.kind, title: item.title,
          prompt: researchPrompt(item.kind, input.researchObject, input.goal), sources: [], conclusions: [] })) } } });
      for (const task of await tx.researchTask.findMany({ where: { studyId: study.id } })) await snapshot(tx, task);
      return studyView(tx, study.id, true);
    }));
  }));
  app.put('/api/research/studies/:id', wrap(async (req, res) => {
    const { expectedUpdatedAt, ...input } = studyUpdateInput.parse(req.body);
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id), true);
      if (study.updatedAt.toISOString() !== expectedUpdatedAt) fail(409, 'REVISION_CONFLICT', '调研轮次已更新，请刷新后重试');
      const tasks = await tx.researchTask.findMany({ where: { studyId: study.id } });
      if (tasks.some(task => task.status !== 'draft')) fail(409, 'RESEARCH_STARTED', '请先将四个任务重开为草稿，再更改研究对象、目标或标题');
      const changed = await tx.researchStudy.updateMany({ where: { id: study.id, updatedAt: new Date(expectedUpdatedAt) }, data: { ...input, updatedAt: nextTimestamp(study.updatedAt) } });
      if (changed.count !== 1) fail(409, 'REVISION_CONFLICT', '调研轮次已更新，请刷新后重试');
      for (const task of tasks) {
        if (task.prompt === researchPrompt(z.enum(researchKinds).parse(task.kind), study.researchObject, study.goal))
          await replaceTask(tx, task, task.revision, { prompt: researchPrompt(z.enum(researchKinds).parse(task.kind), input.researchObject, input.goal) });
      }
      await invalidate(tx, study.id);
      return studyView(tx, study.id, true);
    }));
  }));
  app.get('/api/research/studies/:id/tasks', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id));
      return (await studyView(tx, study.id, false)).tasks;
    }));
  }));
  app.put('/api/research/tasks/:id', wrap(async (req, res) => {
    const input = researchTaskInput.parse(req.body);
    res.json(await db.$transaction(async tx => {
      const task = await taskAccess(tx, res.locals.user, idOf(req.params.id), true);
      if (input.status !== 'draft') await requireResearchIdentity(tx, task.studyId);
      const order = ['draft', 'ready', 'running', 'submitted', 'reviewed'];
      if (input.status !== task.status && order.indexOf(input.status) !== order.indexOf(task.status) + 1)
        fail(409, 'INVALID_TRANSITION', '任务须按草稿、待分派、进行中、已提交、已审核顺序流转；重开请使用重开操作');
      if (['submitted', 'reviewed'].includes(task.status) && !unchangedResult(task, input))
        fail(409, 'RESET_REQUIRED', '已提交或审核的内容须先重开，历史结果会保留');
      if (['submitted', 'reviewed'].includes(input.status)) complete({ ...task, ...input } as ResearchTask);
      const { revision, ...data } = input;
      return replaceTask(tx, task, revision, { ...data,
        startedAt: input.status === 'running' && !task.startedAt ? new Date() : task.startedAt,
        completedAt: input.status === 'submitted' && !task.completedAt ? new Date() : task.completedAt });
    }));
  }));
  app.post('/api/research/tasks/:id/submit', wrap(async (req, res) => {
    const { revision } = revisionInput.parse(req.body);
    res.json(await db.$transaction(async tx => {
      const task = await taskAccess(tx, res.locals.user, idOf(req.params.id), true);
      if (task.status !== 'running') fail(409, 'INVALID_TRANSITION', '请先将任务标为进行中，再提交');
      await requireResearchIdentity(tx, task.studyId);
      complete(task);
      return replaceTask(tx, task, revision, { status: 'submitted', completedAt: new Date() });
    }));
  }));
  app.post('/api/research/tasks/:id/reset', wrap(async (req, res) => {
    const { revision } = revisionInput.parse(req.body);
    res.json(await db.$transaction(async tx => {
      const task = await taskAccess(tx, res.locals.user, idOf(req.params.id), true);
      return replaceTask(tx, task, revision, { status: 'draft', startedAt: null, completedAt: null });
    }));
  }));
  app.get('/api/research/tasks/:id/versions', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const task = await taskAccess(tx, res.locals.user, idOf(req.params.id));
      return (await tx.researchTaskVersion.findMany({ where: { taskId: task.id }, orderBy: { version: 'desc' } })).map(row => ({ id: row.id, version: row.version, snapshot: row.snapshot, createdAt: row.createdAt.toISOString() }));
    }));
  }));
  app.post('/api/research/studies/:id/synthesize', wrap(async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id), true);
      await requireResearchIdentity(tx, study.id);
      const tasks = await completedTasks(tx, study.id);
      const existing = await tx.researchSynthesis.findUnique({ where: { studyId: study.id } });
      if (existing && existing.status !== 'stale') fail(409, 'SYNTHESIS_EXISTS', '已有有效汇总，请编辑现有报告；子任务变化后可重新归并');
      if (existing) await snapshotSynthesis(tx, existing);
      const body = {
        status: 'draft', executiveSummary: `以下仅按四类已提交结论归并，未执行新的研究或自动推理。\n\n${evidenceText(tasks)}`,
        marketOpportunity: evidenceText(tasks.filter(task => task.kind === 'macro')),
        targetUsers: evidenceText(tasks.filter(task => task.kind === 'clinical_need')),
        feasibility: evidenceText(tasks.filter(task => task.kind === 'product_tech')),
        competition: evidenceText(tasks.filter(task => task.kind === 'competitors')),
        risks: tasks.map(task => `### ${task.title.replaceAll('task#', 'task＃')}\n${excerpt(task.limitations, 2000, task.id)}`).join('\n\n'),
        recommendation: '待人工总控综合证据、研究局限和待验证问题，填写商业模式、进入路径，以及继续、暂停或调整的决策建议与理由。',
        openQuestions: tasks.map(task => `${task.title.replaceAll('task#', 'task＃')}：${excerpt(task.openQuestions, 2000, task.id)}`), sourceTaskIds: tasks.map(task => task.id),
      };
      const result = await tx.researchSynthesis.upsert({ where: { studyId: study.id }, create: { ...body, studyId: study.id }, update: { ...body, ...(existing ? { updatedAt: nextTimestamp(existing.updatedAt) } : {}) } });
      await snapshotSynthesis(tx, result);
      await updateStudyStatus(tx, study.id, 'in_review');
      return synthesisView(result);
    }));
  }));
  app.put('/api/research/studies/:id/synthesis', wrap(async (req, res) => {
    const { expectedUpdatedAt, ...input } = synthesisInput.parse(req.body);
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id), true);
      const old = await tx.researchSynthesis.findUnique({ where: { studyId: study.id } });
      if (!old) fail(404, 'NOT_FOUND', '请先汇总四类任务');
      if (old.updatedAt.toISOString() !== expectedUpdatedAt) fail(409, 'REVISION_CONFLICT', '总控报告已更新，请刷新后重试');
      if (old.status === 'stale') fail(409, 'STALE_SYNTHESIS', '子任务已变化，请重新汇总后再编辑和审核');
      const tasks = await completedTasks(tx, study.id);
      validateSynthesisReferences({ ...input, expectedUpdatedAt }, tasks);
      await snapshotSynthesis(tx, old);
      // Make the concurrency token advance even when two requests occur in the same millisecond.
      const updatedAt = nextTimestamp(old.updatedAt);
      const result = await tx.researchSynthesis.updateMany({ where: { id: old.id, updatedAt: new Date(expectedUpdatedAt) }, data: { ...input, updatedAt } });
      if (result.count !== 1) fail(409, 'REVISION_CONFLICT', '总控报告已更新，请刷新后重试');
      await updateStudyStatus(tx, study.id, input.status === 'reviewed' ? 'reviewed' : 'in_review');
      const updated = await tx.researchSynthesis.findUniqueOrThrow({ where: { id: old.id } });
      await snapshotSynthesis(tx, updated);
      return synthesisView(updated);
    }));
  }));
  app.get('/api/research/studies/:id/synthesis/versions', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id));
      const result = await tx.researchSynthesis.findUnique({ where: { studyId: study.id } });
      if (!result) return [];
      return (await tx.researchSynthesisVersion.findMany({ where: { synthesisId: result.id }, orderBy: { id: 'desc' } }))
        .map(row => ({ id: row.id, snapshot: row.snapshot, createdAt: row.createdAt.toISOString() }));
    }));
  }));
  app.get('/api/research/studies/:id/export', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const { study, canEdit } = await studyAccess(tx, res.locals.user, idOf(req.params.id));
      const result = await studyView(tx, study.id, canEdit);
      const filename = Array.from(study.title, character => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character).join('');
      return { markdown: exportMarkdown(result), filename: `${filename}.md` };
    }));
  }));
  app.post('/api/research/studies/:id/archive', wrap(async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(await db.$transaction(async tx => {
      const { study } = await studyAccess(tx, res.locals.user, idOf(req.params.id), true);
      await updateStudyStatus(tx, study.id, 'archived');
      return studyView(tx, study.id, false);
    }));
  }));
}
