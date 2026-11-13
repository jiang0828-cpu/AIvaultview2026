import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { resolve } from "node:path";
import { Prisma, type PrismaClient, type Content } from "@prisma/client";
import { z } from "zod";
import { projectRoot, type AppConfig } from "./config.js";
import { projectCycles, hasProjectCycle } from "./projectTags.js";
import { authentication, createShortShareToken, resolveShareToken, sharePasswordMatches, createShareGrant, readShareGrant, type ShareTarget } from './auth.js';
import { fail, HttpError, wrap, idOf } from './http.js';
import { readableContents, requireContent, validateProjectTree, canReadMedia, canReadContentMedia, canonicalPath } from './permissions.js';
import { registerResearch } from './research.js';
import { registerPrecisionBrief } from './precisionBrief.js';
import { researchProjectMarker } from './researchSchema.js';
import { registerCompare } from './compare.js';
import { registerInvestment } from './investment.js';
import { registerHealth } from './health.js';
import { pageInputSchema, readPageSnapshot, rowsAllowMedia, savePageSnapshot, sharedRows } from './shareScope.js';

export const sceneKeys = [
  "system",
  "tools",
  "life",
  "work",
  "hobbies",
  "other",
] as const;
export type SceneKey = (typeof sceneKeys)[number];
export const projectCycleKeys = projectCycles;
const mediaUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (canonicalPath(value))
      return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "媒体地址须为 /media/ 路径或 HTTP(S) URL")
  .nullable()
  .optional();
const contentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    isProject: z.boolean().default(false),
    type: z.enum([
      "folder",
      "video",
      "ppt",
      "mindmap",
      "longimage",
      "pdf",
      "text",
    ]),
    scene: z.enum(sceneKeys).default("other"),
    topics: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(
            /^[\p{L}\p{N}][\p{L}\p{N}&+._-]*$/u,
            "标签只能包含字母、数字、&、+、点或短横线",
          ),
      )
      .min(1)
      .max(3)
      .default(["other"]),
    description: z.string().max(100000).default(""),
    coverUrl: mediaUrl,
    fileUrl: mediaUrl,
    hlsUrl: mediaUrl,
    pdfUrl: mediaUrl,
    imagesJson: z.array(mediaUrl.unwrap().unwrap()).max(300).default([]),
    assetsJson: z.array(z.string().refine(value => canonicalPath(value) !== null, '附加资源须为 /media/ 本地路径')).max(300).default([]),
    sortOrder: z.number().int().min(-100000).max(100000).default(0),
    parentId: z.number().int().positive().nullable().default(null),
  })
  .strict()
  .superRefine((data, ctx) => {
    const isProject = data.isProject;
    if (isProject && data.type !== 'folder')
      ctx.addIssue({ code: 'custom', path: ['isProject'], message: '项目必须是目录' });
    if (!isProject && data.topics.length > 2)
      ctx.addIssue({
        code: "custom",
        path: ["topics"],
        message: "普通资料最多设置 2 个标签",
      });
    if (isProject && data.topics.length !== 3)
      ctx.addIssue({
        code: "custom",
        path: ["topics"],
        message: "项目必须设置 3 个标签：第一个为项目周期，后两个为主题",
      });
    if (isProject && !projectCycleKeys.includes(data.topics[0] as (typeof projectCycleKeys)[number]))
      ctx.addIssue({
        code: "custom",
        path: ["topics", 0],
        message: "项目第一个标签必须是：长期性、阶段性或临时性",
      });
    if (data.type === "video" && !data.fileUrl && !data.hlsUrl)
      ctx.addIssue({
        code: "custom",
        path: ["fileUrl"],
        message: "请填写视频或 HLS 地址",
      });
    if (
      (data.type === "ppt" || data.type === "longimage") &&
      !data.imagesJson.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["imagesJson"],
        message:
          data.type === "ppt" ? "请添加至少一张幻灯片" : "请添加至少一张长图",
      });
    if (data.type === "pdf" && !data.pdfUrl && !data.fileUrl)
      ctx.addIssue({
        code: "custom",
        path: ["pdfUrl"],
        message: "请填写 PDF 地址",
      });
  });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD").refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "日期无效");
