import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Preserve the working tree and unpublished history. The new release has the
// published branch as its parent and excludes downloaded third-party HTML.
const directory = await mkdtemp(resolve('output/git-release-'));
const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index') };
const git = (args, input) => execFileSync('git', args, { env, input, encoding: 'utf8', windowsHide: true }).trim();
try {
  const frozen = process.env.RELEASE_SOURCE_ROOT;
  git(['read-tree', frozen ? 'origin/main' : 'HEAD']);
  if (frozen) {
    const localTracked = new Set(git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n'));
    const sourceFiles = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
    const allowed = /^(?:\.github\/|frontend\/|backend\/|shared\/|python\/|scripts\/|deploy\/|docs\/|research\/world-evidence\/|package(?:-lock)?\.json$|\.env\.example$|\.gitignore$|README\.md$|eslint\.config\.mjs$)/;
    for (const file of sourceFiles.filter(file => allowed.test(file))) {
      try {
        const bytes = await readFile(join(resolve(frozen), file));
        const hash = git(['hash-object', '-w', '--path', file, '--stdin'], bytes);
        git(['update-index', '--add', '--cacheinfo', '100644', hash, file]);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // Only remove a missing source file, never an intentionally excluded runtime directory.
        if (localTracked.has(file) && !/(?:^|\/)(?:dist|node_modules|data|\.venv|__pycache__)(?:\/|$)/.test(file))
          git(['update-index', '--force-remove', '--', file]);
      }
    }
  }
  const archived = git(['ls-tree', '-r', '--name-only', 'HEAD', 'research']).split('\n').filter(name => /\.m?html?$/i.test(name));
  for (const name of archived) git(['update-index', '--force-remove', '--', name]);
  const tree = git(['write-tree']);
  const base = git(['rev-parse', 'origin/main']);
  const source = git(['rev-parse', 'HEAD']);
  if (tree === git(['rev-parse', `${base}^{tree}`])) {
    console.log(JSON.stringify({ revision: base, source, unchanged: true }));
  } else {
    const version = process.env.RELEASE_VERSION || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    if (!/^[A-Za-z0-9_-]+$/.test(version)) throw new Error('Invalid release version');
    const revision = git(['commit-tree', tree, '-p', base], `Release learning, English practice, investment workspace and sharing updates\n\nSource snapshot: ${source}\nFrozen release: ${version}\nDownloaded source webpages remain in local archives.\n`);
    const branch = `release/${version}`;
    git(['branch', branch, revision]);
    console.log(JSON.stringify({ branch, revision, source, excludedArchives: archived.length }));
  }
} finally { await rm(directory, { recursive: true, force: true }); }
