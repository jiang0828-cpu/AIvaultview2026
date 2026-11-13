import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import { fail, idOf, wrap } from './http.js';
import { requireContent } from './permissions.js';

export const investmentMarker = '<!-- INVESTMENT_WORKBENCH -->';
export const investmentTitle = '基础生活 | 钱 | 投资理财';
const key = z.string().regex(/^[A-Za-z0-9_.-]{1,80}$/);
const body = z.record(z.unknown());

export function registerInvestment(app: Express, db: PrismaClient, config: AppConfig, options: { fetch?: typeof fetch } = {}) {
  const transport = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const token = process.env.COMPARE_INTERNAL_TOKEN || createHash('sha256').update(`price-compare:${config.secret}`).digest('hex');
  const port = Number(process.env.COMPARE_PORT || 8001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid internal Python port');
  async function proxy(req: Request, res: Response, suffix: string, payload?: unknown) {
    // Shared project links never confer access to an account's private ledger.
    if (res.locals.user.role === 'share') return fail(403, 'PRIVATE_ACCOUNT', '投资账户仅限登录账号本人访问');
    const projectId = idOf(req.query.projectId);
    const project = await requireContent(db, res.locals.user, projectId);
    if (!project.isProject || project.type !== 'folder' || project.scene !== 'life' || !project.description.includes(investmentMarker))
      return fail(404, 'NOT_FOUND', '投资项目不存在或未授权');
    const query = new URLSearchParams();
    for (const field of ['demo', 'category', 'peer']) {
      if (req.query[field] !== undefined) query.set(field, z.string().max(100).parse(req.query[field]));
    }
    let upstream: globalThis.Response;
    try {
      upstream = await transport(`http://127.0.0.1:${port}/investment${suffix}?${query}`, {
        method: req.method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-User-Id': String(res.locals.user.id), 'X-Project-Id': String(projectId) },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
    } catch { return fail(503, 'INVESTMENT_UNAVAILABLE', '投资计算服务未启动或暂不可用'); }
    let result: unknown;
    try { result = await upstream.json(); }
    catch { return fail(503, 'INVESTMENT_UNAVAILABLE', '投资服务返回异常'); }
    if (!upstream.ok) {
      if ([400, 404, 422].includes(upstream.status)) {
        const safe = z.object({ error: z.object({ message: z.string().max(1200), code: z.string() }) }).safeParse(result);
        return fail(upstream.status === 422 ? 400 : upstream.status, 'INVALID_INVESTMENT_DATA', safe.success ? safe.data.error.message : '数据格式不正确，请核对字段、数值和日期');
      }
      return fail(503, 'INVESTMENT_UNAVAILABLE', '投资服务暂不可用');
    }
    return res.status(upstream.status).json(result);
  }
  for (const endpoint of ['state', 'candidates', 'review'])
    app.get(`/api/investment/${endpoint}`, wrap((req, res) => proxy(req, res, `/${endpoint}`)));
  app.put('/api/investment/account', wrap((req, res) => proxy(req, res, '/account', body.parse(req.body))));
  app.post('/api/investment/compare', wrap((req, res) => proxy(req, res, '/compare', body.parse(req.body))));
  app.post('/api/investment/refresh', wrap((req, res) => proxy(req, res, '/refresh', z.object({}).strict().parse(req.body))));
  app.post('/api/investment/import', wrap((req, res) => {
    const input = z.object({ kind: z.enum(['products', 'positions', 'transactions', 'valuations']), format: z.enum(['csv', 'json']),
      data: z.union([z.string().min(1).max(200000), z.array(body).min(1).max(500)]) }).strict().parse(req.body);
    return proxy(req, res, '/import', input);
  }));
  app.delete('/api/investment/:kind/:key', wrap((req, res) => {
    const kind = z.enum(['products', 'positions', 'transactions', 'valuations']).parse(req.params.kind);
    return proxy(req, res, `/${kind}/${key.parse(req.params.key)}`);
  }));
}
