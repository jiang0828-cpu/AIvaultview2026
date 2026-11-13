import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

dotenv.config();
const db = new PrismaClient();
const filename = resolve('output/playwright/auth-fixtures.json');
try {
  if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(await readFile(filename, 'utf8'));
    const usernames = [fixture.admin.username, fixture.visitor.username, fixture.newUsername];
    const users = await db.user.findMany({ where: { username: { in: usernames } }, select: { id: true } });
    await db.accessLog.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
    await db.user.deleteMany({ where: { username: { in: usernames } } });
    await unlink(filename);
    console.log('Browser verification accounts removed.');
  } else {
    const suffix = randomBytes(5).toString('hex');
    const fixture = { admin: { username: `qa-admin-${suffix}`, password: randomBytes(24).toString('base64url') },
      visitor: { username: `qa-reader-${suffix}`, password: randomBytes(24).toString('base64url') },
      newUsername: `qa-new-${suffix}`, temporaryPassword: randomBytes(24).toString('base64url'),
      finalPassword: randomBytes(24).toString('base64url') };
    const projects = await db.content.findMany({ where: { isProject: true } });
    fixture.project = projects.find(project => project.title.includes('AI 使用'));
    fixture.privateProject = projects.find(project => project.title.includes('mRNA'));
    if (!fixture.project || !fixture.privateProject) throw new Error('Expected the existing AI and mRNA projects.');
    fixture.project = { id: fixture.project.id, title: fixture.project.title };
    fixture.privateProject = { id: fixture.privateProject.id, title: fixture.privateProject.title };
    await mkdir(resolve('output/playwright'), { recursive: true });
    // Written before DB changes so cleanup is available even if setup is interrupted.
    await writeFile(filename, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' });
    await db.$transaction(async tx => {
      for (const [role, account] of Object.entries({ admin: fixture.admin, visitor: fixture.visitor })) {
        const user = await tx.user.create({ data: { username: account.username,
          passwordHash: await bcrypt.hash(account.password, 12), role, mustChangePassword: false } });
        if (role === 'visitor') await tx.projectAccess.create({ data: { userId: user.id, projectId: fixture.project.id } });
      }
    }, { timeout: 15000 });
    console.log('Isolated browser verification accounts prepared; credentials are not printed.');
  }
} finally { await db.$disconnect(); }
