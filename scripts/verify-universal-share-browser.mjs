import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5180';
const db = new PrismaClient();
const username = `qa-share-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/universal-share-check.js');
const session = `universal-share-${Date.now()}`;
let userId;
function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
  if (output.includes('### Error')) throw new Error(output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
  return output;
}
try {
  const english = await db.content.findFirstOrThrow({ where: { description: { contains: '<!-- ENGLISH_LEARNING_PROJECT -->' } }, include: { parent: true } });
  const castleId = english.parent.parentId;
  const castle = await db.content.findUniqueOrThrow({ where: { id: castleId } });
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'visitor', mustChangePassword: false,
    grants: { create: { projectId: castleId } } } });
  userId = user.id;
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const checks=[];const errors=[];const base=${JSON.stringify(base)};
    page.on('pageerror',error=>errors.push(error.message));
    await page.getByLabel('用户名',{exact:true}).fill(${JSON.stringify(username)});
    await page.getByLabel('密码',{exact:true}).fill(${JSON.stringify(password)});
    await page.getByRole('button',{name:'打开观澜',exact:true}).click();
    await page.waitForURL('**/home');
    await page.goto(base+'/home?project=${castleId}');
    await page.getByRole('button',{name:'分享项目',exact:true}).click();
    const projectInput=page.locator('.share-toolbar .page-share-control').filter({has:page.getByRole('button',{name:'分享项目',exact:true})}).getByRole('textbox');
    await projectInput.waitFor();
    const projectLink=base+new URL(await projectInput.inputValue()).pathname;
    await page.goto(base+'/home?project=${castleId}&folder=${english.id}');
    await page.getByRole('heading',{name:'英语学习及实战',exact:true}).waitFor();
    await page.getByRole('button',{name:'分享当前页面',exact:true}).click();
    const pageControl=page.locator('.share-toolbar .page-share-control').filter({has:page.getByRole('button',{name:'分享当前页面',exact:true})});
    await pageControl.getByRole('textbox').waitFor();
    const pageLink=base+new URL(await pageControl.getByRole('textbox').inputValue()).pathname;
    for(const link of [projectLink,pageLink])if(!/\\/s\\/[A-Za-z0-9_-]{16}$/.test(link))throw new Error('Long share URL');
    checks.push('project and specialized page generate short links from visible controls');
    const context=await page.context().browser().newContext();
    const reader=await context.newPage();reader.on('pageerror',error=>errors.push(error.message));
    await reader.goto(projectLink);
    if(await reader.getByLabel('用户名',{exact:true}).count())throw new Error('Normal login exposed');
    await reader.getByLabel('分享密码',{exact:true}).fill('123456');
    await reader.getByRole('button',{name:'查看页面',exact:true}).click();
    await reader.getByRole('heading',{name:${JSON.stringify(castle.title)},exact:true}).waitFor();
    await reader.locator('.shared-project-item').filter({hasText:'通识'}).click();
    await reader.locator('.shared-project-item').filter({hasText:'英语学习及实战'}).click();
    const firstDoc=reader.locator('.shared-project-item').first();await firstDoc.click();
    await reader.locator('.share-content').waitFor();
    if(!(await reader.locator('.share-content').textContent()).trim())throw new Error('Blank shared document');
    await reader.getByRole('button',{name:'返回目录',exact:true}).click();
    checks.push('anonymous password access, project folders, content rendering and return navigation');
    for(const path of ['/api/contents','/api/auth/me','/api/trip-plans?projectId=${castleId}']){
      const response=await context.request.get(base+path);if(response.status()!==401)throw new Error('Escaped sharing scope '+path);
    }
    const mutation=await context.request.post(base+'/api/share-links',{data:{kind:'project',contentId:${castleId}}});
    if(mutation.status()!==401)throw new Error('Share recipient can mutate');
    checks.push('ordinary library APIs and writes remain unauthorized');
    await reader.goto(pageLink);await reader.getByLabel('分享密码',{exact:true}).fill('123456');
    await reader.getByRole('button',{name:'查看页面',exact:true}).click();
    await reader.locator('.share-snapshot').waitFor();
    if(!await reader.locator('.share-snapshot').getByText('英语学习及实战',{exact:true}).count())throw new Error('Snapshot lost title');
    if(!await reader.locator('.share-snapshot').getByText('apple',{exact:true}).count())throw new Error('Snapshot lost current word');
    if(await reader.locator('.share-snapshot button, .share-snapshot input, .share-snapshot script').count())throw new Error('Snapshot includes editing controls');
    checks.push('specialized page snapshot preserves visible course content and strips editing actions');
    for(const width of [390,1440]){
      await reader.setViewportSize({width,height:1000});
      if(await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Snapshot overflow '+width);
      await reader.screenshot({path:'output/playwright/universal-share-page-'+width+'.png',fullPage:true});
    }
    await reader.goto(projectLink);await reader.getByLabel('分享密码',{exact:true}).fill('123456');
    await reader.getByRole('button',{name:'查看页面',exact:true}).click();await reader.locator('.shared-project').waitFor();
    for(const width of [390,1440]){
      await reader.setViewportSize({width,height:1000});
      if(await reader.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Project overflow '+width);
      await reader.screenshot({path:'output/playwright/universal-share-project-'+width+'.png',fullPage:true});
    }
    await reader.reload();await reader.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
    if(await reader.locator('.share-quote-controls').isVisible())throw new Error('Poetry controls visible');
    checks.push('mobile and desktop layouts, refresh password gate and hidden poetry controls');
    await context.close();
    if(errors.length)throw new Error('Runtime error: '+errors.join(';'));
    const result={ok:true,checks,runtimeErrors:errors.length};
    await page.evaluate(value=>sessionStorage.setItem('universal-share-result',JSON.stringify(value)),result);
    return result;
  }`, { mode: 0o600 });
  cli(['open', base]); cli(['snapshot']); cli(['run-code', '--filename', script]);
  const output = cli(['eval', 'JSON.parse(sessionStorage.getItem("universal-share-result") || "null")']);
  const result = JSON.parse(output.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/)?.[1]?.trim() || 'null');
  if (!result?.ok) throw new Error('Missing browser evidence');
  await writeFile(resolve('output/playwright/universal-share-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  try { cli(['close']); } catch { /* Keep original failure. */ }
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect(); await unlink(script).catch(() => {});
}
