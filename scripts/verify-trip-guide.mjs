import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

dotenv.config();
const db = new PrismaClient();
const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5180';
const fixturePath = resolve('output/playwright/trip-guide-fixture.json');
const codePath = resolve('output/playwright/trip-guide-run.js');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
function cli(args) {
  let output;
  try { output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=trip-guide', ...args], { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 }); }
  catch { throw new Error('Browser verification failed; private arguments withheld.'); }
  const safe = output.split('### Ran Playwright code')[0];
  if (safe.includes('### Error')) throw new Error('Browser verification failed; inspect current snapshot.');
  return safe;
}
async function run(code) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  await writeFile(codePath, `async page => { const fixture = ${JSON.stringify(fixture)}; const base = ${JSON.stringify(base)}; ${code} }`, { mode: 0o600 });
  try { console.log(cli(['run-code', '--filename', codePath])); }
  finally { await unlink(codePath); }
}
try {
  if (process.argv.includes('--setup')) {
    const source = await db.tripPlan.findFirstOrThrow({ where: { title: { contains: '广德·芜湖亲子自驾' } } });
    const fixture = { username: `qa-guide-${randomBytes(5).toString('hex')}`, password: randomBytes(24).toString('base64url'), projectId: source.projectId, planId: null };
    await mkdir(dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' });
    const user = await db.user.create({ data: { username: fixture.username, passwordHash: await bcrypt.hash(fixture.password, 4), mustChangePassword: false, grants: { create: { projectId: source.projectId } } } });
    const input = Object.fromEntries(['projectId', 'title', 'destination', 'startDate', 'endDate', 'status', 'transport', 'companions', 'budget', 'actualSpent', 'itinerary', 'notes'].map(key => [key, source[key]]));
    const plan = await db.tripPlan.create({ data: { ...input, userId: user.id } });
    fixture.planId = plan.id;
    await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
    console.log('Prepared isolated guide verification account and copied trip.');
  } else if (process.argv.includes('--view')) {
    cli(['open', base + '/login']);
    cli(['snapshot']);
    await run(`
      await page.getByRole('textbox', { name: '用户名', exact: true }).fill(fixture.username);
      await page.getByRole('textbox', { name: '密码', exact: true }).fill(fixture.password);
      await page.getByRole('button', { name: '打开观澜', exact: true }).click();
      await page.waitForURL('**/home');
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.goto(base + '/home?project=' + fixture.projectId + '&view=plans&trip=' + fixture.planId);
      await page.locator('.trip-guide').waitFor();
      await page.waitForFunction(() => document.querySelector('.guide-cover img')?.naturalWidth > 0);
      if (await page.locator('.guide-day').count() !== 3) throw new Error('Missing daily itinerary');
      if (await page.locator('.guide-cost').count() !== 9) throw new Error('Missing budget entries');
      await page.screenshot({ path: 'output/playwright/trip-guide-desktop.png', fullPage: true });
      await page.locator('.trip-guide').screenshot({ path: 'output/travel/2026-11-13-guangde-wuhu-illustrated.png' });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Desktop overflow');
      return { stage: 'illustrated trip, 3 day timelines, 9 budget entries and long image', ok: true };
    `);
  } else if (process.argv.includes('--check')) {
    cli(['snapshot']);
    await run(`
      await page.goto(base + '/home?project=' + fixture.projectId + '&view=plans&trip=' + fixture.planId);
      await page.locator('.trip-guide').waitFor();
      await page.locator('.guide-event details summary').first().click();
      if (!await page.locator('.guide-event details').first().getAttribute('open').then(value => value !== null)) throw new Error('Cannot expand full details');
      await page.locator('.guide-checklist label').first().click();
      if (!await page.locator('.guide-checklist input').first().isChecked()) throw new Error('Checklist did not update');
      await page.getByText('1 / 6 项', { exact: true }).waitFor();
      await page.locator('.guide-toolbar').getByRole('button', { name: '编辑', exact: true }).click();
      const title = await page.getByRole('dialog').getByLabel('安排名称', { exact: true }).inputValue();
      if (!title.includes('广德')) throw new Error('Wrong arrangement editor');
      await page.getByRole('button', { name: '关闭编辑', exact: true }).click();
      await page.locator('.guide-toolbar').getByRole('button', { name: '我的安排', exact: true }).click();
      await page.getByRole('button', { name: '查看图文行程', exact: true }).click();
      await page.reload();
      await page.locator('.trip-guide').waitFor();
      for (const width of [390, 360, 768]) {
        await page.setViewportSize({ width, height: 844 });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Viewport overflow: ' + width);
        await page.screenshot({ path: 'output/playwright/trip-guide-' + width + '.png', fullPage: true });
      }
      await page.setViewportSize({ width: 1080, height: 1000 });
      await page.locator('.trip-guide').screenshot({ path: 'output/travel/2026-11-13-guangde-wuhu-mobile.png' });
      return { stage: 'detail expansion, checklist, edit, back, refresh and 3 viewport widths', ok: true };
    `);
  } else if (process.argv.includes('--cleanup')) {
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    await run(`await page.context().clearCookies(); await page.goto(base + '/login'); return { stage: 'browser cleanup', ok: true };`);
    await db.accessLog.deleteMany({ where: { user: { username: fixture.username } } });
    await db.user.deleteMany({ where: { username: fixture.username } });
    await unlink(fixturePath);
    console.log('Verification account, copied trip and temporary credentials removed.');
  }
} finally { await db.$disconnect(); }
