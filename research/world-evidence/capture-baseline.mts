import { writeFileSync } from 'node:fs';
import { worldIssue, worldDataDocument, worldChapters, worldMethodDocument } from '../../backend/prisma/world.ts';
import { worldIssue002, worldDataDocument002, worldChapters002 } from '../../backend/prisma/world-002.ts';
writeFileSync(new URL(process.argv[2] ?? './baseline-v1.json', import.meta.url), JSON.stringify({ rows: [
  { number: '001', documents: [worldIssue, worldDataDocument, ...worldChapters] },
  { number: '002', documents: [worldIssue002, worldDataDocument002, ...worldChapters002] },
], method: worldMethodDocument }, null, 2), { flag: 'wx' });
console.log('Saved original built-in descriptions and metadata, without database or credentials.');
