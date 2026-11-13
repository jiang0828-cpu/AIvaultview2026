import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { fail, idOf, wrap } from './http.js';
import { requireContent } from './permissions.js';

export const compareProjectMarker = '<!-- PRICE_COMPARE_PROJECT -->';
export const compareProjectTitle = '消费支出｜跨平台比价';
const platform = z.enum(['jd', 'ebay', 'goofish', 'douyin', 'pinduoduo']);
const condition = z.enum(['new', 'used', 'refurbished', 'unknown']);
const shortText = z.string().trim().max(300);
const finiteNumber = z.number().finite().min(0).max(1_000_000_000);
const scalar = z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()]);
const specs = z.record(z.string().min(1).max(60), scalar).refine(value => Object.keys(value).length <= 30, '配置字段过多');
const searchInput = z.object({
  query: z.string().trim().min(1).max(160), brand: shortText.nullable().optional(), model: shortText.nullable().optional(),
  category: z.enum(['standard', 'food', 'drink', 'household']).optional(),
  packCount: z.number().int().min(1).max(10000).nullable().optional(),
  netWeight: z.number().finite().positive().max(1000000).nullable().optional(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'piece']).nullable().optional(),
  specs: specs.optional(), condition: condition.optional(), budgetMax: finiteNumber.nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(), platforms: z.array(platform).min(1).max(5).optional(),
  city: z.string().max(100).optional(), targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  requiredConditions: z.array(z.string().max(200)).max(20).optional(),
  acceptableConditions: z.array(z.string().max(200)).max(20).optional(),
  preference: z.enum(['balanced', 'price', 'quality']).optional(), mode: z.enum(['demo', 'live']).optional(),
  demoScenario: z.enum(['phone', 'laptop', 'mixed', 'food', 'drink', 'household']).optional(),
}).strict();
const importInput = z.object({
  format: z.enum(['manual', 'csv', 'json']),
  data: z.union([z.string().min(1).max(120_000), z.record(z.unknown()), z.array(z.record(z.unknown())).min(1).max(200)]),
}).strict();
const favoriteInput = z.object({ offerId: z.union([z.string(), z.number().int().positive()]).transform(String), note: z.string().max(2000).default('') }).strict();
const favoriteEdit = z.object({ note: z.string().max(2000) }).strict();
const entityId = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
const forbiddenFields = new Set(['userId', 'user_id', 'projectId', 'project_id']);

function rejectOwnership(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenFields.has(key)) fail(400, 'INVALID_BODY', '用户和项目身份由登录会话决定');
    rejectOwnership(child);
  }
}

export function registerCompare(app: Express, db: PrismaClient, config: AppConfig,
  options: { fetch?: typeof fetch } = {}) {
  const transport = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const token = process.env.COMPARE_INTERNAL_TOKEN || createHash('sha256').update(`price-compare:${config.secret}`).digest('hex');
  const configuredPort = Number(process.env.COMPARE_PORT || 8001);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : 8001;

  async function proxy(req: Request, res: Response, path: string, body?: unknown) {
    const projectId = idOf(req.query.projectId);
    const project = await requireContent(db, res.locals.user, projectId);
    if (!project.isProject || project.scene !== 'life' || project.type !== 'folder' || !project.description.includes(compareProjectMarker))
      return fail(404, 'NOT_FOUND', '比价项目不存在或无权访问');
    let upstream: globalThis.Response;
    try {
      upstream = await transport(`http://127.0.0.1:${port}${path}`, {
        method: req.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          'X-User-Id': String(res.locals.user.id), 'X-Project-Id': String(projectId) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000), redirect: 'error',
      });
    } catch { return fail(503, 'COMPARE_UNAVAILABLE', '比价服务暂不可用，请确认本机 Python 服务已启动'); }
    if (upstream.status === 204) return res.status(204).end();
    let result: unknown;
    try { result = await upstream.json(); }
    catch { return fail(503, 'COMPARE_UNAVAILABLE', '比价服务返回异常，请稍后重试'); }
    if (!upstream.ok) {
      // Only controlled client errors may cross the service boundary; never expose upstream diagnostics.
      if ([400, 404, 409, 422].includes(upstream.status)) {
        const error = z.object({ error: z.object({ code: z.string().max(80), message: z.string().max(500) }) }).safeParse(result);
        if (error.success) return res.status(upstream.status).json(error.data);
        return fail(upstream.status === 422 ? 400 : upstream.status, 'INVALID_COMPARE_REQUEST', '比价请求无效或记录不存在');
      }
      return fail(503, 'COMPARE_UNAVAILABLE', '比价服务暂不可用，请稍后重试');
    }
    return res.status(upstream.status).json(result);
  }

  for (const path of ['/providers', '/runs', '/imports', '/favorites'])
    app.get(`/api/compare${path}`, wrap((req, res) => proxy(req, res, path)));
  app.get('/api/compare/runs/:id', wrap((req, res) => proxy(req, res, `/runs/${entityId.parse(req.params.id)}`)));
  app.post('/api/compare/search', wrap((req, res) => {
    rejectOwnership(req.body);
    return proxy(req, res, '/search', searchInput.parse(req.body));
  }));
  app.post('/api/compare/import', wrap((req, res) => {
    rejectOwnership(req.body);
    return proxy(req, res, '/imports', importInput.parse(req.body));
  }));
  app.post('/api/compare/imports', wrap((req, res) => {
    rejectOwnership(req.body);
    return proxy(req, res, '/imports', importInput.parse(req.body));
  }));
  app.put('/api/compare/imports/:id', wrap((req, res) => {
    rejectOwnership(req.body);
    const body = z.record(z.unknown()).parse(req.body);
    const payload = 'format' in body && 'data' in body ? body : { format: 'manual', data: body };
    return proxy(req, res, `/imports/${entityId.parse(req.params.id)}`, payload);
  }));
  app.post('/api/compare/favorites', wrap((req, res) => proxy(req, res, '/favorites', favoriteInput.parse(req.body))));
  app.put('/api/compare/favorites/:id', wrap((req, res) => proxy(req, res, `/favorites/${entityId.parse(req.params.id)}`, favoriteEdit.parse(req.body))));
  for (const path of ['imports', 'favorites'])
    app.delete(`/api/compare/${path}/:id`, wrap((req, res) => proxy(req, res, `/${path}/${entityId.parse(req.params.id)}`)));
}
