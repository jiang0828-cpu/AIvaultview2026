import { PrismaClient } from '@prisma/client';
import { seedLiterature } from './seed-literature.js';

const db = new PrismaClient();
try {
  const id = await seedLiterature(db);
  console.log(`Literature project ready: /home?project=${id}. Existing content preserved.`);
} finally {
  await db.$disconnect();
}
