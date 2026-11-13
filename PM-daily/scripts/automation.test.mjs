import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { dailyWindow } from './precision-brief-queue.mjs';
import { runValidation } from './validate-precision-brief.mjs';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let directory;
before(async () => { await mkdir(join(projectDirectory, 'runtime'), { recursive: true }); directory = await mkdtemp(join(projectDirectory, 'runtime/automation-test-')); });
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });
function fixture() {
  const window = dailyWindow();
  return { runKey: 'automation-unit-test', issueDate: window.issueDate, windowStart: window.windowStart.toISOString(), windowEnd: window.windowEnd.toISOString(), firstIssue: false,
    summary: '本时窗未发现经核实新增。保留五个栏目。该输入只用于隔离测试，不用于发布真实新闻。',
    tasks: ['company', 'competitors', 'regulation', 'science', 'partners'].map(kind => ({ kind, status: 'no_news',
      rawReport: '本时窗未发现经核实新增。', coverage: '隔离测试覆盖五个任务完整性与窗口检查，不宣称完成联网抓取。', errorMessage: '' })), items: [], sources: [] };
}

test('daily window always ends at the latest Beijing 09:00 and spans 24 hours', () => {
  const before = dailyWindow(new Date('2026-11-12T00:59:59Z'));
  const after = dailyWindow(new Date('2026-11-12T01:00:00Z'));
  assert.equal(before.issueDate, '2026-11-11');
  assert.equal(after.issueDate, '2026-11-12');
  assert.equal(after.windowEnd.toISOString(), '2026-11-12T01:00:00.000Z');
  assert.equal(after.windowEnd.getTime() - after.windowStart.getTime(), 86400000);
});

test('CLI validation checks complete five-task wire data and rejects an unknown source', async () => {
  const good = join(directory, 'good.json');
  await writeFile(good, JSON.stringify(fixture()));
  const run = file => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/validate-precision-brief.mjs', file], { cwd: resolve(projectDirectory, '..'), encoding: 'utf8', windowsHide: true });
  assert.equal(run(good).status, 0);
  const bad = fixture();
  bad.tasks[0].status = 'completed';
  bad.items.push({ section: 'company', title: '隔离测试条目', message: '验证缺失来源的错误路径。', attention: '来源未提供。', commentary: '不应发布。', severity: 'normal', sourceIds: ['missing'] });
  const invalid = join(directory, 'invalid.json');
  await writeFile(invalid, JSON.stringify(bad));
  const result = run(invalid);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /未知|来源/);
});

test('PostToolUse and Stop reject incomplete active briefs without changing prior output', async () => {
  const previous = join(directory, 'previous.json');
  await writeFile(previous, '{"published":"previous"}');
  const candidate = join(directory, 'candidate.json');
  await writeFile(candidate, JSON.stringify({ ...fixture(), tasks: [] }));
  const active = join(directory, 'active.json');
  await writeFile(active, JSON.stringify({ status: 'awaiting_validation', inputPath: candidate }));
  const options = { activeFilePath: active, eventInput: '{}' };
  assert.equal(await runValidation(['--hook'], options), 2);
  assert.equal(await runValidation(['--stop'], options), 2);
  assert.equal(await readFile(previous, 'utf8'), '{"published":"previous"}');
  assert.equal(await runValidation(['--stop'], { activeFilePath: join(directory, 'missing.json'), eventInput: '{}' }), 0);
  assert.equal(await runValidation(['--stop'], { ...options, eventInput: '{"stop_hook_active":true}' }), 0);
  await writeFile(active, '{');
  assert.equal(await runValidation(['--hook'], options), 2);
  await writeFile(active, JSON.stringify({ status: 'awaiting_validation', inputPath: '../outside.json' }));
  assert.equal(await runValidation(['--stop'], options), 2);
});

