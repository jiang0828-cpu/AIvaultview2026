import "../src/config.js";
import { PrismaClient } from "@prisma/client";
import { seedEnglish } from "./seed-english.js";

const db = new PrismaClient();
try {
  console.log(JSON.stringify(await seedEnglish(db)));
} finally {
  await db.$disconnect();
}
