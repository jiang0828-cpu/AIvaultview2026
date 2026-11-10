import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(resolve(root, ".env.example")) && dirname(root) !== root)
  root = dirname(root);
dotenv.config({ path: resolve(root, ".env") });
export const projectRoot = root;
export function getConfig() {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || secret.startsWith("replace-"))
    throw new Error(
      "Set a unique JWT_SECRET (32+ characters) in .env; run npm run setup first.",
    );
  const sitePassword =
    process.env.SITE_PASSWORD_HASH || process.env.SITE_PASSWORD;
  const adminPassword =
    process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD;
  if (!sitePassword || !adminPassword || sitePassword === adminPassword)
    throw new Error("Configure distinct site and administrator passwords.");
  return {
    secret,
    sitePassword,
    adminPassword,
    siteHashed: Boolean(process.env.SITE_PASSWORD_HASH),
    adminHashed: Boolean(process.env.ADMIN_PASSWORD_HASH),
    production: process.env.NODE_ENV === "production",
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  };
}
export type AppConfig = ReturnType<typeof getConfig>;
