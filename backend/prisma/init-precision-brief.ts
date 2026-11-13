import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedPrecisionBrief } from './seed-precision-brief.js';

const db = new PrismaClient();
try {
  const result = await seedPrecisionBrief(db);
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
