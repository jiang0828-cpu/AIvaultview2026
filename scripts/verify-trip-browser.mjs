import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

dotenv.config();
const db = new PrismaClient();
const fixturePath = resolve("output/playwright/trip-fixture.json");
const codePath = resolve("output/playwright/trip-run.js");
const npx = resolve(
  dirname(process.execPath),
  "node_modules/npm/bin/npx-cli.js",
);
const base = process.env.FRONTEND_ORIGIN || "http://localhost:5174";
function cli(args) {
  let result;
  try {
    result = execFileSync(
      process.execPath,
      [
        npx,
        "--yes",
        "--package",
        "@playwright/cli",
        "playwright-cli",
        "-s=trips",
        ...args,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 90000 },
    );
  } catch {
    throw new Error("Browser command failed; private arguments withheld.");
  }
  const safe = result.split("### Ran Playwright code")[0];
  if (safe.includes("### Error"))
    throw new Error("Browser check failed; inspect the latest snapshot.");
  return safe;
}
async function run(code) {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  await writeFile(
    codePath,
    `async page => { const fixture = ${JSON.stringify(fixture)}; const base = ${JSON.stringify(base)}; ${code} }`,
    { mode: 0o600 },
  );
  try {
    console.log(cli(["run-code", "--filename", codePath]));
  } finally {
    await unlink(codePath);
  }
}
try {
  if (process.argv.includes("--open")) {
    const project = await db.content.findFirstOrThrow({
      where: { isProject: true, title: { contains: "南京周边游" } },
    });
    const fixture = {
      username: `qa-trip-${randomBytes(5).toString("hex")}`,
      password: randomBytes(24).toString("base64url"),
      projectId: project.id,
    };
    await mkdir(dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, JSON.stringify(fixture), {
      mode: 0o600,
      flag: "wx",
    });
    await db.user.create({
      data: {
        username: fixture.username,
        passwordHash: await bcrypt.hash(fixture.password, 4),
        mustChangePassword: false,
        grants: { create: { projectId: project.id } },
      },
    });
  }
  if (process.argv.includes("--open") || process.argv.includes("--login")) {
    await run(`
      await page.context().clearCookies(); await page.goto(base + '/login');
      await page.getByRole('textbox', { name: '用户名', exact: true }).fill(fixture.username);
      await page.getByRole('textbox', { name: '密码', exact: true }).fill(fixture.password);
      await page.getByRole('button', { name: '打开观澜', exact: true }).click();
      await page.waitForURL('**/home');
      await page.goto(base + '/home?project=' + fixture.projectId);
      await page.getByRole('button', { name: '我的安排', exact: true }).click();
      await page.getByRole('heading', { name: '下一程，想去哪里？' }).waitFor();
      await page.getByRole('button', { name: '新增安排', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      return { stage: 'project tab and empty arrangement editor', ok: true };
    `);
  } else if (process.argv.includes("--save")) {
    await run(`
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('安排名称', { exact: true }).fill('浏览器验证·扬州两日行');
      await dialog.getByLabel('目的地', { exact: true }).fill('扬州 · 瘦西湖');
      await dialog.getByLabel('出发日期', { exact: true }).fill('2026-11-14');
      await dialog.getByLabel('结束日期', { exact: true }).fill('2026-11-15');
      await dialog.getByLabel('交通方式', { exact: true }).fill('高铁与公交');
      await dialog.getByLabel('同行人', { exact: true }).fill('家人');
      await dialog.getByLabel('计划预算（元）', { exact: true }).fill('1234.56');
      await dialog.getByRole('button', { name: '添加行程', exact: true }).click();
      await dialog.getByLabel('行程日期', { exact: true }).fill('2026-11-14');
      await dialog.getByLabel('行程标题', { exact: true }).fill('瘦西湖与老城');
      await dialog.getByLabel('具体安排', { exact: true }).fill('上午入园，下午漫步东关街。');
      await dialog.getByLabel('出行内容与旅后记录', { exact: true }).fill('带雨具，提前确认预约。');
      await dialog.getByRole('button', { name: '保存安排', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '安排已保存' }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: '浏览器验证·扬州两日行', exact: true }).waitFor();
      await page.getByText('¥1,234.56', { exact: true }).waitFor();
      await page.locator('.trip-plan-record summary').click();
      await page.getByText('上午入园，下午漫步东关街。', { exact: true }).waitFor();
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Desktop overflow');
      await page.screenshot({ path: 'output/playwright/trips-desktop.png', fullPage: true });
      return { stage: 'create, reload persistence, exact budget, full itinerary', ok: true };
    `);
  } else if (process.argv.includes("--mobile")) {
    await run(`
      await page.setViewportSize({ width: 390, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile overflow');
      await page.screenshot({ path: 'output/playwright/trips-mobile.png', fullPage: true });
      await page.getByRole('button', { name: '编辑浏览器验证·扬州两日行', exact: true }).click();
      await page.getByRole('dialog').getByRole('combobox', { name: /^状态/ }).selectOption('completed');
      await page.getByRole('dialog').getByLabel('实际花费（元）', { exact: true }).fill('1199.99');
      await page.screenshot({ path: 'output/playwright/trips-mobile-editor.png', fullPage: true });
      if (await page.getByRole('dialog').evaluate(node => node.scrollWidth > node.clientWidth)) throw new Error('Editor overflow');
      await page.getByRole('button', { name: '保存安排', exact: true }).click();
      await page.getByText('¥1,199.99', { exact: true }).waitFor();
      await page.reload();
      await page.getByText('¥1,199.99', { exact: true }).waitFor();
      await page.getByRole('button', { name: '删除浏览器验证·扬州两日行', exact: true }).click();
      await page.getByRole('button', { name: '确认删除', exact: true }).click();
      await page.getByRole('heading', { name: '下一程，想去哪里？' }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: '下一程，想去哪里？' }).waitFor();
      return { stage: '390px layout, update, reload and confirmed deletion', ok: true };
    `);
  } else if (process.argv.includes("--navigation")) {
    await run(`
      await page.setViewportSize({ width: 360, height: 740 });
      await page.getByRole('button', { name: '旅行说明', exact: true }).click();
      await page.waitForURL('**/home?id=*');
      await page.locator('.detail').waitFor();
      if (await page.locator('nav[aria-label="周边游项目切换"]').count() !== 1) throw new Error('Duplicate project navigation');
      await page.getByRole('button', { name: '我的安排', exact: true }).click();
      await page.getByRole('heading', { name: '我的安排', exact: true }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('360px overflow');
      await page.getByRole('button', { name: '新增安排', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      return { stage: 'document-to-plans navigation, 360px layout and modal keyboard close', ok: true };
    `);
  } else if (process.argv.includes("--cleanup")) {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    await run(`await page.context().clearCookies(); await page.goto(base + '/login'); return { stage: 'browser cleanup', ok: true };`);
    await db.accessLog.deleteMany({ where: { user: { username: fixture.username } } });
    await db.user.deleteMany({ where: { username: fixture.username } });
    await unlink(fixturePath);
    console.log(
      "Trip browser verification account and personal records removed.",
    );
  }
} finally {
  await db.$disconnect();
}
