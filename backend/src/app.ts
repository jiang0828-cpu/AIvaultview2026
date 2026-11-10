import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { Prisma, type PrismaClient, type Content } from "@prisma/client";
import { z } from "zod";
import { projectRoot, type AppConfig } from "./config.js";

type Role = "visitor" | "admin";
export const sceneKeys = [
  "system",
  "tools",
  "life",
  "work",
  "hobbies",
  "other",
] as const;
export type SceneKey = (typeof sceneKeys)[number];
export const projectCycleKeys = ["长期性", "阶段性", "临时性"] as const;
class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, code: string, message: string): never => {
  throw new HttpError(status, code, message);
};
const wrap =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
const mediaUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/media\/[\w/.-]+$/.test(value) && !value.split("/").includes(".."))
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
    sortOrder: z.number().int().min(-100000).max(100000).default(0),
    parentId: z.number().int().positive().nullable().default(null),
  })
  .strict()
  .superRefine((data, ctx) => {
    const isProject =
      data.type === "folder" &&
      (data.title.startsWith("项目") || data.title === "爱的城堡");
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
const idOf = (value: unknown) =>
  z.coerce.number().int().positive().parse(value);
const digest = (value: string) => createHash("sha256").update(value).digest();
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
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { "frame-ancestors": ["'self'"] } },
    }),
  );
  app.use(express.json({ limit: "150kb" }), cookieParser());
  app.use(["/api", "/media"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const cookieOptions = {
    httpOnly: true,
    secure: config.production,
    sameSite: "strict" as const,
    path: "/",
  };
  const passwordFor = (role: Role) =>
    role === "admin" ? config.adminPassword : config.sitePassword;
  const versionFor = (role: Role) =>
    createHmac("sha256", config.secret)
      .update(`${role}:${passwordFor(role)}`)
      .digest("hex");
  const authorize = (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = jwt.verify(
        req.cookies.yaocang_session || "",
        config.secret,
        { algorithms: ["HS256"], issuer: "yaocang", audience: "yaocang-web" },
      );
      if (
        typeof payload === "string" ||
        !["visitor", "admin"].includes(payload.role) ||
        payload.version !== versionFor(payload.role)
      )
        throw new Error("Invalid session");
      res.locals.role = payload.role;
      next();
    } catch {
      res
        .status(401)
        .json({ error: { code: "UNAUTHORIZED", message: "请先输入访问密码" } });
    }
  };
  const admin = (_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.role !== "admin") {
      res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } });
      return;
    }
    next();
  };
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
  const attempts = new Map<string, { count: number; expires: number }>();
  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const { password, role } = z
        .object({
          password: z.string().min(1).max(256),
          role: z.enum(["visitor", "admin"]).default("visitor"),
        })
        .strict()
        .parse(req.body);
      const ip = req.ip || "unknown";
      const now = Date.now();
      for (const [key, value] of attempts)
        if (value.expires <= now) attempts.delete(key);
      const previous = attempts.get(ip);
      if (previous && previous.count >= 5) {
        const seconds = Math.ceil((previous.expires - now) / 1000);
        res.set("Retry-After", String(seconds));
        res.status(429).json({
          error: {
            code: "LOCKED",
            message: "尝试次数过多，请稍后再试",
            retryAfter: seconds,
          },
        });
        return;
      }
      const hashed = role === "admin" ? config.adminHashed : config.siteHashed;
      const valid = hashed
        ? await bcrypt.compare(password, passwordFor(role))
        : timingSafeEqual(digest(password), digest(passwordFor(role)));
      if (!valid) {
        if (attempts.size >= 10000 && !attempts.has(ip))
          fail(429, "BUSY", "请稍后再试");
        attempts.set(ip, {
          count: (previous?.count || 0) + 1,
          expires: previous?.expires || now + 15 * 60 * 1000,
        });
        fail(401, "INVALID_PASSWORD", "密码不正确");
      }
      attempts.delete(ip);
      const token = jwt.sign(
        { role, version: versionFor(role) },
        config.secret,
        {
          algorithm: "HS256",
          expiresIn: "30d",
          issuer: "yaocang",
          audience: "yaocang-web",
        },
      );
      res.cookie("yaocang_session", token, {
        ...cookieOptions,
        maxAge: 30 * 86400000,
      });
      await db.accessLog.create({
        data: {
          ip,
          userAgent: req.get("user-agent")?.slice(0, 512),
          action: "login",
        },
      });
      res.json({ role });
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", authorize, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/auth/me", (_req, res) => res.json({ role: res.locals.role }));
  app.get(
    "/api/literature/:projectId/writers",
    wrap(async (req, res) => {
      const projectId = idOf(req.params.projectId);
      const project = await db.content.findUnique({ where: { id: projectId } });
      if (!project?.description.includes("<!-- LITERATURE_PROJECT -->"))
        fail(404, "NOT_FOUND", "文学项目不存在");
      const rows = await db.literaryWriter.findMany({ where: { projectId }, orderBy: { id: "asc" } });
      res.json(rows.map((row) => row.data));
    }),
  );
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie("yaocang_session", cookieOptions).json({ ok: true });
  });
  app.get(
    "/api/contents",
    wrap(async (_req, res) =>
      res.json(
        buildTree(
          await db.content.findMany({
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          }),
        ),
      ),
    ),
  );
  app.get(
    "/api/contents/:id",
    wrap(async (req, res) => {
      const row = await db.content.findUnique({
        where: { id: idOf(req.params.id) },
      });
      if (!row) fail(404, "NOT_FOUND", "资料不存在");
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
      if (!(await db.content.findUnique({ where: { id: data.contentId } })))
        fail(404, "NOT_FOUND", "资料不存在");
      await db.accessLog.create({
        data: {
          ...data,
          ip: req.ip || "unknown",
          userAgent: req.get("user-agent")?.slice(0, 512),
        },
      });
      res.status(201).json({ ok: true });
    }),
  );
  app.use(
    "/media",
    authorize,
    (_req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      next();
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
