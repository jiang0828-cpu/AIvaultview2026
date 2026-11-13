import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { seedCdxMarket } from './seed-cdx-market.js';

const db = new PrismaClient();
try {
  const content = await db.content.findMany({ orderBy: { id: 'asc' } });
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const before = hash(content);
  const result = await seedCdxMarket(db);
  const existingContent = await db.content.findMany({ where: { id: { in: content.map(row => row.id) } }, orderBy: { id: 'asc' } });
  if (before !== hash(existingContent)) throw new Error('Existing content preservation check failed.');
  console.log(JSON.stringify({ ...result, existingContentPreserved: true,
    path: `/home?project=${result.projectId}&study=${result.studyId}&researchView=report` }));
} finally {
  await db.$disconnect();
}
