import '../backend/src/config.ts';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { editionPayload } from '../PM-daily/scripts/publish-precision-brief.mjs';

const db = new PrismaClient();
const temporary = await mkdtemp(join(tmpdir(), 'precision-browser-'));
const output = resolve('output/playwright/precision');
const base = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5180';
const suffix = randomBytes(6).toString('hex');
const session = `precision-${suffix}`;
const candidateText = await readFile('PM-daily/briefs/2026-11-12.json', 'utf8');
const candidate = JSON.parse(candidateText);
const artifact = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const accounts = ['admin', 'visitor'].map(role => ({ role, username: `qa-pm-${role}-${suffix}`, password: randomBytes(24).toString('base64url') }));
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
function cli(args) {
  let text;
  try {
    text = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) { text = `${error.stdout || ''}\n${error.stderr || ''}`; }
  let safe = text.split('### Ran Playwright code')[0];
  for (const account of accounts) safe = safe.replaceAll(account.password, '[REDACTED]');
  if (/### Error|Error:|error:/i.test(safe)) throw new Error(safe.slice(0, 3500));
  return safe;
}
async function run(code) {
  const filename = join(temporary, 'browser-step.js');
  await writeFile(filename, `async page => { const accounts = ${JSON.stringify(accounts)}; const base = ${JSON.stringify(base)}; const output = ${JSON.stringify(output)}; const candidate = ${JSON.stringify(candidate)}; ${code} }`, { mode: 0o600 });
  const result = cli(['run-code', '--filename', filename]);
  if (result.includes('### Result')) {
    const value = JSON.parse(result.split('### Result')[1].split(/\n### /)[0].trim());
    if (value.publishedEdition) {
      assert.deepEqual(editionPayload(value.publishedEdition), editionPayload(candidate), 'Published edition differs from frozen candidate');
      await writeFile(join(output, 'authenticated-current.json'), JSON.stringify(value.publishedEdition, null, 2));
      delete value.publishedEdition;
    }
    console.log(JSON.stringify(value));
  }
}
try {
  await mkdir(output, { recursive: true });
  const project = await db.content.findFirstOrThrow({ where: { description: { contains: '<!-- PRECISION_BRIEF_PROJECT -->' }, isProject: true } });
  for (const account of accounts) {
    const user = await db.user.create({ data: { username: account.username, passwordHash: await bcrypt.hash(account.password, 10), role: account.role, mustChangePassword: false } });
    if (account.role === 'visitor') await db.projectAccess.create({ data: { projectId: project.id, userId: user.id } });
  }
  cli(['open', base]);
  cli(['snapshot']);
  await run(`
    await page.getByRole('textbox', { name: '用户名', exact: true }).fill(accounts[0].username);
    await page.getByRole('textbox', { name: '密码', exact: true }).fill(accounts[0].password);
    await page.getByRole('button', { name: /^打开/ }).click();
    await page.waitForURL('**/home');
    await page.goto(base + '/home?project=${project.id}');
    await page.locator('.precision-intro').waitFor();
    await page.getByRole('button', { name: '阅读当前日报' }).click();
    await page.locator('.precision-news').first().waitFor();
    const scheduleNotice = page.locator('.precision-schedule-notice');
    if (await scheduleNotice.count() && !(await scheduleNotice.innerText()).includes('已发布日报')) throw new Error('Published edition status is unclear');
    const response = await page.request.get(base + '/api/precision-brief/projects/${project.id}/current');
    const current = (await response.json()).run;
    if (await page.locator('.precision-section').count() !== 5) throw new Error('Expected five sections');
    if (await page.locator('.precision-news').count() !== 12) throw new Error('Expected twelve reviewed items');
    const section = page.locator('.precision-section').first();
    await section.locator('summary').click();
    if (await section.getAttribute('open') !== null) throw new Error('Collapse failed');
    await section.locator('summary').click();
    if (await section.getAttribute('open') === null) throw new Error('Expand failed');
    for (const link of await page.locator('.precision-citations a').all()) {
      if (!/^https?:/.test(await link.getAttribute('href'))) throw new Error('Unsafe source link');
      if (await link.getAttribute('target') !== '_blank') throw new Error('Source should open separately');
    }
    if (await page.locator('.precision-news.important').count() < 1) throw new Error('Important item styling missing');
    for (const format of ['Markdown', 'HTML']) {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: format, exact: true }).click();
      const download = await pending;
      await download.saveAs(output + '/current.' + (format === 'HTML' ? 'html' : 'md'));
    }
    await page.reload();
    await page.locator('.precision-news').first().waitFor();
    return { current: 'five sections, twelve items, collapse and expand, citations, importance, downloads, session refresh passed', publishedEdition: current };
  `);
  for (const width of [1440, 390, 320]) {
    await run(`
      await page.setViewportSize({ width: ${width}, height: 900 });
      for (const view of ['overview','current','tasks','sources','runs','rules']) {
        await page.goto(base + '/home?project=${project.id}&briefView=' + view);
        await page.locator('.precision-space').waitFor();
        await page.getByRole('status').filter({ hasText: '正在读取行业简报' }).waitFor({ state: 'hidden' });
        if (view === 'tasks') await page.locator('.precision-task-body').first().waitFor({ state: 'attached' });
        if (await page.locator('.precision-alert').count()) throw new Error('View error: ' + view);
        const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
          panels: [...document.querySelectorAll('.precision-space')].map(node => node.getBoundingClientRect().right) }));
        if (overflow.document > ${width} + 1 || overflow.panels.some(right => right > ${width} + 1)) throw new Error('Overflow: ' + view + JSON.stringify(overflow));
        await page.screenshot({ path: output + '/${width}-' + view + '.png', fullPage: true });
      }
      return { width: ${width}, views: 6, overflow: false };
    `);
  }
  await run(`
    await page.setViewportSize({ width: 390, height: 900 });
    const endpoint = base + '/api/precision-brief/projects/${project.id}/current';
    const original = await (await page.request.get(endpoint)).json();
    for (const scenario of ['loading','error','empty','no_news','failed']) {
      let release;
      const pending = new Promise(resolve => { release = resolve; });
      await page.route('**/api/precision-brief/projects/${project.id}/current', async route => {
        if (scenario === 'loading') await pending;
        if (scenario === 'error') return route.fulfill({ status: 503, json: { error: { code: 'QA_UNAVAILABLE', message: '日报读取暂时不可用' } } });
        const value = JSON.parse(JSON.stringify(original));
        if (scenario === 'empty') { value.run = null; value.lastAttempt = null; }
        if (scenario === 'no_news') value.run.items = [];
        if (scenario === 'failed') value.lastAttempt = { ...value.lastAttempt, status: 'failed', errorMessage: '隔离页面模拟：来源核验未完成' };
        return route.fulfill({ json: value });
      });
      await page.goto(base + '/home?project=${project.id}&briefView=current');
      if (scenario === 'loading') { await page.getByText('正在读取行业简报…').waitFor(); release(); }
      if (scenario === 'error') {
        await page.locator('.precision-alert').waitFor();
        await page.getByRole('heading', { name: '暂时无法确认日报状态' }).waitFor();
        if (await page.getByText('首份日报尚未发布', { exact: true }).count()) throw new Error('Read error reported as unpublished');
      }
      if (scenario === 'empty') await page.getByText('首份日报尚未发布').waitFor();
      if (scenario === 'no_news') { await page.locator('.precision-no-news').first().waitFor(); if (await page.locator('.precision-no-news').count() !== 5) throw new Error('Empty sections omitted'); }
      if (scenario === 'failed') { await page.locator('.precision-warning').first().waitFor(); if (await page.locator('.precision-news').count() !== 12) throw new Error('Previous edition missing'); }
      await page.screenshot({ path: output + '/state-' + scenario + '.png', fullPage: true });
      await page.unroute('**/api/precision-brief/projects/${project.id}/current');
    }
    await page.request.post(base + '/api/auth/logout', { data: {} });
    const login = await page.request.post(base + '/api/auth/login', { data: { username: accounts[1].username, password: accounts[1].password } });
    if (!login.ok()) throw new Error('Reader login failed');
    await page.goto(base + '/home?project=${project.id}&briefView=current');
    await page.locator('.precision-news').first().waitFor();
    if (await page.getByRole('button', { name: '运行记录', exact: true }).count()) throw new Error('Reader saw run administration');
    const current = await (await page.request.get(endpoint)).json();
    if (current.run.tasks.length || current.canManage || current.canInspect) throw new Error('Reader raw tasks leaked');
    const denied = await page.request.get(base + '/api/precision-brief/projects/${project.id}/runs');
    if (denied.status() !== 403) throw new Error('Reader history accessible');
    await page.screenshot({ path: output + '/reader.png', fullPage: true });
    return { states: 'loading, error, empty, no-news, failure-preserves-edition passed', reader: 'restricted to published current' };
  `);
  if (await readFile('PM-daily/briefs/2026-11-12.json', 'utf8') !== candidateText) throw new Error('Candidate changed during browser verification');
  const original = candidate;
  for (const format of ['md', 'html']) {
    const content = await readFile(join(output, `current.${format}`), 'utf8');
    for (const item of original.items) if (!content.includes(item.title)) throw new Error(`Missing download item: ${format}`);
    for (const source of original.sources) if (!content.includes(source.url.replaceAll('&', format === 'html' ? '&amp;' : '&'))) throw new Error(`Missing download citation: ${format}`);
  }
  await writeFile(join(output, 'verification.json'), JSON.stringify({ artifact, verifiedAt: new Date().toISOString(),
    projectId: project.id, runKey: candidate.runKey, briefSha256: createHash('sha256').update(candidateText).digest('hex'),
    itemCount: candidate.items.length, sourceCount: candidate.sources.length, viewports: [1440, 390, 320],
    authenticatedApiMatchesCandidate: true, downloadsComplete: true }, null, 2));
  console.log('Browser verification and complete Markdown/HTML downloads passed.');
} finally {
  try { cli(['close']); } catch { /* Cleanup must continue even if browser already exited. */ }
  const users = await db.user.findMany({ where: { username: { in: accounts.map(account => account.username) } }, select: { id: true } });
  await db.accessLog.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await db.$disconnect();
  await rm(temporary, { recursive: true, force: true });
}
