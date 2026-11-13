import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const db = new PrismaClient();
const username = `qa-compare-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/compare-v2-check.js');
const session = `compare-${Date.now()}`;
let userId;

function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  const safe = output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
  if (output.includes('### Error')) throw new Error(safe);
  return safe.trim();
}

try {
  const project = await db.content.findFirstOrThrow({ where: { isProject: true, scene: 'life', description: { contains: '<!-- PRICE_COMPARE_PROJECT -->' } } });
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'visitor', mustChangePassword: false,
    grants: { create: { projectId: project.id } } } });
  userId = user.id;
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const base=${JSON.stringify(base)};
    const project=${project.id};
    const checks=[];
    const errors=[];
    let stage='login';
    try {
    page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('textbox',{name:'用户名',exact:true}).fill(${JSON.stringify(username)});
    await page.getByRole('textbox',{name:'密码',exact:true}).fill(${JSON.stringify(password)});
    await page.getByRole('button',{name:'打开观澜',exact:true}).click();
    await page.waitForURL('**/home**');
    await page.goto(base+'/home?project='+project);
    await page.getByRole('link',{name:'开始比价',exact:true}).click();
    await page.getByRole('heading',{name:'消费比价工作台',exact:true}).waitFor();
    for(const scenario of ['food','drink','household']) {
      stage='scenario '+scenario;
      await page.getByRole('combobox',{name:'演示场景',exact:true}).selectOption(scenario);
      await page.getByRole('button',{name:'确认需求',exact:true}).click();
      await page.getByRole('button',{name:'开始比价',exact:true}).click();
      await page.getByRole('heading',{name:'严格推荐 · 3 项',exact:true}).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.compare-offer').length === 3);
      stage='restored '+scenario;
      await page.getByRole('button',{name:'确认需求',exact:true}).waitFor();
      await page.waitForFunction(expected => document.querySelector('select') && Array.from(document.querySelectorAll('select')).some(select => select.value === expected), scenario);
      const units=await page.locator('.compare-offer .compare-unit-price').allTextContents();
      if(units.some(text=>text.includes('待确认'))) throw new Error('Unknown demo unit price');
      const destinations=await page.locator('.compare-offer a').evaluateAll(links=>links.map(a=>({text:a.textContent,url:a.href,target:a.target})));
      if(destinations.some(link=>!link.text.includes('平台搜索')||link.url.includes('example.com')||link.target!=='_blank')) throw new Error('Invalid demo platform destinations');
      const top=await page.locator('.compare-offer').first().innerText();
      checks.push({scenario,unitPrices:units,top:top.slice(0,100),destinations});
    }
    await page.screenshot({path:'output/playwright/compare-v2-desktop.png',fullPage:true});
    stage='favorite';
    await page.getByRole('button',{name:'收藏',exact:true}).first().click();
    await page.getByRole('button',{name:'收藏夹',exact:true}).click();
    await page.locator('.compare-history').first().waitFor();
    checks.push({favorites:true});
    await page.getByRole('button',{name:'报价导入',exact:true}).click();
    stage='manual import';
    await page.getByRole('combobox',{name:'商品类别',exact:true}).selectOption('drink');
    const fields={ '商品标题':'验收纯牛奶', '原平台商品链接':'https://item.jd.com/123456789.html', '品牌':'验收牧场', '型号 / 产品系列':'纯牛奶', '口味 / 配方 / 浓度':'全脂', '包装数量':'12', '每包 / 瓶净含量':'250', '商品价':'48', '运费':'0', '税费':'0', '服务费':'0', '已确认优惠券':'0', '已确认补贴':'0' };
    for(const [name,value] of Object.entries(fields)) await page.getByLabel(name,{exact:true}).fill(value);
    await page.getByRole('combobox',{name:'净含量单位',exact:true}).selectOption('ml');
    await page.getByRole('button',{name:'保存报价',exact:true}).click();
    await page.locator('.compare-history').filter({hasText:'验收纯牛奶'}).waitFor();
    const response=await page.request.post(base+'/api/compare/search?projectId='+project,{data:{query:'纯牛奶',brand:'验收牧场',model:'纯牛奶',category:'drink',specs:{variant:'全脂'},packCount:12,netWeight:250,unit:'ml',condition:'new',budgetMax:100,currency:'CNY',platforms:['jd'],mode:'live'}});
    if(response.status()!==200) throw new Error('Live imported search failed');
    const saved=await response.json();
    if(saved.recommendations.length!==1||saved.recommendations[0].unitPrice!==16) throw new Error('Manual imported unit price incorrect');
    await page.goto(base+'/compare?project='+project+'&run='+saved.runId);
    await page.getByRole('heading',{name:'严格推荐 · 1 项',exact:true}).waitFor();
    const original=page.locator('.compare-offer').getByRole('link',{name:'原商品页',exact:true});
    if(await original.getAttribute('href')!=='https://item.jd.com/123456789.html') throw new Error('Original link lost');
    const created=page.waitForEvent('popup');
    await original.click(); const popup=await created; await popup.close();
    checks.push({manualImport:true,unitPrice:saved.recommendations[0].unitPrice,originalPlatformPopup:true});
    await page.reload(); await page.getByRole('heading',{name:'严格推荐 · 1 项',exact:true}).waitFor();
    if(await page.getByLabel('包装数量',{exact:true}).inputValue()!=='12') throw new Error('Saved daily form not restored');
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:900});
      const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      if(size.scrollWidth>size.width) throw new Error('Horizontal page overflow');
      checks.push({viewport:size});
      await page.screenshot({path:'output/playwright/compare-v2-'+width+'.png',fullPage:true});
    }
    if(errors.length) throw new Error('Page errors: '+errors.join(';'));
    return {ok:true,checks};
    } catch(error) {
      await page.screenshot({path:'output/playwright/compare-v2-failed.png',fullPage:true});
      const state=await page.locator('select').evaluateAll(nodes=>nodes.map(n=>({label:n.parentElement.textContent.slice(0,30),value:n.value})));
      throw new Error(stage+' '+error.message+' state='+JSON.stringify(state));
    }
  }`, { mode: 0o600 });
  cli(['open', `${base}/login`]);
  console.log(cli(['run-code', '--filename', script]));
} catch (error) {
  // CLI errors may contain the generated login script. Keep credentials out of
  // logs even on failed navigation or missing form fields.
  const output = error?.stdout || error?.message || 'Comparison browser check failed';
  console.error(String(output).split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
  process.exitCode = 1;
} finally {
  try { cli(['close']); } catch { /* Browser may already have exited. */ }
  await unlink(script).catch(() => {});
  if (userId) {
    // Remove only this verification user's private comparison snapshots.
    const cleanup = 'from sqlalchemy import delete; from price_compare.models import *; from price_compare.config import settings; f,e=make_session(settings.database_url); s=f(); uid='+userId+'; ids=list(s.scalars(select(Offer.id).where(Offer.user_id==uid))); s.execute(delete(Recommendation).where(Recommendation.offer_id.in_(ids))); [s.execute(delete(m).where(m.user_id==uid)) for m in [Favorite,Offer,ImportRecord,SearchRun]]; s.commit(); s.close(); e.dispose()';
    try { execFileSync(resolve('python/.venv/Scripts/python.exe'), ['-c', 'from sqlalchemy import select; '+cleanup],
      { env: { ...process.env, PYTHONPATH: resolve('python') }, windowsHide: true, stdio: 'pipe' }); }
    catch { console.error('Comparison verification data cleanup requires attention.'); process.exitCode = 1; }
    await db.accessLog.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
}
