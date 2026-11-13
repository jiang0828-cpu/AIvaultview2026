import { readFile } from 'node:fs/promises';
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();
const fixture = JSON.parse(await readFile('output/playwright/auth-fixtures.json', 'utf8'));
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const secrets = [fixture.admin.password, fixture.visitor.password, fixture.temporaryPassword, fixture.finalPassword];
function cli(session, args) {
  let output;
  try {
    output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 90000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    let safe = `${error.stdout || ''}\n${error.stderr || ''}`.split('### Ran Playwright code')[0];
    for (const secret of secrets) safe = safe.replaceAll(secret, '[REDACTED]');
    throw new Error(safe || 'Browser command failed; private command arguments withheld.');
  }
  if (output.includes('### Error')) {
    let safe = output.split('### Ran Playwright code')[0];
    for (const secret of secrets) safe = safe.replaceAll(secret, '[REDACTED]');
    throw new Error(safe);
  }
  return output.split('### Ran Playwright code')[0];
}
function run(session, code) {
  const filename = resolve('output/playwright/auth-run-code.js');
  writeFileSync(filename, `async page => { const fixture = ${JSON.stringify(fixture)}; const base = ${JSON.stringify(base)}; ${code} }`, { mode: 0o600 });
  try {
    const output = cli(session, ['run-code', '--filename', filename]);
    if (output.includes('### Result')) console.log(output.trim());
  } finally { unlinkSync(filename); }
}
const login = (account, password) => `
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill(${account});
  await page.getByRole('textbox', { name: '密码', exact: true }).fill(${password});
  await page.getByRole('button', { name: /^打开/ }).click();
`;

