import { mkdir, readdir, lstat, copyFile, symlink, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const target = resolve('output/releases', version);
const excluded = new Set(['node_modules', 'dist', '.venv', '__pycache__', 'data']);
async function copy(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error('Unexpected source link');
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const name of await readdir(source)) {
      if (excluded.has(name) || /\.db(?:-|$)/.test(name)) continue;
      await copy(join(source, name), join(destination, name));
    }
  } else if (info.isFile()) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}
for (const name of ['package.json', 'package-lock.json', '.env.example', '.gitignore', '.github', 'README.md', 'docs', 'eslint.config.mjs', 'frontend', 'backend', 'shared', 'python', 'scripts', 'deploy', 'research/world-evidence'])
  await copy(resolve(name), join(target, name));
await symlink(resolve('node_modules'), join(target, 'node_modules'), 'junction');
const db = new PrismaClient();
try {
  const file = join(target, 'local-snapshot.db').replaceAll('\\', '/');
  await db.$executeRawUnsafe(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
} finally { await db.$disconnect(); }
await writeFile(resolve('output/releases/latest.json'), JSON.stringify({ version, target }));
console.log(JSON.stringify({ version, target, frozen: true }));
