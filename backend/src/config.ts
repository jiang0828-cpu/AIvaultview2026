import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { castleProjectTitle } from "./castleProjectName.js";
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(resolve(root, ".env.example")) && dirname(root) !== root)
  root = dirname(root);
dotenv.config({ path: resolve(root, ".env") });
export const projectRoot = root;
export interface AppConfig {
  secret: string;
  adminPassword: string | undefined;
  adminUsername: string;
  adminHashed: boolean;
  shareUsername?: string;
  sharePassword?: string;
  shareHashed?: boolean;
  shareProjectSelectors?: string[];
  production: boolean;
  origin: string;
  trustProxy?: 'loopback';
}
export function getConfig(): AppConfig {
  const proxy = process.env.TRUST_PROXY || '';
  if (proxy && proxy !== 'loopback')
    throw new Error('TRUST_PROXY must be empty or loopback for a same-host reverse proxy.');
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || secret.startsWith("replace-"))
    throw new Error(
      "Set a unique JWT_SECRET (32+ characters) in .env; run npm run setup first.",
    );
  const adminPassword =
    process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD;
  return {
    secret,
    adminPassword,
    adminUsername: process.env.ADMIN_USERNAME || "admin",
    adminHashed: Boolean(process.env.ADMIN_PASSWORD_HASH),
    shareUsername: process.env.SHARE_USERNAME || "user",
    sharePassword: process.env.SHARE_PASSWORD_HASH || process.env.SHARE_PASSWORD || "123456",
    shareHashed: Boolean(process.env.SHARE_PASSWORD_HASH),
    shareProjectSelectors: (process.env.SHARE_PROJECTS || castleProjectTitle)
      .split(",").map(value => value.trim()).filter(Boolean),
    production: process.env.NODE_ENV === "production",
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    ...(proxy === 'loopback' ? { trustProxy: 'loopback' as const } : {}),
  };
}
