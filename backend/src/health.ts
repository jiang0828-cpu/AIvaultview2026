import type { Express, Request, Response } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { fail, wrap } from './http.js';
import { requireContent } from './permissions.js';
import { emptyHealthWorkspace, healthDeleteSchema, healthProjectMarker, healthSaveSchema } from './healthSchema.js';

const projectQuery = z.object({ projectId: z.coerce.number().int().positive() }).strict();
const conflict = () => fail(409, 'HEALTH_VERSION_CONFLICT', '资料已在其他页面更新，请先重新加载，再合并本页修改');

export function registerHealth(app: Express, db: PrismaClient) {
  async function scope(req: Request, res: Response) {
    res.set('Cache-Control', 'private, no-store');
    if (!res.locals.user) return fail(401, 'UNAUTHORIZED', '请先登录账号');
    const { projectId } = projectQuery.parse(req.query);
    const project = await requireContent(db, res.locals.user, projectId);
    if (!project.isProject || project.scene !== 'life' || project.type !== 'folder' || !project.description.includes(healthProjectMarker))
      return fail(404, 'NOT_FOUND', '健康管理项目不存在或无权访问');
    return { userId: res.locals.user.id as number, projectId };
  }

  app.get('/api/health/workspace', wrap(async (req, res) => {
    const identity = await scope(req, res);
    const row = await db.healthWorkspace.findUnique({ where: { userId_projectId: identity } });
    res.json(row ? { version: row.version, updatedAt: row.updatedAt.toISOString(), data: row.data }
      : { version: 0, updatedAt: null, data: emptyHealthWorkspace() });
  }));

  app.put('/api/health/workspace', wrap(async (req, res) => {
    const identity = await scope(req, res);
    const input = healthSaveSchema.parse(req.body);
    const data = input.data as Prisma.InputJsonValue;
    try {
      const row = await db.$transaction(async tx => {
        if (input.version === 0)
          return tx.healthWorkspace.create({ data: { ...identity, data, version: 1 } });
        const result = await tx.healthWorkspace.updateMany({ where: { ...identity, version: input.version },
          data: { data, version: { increment: 1 } } });
        if (!result.count) return conflict();
        return tx.healthWorkspace.findUniqueOrThrow({ where: { userId_projectId: identity } });
      });
      res.json({ version: row.version, updatedAt: row.updatedAt.toISOString(), data: row.data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) return conflict();
      throw error;
    }
  }));

  app.delete('/api/health/workspace', wrap(async (req, res) => {
    const identity = await scope(req, res);
    const input = healthDeleteSchema.parse(req.body);
    const data = emptyHealthWorkspace();
    try {
      const snapshot = await db.$transaction(async tx => {
        const row = await tx.healthWorkspace.findUnique({ where: { userId_projectId: identity } });
        if (!row) {
          if (input.version !== 0) return conflict();
          return { version: 0, updatedAt: null, data };
        }
        if (row.version !== input.version) return conflict();
        // Keep a content-free revision tombstone, so a stale pre-delete tab can
        // never recreate old private data using a reused initial version.
        const updated = await tx.healthWorkspace.updateMany({ where: { ...identity, version: input.version },
          data: { data, version: { increment: 1 } } });
        if (!updated.count) return conflict();
        const cleared = await tx.healthWorkspace.findUniqueOrThrow({ where: { userId_projectId: identity } });
        return { version: cleared.version, updatedAt: cleared.updatedAt.toISOString(), data };
      });
      res.json(snapshot);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return conflict();
      throw error;
    }
  }));
}
