import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedLiterature } from './seed-literature.js';
import { seedWriters } from './seed-writers.js';

const db = new PrismaClient();
try {
  const projectId = await seedLiterature(db);
  const result = await seedWriters(db, projectId);
  console.log(JSON.stringify({ projectId, ...result }));
} finally {
  await db.$disconnect();
}
