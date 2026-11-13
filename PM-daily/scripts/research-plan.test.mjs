import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createResearchPlan, runPlan, validateRunMetadata } from './research-plan.mjs';
import { withResearchPlan } from './precision-brief-queue.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let directory;
let config;
const metadata = () => ({ runId: 17, projectId: 9, runKey: 'queued-original-window', issueDate: '2026-11-12',
  windowStart: '2026-11-11T01:00:00.000Z', windowEnd: '2026-11-12T01:00:00.000Z', firstIssue: false, status: 'queued' });
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'precision-plan-test-'));
  config = JSON.parse(await readFile(join(root, 'PM-daily/sources.json'), 'utf8'));
});
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

test('queue plan helper preserves every existing metadata field and the original window', () => {
  const input = metadata();
  const original = structuredClone(input);
  const result = withResearchPlan(input, config);
  const { researchPlan, ...preserved } = result;
  assert.deepEqual(preserved, original);
  assert.deepEqual(input, original);
  assert.equal(researchPlan.windowStart, original.windowStart);
  assert.equal(researchPlan.windowEnd, original.windowEnd);
  assert.equal(researchPlan.runKey, original.runKey);
  assert.deepEqual(researchPlan.tasks.map(task => task.kind), ['company', 'competitors', 'regulation', 'science', 'partners']);
  const firstIssue = { ...input, firstIssue: true, windowStart: '2026-11-05T01:00:00.000Z' };
  assert.equal(withResearchPlan(firstIssue, config).researchPlan.windowStart, firstIssue.windowStart);
});

test('company plan independently covers verified subsidiaries, latest government lists, originals and attachments', () => {
  const plan = createResearchPlan(metadata(), config);
  const company = plan.tasks.find(task => task.kind === 'company');
  const checks = new Map(company.requiredChecks.map(check => [check.id, check]));
  assert.equal(checks.get('source-index').method, 'direct_open');
  assert.ok(checks.get('source-index').sources.some(source => source.id === 'shengene-news'));
  assert.equal(checks.get('government-source-index').method, 'direct_open');
  assert.deepEqual(checks.get('government-source-index').sources.map(source => source.id), ['nanjing-amr', 'nanjing-government', 'jiangbei-government']);
  assert.equal(checks.get('announcement-body').method, 'read_original_and_attachments');
  assert.match(checks.get('announcement-body').instructions, /embedded or separately linked attachments/);
  for (const alias of config.researchPolicy.companyAliases) {
    assert.ok(plan.entityEvidence.some(entry => entry.name === alias));
    for (const term of config.researchPolicy.companyEventTerms) {
      assert.ok(checks.get('entity-search').queries.includes(`"${alias}" "${term}"`));
    }
  }
  assert.ok(checks.get('entity-search').queries.some(query => query.includes('南京世和医疗器械有限公司') && query.includes('提名奖')));
  assert.deepEqual(plan.companyAliases, config.researchPolicy.companyAliases);
  assert.match(plan.notice, /not network collection/);
  assert.match(plan.instructions.join(' '), /date-only.*09:00/);
  assert.match(plan.instructions.join(' '), /publication date, page\/document generation date and publicity period separately/);
});

test('a plan, a parent-company lookup or a homepage never establishes completed coverage', () => {
  const plan = createResearchPlan({ ...metadata(), status: 'completed' }, config);
  for (const task of plan.tasks) {
    assert.equal(task.status, 'not_started');
    assert.equal(task.coverage.noNewsEligible, false);
    assert.deepEqual(task.coverage.completedCheckIds, []);
    assert.deepEqual(task.coverage.unresolvedCandidates, []);
    assert.ok(task.requiredChecks.length >= 3);
    assert.ok(task.requiredChecks.every(check => check.status === 'not_started' && check.checkedAt === null));
    assert.ok(task.coverage.ledger.every(entry => entry.status === 'not_started' && entry.checkedAt === null && !entry.visitedUrls.length));
    assert.match(task.coverage.completionRule, /Homepage-only or parent-company-only checks are insufficient/);
    assert.match(task.coverage.completionRule, /no unresolved candidates/);
    assert.match(task.coverage.completionRule, /failure stays failed/);
  }
});

test('empty and failed queue output needs neither metadata reconstruction nor source configuration', () => {
  for (const input of [{ runId: null, projectId: 9, status: 'empty' }, { runId: 17, status: 'failed' }]) {
    assert.equal(withResearchPlan(input, null), input);
    assert.equal(Object.hasOwn(withResearchPlan(input, null), 'researchPlan'), false);
    assert.equal(Object.hasOwn(withResearchPlan({ ...input, researchPlan: { status: 'not_started' } }, null), 'researchPlan'), false);
  }
});