const tripPlanStatus = z.enum(["planned", "ongoing", "completed", "cancelled"]);
const tripPlanItem = z.object({
  date: isoDate,
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(2000).default(""),
}).strict();
const tripPlanInput = z.object({
  title: z.string().trim().min(1, "请填写安排名称").max(120),
  destination: z.string().trim().min(1, "请填写目的地").max(200),
  startDate: isoDate,
  endDate: isoDate,
  status: tripPlanStatus.default("planned"),
  transport: z.string().trim().max(200).default(""),
  companions: z.string().trim().max(200).default(""),
  budget: z.number().int().min(0).max(1000000000).nullable().default(null),
  actualSpent: z.number().int().min(0).max(1000000000).nullable().default(null),
  itinerary: z.array(tripPlanItem).max(90).default([]),
  notes: z.string().trim().max(10000).default(""),
}).strict().superRefine((value, ctx) => {
  if (value.endDate < value.startDate)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "结束日期不能早于开始日期" });
  value.itinerary.forEach((item, index) => {
    if (item.date < value.startDate || item.date > value.endDate)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["itinerary", index, "date"], message: "行程日期必须在出行日期内" });
  });
});

function tripPlanView(row: { id: number; projectId: number; title: string; destination: string; startDate: string; endDate: string; status: string; transport: string; companions: string; budget: number | null; actualSpent: number | null; itinerary: unknown; notes: string; createdAt: Date; updatedAt: Date }) {
  return { ...row, itinerary: Array.isArray(row.itinerary) ? row.itinerary : [] };
}
type TreeNode = Content & { children: TreeNode[] };
export function buildTree(rows: Content[]): TreeNode[] {
  const nodes = new Map(
    rows.map((row) => [row.id, { ...row, children: [] as TreeNode[] }]),
  );
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function createApp(db: PrismaClient, config: AppConfig) {
  const app = express();
  app.set('trust proxy', config.trustProxy || false);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { "frame-ancestors": ["'self'"] } },
    }),
  );
  app.use('/api/research', express.json({ limit: '3mb' }));
  app.use('/api/investment', express.json({ limit: '350kb' }));
  app.use('/api/share-links', express.json({ limit: '800kb' }));
  app.use(express.json({ limit: "150kb" }), cookieParser());
  app.use(["/api", "/media"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const auth = authentication(db, config);
  const { authorize, admin, passwordReady } = auth;
  app.use((req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (
        (req.headers.origin && req.headers.origin !== config.origin) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        return next(new HttpError(403, "ORIGIN_REJECTED", "请求来源不允许"));
      if (!req.is("application/json"))
        return next(new HttpError(415, "JSON_REQUIRED", "请使用 JSON 请求"));
    }
    next();
  });
  const shareAttempts = new Map<string, { count: number; expires: number }>();
  app.post('/api/share-links/verify', wrap(async (req, res) => {
    const now = Date.now();
    for (const [key, value] of shareAttempts) if (value.expires <= now) shareAttempts.delete(key);
    const ip = req.ip || 'unknown';
    const attempt = shareAttempts.get(ip) || { count: 0, expires: now + 900000 };
    if (attempt.count >= 5) {
      const retryAfter = Math.ceil((attempt.expires - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: { code: 'LOCKED', message: '尝试次数过多，请稍后再试', retryAfter } });
    }
    if (shareAttempts.size >= 10000 && !shareAttempts.has(ip)) return fail(429, 'BUSY', '请稍后再试');
    shareAttempts.set(ip, { ...attempt, count: attempt.count + 1 });
    const input = z.object({ token: z.string().min(16).max(4096), password: z.string().min(1).max(256) }).strict().parse(req.body);
    let target: ShareTarget;
    let shareToken: string;
    try { ({ target, token: shareToken } = await resolveShareToken(db, config, input.token)); } catch { return fail(401, 'INVALID_SHARE_LINK', '分享链接无效或已过期'); }
    if (!await sharePasswordMatches(db, config, input.password)) return fail(401, 'INVALID_SHARE_PASSWORD', '分享密码不正确');
    shareAttempts.delete(ip);
    res.set('Cache-Control', 'private, no-store');
    res.cookie('yaocang_page_share', await createShareGrant(db, config, shareToken), {
      httpOnly: true, secure: config.production, sameSite: 'strict', path: '/', maxAge: 86400000,
    });
    if (target.kind === 'trip') {
      const plan = await db.tripPlan.findFirst({ where: { id: target.tripId, projectId: target.projectId }, include: { project: { select: { id: true, title: true } } } });
      if (!plan) return fail(404, 'SHARE_NOT_FOUND', '分享内容不存在');
      return res.json({ kind: 'trip', project: plan.project, plan: {
        id: plan.id, title: plan.title, destination: plan.destination, startDate: plan.startDate,
        endDate: plan.endDate, status: plan.status, transport: plan.transport, companions: plan.companions,
        budget: plan.budget, actualSpent: plan.actualSpent, itinerary: plan.itinerary, notes: plan.notes,
        updatedAt: plan.updatedAt,
      } });
    }
    if (target.kind === 'project') {
      const rows = await sharedRows(db, target.contentId, target.ownerId);
      return res.json({ kind: 'project', items: buildTree(rows), rootId: target.contentId });
    }
    if (target.kind === 'page') {
      const owner = await db.user.findUnique({ where: { id: target.ownerId } });
      if (!owner?.enabled || owner.mustChangePassword) return fail(404, 'SHARE_NOT_FOUND', '分享页面已撤回');
      if (target.contentId) await requireContent(db, owner, target.contentId);
      const page = await readPageSnapshot(db, target.pageId);
      return res.json({ kind: 'page', page: { title: page.title, nodes: page.nodes, capturedAt: page.capturedAt } });
    }
    const content = await db.content.findUnique({ where: { id: target.contentId } });
    if (!content || content.type === 'folder') return fail(404, 'SHARE_NOT_FOUND', '分享内容不存在');
    res.json({ kind: 'content', content: {
      id: content.id, title: content.title, type: content.type, isProject: content.isProject,
      scene: content.scene, topics: content.topics, description: content.description,
      coverUrl: content.coverUrl, fileUrl: content.fileUrl, hlsUrl: content.hlsUrl, pdfUrl: content.pdfUrl,
      imagesJson: content.imagesJson, assetsJson: content.assetsJson, sortOrder: content.sortOrder,
      createdAt: content.createdAt, updatedAt: content.updatedAt,
    } });
  }));
  auth.register(app);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", authorize, passwordReady, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (res.locals.role === "share" && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !["/log", "/auth/logout"].includes(req.path))
      return next(new HttpError(403, "READ_ONLY_SHARE", "分享浏览账号仅可浏览资料"));
    next();
  });
  auth.registerAdmin(app);
  registerResearch(app, db);
  registerPrecisionBrief(app, db);
  registerCompare(app, db, config);
  registerInvestment(app, db, config);
  registerHealth(app, db);
  app.post('/api/share-links', wrap(async (req, res) => {
    const input = z.object({
      kind: z.enum(['trip', 'content', 'project', 'page']), projectId: z.number().int().positive().optional(),
      tripId: z.number().int().positive().optional(), contentId: z.number().int().positive().optional(),
      page: pageInputSchema.optional(),
    }).strict().superRefine((data, ctx) => {
      if (data.kind === 'trip' && (!data.projectId || !data.tripId)) ctx.addIssue({ code: 'custom', message: '旅行分享需要 projectId 和 tripId' });
      if (data.kind === 'content' && !data.contentId) ctx.addIssue({ code: 'custom', message: '资料分享需要 contentId' });
      if (data.kind === 'project' && !data.contentId) ctx.addIssue({ code: 'custom', message: '项目分享需要 contentId' });
      if (data.kind === 'page' && !data.page) ctx.addIssue({ code: 'custom', message: '页面分享需要页面内容' });
    }).parse(req.body);
    let target: ShareTarget;
    if (input.kind === 'trip') {
      const plan = await db.tripPlan.findFirst({ where: { id: input.tripId, projectId: input.projectId, userId: res.locals.user.id } });
      if (!plan) return fail(404, 'NOT_FOUND', '行程不存在或无权分享');
      await requireContent(db, res.locals.user, input.projectId!);
      target = { kind: 'trip', projectId: input.projectId!, tripId: input.tripId! };
    } else if (input.kind === 'project') {
      const content = await requireContent(db, res.locals.user, input.contentId!);
      if (content.type !== 'folder') return fail(400, 'INVALID_SHARE_TARGET', '项目或板块分享需要目录');
      target = { kind: 'project', contentId: content.id, ownerId: res.locals.user.id };
    } else if (input.kind === 'page') {
      const pageId = await savePageSnapshot(db, res.locals.user, input.contentId, input.page!);
      target = { kind: 'page', pageId, ownerId: res.locals.user.id, ...(input.contentId ? { contentId: input.contentId } : {}) };
    } else {
      const content = await requireContent(db, res.locals.user, input.contentId!);
      if (content.type === 'folder') return fail(400, 'INVALID_SHARE_TARGET', '只能分享单份资料');
      target = { kind: 'content', contentId: input.contentId! };
    }
    const code = await createShortShareToken(db, config, target);
    res.status(201).json({ url: `${config.origin.replace(/\/$/, '')}/s/${code}`, expiresInDays: 30 });
  }));
  app.get("/api/trip-plans", wrap(async (req, res) => {
    const projectId = idOf(req.query.projectId);
    const project = await requireContent(db, res.locals.user, projectId);
    if (!project.isProject) return fail(400, "NOT_PROJECT", "安排必须归属于项目");
    const rows = await db.tripPlan.findMany({
      where: { userId: res.locals.user.id, projectId },
      orderBy: [{ startDate: "asc" }, { updatedAt: "desc" }],
    });
    res.json(rows.map(tripPlanView));
  }));
  app.post("/api/trip-plans", wrap(async (req, res) => {
    const { projectId, ...input } = z.object({ projectId: z.number().int().positive() }).passthrough().parse(req.body);
    const project = await requireContent(db, res.locals.user, projectId);
    if (!project.isProject) return fail(400, "NOT_PROJECT", "安排必须归属于项目");
    const data = tripPlanInput.parse(input);
    const row = await db.tripPlan.create({ data: { ...data, projectId, userId: res.locals.user.id } });
    res.status(201).json(tripPlanView(row));
  }));
  app.put("/api/trip-plans/:id", wrap(async (req, res) => {
    const id = idOf(req.params.id);
    const current = await db.tripPlan.findFirst({ where: { id, userId: res.locals.user.id } });
    if (!current) return fail(404, "NOT_FOUND", "安排不存在或无权访问");
    const project = await requireContent(db, res.locals.user, current.projectId);
    if (!project.isProject) return fail(400, "NOT_PROJECT", "安排必须归属于项目");
    const data = tripPlanInput.parse(req.body);
    const row = await db.tripPlan.update({ where: { id }, data });
    res.json(tripPlanView(row));
  }));
  app.delete("/api/trip-plans/:id", wrap(async (req, res) => {
    const id = idOf(req.params.id);
    const current = await db.tripPlan.findFirst({ where: { id, userId: res.locals.user.id } });
    if (!current) return fail(404, "NOT_FOUND", "安排不存在或无权访问");
    await requireContent(db, res.locals.user, current.projectId);
    await db.tripPlan.delete({ where: { id } });
    res.status(204).end();
  }));
  app.get(
    "/api/literature/:projectId/writers",
    wrap(async (req, res) => {
      const projectId = idOf(req.params.projectId);
      const project = await requireContent(db, res.locals.user, projectId);
      if (!project?.description.includes("<!-- LITERATURE_PROJECT -->"))
        fail(404, "NOT_FOUND", "文学项目不存在");
      const rows = await db.literaryWriter.findMany({ where: { projectId }, orderBy: { id: "asc" } });
      res.json(rows.map((row) => row.data));
    }),
  );
  app.get(
    "/api/contents",
    wrap(async (_req, res) =>
      res.json(
        buildTree(
          await readableContents(db, res.locals.user),
        ),
      ),
    ),
  );
  app.get(
    "/api/contents/:id",
    wrap(async (req, res) => {
      const row = await requireContent(db, res.locals.user, idOf(req.params.id));
      res.json(row);
    }),
  );
  async function validateParent(
    tx: Prisma.TransactionClient,
    parentId: number | null,
    id?: number,
  ) {
    let current = parentId;
    const visited = new Set<number>();
    while (current !== null) {
      if (current === id || visited.has(current))
        fail(400, "INVALID_PARENT", "不能将内容放入自身或其子目录");
      visited.add(current);
      const parent: Content | null = await tx.content.findUnique({
        where: { id: current },
      });
      if (!parent || parent.type !== "folder")
        fail(400, "INVALID_PARENT", "父级必须是已存在的目录");
      current = parent!.parentId;
    }
  }
  app.post(
    "/api/contents",
    admin,
    wrap(async (req, res) => {
      const data = contentSchema.parse(req.body);
      const row = await db.$transaction(async (tx) => {
        const parent = data.parentId
          ? await tx.content.findUnique({ where: { id: data.parentId } })
          : null;
        if (data.parentId && (!parent || parent.type !== "folder"))
          fail(400, "INVALID_PARENT", "父级必须是已存在的目录");
        await validateParent(tx, data.parentId);
        await validateProjectTree(tx, data);
        return tx.content.create({
          data: parent ? { ...data, scene: parent.scene } : data,
        });
      });
      res.status(201).json(row);
    }),
  );
  app.put(
    "/api/contents/:id",
    admin,
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      const data = contentSchema.parse(req.body);
      const row = await db.$transaction(async (tx) => {
        const current = await tx.content.findUnique({ where: { id } });
        if (!current) fail(404, "NOT_FOUND", "资料不存在");
        const parent = data.parentId
          ? await tx.content.findUnique({ where: { id: data.parentId } })
          : null;
        if (data.parentId && (!parent || parent.type !== "folder"))
          fail(400, "INVALID_PARENT", "父级必须是已存在的目录");
        await validateParent(tx, data.parentId, id);
        await validateProjectTree(tx, data, id);
        if (current.isProject && (!data.isProject || data.type !== 'folder' || (parent?.scene ?? data.scene) !== 'work' || !data.description.includes(researchProjectMarker)) && await tx.researchStudy.count({ where: { projectId: id } }))
          fail(409, 'HAS_RESEARCH', '项目中仍有调研记录，不能移除研究入口或取消项目身份');
        if (current.isProject && !data.isProject && await tx.tripPlan.count({ where: { projectId: id } }))
          fail(409, "HAS_TRIP_PLANS", "项目中仍有出行安排，不能取消项目身份");
        if (current.isProject && !data.isProject)
          await tx.projectAccess.deleteMany({ where: { projectId: id } });
        if (
          data.type !== "folder" &&
          (await tx.content.count({ where: { parentId: id } }))
        )
          fail(409, "HAS_CHILDREN", "请先移动或删除目录中的内容");
        return tx.content.update({
          where: { id },
          data: parent ? { ...data, scene: parent.scene } : data,
        });
      });
      res.json(row);
    }),
  );
  app.patch(
    "/api/contents/:id/cycle",
    admin,
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      const { cycle } = z.object({ cycle: z.enum(projectCycles) }).strict().parse(req.body);
      const row = await db.$transaction(async (tx) => {
        const current = await tx.content.findUnique({ where: { id } });
        if (!current) return fail(404, "NOT_FOUND", "项目不存在");
        if (!current.isProject)
          return fail(400, "NOT_PROJECT", "只能修改项目的周期标签");
        if (!hasProjectCycle(current.topics))
          return fail(400, "INVALID_PROJECT_TOPICS", "请先在内容管理中设置项目周期和两个主题标签");
        return tx.content.update({
          where: { id },
          data: { topics: [cycle, ...current.topics.slice(1)] },
        });
      });
      res.json(row);
    }),
  );
  app.delete(
    "/api/contents/:id",
    admin,
    wrap(async (req, res) => {
      const id = idOf(req.params.id);
      await db.$transaction(async (tx) => {
        if (await tx.content.count({ where: { parentId: id } }))
          fail(409, "HAS_CHILDREN", "请先移动或删除目录中的内容");
        if (await tx.literaryWriter.count({ where: { projectId: id } }))
          fail(409, "HAS_WRITERS", "请先归档或移除项目的人物档案");
        if (await tx.tripPlan.count({ where: { projectId: id } }))
          fail(409, "HAS_TRIP_PLANS", "项目中仍有出行安排，不能删除项目");
        if (await tx.researchStudy.count({ where: { projectId: id } }))
          fail(409, 'HAS_RESEARCH', '项目中仍有调研记录，请保留项目及其历史版本');
        await tx.content.delete({ where: { id } });
      });
      res.status(204).end();
    }),
  );
  app.post(
    "/api/log",
    wrap(async (req, res) => {
      const data = z
        .object({
          contentId: z.number().int().positive(),
          action: z.enum([
            "view_video",
            "view_ppt",
            "view_mindmap",
            "view_longimage",
            "view_pdf",
            "view_text",
            "download",
          ]),
        })
        .strict()
        .parse(req.body);
      await requireContent(db, res.locals.user, data.contentId);
      await db.accessLog.create({
        data: {
          ...data,
          userId: res.locals.user.id,
          ip: req.ip || "unknown",
          userAgent: req.get("user-agent")?.slice(0, 512),
        },
      });
      res.status(201).json({ ok: true });
    }),
  );
  const mediaFiles = express.static(resolve(projectRoot, 'backend/media'), { dotfiles: 'deny', index: false, cacheControl: false });
  app.use('/media', wrap(async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || !req.cookies.yaocang_page_share) return next();
    let target: ShareTarget;
    try { target = await readShareGrant(db, config, req.cookies.yaocang_page_share); } catch { return next(); }
    let allowed = false;
    if (target.kind === 'content') {
      const content = await db.content.findUnique({ where: { id: target.contentId } });
      allowed = !!content && await canReadContentMedia(content, req.path);
    } else if (target.kind === 'project') {
      allowed = await rowsAllowMedia(await sharedRows(db, target.contentId, target.ownerId), req.path);
    } else if (target.kind === 'page') {
      const owner = await db.user.findUnique({ where: { id: target.ownerId } });
      if (owner?.enabled && !owner.mustChangePassword) {
        if (target.contentId) await requireContent(db, owner, target.contentId);
        const page = await readPageSnapshot(db, target.pageId);
        allowed = await canReadContentMedia({ assetsJson: page.media } as Content, req.path);
      }
    }
    if (!allowed) return next();
    res.set('Cache-Control', 'private, no-store');
    mediaFiles(req, res, next);
  }));
  app.use(
    "/media",
    authorize,
    passwordReady,
    (req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      void canReadMedia(db, res.locals.user, req.path).then(allowed => {
        if (!allowed) return next(new HttpError(404, 'NOT_FOUND', '资源不存在'));
        next();
      }, next);
    },
    express.static(resolve(projectRoot, "backend/media"), {
      dotfiles: "deny",
      index: false,
      cacheControl: false,
    }),
  );
  app.use((_req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "资源不存在")),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues[0]?.message || "输入有误",
            fields: error.flatten().fieldErrors,
          },
        });
        return;
      }
      if (error instanceof HttpError) {
        res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      ) {
        res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: '用户名已存在' } });
        return;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        res
          .status(404)
          .json({ error: { code: "NOT_FOUND", message: "资料不存在" } });
        return;
      }
      if (
        error instanceof SyntaxError ||
        (typeof error === "object" &&
          error !== null &&
          "type" in error &&
          error.type === "entity.too.large")
      ) {
        res.status(400).json({
          error: {
            code: "INVALID_BODY",
            message: "请求内容格式不正确或过大",
          },
        });
        return;
      }
      console.error(
        "Request failed:",
        error instanceof Error ? error.name : "Unknown error",
      );
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "服务暂时不可用，请稍后重试",
        },
      });
    },
  );
  return app;
}
