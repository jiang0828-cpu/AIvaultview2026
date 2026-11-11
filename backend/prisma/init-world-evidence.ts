import '../src/config.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { upgradeWorldEvidence } from './upgrade-world-evidence.js';

const db = new PrismaClient();
try {
  const apply = process.argv.includes('--apply');
  let backup: string | undefined;
  const result = await upgradeWorldEvidence(db, apply, (changes) => {
    const directory = resolve('output/backups');
    mkdirSync(directory, { recursive: true });
    backup = resolve(directory, `world-evidence-${Date.now()}.json`);
    writeFileSync(backup, JSON.stringify({ changes }, null, 2), { flag: 'wx' });
  });
  console.log(JSON.stringify({ projectId: result.projectId, applied: apply, changed: result.changes.map(({ id, title }) => ({ id, title })), conflicts: result.conflicts, backup }));
} finally { await db.$disconnect(); }