test('isolated SQLite CLI flow queues five tasks, publishes and preserves current after failed runs', async () => {
  const workspace = resolve(projectDirectory, '..');
  const output = join(directory, 'cli-output');
  const databaseUrl = `file:${join(directory, 'automation.db').replaceAll('\\', '/')}`;
  const environment = { ...process.env, DATABASE_URL: databaseUrl, PM_BRIEF_OUTPUT_DIR: output };
  const execute = (args, expected = 0) => {
    const result = spawnSync(process.execPath, args, { cwd: workspace, env: environment, encoding: 'utf8', windowsHide: true, timeout: 60000 });
    assert.equal(result.status, expected, result.stderr || result.error?.message || result.stdout);
    return result.stdout;
  };
  const cli = (script, args = [], expected = 0) => execute(['--import', 'tsx', `scripts/${script}.mjs`, ...args], expected);
  const parseLast = output => JSON.parse(output.trim().split(/\r?\n/).at(-1));
  const inputMetadata = ({ runId, runKey, issueDate, windowStart, windowEnd, firstIssue }) => ({ runId, runKey, issueDate, windowStart, windowEnd, firstIssue });
  execute(['backend/prisma/migrate.mjs']);
  const seeded = parseLast(execute(['--import', 'tsx', 'backend/prisma/init-precision-brief.ts']));
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const queue = () => parseLast(cli('precision-brief-queue', ['--create']));
    const first = queue();
    assert.equal(first.projectId, seeded.projectId);
    assert.equal(first.status, 'queued');
    assert.equal((await db.precisionBriefTask.count({ where: { runId: first.runId } })), 5);
    const started = parseLast(cli('precision-brief-queue', ['--start', String(first.runId)]));
    assert.equal(started.status, 'running');
    assert.equal(await db.precisionBriefTask.count({ where: { runId: first.runId, status: 'running' } }), 5);
    cli('precision-brief-queue', ['--start', String(first.runId)], 2);
    const candidate = { ...fixture(), ...inputMetadata(first) };
    candidate.tasks[0].status = 'completed';
    candidate.items = [{ section: 'company', title: '隔离数据库测试公告', message: '只验证自动化发布链路，不代表发生真实行业事件。', attention: '这是无网络隔离测试。', commentary: '核对原始事实与业务点评字段独立保存。', severity: 'normal', sourceIds: ['S1'] }];
    candidate.sources = [{ key: 'S1', title: '隔离测试来源元数据', publisher: '隔离测试机构', publishedAt: new Date(Date.parse(first.windowStart) + 3600000).toISOString(), accessedAt: new Date().toISOString(), url: 'https://www.fda.gov/medical-devices', sourceType: 'official', verified: true }];
    const inputPath = join(directory, 'cli-brief.json');
    await writeFile(inputPath, JSON.stringify(candidate));
    assert.equal(parseLast(cli('publish-precision-brief', [inputPath])).status, 'published');
    const current = await db.precisionBriefRun.findFirstOrThrow({ where: { projectId: seeded.projectId, isCurrent: true }, include: { tasks: true, items: true, sources: true } });
    assert.equal(current.id, first.runId);
    assert.equal(current.tasks.length, 5);
    assert.equal(current.items.length, 1);
    assert.equal(current.sources.length, 1);
    assert.ok(current.tasks.every(task => task.completedAt));
    assert.equal(current.validation.passed, true);
    const mirrored = await readFile(join(output, 'published/current.json'), 'utf8');
    assert.equal(JSON.parse(mirrored).publishedRunId, first.runId);
    assert.equal(parseLast(cli('publish-precision-brief', [inputPath])).runId, first.runId);
    await writeFile(inputPath, JSON.stringify({ ...candidate, summary: '修订内容不能被相同运行键静默忽略。' }));
    cli('publish-precision-brief', [inputPath], 2);
    assert.equal(await readFile(join(output, 'published/current.json'), 'utf8'), mirrored);
    assert.equal((await db.precisionBriefRun.findUniqueOrThrow({ where: { id: first.runId } })).summary, candidate.summary);
    const second = queue();
    cli('precision-brief-queue', ['--start', String(second.runId)]);
    await writeFile(inputPath, JSON.stringify({ ...candidate, ...inputMetadata(second), sources: [] }));
    cli('publish-precision-brief', [inputPath], 2);
    const rejected = await db.precisionBriefRun.findUniqueOrThrow({ where: { id: second.runId }, include: { tasks: true } });
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.validation.passed, false);
    assert.match(rejected.errorMessage, /来源|未知/);
    assert.equal(rejected.tasks.length, 5);
    assert.equal(await readFile(join(output, 'published/current.json'), 'utf8'), mirrored);
    assert.equal(JSON.parse(await readFile(join(output, 'runtime/active.json'), 'utf8')).status, 'failed');
    const third = queue();
    cli('precision-brief-queue', ['--start', String(third.runId)]);
    cli('precision-brief-queue', ['--fail', String(third.runId), 'isolated upstream task failure']);
    assert.equal(await db.precisionBriefRun.count({ where: { projectId: seeded.projectId } }), 3);
    assert.equal(await db.precisionBriefTask.count(), 15);
    assert.equal(await db.precisionBriefRun.count({ where: { isCurrent: true, id: first.runId, status: 'published' } }), 1);
    assert.equal(await db.precisionBriefRun.count({ where: { status: 'failed' } }), 2);
    const revision = { ...candidate, runId: undefined, runKey: `${first.runKey}-revision`, summary: '独立修订版本，验证历史重试不能让本地当前版回退。' };
    await writeFile(inputPath, JSON.stringify(revision));
    const revised = parseLast(cli('publish-precision-brief', [inputPath]));
    const revisedMirror = await readFile(join(output, 'published/current.json'), 'utf8');
    assert.notEqual(revised.runId, first.runId);
    await writeFile(inputPath, JSON.stringify(candidate));
    cli('publish-precision-brief', [inputPath], 2);
    assert.equal(await readFile(join(output, 'published/current.json'), 'utf8'), revisedMirror);
    assert.equal((await db.precisionBriefRun.findFirstOrThrow({ where: { isCurrent: true } })).id, revised.runId);
  } finally { await db.$disconnect(); }
});
