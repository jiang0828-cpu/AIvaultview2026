import type { Express, Request, Response, NextFunction } from 'express';
import type { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { fail, HttpError, idOf, wrap } from './http.js';
import { castleProjectTitle, castleProjectTitles } from './castleProjectName.js';

const usernameSchema = z.string().trim().toLowerCase().min(3).max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, '用户名使用 3–64 位字母、数字、点、下划线或短横线');
const passwordSchema = z.string().min(12, '密码至少 12 个字符')
  .refine(value => [...value].length >= 12, '密码至少 12 个字符')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, '密码不能超过 72 个 UTF-8 字节');
const roleSchema = z.enum(['admin', 'visitor', 'share']);
const sharePasswordSchema = z.string().min(6, '分享密码至少 6 个字符')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, '分享密码不能超过 72 个 UTF-8 字节');
export type ShareTarget =
  | { kind: 'trip'; projectId: number; tripId: number }
  | { kind: 'project'; contentId: number; ownerId: number }
  | { kind: 'page'; pageId: string; ownerId: number; contentId?: number }
  | { kind: 'content'; contentId: number };
export const publicUser = (user: User) => ({
  id: user.id, username: user.username, role: user.role,
  mustChangePassword: user.mustChangePassword,
});
const managedUser = (user: User) => ({ ...publicUser(user), enabled: user.enabled,
  createdAt: user.createdAt, updatedAt: user.updatedAt });

export async function bootstrapAdmin(db: PrismaClient, config: AppConfig) {
  if (await db.config.findUnique({ where: { key: 'accounts.initialized' } })) return;
  await db.$transaction(async tx => {
    if (await tx.config.findUnique({ where: { key: 'accounts.initialized' } })) return;
    if (await tx.user.count() === 0) {
      if (!config.adminPassword || config.adminPassword.startsWith('replace-'))
        throw new Error('Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH to initialize the first administrator.');
      const username = usernameSchema.parse(config.adminUsername);
      const passwordHash = config.adminHashed ? config.adminPassword :
        await bcrypt.hash(passwordSchema.parse(config.adminPassword), 12);
      if (config.adminHashed && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash))
        throw new Error('ADMIN_PASSWORD_HASH must be a bcrypt hash.');
      await tx.user.create({ data: { username, passwordHash, role: 'admin' } });
    }
    await tx.config.create({ data: { key: 'accounts.initialized', value: '1' } });
  }, { timeout: 15000 });
}

export async function bootstrapShare(db: PrismaClient, config: AppConfig) {
  const username = usernameSchema.parse(config.shareUsername || 'user');
  const configuredPassword = config.sharePassword || '123456';
  const passwordHash = config.shareHashed ? configuredPassword :
    await bcrypt.hash(sharePasswordSchema.parse(configuredPassword), 12);
  if (config.shareHashed && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash))
    throw new Error('SHARE_PASSWORD_HASH must be a bcrypt hash.');
  const existing = await db.user.findUnique({ where: { username }, select: { id: true, role: true } });
  if (existing?.role === 'share' && await db.config.findUnique({ where: { key: `accounts.share.initialized.${existing.id}` } })) return;
  await db.$transaction(async tx => {
    let user = await tx.user.findUnique({ where: { username } });
    if (!user) user = await tx.user.create({ data: { username, passwordHash, role: 'share', mustChangePassword: false } });
    else if (user.role !== 'share') throw new Error(`SHARE_USERNAME ${username} conflicts with an existing non-share account.`);
    const key = `accounts.share.initialized.${user.id}`;
    if (await tx.config.findUnique({ where: { key } })) return;
    if (await tx.projectAccess.count({ where: { userId: user.id } }) > 0) {
      await tx.config.create({ data: { key, value: '1' } });
      return;
    }
    const selectors = config.shareProjectSelectors || [castleProjectTitle];
    const numericIds = selectors.filter(value => /^\d+$/.test(value)).map(Number);
    const names = selectors.filter(value => !/^\d+$/.test(value));
    if (names.some(name => castleProjectTitles.includes(name))) names.push(...castleProjectTitles);
    const projects = await tx.content.findMany({ where: { isProject: true, OR: [
      ...(numericIds.length ? [{ id: { in: numericIds } }] : []),
      ...(names.length ? [{ title: { in: names } }] : []),
    ] }, select: { id: true } });
    if (projects.length) {
      await tx.projectAccess.createMany({ data: projects.map(project => ({ userId: user!.id, projectId: project.id })) });
      await tx.config.create({ data: { key, value: '1' } });
    }
  }, { timeout: 15000 });
}

