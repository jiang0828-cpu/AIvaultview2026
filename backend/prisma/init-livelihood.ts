import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedLivelihood } from './seed-livelihood.js';

const db = new PrismaClient();
try { console.log(JSON.stringify(await seedLivelihood(db))); }
finally { await db.$disconnect(); }