try {
  if (process.argv.includes('--formats')) {
    cli('vault-reader', ['snapshot']);
    run('vault-reader', `
      const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
      const rows = flatten(await (await page.request.get(base + '/api/contents')).json());
      const project = rows.find(row => row.id === fixture.project.id);
      const docs = flatten(project.children || []);
      for (const type of ['mindmap', 'text', 'ppt', 'longimage', 'video']) {
        const doc = docs.find(row => row.type === type);
        if (!doc) throw new Error('Missing course format: ' + type);
        await page.goto(base + '/home?id=' + doc.id);
        await page.locator('.detail .content-body').waitFor();
        if (type === 'mindmap') await page.locator('.mindmap-viewer').waitFor();
        if (type === 'text') await page.locator('.article-body').first().waitFor();
        if (type === 'ppt') {
          await page.waitForFunction(() => document.querySelector('.slide-stage img')?.naturalWidth > 0);
          await page.getByRole('button', { name: '下一页', exact: true }).click();
          await page.getByRole('img', { name: '第 2 页幻灯片', exact: true }).waitFor();
        }
        if (type === 'longimage') await page.waitForFunction(() => document.querySelector('.long-image-viewer img')?.naturalWidth > 0);
        if (type === 'video') {
          await page.locator('video').evaluate(async video => { video.muted = true; await video.play(); });
          await page.waitForFunction(() => { const video = document.querySelector('video'); return video && video.currentTime > 0.1 && video.videoWidth > 0; });
          await page.locator('video').evaluate(video => video.pause());
        }
        if (await page.getByRole('alert').count()) throw new Error('Course view error: ' + type);
        await page.screenshot({ path: 'output/playwright/course-' + type + '.png', fullPage: true });
      }
      return { stage: 'five course formats, slide navigation, local images and video playback', ok: true };
    `);
    cli('vault-auth', ['snapshot']);
    run('vault-auth', `
      const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
      const rows = flatten(await (await page.request.get(base + '/api/contents')).json());
      const pdf = rows.find(row => row.type === 'pdf');
      if (!pdf) throw new Error('Missing PDF fixture');
      await page.goto(base + '/home?id=' + pdf.id);
      await page.locator('iframe.pdf-frame').waitFor();
      const response = await page.request.get(base + (pdf.pdfUrl || pdf.fileUrl));
      if (response.status() !== 200) throw new Error('PDF media access failed');
      await page.screenshot({ path: 'output/playwright/pdf-desktop.png', fullPage: true });
      return { stage: 'existing PDF view', ok: true };
    `);
  } else if (process.argv.includes('--media')) {
    cli('vault-auth', ['snapshot']);
    run('vault-auth', `
      const users = await (await page.request.get(base + '/api/admin/users')).json();
      const user = users.find(user => user.username === fixture.visitor.username);
      const result = await page.request.put(base + '/api/admin/users/' + user.id + '/projects', {
        data: { projectIds: [fixture.project.id, fixture.privateProject.id] }
      });
      if (result.status() !== 200) throw new Error('Fixture permission update failed');
      return { stage: 'research project grant', ok: true };
    `);
    cli('vault-reader', ['snapshot']);
    run('vault-reader', `
      await page.setViewportSize({ width: 1440, height: 1000 });
      ${login('fixture.visitor.username', 'fixture.visitor.password')}
      await page.waitForURL('**/home');
      await page.goto(base + '/home?project=' + fixture.privateProject.id);
      const response = await page.request.get(base + '/media/projects/mrna/research-data.json');
      if (response.status() !== 200) throw new Error('Granted research JSON not readable');
      await page.getByRole('heading', { name: /mRNA/ }).first().waitFor();
      const result = await page.request.get(base + '/media/projects/mrna/' + encodeURIComponent('02_mRNA肿瘤药物主台账.xlsx'));
      if (result.status() !== 200) throw new Error('Granted workbook not readable');
      await page.goto(base + '/home?project=' + fixture.project.id);
      return { stage: 'visitor research JSON and workbook download', ok: true };
    `);
    console.log(cli('vault-reader', ['snapshot']));
  } else {
  cli('vault-auth', ['open', `${base}/login`]);
  cli('vault-auth', ['snapshot']);
  run('vault-auth', `
    await page.context().clearCookies();
    await page.goto(base + '/login');
    await page.setViewportSize({ width: 1440, height: 1000 });
    ${login('fixture.admin.username', 'fixture.admin.password')}
    await page.waitForURL('**/home');
    await page.getByRole('link', { name: '用户与授权' }).click();
    await page.getByRole('heading', { name: '用户与授权', exact: true }).waitFor();
    await page.screenshot({ path: 'output/playwright/accounts-desktop.png', fullPage: true });
    return { stage: 'administrator login and user management', ok: true };
  `);
  cli('vault-auth', ['snapshot']);
  run('vault-auth', `
    const editor = page.locator('.account-editor');
    await editor.getByLabel('用户名', { exact: true }).fill(fixture.newUsername);
    await editor.getByLabel('临时密码', { exact: true }).fill(fixture.temporaryPassword);
    await editor.getByRole('button', { name: '创建账号', exact: true }).click();
    await page.getByRole('heading', { name: fixture.newUsername, exact: true }).waitFor();
    await page.getByRole('checkbox', { name: fixture.project.title, exact: true }).check();
    await page.getByRole('button', { name: '保存项目授权', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '项目授权已保存' }).waitFor();
    await page.getByLabel('新临时密码', { exact: true }).fill(fixture.temporaryPassword);
    await page.getByRole('button', { name: '重置密码', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '临时密码已重置' }).waitFor();
    await page.screenshot({ path: 'output/playwright/project-grants-desktop.png', fullPage: true });
    return { stage: 'create account, assign project, reset password', ok: true };
  `);
  cli('vault-reader', ['open', `${base}/login`]);
  cli('vault-reader', ['snapshot']);
  run('vault-reader', `
    ${login('fixture.newUsername', 'fixture.temporaryPassword')}
    await page.getByRole('heading', { name: '首次登录 · 设置新密码', exact: true }).waitFor();
    await page.getByLabel('原密码', { exact: true }).fill(fixture.temporaryPassword);
    await page.getByLabel('新密码', { exact: true }).fill(fixture.finalPassword);
    await page.getByLabel('确认新密码', { exact: true }).fill(fixture.finalPassword);
    await page.getByRole('button', { name: '保存并重新登录', exact: true }).click();
    await page.getByRole('textbox', { name: '用户名', exact: true }).waitFor();
    ${login('fixture.newUsername', 'fixture.finalPassword')}
    await page.waitForURL('**/home');
    await page.getByRole('link', { name: '用户与授权' }).waitFor({ state: 'hidden' });
    await page.reload();
    await page.locator('.sidebar-bottom strong').filter({ hasText: fixture.newUsername }).waitFor();
    const tree = await (await page.request.get(base + '/api/contents')).json();
    const flatten = rows => rows.flatMap(row => [row, ...flatten(row.children || [])]);
    const visible = flatten(tree).filter(row => row.isProject);
    if (visible.length !== 1 || visible[0].id !== fixture.project.id) throw new Error('Unexpected project visibility');
    await page.goto(base + '/home?project=' + fixture.privateProject.id);
    await page.getByRole('heading', { name: '项目不存在或暂未授权' }).waitFor();
    if ((await page.request.get(base + '/media/projects/mrna/research-data.json')).status() !== 404) throw new Error('Media authorization failed');
    await page.goto(base + '/home?project=' + fixture.project.id);
    await page.locator('.main-content').getByText(/AI 使用技能/).first().waitFor();
    await page.screenshot({ path: 'output/playwright/visitor-ai-desktop.png', fullPage: true });
    return { stage: 'first password change, refresh persistence and project isolation', ok: true };
  `);
  cli('vault-reader', ['snapshot']);
  run('vault-reader', `
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/visitor-ai-mobile.png', fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error('Mobile page overflow');
    await page.getByRole('button', { name: '打开导航', exact: true }).click();
    await page.getByRole('link', { name: '修改密码', exact: true }).click();
    await page.getByRole('heading', { name: '修改密码', exact: true }).waitFor();
    await page.screenshot({ path: 'output/playwright/password-mobile.png', fullPage: true });
    return { stage: 'mobile project and password views', overflow, ok: true };
  `);
  cli('vault-auth', ['snapshot']);
  run('vault-auth', `
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/accounts-mobile.png', fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile account page overflow');
    await page.getByRole('checkbox', { name: '启用账号', exact: true }).uncheck();
    await page.getByRole('button', { name: '保存账号', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '账号已保存' }).waitFor();
    return { stage: 'mobile user management and account disable', ok: true };
  `);
  run('vault-reader', `
    await page.reload();
    await page.waitForURL('**/login');
    return { stage: 'disabled account session revoked', ok: true };
  `);
  run('vault-auth', `
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/home?project=' + fixture.privateProject.id);
    const response = await page.request.get(base + '/media/projects/mrna/research-data.json');
    if (response.status() !== 200) throw new Error('Research data failed to load');
    await page.locator('.mrna-space, .mrna-research-space, .mrna-shell').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'output/playwright/mrna-authorized-desktop.png', fullPage: true });
    const errors = await page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map(node => node.textContent));
    if (errors.length) throw new Error('Research view displayed an error');
    return { stage: 'existing research view regression', ok: true };
  `);
  }
} catch (error) {
  let safe = error.message;
  for (const secret of secrets) safe = safe.replaceAll(secret, '[REDACTED]');
  console.error(safe); process.exitCode = 1;
}