export function createShareToken(config: AppConfig, target: ShareTarget) {
  return jwt.sign({ share: true, ...target }, config.secret, {
    algorithm: 'HS256', expiresIn: '30d', issuer: 'yaocang-share', audience: 'yaocang-share-link',
  });
}

export function readShareToken(config: AppConfig, token: string): ShareTarget {
  const payload = jwt.verify(token, config.secret, {
    algorithms: ['HS256'], issuer: 'yaocang-share', audience: 'yaocang-share-link',
  });
  if (typeof payload === 'string' || payload.share !== true) throw new Error('Invalid share token');
  if (payload.kind === 'trip' && Number.isInteger(payload.projectId) && Number.isInteger(payload.tripId))
    return { kind: 'trip', projectId: payload.projectId as number, tripId: payload.tripId as number };
  if (payload.kind === 'content' && Number.isInteger(payload.contentId))
    return { kind: 'content', contentId: payload.contentId as number };
  if (payload.kind === 'project' && Number.isInteger(payload.contentId) && Number.isInteger(payload.ownerId))
    return { kind: 'project', contentId: payload.contentId as number, ownerId: payload.ownerId as number };
  if (payload.kind === 'page' && typeof payload.pageId === 'string' && /^[A-Za-z0-9_-]{16}$/.test(payload.pageId) && Number.isInteger(payload.ownerId))
    return { kind: 'page', pageId: payload.pageId, ownerId: payload.ownerId as number,
      ...(Number.isInteger(payload.contentId) ? { contentId: payload.contentId as number } : {}) };
  throw new Error('Invalid share target');
}

export async function createShortShareToken(db: PrismaClient, config: AppConfig, target: ShareTarget) {
  const code = randomBytes(12).toString('base64url');
  await db.config.create({ data: { key: `share.link.${code}`, value: createShareToken(config, target) } });
  return code;
}

export async function resolveShareToken(db: PrismaClient, config: AppConfig, value: string) {
  let token = value;
  if (/^[A-Za-z0-9_-]{16}$/.test(value)) {
    const link = await db.config.findUnique({ where: { key: `share.link.${value}` } });
    if (!link) throw new Error('Unknown share link');
    token = link.value;
  }
  return { token, target: readShareToken(config, token) };
}

export async function sharePasswordMatches(db: PrismaClient, config: AppConfig, password: string) {
  const user = await db.user.findUnique({ where: { username: usernameSchema.parse(config.shareUsername || 'user') } });
  if (!user || user.role !== 'share' || !user.enabled || Buffer.byteLength(password, 'utf8') > 72) return false;
  if (await bcrypt.compare(password, user.passwordHash)) return true;
  // Numeric access codes can be pasted with surrounding spaces or entered with a full-width IME.
  const numericCode = password.normalize('NFKC').trim();
  return /^\d{6}$/.test(numericCode) && numericCode !== password && bcrypt.compare(numericCode, user.passwordHash);
}

export async function createShareGrant(db: PrismaClient, config: AppConfig, token: string) {
  const user = await db.user.findUniqueOrThrow({ where: { username: config.shareUsername || 'user' } });
  return jwt.sign({ token, fingerprint: createHash('sha256').update(user.passwordHash).digest('hex') }, config.secret, {
    algorithm: 'HS256', expiresIn: '1d', issuer: 'yaocang-share-session', audience: 'yaocang-share-page',
  });
}

export async function readShareGrant(db: PrismaClient, config: AppConfig, cookie: string): Promise<ShareTarget> {
  const grant = jwt.verify(cookie, config.secret, {
    algorithms: ['HS256'], issuer: 'yaocang-share-session', audience: 'yaocang-share-page',
  });
  if (typeof grant === 'string' || typeof grant.token !== 'string') throw new Error('Invalid share session');
  const user = await db.user.findUnique({ where: { username: config.shareUsername || 'user' } });
  if (!user?.enabled || user.role !== 'share' || grant.fingerprint !== createHash('sha256').update(user.passwordHash).digest('hex'))
    throw new Error('Share access revoked');
  return readShareToken(config, grant.token);
}

