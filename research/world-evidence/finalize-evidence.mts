import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const candidate = resolve(root, 'output/reviews/world-evidence-candidate');
const files = [
  'backend/prisma/world.ts', 'backend/prisma/world-data.ts', 'backend/prisma/world-002.ts',
  'backend/prisma/world-002-data.ts', 'backend/prisma/world-evidence-001.ts', 'backend/prisma/world-evidence-002.ts',
  'backend/prisma/init-world-evidence.ts', 'backend/prisma/upgrade-world-evidence.ts',
  'backend/src/worldSchema.ts', 'backend/test/world.test.ts', 'frontend/src/WorldSpace.tsx',
  'frontend/src/worldModel.ts', 'frontend/src/world.css', 'frontend/test/world.test.ts',
];
for (const file of files) {
  if (!readFileSync(resolve(root, file)).equals(readFileSync(resolve(candidate, file))))
    throw new Error(`Reviewed source differs: ${file}`);
}
const run = 'research/world-evidence/run';
mkdirSync(resolve(root, run, 'audits/round-2/evidence'), { recursive: true });
for (const file of ['scores.csv', 'round-2/evidence/EVIDENCE.md', 'round-2/evidence/CHANGED.md'])
  copyFileSync(resolve(candidate, run, 'audits', file), resolve(root, run, 'audits', file));
console.log(`Verified ${files.length} live WORLD source files against final candidate; copied unmodified final gate evidence.`);
