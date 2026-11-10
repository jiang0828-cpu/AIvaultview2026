import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, open } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const schemaDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(schemaDirectory, "../../.env") });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:"))
  throw new Error("DATABASE_URL must be a SQLite file URL.");
const databasePath = resolve(schemaDirectory, databaseUrl.slice(5));
await mkdir(dirname(databasePath), { recursive: true });
// Prisma 6 on Windows may fail to migrate a SQLite file that does not yet exist.
const file = await open(databasePath, "a");
await file.close();
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    require.resolve("prisma/build/index.js"),
    "migrate",
    "deploy",
    "--schema",
    resolve(schemaDirectory, "schema.prisma"),
  ],
  { stdio: "inherit", env: process.env, windowsHide: true },
);
process.exit(result.status ?? 1);
