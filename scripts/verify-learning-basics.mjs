import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getConfig } from '../backend/src/config.ts';

if (!process.env.PLAYWRIGHT_CLI_JS) throw new Error('Set PLAYWRIGHT_CLI_JS to an installed Playwright CLI entry point.');
const { chromium } = createRequire(resolve(process.env.PLAYWRIGHT_CLI_JS))('playwright');
const config = getConfig();
if (config.shareHashed) throw new Error('A configured share password is required for this local verification.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
const db = new PrismaClient();
let testUserId;
await mkdir('output/playwright/learning-basics', { recursive: true });
try {
  async function login(username, password) {
    const context = await browser.newContext();
    const response = await context.request.post(config.origin + '/api/auth/login', {
      headers: { Origin: config.origin }, data: { username, password },
    });
    if (response.status() !== 200) { await context.close(); throw new Error('Configured verification login failed: ' + response.status()); }
    return context;
  }
  const visitor = await login(config.shareUsername, config.sharePassword);
  const response = await visitor.request.get(config.origin + '/api/contents');
  const items = await response.json();
  const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
  const project = flatten(items).find(row => row.isProject && row.title === '日常生活 | 学 | 德智体美用');
  if (!project) throw new Error('Learning project missing');
  const basic = project.children.find(row => row.title === '基本信息');
  const document = basic?.children.find(row => row.type === 'text' && (row.title === '基本信息与安排依据' || row.description.includes('<!-- LEARNING_BASELINE_V1 -->')));
  if (!document || project.children[0].id !== basic.id) throw new Error('Basic information is not the first section');
  const page = await visitor.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(config.origin + `/home?project=${project.id}`);
    await page.getByRole('heading', { name: project.title, exact: true }).waitFor();
    const cards = page.locator('.project-content-card');
    if (!(await cards.first().innerText()).includes('基本信息')) throw new Error('Wrong first project card');
    await cards.first().click();
    const profile = page.getByRole('region', { name: '基本信息', exact: true });
    await profile.getByRole('heading', { name: '基本信息', exact: true }).waitFor();
    if ((await profile.locator('article').innerText()).includes('LEARNING_BASELINE_V1')) throw new Error('Internal baseline marker is visible');
    if (await profile.getByRole('button', { name: '编辑基本信息' }).count()) throw new Error('Share account can edit');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Profile overflow: ' + width);
    await page.screenshot({ path: `output/playwright/learning-basics/profile-${width}.png`, fullPage: true });
    for (const title of ['通识', '专业', '运动']) {
      await profile.getByRole('navigation', { name: '依据基本信息进入板块' }).getByRole('button', { name: title, exact: true }).click();
      const reference = page.getByRole('complementary', { name: '基本信息参考' });
      await reference.getByRole('button', { name: '展开参考信息', exact: true }).click();
      await reference.locator('article').waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Reference overflow: ' + width + ' ' + title);
      if (title === '专业') await page.screenshot({ path: `output/playwright/learning-basics/professional-${width}.png`, fullPage: true });
      await reference.getByRole('button', { name: '查看基本信息', exact: true }).click();
      await profile.getByRole('heading', { name: '基本信息', exact: true }).waitFor();
    }
    await page.reload();
    await profile.getByRole('heading', { name: '基本信息', exact: true }).waitFor();
    checks.push({ width, profile: true, modules: 3, reload: true, overflow: false });
  }
  const english = flatten(project.children).find(row => row.title === '英语学习及实战');
  await page.goto(config.origin + `/home?project=${project.id}&folder=${english.id}`);
  const reference = page.getByRole('complementary', { name: '基本信息参考' });
  await reference.getByRole('button', { name: '复制安排依据', exact: true }).click();
  const fallback = reference.getByRole('textbox', { name: '安排依据', exact: true });
  await fallback.waitFor();
  const referenceText = await fallback.inputValue();
  if (!referenceText.includes(document.description.replace(/^\s*<!-- LEARNING_BASELINE_V1 -->\s*/, '')) || !referenceText.includes('通识安排依据') || referenceText.includes('LEARNING_BASELINE_V1')) throw new Error('Incorrect planning reference');
  await page.getByRole('navigation', { name: '英语学习模式' }).getByRole('button', { name: /二选一/ }).click();
  if (await page.locator('.english-options button').count() !== 2) throw new Error('English regression');
  const lesson = english.children.find(row => row.type === 'text');
  await page.goto(config.origin + `/home?id=${lesson.id}`);
  await page.getByRole('complementary', { name: '基本信息参考' }).waitFor();
  checks.push('nested English views and leaf documents reference the same baseline; HTTP clipboard fallback works');
  {
    const username = `qa-basics-${randomBytes(6).toString('hex')}`;
    const password = randomBytes(24).toString('base64url');
    const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'admin', mustChangePassword: false } });
    testUserId = user.id;
    await db.$disconnect();
    const admin = await login(username, password);
    const editorPage = await admin.newPage();
    await editorPage.setViewportSize({ width: 390, height: 900 });
    await editorPage.goto(config.origin + `/home?project=${project.id}&folder=${basic.id}`);
    await editorPage.getByRole('button', { name: '编辑基本信息', exact: true }).click();
    const editor = editorPage.getByRole('textbox', { name: '基本信息正文', exact: true });
    if (await editor.inputValue() !== document.description) throw new Error('Editor source differs from saved document');
    await editorPage.getByRole('button', { name: '预览', exact: true }).click();
    if (await editorPage.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Editor preview overflow');
    await editorPage.screenshot({ path: 'output/playwright/learning-basics/editor-390.png', fullPage: true });
    const saveResponse = editorPage.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/api/contents/${document.id}`));
    await editorPage.getByRole('button', { name: '保存基本信息', exact: true }).click();
    if ((await saveResponse).status() !== 200) throw new Error('Baseline save failed');
    await editorPage.getByRole('button', { name: '编辑基本信息', exact: true }).waitFor();
    const saved = await (await admin.request.get(config.origin + `/api/contents/${document.id}`)).json();
    if (saved.description !== document.description) throw new Error('Identity save altered baseline');
    checks.push('administrator edits, previews, saves unchanged baseline and refreshes; source text preserved');
    await admin.close();
  }
  if (errors.length) throw new Error(errors.join('; '));
  const result = { ok: true, projectId: project.id, basicFolderId: basic.id, checks };
  await writeFile('output/playwright/learning-basics/result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await visitor.close();
} finally {
  await browser.close();
  try {
    if (testUserId) {
      await db.accessLog.deleteMany({ where: { userId: testUserId } });
      await db.user.delete({ where: { id: testUserId } });
    }
  } finally { await db.$disconnect(); }
}
