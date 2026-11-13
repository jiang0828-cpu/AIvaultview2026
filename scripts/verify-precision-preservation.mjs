import '../backend/src/config.ts';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('output/precision-brief');
const manifest = resolve(directory, 'preservation.json');
const db = new PrismaClient();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  if (process.argv.includes('--backup')) {
    await mkdir(directory, { recursive: true });
    const tables = ['content', 'researchStudy', 'researchTask', 'researchTaskVersion', 'researchSynthesis', 'researchSynthesisVersion', 'literaryWriter'];
    const baseline = {};
    for (const table of tables) {
      const rows = await db[table].findMany();
      baseline[table] = rows.map(row => ({ id: row.id, hash: hash(row) }));
    }
    await db.$disconnect();
    const url = process.env.DATABASE_URL;
    if (!url?.startsWith('file:')) throw new Error('Expected a local SQLite file');
    await copyFile(resolve('backend/prisma', url.slice(5)), resolve(directory, `before-${Date.now()}.db`));
    await writeFile(manifest, JSON.stringify(baseline), { flag: 'wx' });
    console.log('SQLite backup and existing-content fingerprints recorded.');
  } else {
    const baseline = JSON.parse(await readFile(manifest, 'utf8'));
    let checked = 0;
    for (const [table, rows] of Object.entries(baseline)) {
      const current = new Map((await db[table].findMany()).map(row => [row.id, hash(row)]));
      for (const row of rows) {
        if (current.get(row.id) !== row.hash) throw new Error(`Existing ${table} record changed: ${row.id}`);
        checked++;
      }
    }
    console.log(`Preservation passed: ${checked} existing records unchanged.`);
  }
} finally { await db.$disconnect(); }
