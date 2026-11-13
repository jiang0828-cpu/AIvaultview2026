import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { literatureProject } from './literature.js';
import { hasProjectCycle } from '../src/projectTags.js';

export async function seedLiterature(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    let scene = await tx.content.findFirst({ where: { title: '兴趣爱好', scene: 'hobbies', parentId: null, type: 'folder' } });
    scene ??= await tx.content.create({ data: { title: '兴趣爱好', scene: 'hobbies', type: 'folder', sortOrder: 4 } });
    const { children, ...data } = literatureProject;
    let project = await tx.content.findFirst({ where: { title: data.title, parentId: scene.id, type: 'folder' } });
    project = project
      ? hasProjectCycle(project.topics) ? project
        : await tx.content.update({ where: { id: project.id }, data: { topics: data.topics } })
      : await tx.content.create({ data: { ...data, isProject: true, parentId: scene.id } });
    if (!project.isProject) project = await tx.content.update({ where: { id: project.id }, data: { isProject: true } });
    for (const child of children || []) {
      const existing = await tx.content.findFirst({ where: { parentId: project.id, title: child.title } });
      if (!existing) await tx.content.create({ data: { ...child, children: undefined, parentId: project.id } });
    }
    return project.id;
  });
}
