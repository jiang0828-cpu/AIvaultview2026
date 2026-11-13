import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Preserve the working tree and unpublished history. The new release has the
// published branch as its parent and excludes downloaded third-party HTML.
const directory = await mkdtemp(resolve('output/git-release-'));
const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index') };
const git = (args, input) => execFileSync('git', args, { env, input, encoding: 'utf8', windowsHide: true }).trim();
try {
  git(['read-tree', 'HEAD']);
  const archived = git(['ls-tree', '-r', '--name-only', 'HEAD', 'research']).split('\n').filter(name => /\.m?html?$/i.test(name));
  for (const name of archived) git(['update-index', '--force-remove', '--', name]);
  const tree = git(['write-tree']);
  const base = git(['rev-parse', 'origin/main']);
  const source = git(['rev-parse', 'HEAD']);
  const revision = git(['commit-tree', tree, '-p', base], `Release learning spaces, sharing access and safe trip synchronization\n\nSource snapshot: ${source}\nDownloaded source webpages remain in local archives.\n`);
  const branch = `release/${new Date().toISOString().slice(0, 10)}`;
  git(['branch', branch, revision]);
  console.log(JSON.stringify({ branch, revision, source, excludedArchives: archived.length }));
} finally { await rm(directory, { recursive: true, force: true }); }
