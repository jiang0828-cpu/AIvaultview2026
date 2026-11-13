import type { Express } from 'express';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, idOf, wrap } from './http.js';
import { requireContent } from './permissions.js';
import { precisionBriefEditionPayload, precisionBriefProjectMarker, precisionBriefSections, precisionBriefScheduleSchema, validatePrecisionBriefForPublish, type PrecisionBriefInput,
  type PrecisionBriefRunSummary, type PrecisionBriefRunView, type PrecisionBriefTaskView, type PrecisionBriefItemView, type PrecisionBriefSourceView } from './precisionBriefSchema.js';

type Tx = Prisma.TransactionClient;
const include = { tasks: true, items: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] }, sources: true };
type FullRun = Prisma.PrecisionBriefRunGetPayload<{ include: typeof include }>;
export function precisionBriefRunView(row: FullRun, inspect = true): PrecisionBriefRunView {
  return { ...precisionBriefRunSummary(row), validation: inspect ? row.validation : null,
    tasks: inspect ? precisionBriefSections.flatMap(kind => row.tasks.filter(task => task.kind === kind).map(task => ({ ...task,
      kind: task.kind as PrecisionBriefTaskView['kind'], status: task.status as PrecisionBriefTaskView['status'],
      startedAt: task.startedAt?.toISOString() ?? null, completedAt: task.completedAt?.toISOString() ?? null }))) : [],
    items: precisionBriefSections.flatMap(section => row.items.filter(item => item.section === section).map(item => ({ ...item,
      section: item.section as PrecisionBriefItemView['section'], severity: item.severity as PrecisionBriefItemView['severity'], sourceIds: item.sourceIds as string[] }))),
    sources: row.sources.map(source => ({ ...source, sourceType: source.sourceType as PrecisionBriefSourceView['sourceType'], accessedAt: source.accessedAt.toISOString() })),
  };
}
export function precisionBriefRunSummary(row: Prisma.PrecisionBriefRunGetPayload<object>): PrecisionBriefRunSummary {
  return { id: row.id, projectId: row.projectId, runKey: row.runKey, issueDate: row.issueDate,
    windowStart: row.windowStart.toISOString(), windowEnd: row.windowEnd.toISOString(), firstIssue: row.firstIssue,
    status: row.status as PrecisionBriefRunSummary['status'], summary: row.summary, publishedAt: row.publishedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage, isCurrent: row.isCurrent, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
async function requireProject(tx: Tx, projectId: number) {
  const project = await tx.content.findUnique({ where: { id: projectId } });
  if (!project?.isProject || project.type !== 'folder' || project.scene !== 'work' || !project.description.includes(precisionBriefProjectMarker))
    fail(404, 'NOT_FOUND', '精准医疗简报项目不存在');
  return project;
}
async function access(tx: Tx, user: User, projectId: number, inspect = false, manage = false) {
  const current = await tx.user.findUnique({ where: { id: user.id } });
  if (!current?.enabled) fail(404, 'NOT_FOUND', '项目不存在或无权访问');
  await requireContent(tx as PrismaClient, current, projectId);
  await requireProject(tx, projectId);
  const grant = await tx.projectAccess.findUnique({ where: { userId_projectId: { userId: user.id, projectId } } });
  const canManage = current.role === 'admin', canInspect = canManage || (current.role !== 'share' && grant?.canEditResearch === true);
  if (manage && !canManage) fail(403, 'ADMIN_REQUIRED', '只有管理员可以发布或重跑日报');
  if (inspect && !canInspect) fail(403, 'BRIEF_READ_ONLY', '当前账号仅可阅读已发布日报');
  return { canManage, canInspect };
}
async function requireRun(tx: Tx, id: number) {
  return await tx.precisionBriefRun.findUnique({ where: { id }, include }) ?? fail(404, 'NOT_FOUND', '日报运行不存在或无权访问');
}

export async function queuePrecisionBriefRun(db: PrismaClient, projectId: number, window?: { issueDate: string; windowStart: Date; windowEnd: Date; firstIssue: boolean }) {
  return db.$transaction(async tx => {
    await requireProject(tx, projectId);
    const end = window?.windowEnd ?? new Date();
    const created = await tx.precisionBriefRun.create({ data: { projectId, runKey: `queued-${randomUUID()}`,
      issueDate: window?.issueDate ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(end),
      windowStart: window?.windowStart ?? new Date(end.getTime() - 86400000), windowEnd: end, firstIssue: window?.firstIssue ?? false,
      status: 'queued', validation: {}, tasks: { create: precisionBriefSections.map(kind => ({ kind, status: 'queued' })) } }, include });
    return precisionBriefRunView(created);
  });
}

export async function claimPrecisionBriefRun(db: PrismaClient, runId: number) {
  return db.$transaction(async tx => {
    const old = await requireRun(tx, runId);
    await requireProject(tx, old.projectId);
    if (old.status !== 'queued') fail(409, 'RUN_NOT_QUEUED', '只有排队任务可以开始执行');
    const changed = await tx.precisionBriefRun.updateMany({ where: { id: old.id, status: 'queued' }, data: { status: 'running' } });
    if (changed.count !== 1) fail(409, 'RUN_ALREADY_CLAIMED', '运行已被其他调度领取');
    await tx.precisionBriefTask.updateMany({ where: { runId }, data: { status: 'running', startedAt: new Date() } });
    return precisionBriefRunView(await requireRun(tx, runId));
  });
}

export async function failPrecisionBriefRun(db: PrismaClient, projectId: number, input: unknown, errors: string[]) {
  const raw = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  const metadata = z.object({ runId: z.number().int().positive().optional(), runKey: z.string().min(1).max(120), issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), windowStart: z.string().datetime({ offset: true }), windowEnd: z.string().datetime({ offset: true }), firstIssue: z.boolean().optional() }).safeParse(raw);
  if (!metadata.success) return null;
  return db.$transaction(async tx => {
    await requireProject(tx, projectId);
    const old = metadata.data.runId ? await tx.precisionBriefRun.findFirst({ where: { id: metadata.data.runId, projectId } })
      : await tx.precisionBriefRun.findUnique({ where: { projectId_runKey: { projectId, runKey: metadata.data.runKey } } });
    if (old?.status === 'published') return precisionBriefRunSummary(old);
    if (metadata.data.runId && !old) fail(404, 'NOT_FOUND', '指定运行不属于本项目');
    const data = { status: 'failed', errorMessage: errors.join('；').slice(0, 4000), validation: { passed: false, errors }, isCurrent: false };
    const row = old ? await tx.precisionBriefRun.update({ where: { id: old.id }, data }) : await tx.precisionBriefRun.create({ data: {
      projectId, runKey: metadata.data.runKey, issueDate: metadata.data.issueDate, windowStart: new Date(metadata.data.windowStart), windowEnd: new Date(metadata.data.windowEnd), firstIssue: metadata.data.firstIssue ?? false, ...data,
    } });
    const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    for (const kind of precisionBriefSections) {
      const rawTask = rawTasks.find(task => typeof task === 'object' && task !== null && (task as Record<string, unknown>).kind === kind) as Record<string, unknown> | undefined;
      const text = (field: string, max: number) => typeof rawTask?.[field] === 'string' ? (rawTask[field] as string).slice(0, max) : '';
      const task = { status: rawTask && ['completed', 'no_news', 'failed'].includes(String(rawTask.status)) ? String(rawTask.status) : 'failed',
        rawReport: text('rawReport', 30000), coverage: text('coverage', 5000), completedAt: new Date(),
        errorMessage: text('errorMessage', 2000) || (!rawTask ? '本次运行未完成该专题' : '') };
      await tx.precisionBriefTask.upsert({ where: { runId_kind: { runId: row.id, kind } }, create: { runId: row.id, kind, ...task }, update: task });
    }
    return precisionBriefRunSummary(row);
  });
}

export async function publishPrecisionBrief(db: PrismaClient, projectId: number, input: unknown): Promise<PrecisionBriefRunView> {
  const validation = validatePrecisionBriefForPublish(input);
  if (!validation.success || !validation.data) {
    await failPrecisionBriefRun(db, projectId, input, validation.errors);
    fail(400, 'BRIEF_VALIDATION_FAILED', validation.errors.join('；').slice(0, 4000));
  }
  const value: PrecisionBriefInput = validation.data;
  return db.$transaction(async tx => {
    await requireProject(tx, projectId);
    const old = value.runId ? await tx.precisionBriefRun.findFirst({ where: { id: value.runId, projectId }, include })
      : await tx.precisionBriefRun.findUnique({ where: { projectId_runKey: { projectId, runKey: value.runKey } }, include });
    if (value.runId && !old) fail(404, 'NOT_FOUND', '指定运行不属于本项目');
    if (old?.status === 'published') {
      const published = precisionBriefRunView(old);
      if (!old.isCurrent) fail(409, 'HISTORICAL_RUN', '此运行已是历史版本，请新建修订版本或显式回退');
      if (JSON.stringify(precisionBriefEditionPayload(value)) !== JSON.stringify(precisionBriefEditionPayload(published))) {
        fail(409, 'BRIEF_CONTENT_CONFLICT', '此runKey已发布其他内容，修订日报请使用新的runKey');
      }
      return published;
    }
    if (old?.status === 'failed') fail(409, 'FAILED_RUN', '失败运行保留为记录，请新建重试再发布');
    if (old && old.runKey !== value.runKey) fail(409, 'RUN_KEY_MISMATCH', '生成结果的runKey与排队运行不一致');
    if (old && (old.issueDate !== value.issueDate || old.windowStart.getTime() !== Date.parse(value.windowStart) || old.windowEnd.getTime() !== Date.parse(value.windowEnd))) fail(409, 'RUN_WINDOW_MISMATCH', '生成结果不得更改排队运行的资料窗口');
    const current = await tx.precisionBriefRun.findFirst({ where: { projectId, isCurrent: true } });
    if (current && current.windowEnd.getTime() > Date.parse(value.windowEnd)) fail(409, 'OLDER_BRIEF', '旧窗口不能自动覆盖更新的日报，请显式回退');
    const now = new Date();
    const data = { issueDate: value.issueDate, windowStart: new Date(value.windowStart), windowEnd: new Date(value.windowEnd),
      firstIssue: value.firstIssue, summary: value.summary, status: 'published', publishedAt: now, errorMessage: '', validation: { passed: true, checkedAt: now.toISOString(), itemCount: value.items.length, sourceCount: value.sources.length } };
    const run = old ? await tx.precisionBriefRun.update({ where: { id: old.id }, data }) : await tx.precisionBriefRun.create({ data: { projectId, runKey: value.runKey, ...data } });
    if (old) {
      await tx.precisionBriefTask.deleteMany({ where: { runId: old.id } });
      await tx.precisionBriefItem.deleteMany({ where: { runId: old.id } });
      await tx.precisionBriefSource.deleteMany({ where: { runId: old.id } });
    }
    await tx.precisionBriefTask.createMany({ data: value.tasks.map(task => ({ ...task, runId: run.id, startedAt: old?.tasks.find(previous => previous.kind === task.kind)?.startedAt ?? now, completedAt: now })) });
    if (value.items.length) await tx.precisionBriefItem.createMany({ data: value.items.map(item => ({ ...item, runId: run.id })) });
    if (value.sources.length) await tx.precisionBriefSource.createMany({ data: value.sources.map(source => ({ ...source, accessedAt: new Date(source.accessedAt), runId: run.id })) });
    await tx.precisionBriefRun.updateMany({ where: { projectId, isCurrent: true }, data: { isCurrent: false } });
    await tx.precisionBriefRun.update({ where: { id: run.id }, data: { isCurrent: true } });
    return precisionBriefRunView(await requireRun(tx, run.id));
  }, { timeout: 15000 });
}

export function registerPrecisionBrief(app: Express, db: PrismaClient) {
  app.get('/api/precision-brief/projects/:projectId/current', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const projectId = idOf(req.params.projectId), rights = await access(tx, res.locals.user, projectId);
      const run = await tx.precisionBriefRun.findFirst({ where: { projectId, isCurrent: true, status: 'published' }, include });
      const lastAttempt = await tx.precisionBriefRun.findFirst({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      const configured = await tx.config.findUnique({ where: { key: `precisionBrief.schedule.${projectId}` } });
      let schedule = null;
      if (configured) {
        try {
          const parsed = precisionBriefScheduleSchema.safeParse(JSON.parse(configured.value));
          if (parsed.success) schedule = parsed.data;
        } catch { /* Invalid schedule metadata must not prevent reading the current brief. */ }
      }
      const last = lastAttempt ? precisionBriefRunSummary(lastAttempt) : null;
      if (last && !rights.canInspect) { last.runKey = ''; last.summary = ''; last.errorMessage = last.status === 'failed' ? '本次更新失败，保留上一份已发布日报。' : ''; }
      return { run: run ? precisionBriefRunView(run, rights.canInspect) : null, lastAttempt: last, schedule, ...rights };
    }));
  }));
  app.get('/api/precision-brief/projects/:projectId/runs', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const projectId = idOf(req.params.projectId), rights = await access(tx, res.locals.user, projectId, true);
      const runs = await tx.precisionBriefRun.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
      return { runs: runs.map(precisionBriefRunSummary), ...rights };
    }));
  }));
  app.get('/api/precision-brief/runs/:runId', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const run = await requireRun(tx, idOf(req.params.runId));
      await access(tx, res.locals.user, run.projectId, true);
      return precisionBriefRunView(run);
    }));
  }));
  app.get('/api/precision-brief/runs/:runId/sources', wrap(async (req, res) => {
    res.json(await db.$transaction(async tx => {
      const run = await requireRun(tx, idOf(req.params.runId));
      await access(tx, res.locals.user, run.projectId, true);
      return precisionBriefRunView(run).sources;
    }));
  }));
  app.post('/api/precision-brief/runs/:runId/retry', wrap(async (req, res) => {
    z.object({}).strict().parse(req.body);
    const run = await db.$transaction(async tx => { const row = await requireRun(tx, idOf(req.params.runId)); await access(tx, res.locals.user, row.projectId, false, true); return row; });
    res.status(201).json(await queuePrecisionBriefRun(db, run.projectId, run));
  }));
  app.post('/api/precision-brief/projects/:projectId/publish', wrap(async (req, res) => {
    const projectId = idOf(req.params.projectId);
    await db.$transaction(tx => access(tx, res.locals.user, projectId, false, true));
    res.json(await publishPrecisionBrief(db, projectId, req.body));
  }));
  app.post('/api/precision-brief/runs/:runId/rollback', wrap(async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(await db.$transaction(async tx => {
      const run = await requireRun(tx, idOf(req.params.runId));
      await access(tx, res.locals.user, run.projectId, false, true);
      if (run.status !== 'published') fail(409, 'NOT_PUBLISHED', '仅可回退到已发布的日报');
      await tx.precisionBriefRun.updateMany({ where: { projectId: run.projectId, isCurrent: true }, data: { isCurrent: false } });
      return precisionBriefRunView(await tx.precisionBriefRun.update({ where: { id: run.id }, data: { isCurrent: true }, include }));
    }));
  }));
}
