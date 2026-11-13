import { readFile, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const require = createRequire('/opt/vaultview/current/package.json');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const env = dotenv.parse(await readFile('/etc/vaultview/vaultview.env'));
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const file = '/root/vaultview-upload/browser-fixture.json';
try {
  if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(await readFile(file));
    if (!/^deploy-browser-[a-f0-9]+$/.test(fixture.username)) throw new Error('Unexpected verification identity');
    await db.accessLog.deleteMany({ where: { userId: fixture.userId } });
    await db.user.delete({ where: { id: fixture.userId, username: fixture.username } });
    await unlink(file);
    console.log('Temporary browser account, sessions, grants and logs removed.');
  } else {
    const fixture = { username: `deploy-browser-${randomBytes(8).toString('hex')}`, password: randomBytes(24).toString('base64url') };
    // Write recovery information before account creation.
    await writeFile(file, JSON.stringify(fixture), { flag: 'wx', mode: 0o600 });
    const user = await db.user.create({ data: { username: fixture.username,
      passwordHash: await bcrypt.hash(fixture.password, 12), role: 'admin', mustChangePassword: false } });
    const projects = await db.content.findMany({ where: { isProject: true } });
    fixture.userId = user.id;
    fixture.projects = Object.fromEntries([
      ['health', 'FAMILY_HEALTH_PROJECT'], ['compare', 'PRICE_COMPARE_PROJECT'],
    ].map(([name, marker]) => [name, projects.find(row => row.description.includes(marker))?.id]));
    fixture.projects.course = projects.find(row => row.title.includes('第二期'))?.id;
    fixture.projectCount = projects.length;
    await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
    console.log('Temporary browser account prepared; credentials are kept in a private file.');
  }
} finally { await db.$disconnect(); }
