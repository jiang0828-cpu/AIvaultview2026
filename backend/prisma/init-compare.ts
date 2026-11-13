import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedCompare } from './compare.js';

const db = new PrismaClient();
try {
  const result = await seedCompare(db);
  console.log(`Price comparison project ${result.projectId}: ${result.created} new content records.`);
} finally {
  await db.$disconnect();
}
