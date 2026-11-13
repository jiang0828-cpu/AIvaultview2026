import '../backend/src/config.ts';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const db = new PrismaClient();
const temporary = await mkdtemp(join(tmpdir(), 'cdx-browser-'));
const output = resolve('output/playwright/cdx');
const base = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5180';
const username = `qa-cdx-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
let userId;
function cli(args) {
  let result;
  try {
    result = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=cdx', ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    const safe = String(error.stdout || '').split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
    throw new Error(safe.slice(0, 2000) || 'Browser command failed; private arguments withheld.');
  }
  const safe = result.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
  if (safe.includes('### Error')) throw new Error(safe.slice(0, 2000));
  return safe;
}
async function run(code) {
  const filename = join(temporary, 'step.js');
  await writeFile(filename, `async page => { const base = ${JSON.stringify(base)}; const output = ${JSON.stringify(output)}; ${code} }`, { mode: 0o600 });
  console.log(cli(['run-code', '--filename', filename]).trim());
}
try {
  await mkdir(output, { recursive: true });
  const registry = await db.config.findUniqueOrThrow({ where: { key: 'research.cdx-market.v1.studyId' } });
  const study = await db.researchStudy.findUniqueOrThrow({ where: { id: Number(registry.value) } });
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 4), role: 'visitor', mustChangePassword: false } });
  userId = user.id;
  await db.projectAccess.create({ data: { userId, projectId: study.projectId } });
  cli(['open', base]);
  cli(['snapshot']);
  await run(`
    await page.getByRole('textbox', { name: '用户名', exact: true }).fill(${JSON.stringify(username)});
    await page.getByRole('textbox', { name: '密码', exact: true }).fill(${JSON.stringify(password)});
    await page.getByRole('button', { name: /^打开/ }).click();
    await page.waitForURL('**/home');
    return { login: true };
  `);
  const path = `/home?project=${study.projectId}&study=${study.id}&researchView=report`;
  for (const width of [1440, 390, 320]) {
    await run(`
      await page.setViewportSize({ width: ${width}, height: 900 });
      await page.goto(base + ${JSON.stringify(path)});
      await page.locator('.research-report-body').waitFor();
      if (await page.locator('.research-report-chapter').count() !== 7) throw new Error('Missing report chapter');
      if (!(await page.locator('.research-report').innerText()).includes('待负责人审核')) throw new Error('Missing review boundary');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) throw new Error('Horizontal overflow at ${width}');
      await page.screenshot({ path: output + '/report-${width}.png', fullPage: true });
      await page.screenshot({ path: output + '/viewport-${width}.png' });
      await page.getByRole('link', { name: 'M1 · 来源', exact: true }).first().click();
      await page.getByRole('heading', { name: '来源台账', exact: true }).waitFor();
      if (!(await page.locator('.research-tablewrap').innerText()).includes('病理检查诊断价格立项精细化')) throw new Error('Source mapping failed');
      await page.getByRole('button', { name: '调研报告', exact: true }).click();
      await page.locator('.research-report-body').waitFor();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出完整报告', exact: true }).click();
      const download = await pending;
      await download.saveAs(output + '/report-${width}.md');
      await page.reload();
      await page.locator('.research-report-body').waitFor();
      await page.getByRole('button', { name: '宏观政策、医保支付与产业资本', exact: true }).click();
      await page.locator('.research-markdown').waitFor();
      if (await page.locator('[role=alert]').count()) throw new Error('Visible page error');
      return { width: ${width}, report: true, sourceNavigation: true, export: true, refresh: true, taskPreview: true, overflow: false };
    `);
  }
} finally {
  try { cli(['close']); } catch { /* Cleanup continues when browser already exited. */ }
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
  await rm(temporary, { recursive: true, force: true });
}
