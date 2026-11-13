import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { seedInvestment } from './investment.js';
dotenv.config();
const db = new PrismaClient();
try { console.log(JSON.stringify(await seedInvestment(db))); }
finally { await db.$disconnect(); }
