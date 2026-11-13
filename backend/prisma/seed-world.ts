import type { PrismaClient } from '@prisma/client';
import { worldChapters, worldDataDocument, worldIssue, worldMethodDocument, worldProject } from './world.js';
import { worldChapters002, worldDataDocument002, worldIssue002 } from './world-002.js';
import { worldChapters003, worldDataDocument003, worldIssue003 } from './world-003.js';
import { worldDataMarker, worldIssueMarker, worldProjectMarker } from '../src/worldSchema.js';

export async function seedWorld(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const scene = await tx.content.findFirst({ where: { scene: 'system', parentId: null, type: 'folder', title: '系统管理' } })
      ?? await tx.content.create({ data: { scene: 'system', type: 'folder', title: '系统管理', sortOrder: 0 } });
    let created = 0;
    async function ensure(data: typeof worldProject | typeof worldIssue | typeof worldDataDocument, parentId: number) {
      const existing = await tx.content.findFirst({ where: { title: data.title, parentId } });
      if (existing) {
        if (existing.type !== data.type) throw new Error(`Content type conflict: ${data.title}`);
        return existing;
      }
      created++;
      return tx.content.create({ data: { ...data, parentId } });
    }
    const project = await ensure(worldProject, scene.id);
    if (!project.isProject) await tx.content.update({ where: { id: project.id }, data: { isProject: true } });
    if (!project.description.includes(worldProjectMarker)) throw new Error('Existing project has no WORLD_PROJECT marker; preserved without overwrite.');
    async function seedIssue(folder: typeof worldIssue, data: typeof worldDataDocument, chapters: typeof worldChapters) {
      const issue = await ensure(folder, project.id);
      if (!issue.description.includes(worldIssueMarker)) throw new Error(`Missing issue marker: ${issue.title}`);
      const document = await ensure(data, issue.id);
      if (!document.description.startsWith(worldDataMarker)) throw new Error(`Missing report marker: ${issue.title}`);
      for (const [index, chapter] of chapters.entries()) await ensure({ ...chapter, sortOrder: index + 1 }, issue.id);
      return issue.id;
    }
    const issueId = await seedIssue(worldIssue, worldDataDocument, worldChapters);
    const issue002Id = await seedIssue(worldIssue002, worldDataDocument002, worldChapters002);
    const issue003Id = await seedIssue(worldIssue003, worldDataDocument003, worldChapters003);
    await ensure(worldMethodDocument, project.id);
    if (created) await tx.content.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
    return { projectId: project.id, issueId, issue002Id, issue003Id, created };
  });
}
