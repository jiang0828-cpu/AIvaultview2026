import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { AppConfig } from '../src/config.js';

export type TestConfig = AppConfig & { sitePassword: string; siteHashed: boolean };
export async function seedTestUsers(db: PrismaClient, config: TestConfig) {
  for (const role of ['admin', 'visitor'] as const) {
    const passwordHash = await bcrypt.hash(role === 'admin' ? config.adminPassword! : config.sitePassword, 4);
    const user = await db.user.upsert({ where: { username: role },
      create: { username: role, role, passwordHash, mustChangePassword: false }, update: {} });
    if (role === 'visitor') {
      for (const project of await db.content.findMany({ where: { isProject: true } }))
        await db.projectAccess.upsert({ where: { userId_projectId: { userId: user.id, projectId: project.id } },
          create: { userId: user.id, projectId: project.id }, update: {} });
    }
  }
}
