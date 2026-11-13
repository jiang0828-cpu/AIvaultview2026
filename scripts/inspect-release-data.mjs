import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire('/opt/vaultview/current/package.json');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const env = dotenv.parse(await readFile('/etc/vaultview/vaultview.env'));
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const users = await db.user.findMany({ orderBy: { id: 'asc' } });
  const trips = await db.tripPlan.findMany({ orderBy: { id: 'asc' } });
  const grants = await db.projectAccess.findMany({ orderBy: [{ userId: 'asc' }, { projectId: 'asc' }] });
  const summary = {
    users: users.length, accountFingerprints: Object.fromEntries(users.map(row => [row.id, digest(row)])),
    trips: trips.length, tripFingerprints: Object.fromEntries(trips.map(row => [row.id, digest(row)])),
    grantFingerprints: Object.fromEntries(grants.map(row => [`${row.userId}:${row.projectId}`, digest(row)])),
    contents: await db.content.count(), projects: await db.content.count({ where: { isProject: true } }),
    adminTripCount: trips.filter(row => users.some(user => user.id === row.userId && user.username === 'admin' && user.role === 'admin')).length,
  };
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(summary));
} finally { await db.$disconnect(); }