test('invalid metadata and invalid or unresolved source configuration fail explicitly', () => {
  for (const bad of [{}, { ...metadata(), runKey: '' }, { ...metadata(), windowStart: '2026-11-11' },
    { ...metadata(), windowEnd: metadata().windowStart }, { ...metadata(), windowStart: '2026-02-30T01:00:00Z' },
    { ...metadata(), windowStart: '2026-11-13T01:00:00Z' }]) {
    assert.throws(() => createResearchPlan(bad, config), /run metadata/);
  }
  assert.doesNotThrow(() => validateRunMetadata(metadata()));
  const changed = mutate => { const copy = structuredClone(config); mutate(copy); return copy; };
  for (const bad of [null, changed(copy => { delete copy.researchPolicy; }),
    changed(copy => { copy.sources = copy.sources.filter(source => source.id !== 'nanjing-amr'); }),
    changed(copy => { copy.sources[0].url = 'not-a-url'; }),
    changed(copy => { copy.sources.push(copy.sources[0]); }),
    changed(copy => { copy.researchPolicy.companyRequiredSourceIds.push('unresolved-source'); }),
    changed(copy => { copy.researchPolicy.companyEventTerms = ['注册']; }),
    changed(copy => { copy.researchPolicy.companyAliases.push('未经证实的合作企业'); }),
    changed(copy => { copy.researchPolicy.entityEvidence[0].url = 'https://user:secret@example.org/'; })]) {
    assert.throws(() => createResearchPlan(metadata(), bad), /sources.json/);
  }
});

test('CLI emits JSON for an existing metadata file and accepts its own queue-shaped output', async () => {
  const input = join(directory, 'run.json');
  const source = join(directory, 'sources.json');
  await writeFile(input, JSON.stringify(metadata()));
  await writeFile(source, JSON.stringify(config));
  const execute = args => spawnSync(process.execPath, ['PM-daily/scripts/research-plan.mjs', ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const first = execute([input, '--sources', source]);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stderr, '');
  const output = JSON.parse(first.stdout);
  assert.deepEqual(output, withResearchPlan(metadata(), config));
  await writeFile(input, JSON.stringify(output));
  const repeat = execute([input, '--sources', source]);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.deepEqual(JSON.parse(repeat.stdout), output);
  assert.match(execute(['--help']).stdout, /does not execute network research/);
  const missing = execute([join(directory, 'missing-secret-value.json')]);
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout, '');
  assert.doesNotMatch(missing.stderr, /missing-secret-value/);
  await writeFile(source, JSON.stringify({ ...config, researchPolicy: null }));
  const bad = execute([input, '--sources', source]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /researchPolicy/);
  assert.equal(bad.stdout, '');
  await writeFile(source, JSON.stringify(config));
  await writeFile(input, JSON.stringify({ ...metadata(), summary: 'brief content', tasks: [], items: [], sources: [], token: 'do-not-echo-this-secret' }));
  const secret = execute([input, '--sources', source]);
  assert.equal(secret.status, 0, secret.stderr);
  assert.deepEqual(JSON.parse(secret.stdout), withResearchPlan(metadata(), config));
  assert.doesNotMatch(secret.stdout, /do-not-echo-this-secret|brief content/);
  assert.doesNotMatch(secret.stderr, /do-not-echo-this-secret/);
  for (const state of [{ runId: null, projectId: 9, status: 'empty' }, { ...metadata(), status: 'failed' }]) {
    await writeFile(input, JSON.stringify(state));
    const unchanged = execute([input, '--sources', join(directory, 'missing.json')]);
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.deepEqual(JSON.parse(unchanged.stdout), state);
  }
});

test('CLI reports malformed input, missing sources and invalid arguments without echoing file contents', async () => {
  const input = join(directory, 'bad.json');
  const source = join(directory, 'bad-sources.json');
  const invoke = async args => {
    const output = [];
    const errors = [];
    const code = await runPlan(args, { log: text => output.push(text), error: text => errors.push(text) });
    return { code, output, error: errors.join(' ') };
  };
  await writeFile(input, '{"token":"do-not-echo-this-secret"');
  await writeFile(source, '{"token":"do-not-echo-this-secret"');
  for (const args of [[], ['--unknown'], [input], [input, '--unknown', source]]) {
    const result = await invoke(args);
    assert.equal(result.code, 2);
    assert.deepEqual(result.output, []);
    assert.doesNotMatch(result.error, /do-not-echo-this-secret/);
  }
  await writeFile(input, JSON.stringify(metadata()));
  for (const path of [source, join(directory, 'missing.json')]) {
    const result = await invoke([input, '--sources', path]);
    assert.equal(result.code, 2);
    assert.match(result.error, /sources.json/);
    assert.doesNotMatch(result.error, /do-not-echo-this-secret/);
  }
});
