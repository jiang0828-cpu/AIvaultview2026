import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { literatureProject } from './literature.js';

export async function seedLiterature(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    let scene = await tx.content.findFirst({ where: { title: '兴趣爱好', scene: 'hobbies', parentId: null, type: 'folder' } });
    scene ??= await tx.content.create({ data: { title: '兴趣爱好', scene: 'hobbies', type: 'folder', sortOrder: 4 } });
    const { children, ...data } = literatureProject;
    let project = await tx.content.findFirst({ where: { title: data.title, parentId: scene.id, type: 'folder' } });
    project = project
      ? await tx.content.update({ where: { id: project.id }, data: { topics: data.topics } })
      : await tx.content.create({ data: { ...data, parentId: scene.id } });
    for (const child of children || []) {
      const existing = await tx.content.findFirst({ where: { parentId: project.id, title: child.title } });
      if (!existing) await tx.content.create({ data: { ...child, children: undefined, parentId: project.id } });
    }
    return project.id;
  });
}
