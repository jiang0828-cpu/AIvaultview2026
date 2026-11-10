import { getConfig } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
const db = new PrismaClient();
await db.$connect();
const port = Number(process.env.PORT || 3001);
const server = createApp(db, getConfig()).listen(port, "127.0.0.1", () =>
  console.log(`Yaocang API: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
