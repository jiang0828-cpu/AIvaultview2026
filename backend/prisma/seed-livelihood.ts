import type { PrismaClient } from '@prisma/client';
import { livelihoodProject, livelihoodDocuments } from './livelihood.js';
import { livelihoodDataMarker, livelihoodIssueMarker, livelihoodProjectMarker } from '../src/livelihoodSchema.js';
import { livelihoodIssue001, livelihoodDataDocument001, livelihoodChapters001 } from './livelihood-001.js';

export async function seedLivelihood(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const scene = await tx.content.findFirst({ where: { title: '系统管理', scene: 'system', type: 'folder', parentId: null } })
      ?? await tx.content.create({ data: { title: '系统管理', scene: 'system', type: 'folder' } });
    const existing = await tx.content.findFirst({ where: { title: livelihoodProject.title, parentId: scene.id } });
    if (existing && (existing.type !== 'folder' || !existing.isProject || !existing.description.includes(livelihoodProjectMarker)))
      throw new Error('Existing livelihood project conflicts; preserved without overwrite.');
    const project = existing ?? await tx.content.create({ data: { ...livelihoodProject, parentId: scene.id } });
    let created = existing ? 0 : 1;
    for (const document of livelihoodDocuments) {
      const current = await tx.content.findFirst({ where: { title: document.title, parentId: project.id } });
      if (current) {
        if (current.type !== 'text') throw new Error(`Content type conflict: ${document.title}`);
      } else {
        await tx.content.create({ data: { ...document, parentId: project.id } });
        created++;
      }
    }
    const currentIssue = await tx.content.findFirst({ where: { title: livelihoodIssue001.title, parentId: project.id } });
    if (currentIssue && (currentIssue.type !== 'folder' || currentIssue.isProject || !currentIssue.description.includes(livelihoodIssueMarker)))
      throw new Error('Existing livelihood issue conflicts; preserved without overwrite.');
    const issue = currentIssue ?? await tx.content.create({ data: { ...livelihoodIssue001, parentId: project.id } });
    if (!currentIssue) created++;
    for (const document of [livelihoodDataDocument001, ...livelihoodChapters001]) {
      const current = await tx.content.findFirst({ where: { title: document.title, parentId: issue.id } });
      if (current) {
        if (current.type !== 'text' || (document === livelihoodDataDocument001 && !current.description.startsWith(livelihoodDataMarker)))
          throw new Error(`Content type or data marker conflict: ${document.title}`);
      } else {
        await tx.content.create({ data: { ...document, parentId: issue.id } });
        created++;
      }
    }
    return { projectId: project.id, issue001Id: issue.id, created };
  });
}
