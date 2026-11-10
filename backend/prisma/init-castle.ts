import "../src/config.js";
import { PrismaClient } from "@prisma/client";
import { seedCastle } from "./seed-castle.js";

const db = new PrismaClient();
try {
  console.log(`Castle space ready: ${await seedCastle(db)}`);
} finally {
  await db.$disconnect();
}
