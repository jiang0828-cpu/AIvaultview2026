import '../src/config.js';
import { PrismaClient } from '@prisma/client';
import { seedWorld } from './seed-world.js';

const db = new PrismaClient();
try { console.log(JSON.stringify(await seedWorld(db))); }
finally { await db.$disconnect(); }
