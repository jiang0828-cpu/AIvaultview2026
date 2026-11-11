import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const destination = resolve(root, 'output/reviews/world-evidence-candidate');
const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', windowsHide: true }).split('\0');
const files = paths.filter((file) => file && (
  ['backend/', 'frontend/', 'scripts/', 'research/world-evidence/'].some((prefix) => file.startsWith(prefix)) ||
  ['package.json', 'package-lock.json', 'eslint.config.mjs', 'README.md', '.env.example'].includes(file)
) && !/\.(db|log)$/.test(file) && !file.includes('/run/.tmp/'));
const manifest = files.map((file) => {
  const bytes = readFileSync(resolve(root, file));
  const target = resolve(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target) || !readFileSync(target).equals(bytes)) copyFileSync(resolve(root, file), target);
  return { file, sha256: createHash('sha256').update(bytes).digest('hex') };
});
mkdirSync(resolve(destination, 'verification'), { recursive: true });
for (const file of ['world-evidence-tests-final.log', 'world-evidence-typecheck.log', 'world-evidence-build.log', 'world-evidence-lint.log', 'world-evidence-style-001.log', 'world-evidence-style-002.log', 'world-evidence-browser-final.log'])
  copyFileSync(resolve(root, '.tmp', file), resolve(destination, 'verification', file));
for (const id of [176, 185]) for (const suffix of ['calculations.png', 'claims.png'])
  copyFileSync(resolve(root, `output/playwright/world-evidence-${id}-${suffix}`), resolve(destination, `verification/world-evidence-${id}-${suffix}`));
for (const id of [176, 185]) for (const width of [1440, 390, 320])
  copyFileSync(resolve(root, `output/playwright/world-evidence-${id}-full-${width}.png`), resolve(destination, `verification/world-evidence-${id}-full-${width}.png`));
for (const id of [176, 185]) copyFileSync(resolve(root, `output/playwright/world-evidence-${id}.md`), resolve(destination, `verification/world-evidence-${id}.md`));
copyFileSync(resolve(root, '.tmp/world-evidence-browser.js'), resolve(destination, 'verification/browser-check.js'));
writeFileSync(resolve(destination, 'verification/source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Prepared ${manifest.length} source files and bounded verification artifacts; excludes credentials, user database, node_modules and unrelated research.`);
