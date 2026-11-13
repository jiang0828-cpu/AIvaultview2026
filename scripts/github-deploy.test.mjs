import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { requireReviewers } from './check-deployment-approval.mjs';
import { verifyCandidate } from './deploy-github-release.mjs';

test('deployment fails closed without reviewers or with approval bypass enabled', () => {
  assert.throws(() => requireReviewers({ protection_rules: [] }), /required reviewers/);
  assert.throws(() => requireReviewers({ protection_rules: [{ type: 'required_reviewers', reviewers: [] }] }), /required reviewers/);
  const environment = { can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 1 } }] }] };
  assert.doesNotThrow(() => requireReviewers(environment));
  assert.throws(() => requireReviewers({ ...environment, can_admins_bypass: true }), /bypass/);
});

test('code-only CI packages exclude local databases, media and data even when configured', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vaultview-ci-test-'));
  const revision = 'a'.repeat(40);
  try {
    const files = ['package.json', 'package-lock.json', '.env.example', 'backend/package.json', 'backend/dist/src/server.js',
      'backend/prisma/schema.prisma', 'backend/prisma/migrations/test/migration.sql', 'frontend/package.json', 'frontend/dist/index.html',
      'python/price_compare/main.py', 'python/requirements.txt', 'deploy/vault.trialmatch.xin/upgrade.sh',
      'scripts/apply-release-data.mjs', 'scripts/release-merge.mjs', 'scripts/verify-production.mjs'];
    for (const file of [...files, '.env', 'local.db', 'backend/media/private.txt', 'python/price_compare/data/private.txt']) {
      const path = join(directory, file);
      await mkdir(resolve(path, '..'), { recursive: true });
      await writeFile(path, file.endsWith('.json') ? '{}' : file);
    }
    const run = () => JSON.parse(execFileSync(process.execPath, [resolve('scripts/package-upgrade.mjs'), '--code-only'], {
      cwd: directory, env: { ...process.env, RELEASE_SOURCE_ROOT: directory, RELEASE_SOURCE_REVISION: revision,
        LOCAL_RELEASE_SNAPSHOT: join(directory, 'missing.db'), BASELINE_RELEASE_DATA: join(directory, 'missing.json') },
      encoding: 'utf8', windowsHide: true,
    }));
    const { output } = run();
    const manifest = await verifyCandidate(output, revision);
    assert.equal(manifest.mode, 'code-only');
    assert.equal(manifest.media, 0);
    const data = JSON.parse(await readFile(join(output, 'payload/data.json'), 'utf8'));
    assert.deepEqual(data.baseline, { content: [], literaryWriter: [] });
    assert.ok(Object.values(data.local).every(rows => rows.length === 0));
    assert.deepEqual(JSON.parse(await readFile(join(output, 'payload/media.json'), 'utf8')), []);
    const databaseUrl = `file:${join(directory, 'preview.db').replaceAll('\\', '/')}`;
    execFileSync(process.execPath, [resolve('backend/prisma/migrate.mjs')], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe', windowsHide: true,
    });
    const preview = JSON.parse(execFileSync(process.execPath, [resolve('scripts/apply-release-data.mjs'), join(output, 'payload'), '--check'], {
      env: { ...process.env, RELEASE_DATABASE_URL: databaseUrl }, encoding: 'utf8', windowsHide: true,
    }));
    assert.equal(preview.created, 0);
    assert.equal(preview.relatedCreated, 0);
    const entries = execFileSync('tar', ['-tzf', join(output, 'vaultview-upgrade.tar.gz')], { encoding: 'utf8', windowsHide: true });
    assert.ok(entries.includes('release-manifest.json'));
    assert.doesNotMatch(entries, /(?:^|\/)\.env(?:\r?\n|$)|local\.db|private\.txt/);
    await assert.rejects(verifyCandidate(output, 'b'.repeat(40)), /approved code-only commit/);
    await writeFile(join(output, 'upgrade.sh'), 'tampered');
    await assert.rejects(verifyCandidate(output, revision), /integrity check/);
    const digest = createHash('sha256').update('tampered').digest('hex');
    await writeFile(join(output, 'SHA256SUMS'), `${digest}  upgrade.sh\n${digest}  upgrade.sh\n`);
    await assert.rejects(verifyCandidate(output, revision), /duplicate/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('frozen Git releases retain published workflows and preserve local history and staged changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vaultview-git-ci-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Release Test', GIT_AUTHOR_EMAIL: 'release@example.test',
    GIT_COMMITTER_NAME: 'Release Test', GIT_COMMITTER_EMAIL: 'release@example.test' };
  const git = args => execFileSync('git', args, { cwd: directory, env, encoding: 'utf8', windowsHide: true }).trim();
  try {
    git(['init', '-b', 'main']);
    await writeFile(join(directory, '.gitignore'), 'output/\n');
    await writeFile(join(directory, 'README.md'), 'original\n');
    git(['add', '.']); git(['commit', '-m', 'Local history']);
    const original = git(['rev-parse', 'HEAD']);
    git(['checkout', '-b', 'published']);
    await mkdir(join(directory, '.github/workflows'), { recursive: true });
    await writeFile(join(directory, '.github/workflows/release.yml'), 'published workflow\n');
    git(['add', '.']); git(['commit', '-m', 'Published workflow']);
    const published = git(['rev-parse', 'HEAD']);
    git(['update-ref', 'refs/remotes/origin/main', published]);
    git(['checkout', 'main']);
    await writeFile(join(directory, 'README.md'), 'user edit\n');
    git(['add', 'README.md']);
    const staged = git(['diff', '--cached']);
    const frozen = join(directory, 'output/frozen');
    await mkdir(frozen, { recursive: true });
    await writeFile(join(frozen, 'README.md'), 'frozen release\n');
    await writeFile(join(frozen, '.gitignore'), 'output/\n');
    const result = JSON.parse(execFileSync(process.execPath, [resolve('scripts/prepare-git-release.mjs')], {
      cwd: directory, env: { ...env, RELEASE_SOURCE_ROOT: frozen, RELEASE_VERSION: 'ci-test' }, encoding: 'utf8', windowsHide: true,
    }));
    assert.equal(git(['show', `${result.branch}:.github/workflows/release.yml`]), 'published workflow');
    assert.equal(git(['show', `${result.branch}:README.md`]), 'frozen release');
    assert.equal(git(['rev-parse', `${result.revision}^`]), published);
    assert.equal(git(['rev-parse', 'HEAD']), original);
    assert.equal(git(['diff', '--cached']), staged);
    assert.equal(await readFile(join(directory, 'README.md'), 'utf8'), 'user edit\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
