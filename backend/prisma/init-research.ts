import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedResearch } from './seed-research.js';

const db = new PrismaClient();
try {
  const result = await seedResearch(db);
  console.log(`Market research project ready: project ${result.projectId}, initial study ${result.studyId}`);
} finally {
  await db.$disconnect();
}