export function authentication(db: PrismaClient, config: AppConfig) {
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'strict' as const, path: '/' };
  async function loadIdentity(req: Request, res: Response) {
    let sessionId: string;
    let userId: number;
    try {
      const payload = jwt.verify(req.cookies.yaocang_session || '', config.secret,
        { algorithms: ['HS256'], issuer: 'yaocang', audience: 'yaocang-web' });
      if (typeof payload === 'string' || typeof payload.sid !== 'string' || !payload.sub) throw new Error();
      sessionId = payload.sid;
      userId = idOf(payload.sub);
    } catch { return fail(401, 'UNAUTHORIZED', '请先登录账号'); }
    const session = await db.authSession.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.userId !== userId || !session.user.enabled || session.expiresAt.getTime() <= Date.now())
      return fail(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
    res.locals.user = session.user;
    res.locals.role = session.user.role;
    res.locals.sessionId = session.id;
  }
  const authorize = (req: Request, res: Response, next: NextFunction) => {
    void loadIdentity(req, res).then(() => next(), next);
  };
  const passwordReady = (_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.user.mustChangePassword)
      return next(new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', '请先修改临时密码'));
    next();
  };
  const admin = (_req: Request, res: Response, next: NextFunction) => {
    if (res.locals.role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', '需要管理员权限'));
    next();
  };
  const attempts = new Map<string, { count: number; expires: number }>();
  const dummyHash = bcrypt.hashSync('unmatchable-dummy-password', 12);
  function register(app: Express) {
    app.post('/api/auth/login', wrap(async (req, res) => {
      const input = z.object({ username: z.string().trim().toLowerCase().min(1).max(64),
        password: z.string().min(1).max(256) }).strict().parse(req.body);
      const now = Date.now();
      for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
      const keys = [`ip:${req.ip}`, `user:${input.username}`];
      const blocked = keys.map(key => attempts.get(key)).find(value => value && value.count >= 5);
      if (blocked) {
        const retryAfter = Math.ceil((blocked.expires - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: { code: 'LOCKED', message: '尝试次数过多，请稍后再试', retryAfter } });
      }
      const user = await db.user.findUnique({ where: { username: input.username } });
      const valid = await bcrypt.compare(input.password, user?.passwordHash || dummyHash);
      if (!user || !user.enabled || !valid || Buffer.byteLength(input.password, 'utf8') > 72) {
        for (const key of keys) {
          if (attempts.size >= 10000 && !attempts.has(key)) fail(429, 'BUSY', '请稍后再试');
          const previous = attempts.get(key);
          attempts.set(key, { count: (previous?.count || 0) + 1, expires: previous?.expires || now + 900000 });
        }
        fail(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
      }
      for (const key of keys) attempts.delete(key);
      const sid = randomUUID();
      const currentUser = await db.$transaction(async tx => {
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (!current?.enabled || current.passwordHash !== user.passwordHash)
          return fail(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
        await tx.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
        await tx.authSession.create({ data: { id: sid, userId: user.id, expiresAt: new Date(now + 30 * 86400000) } });
        await tx.accessLog.create({ data: { userId: user.id, ip: req.ip || 'unknown',
          userAgent: req.get('user-agent')?.slice(0, 512), action: 'login' } });
        return current;
      }, { maxWait: 10000, timeout: 30000 });
      const token = jwt.sign({ sid }, config.secret, { subject: String(user.id), algorithm: 'HS256',
        expiresIn: '30d', issuer: 'yaocang', audience: 'yaocang-web' });
      res.cookie('yaocang_session', token, { ...cookieOptions, maxAge: 30 * 86400000 });
      res.json({ user: publicUser(currentUser) });
    }));
    app.get('/api/auth/me', authorize, (_req, res) => res.json({ user: publicUser(res.locals.user) }));
    app.post('/api/auth/logout', authorize, wrap(async (_req, res) => {
      await db.authSession.deleteMany({ where: { id: res.locals.sessionId } });
      res.clearCookie('yaocang_session', cookieOptions).json({ ok: true });
    }));
    app.post('/api/auth/change-password', authorize, wrap(async (req, res) => {
      if (res.locals.role === 'share') fail(403, 'READ_ONLY_SHARE', '分享浏览账号不能修改账号设置');
      const input = z.object({ oldPassword: z.string().min(1).max(256), newPassword: passwordSchema }).strict().parse(req.body);
      const user: User = res.locals.user;
      if (Buffer.byteLength(input.oldPassword, 'utf8') > 72 || !await bcrypt.compare(input.oldPassword, user.passwordHash))
        fail(400, 'INVALID_PASSWORD', '原密码不正确');
      if (await bcrypt.compare(input.newPassword, user.passwordHash)) fail(400, 'SAME_PASSWORD', '新密码不能与原密码相同');
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await db.$transaction(async tx => {
        const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        if (current.passwordHash !== user.passwordHash) fail(409, 'ACCOUNT_CHANGED', '账号已更新，请重新登录');
        await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
        await tx.authSession.deleteMany({ where: { userId: user.id } });
      });
      res.clearCookie('yaocang_session', cookieOptions).json({ ok: true });
    }));
  }
  function registerAdmin(app: Express) {
    app.use('/api/admin', admin);
    app.get('/api/admin/users', wrap(async (_req, res) => {
      res.json((await db.user.findMany({ orderBy: { id: 'asc' } })).map(managedUser));
    }));
    app.post('/api/admin/users', wrap(async (req, res) => {
      const input = z.object({ username: usernameSchema, password: z.string(),
        role: roleSchema.default('visitor') }).strict().parse(req.body);
      (input.role === 'share' ? sharePasswordSchema : passwordSchema).parse(input.password);
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await db.user.create({ data: { username: input.username, passwordHash, role: input.role, mustChangePassword: input.role !== 'share' } });
      res.status(201).json(managedUser(user));
    }));
    app.patch('/api/admin/users/:id', wrap(async (req, res) => {
      const id = idOf(req.params.id);
      const input = z.object({ username: usernameSchema.optional(), role: roleSchema.optional(), enabled: z.boolean().optional() })
        .strict().refine(value => Object.keys(value).length > 0, '请填写修改内容').parse(req.body);
      const user = await db.$transaction(async tx => {
        const current = await tx.user.findUniqueOrThrow({ where: { id } });
        const next = { ...current, ...input };
        if (current.role === 'admin' && current.enabled && (next.role !== 'admin' || !next.enabled) &&
          await tx.user.count({ where: { role: 'admin', enabled: true } }) <= 1)
          fail(409, 'LAST_ADMIN', '至少保留一名启用的管理员');
        const updated = await tx.user.update({ where: { id }, data: input });
        if (current.role !== updated.role || current.enabled !== updated.enabled || current.username !== updated.username)
          await tx.authSession.deleteMany({ where: { userId: id } });
        return updated;
      });
      res.json(managedUser(user));
    }));
    app.post('/api/admin/users/:id/reset-password', wrap(async (req, res) => {
      const id = idOf(req.params.id);
      if (id === res.locals.user.id) fail(400, 'USE_CHANGE_PASSWORD', '请使用个人改密入口');
      const user = await db.user.findUniqueOrThrow({ where: { id } });
      const { password } = z.object({ password: user.role === 'share' ? sharePasswordSchema : passwordSchema }).strict().parse(req.body);
      const passwordHash = await bcrypt.hash(password, 12);
      await db.$transaction([
        db.user.update({ where: { id }, data: { passwordHash, mustChangePassword: user.role !== 'share' } }),
        db.authSession.deleteMany({ where: { userId: id } }),
      ]);
      res.json({ ok: true });
    }));
    app.get('/api/admin/projects', wrap(async (_req, res) => {
      res.json(await db.content.findMany({ where: { isProject: true }, select: { id: true, title: true, scene: true }, orderBy: { sortOrder: 'asc' } }));
    }));
    app.get('/api/admin/users/:id/projects', wrap(async (req, res) => {
      const userId = idOf(req.params.id);
      await db.user.findUniqueOrThrow({ where: { id: userId } });
      const grants = await db.projectAccess.findMany({ where: { userId } });
      res.json({ projectIds: grants.map(row => row.projectId), researchEditorProjectIds: grants.filter(row => row.canEditResearch).map(row => row.projectId) });
    }));
    app.put('/api/admin/users/:id/projects', wrap(async (req, res) => {
      const userId = idOf(req.params.id);
      const { projectIds, researchEditorProjectIds } = z.object({
        projectIds: z.array(z.number().int().positive()).max(1000),
        researchEditorProjectIds: z.array(z.number().int().positive()).max(1000).optional(),
      }).strict().parse(req.body);
      const ids = [...new Set(projectIds)];
      if (researchEditorProjectIds?.some(id => !ids.includes(id))) fail(400, 'INVALID_EDITOR_GRANT', '调研编辑权限必须包含项目访问权限');
      await db.$transaction(async tx => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (!['visitor', 'share'].includes(user.role)) fail(400, 'ADMIN_ALL_PROJECTS', '管理员默认拥有全部项目权限');
        if (user.role === 'share' && researchEditorProjectIds?.length) fail(400, 'READ_ONLY_SHARE', '分享账号只能分配浏览权限');
        if (await tx.content.count({ where: { id: { in: ids }, isProject: true } }) !== ids.length)
          fail(400, 'INVALID_PROJECT', '只能授权存在的项目');
        const previous = await tx.projectAccess.findMany({ where: { userId, canEditResearch: true } });
        const editorIds = new Set(user.role === 'share' ? [] : researchEditorProjectIds ?? previous.map(row => row.projectId));
        await tx.projectAccess.deleteMany({ where: { userId } });
        await tx.projectAccess.createMany({ data: ids.map(projectId => ({ userId, projectId, canEditResearch: editorIds.has(projectId) })) });
      });
      res.json({ projectIds: ids });
    }));
  }
  return { authorize, admin, passwordReady, register, registerAdmin };
}
