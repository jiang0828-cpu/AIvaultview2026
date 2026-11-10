import type { PrismaClient, Prisma } from '@prisma/client';
import { writers } from './writers/index.js';

export async function seedWriters(db: PrismaClient, projectId: number) {
  return db.$transaction(async (tx) => {
    const project = await tx.content.findUnique({ where: { id: projectId } });
    if (!project?.description.includes('<!-- LITERATURE_PROJECT -->')) throw new Error('Not a literature project');
    let created = 0;
    for (const profile of writers) {
      const existing = await tx.literaryWriter.findUnique({ where: { id: profile.id } });
      if (existing) {
        if (existing.projectId !== projectId) throw new Error(`Writer belongs to another project: ${profile.id}`);
        continue;
      }
      await tx.literaryWriter.create({ data: { id: profile.id, projectId, data: profile as Prisma.InputJsonValue } });
      created++;
    }
    if (created) await tx.content.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
    return { created, total: await tx.literaryWriter.count({ where: { projectId } }) };
  }, { timeout: 30000 });
}
