import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedHealth } from './health.js';

const db = new PrismaClient();
try {
  const result = await seedHealth(db);
  console.log(`Family health project ${result.projectId}: ${result.created} new content records.`);
} finally {
  await db.$disconnect();
}
