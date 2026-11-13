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
const username = `qa-invest-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/investment-check.js');
const session = `invest-${Date.now()}`;
let userId;
function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
  const safe = output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
  if (output.includes('### Error')) throw new Error(safe);
  return safe.trim();
}
try {
  const deadline = Date.now() + 600000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${process.env.COMPARE_PORT || 8001}/health`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) { ready = true; break; }
    } catch { /* The local Python service may still be starting. */ }
    await new Promise(complete => setTimeout(complete, 2000));
  }
  if (!ready) throw new Error('Local Python service did not become ready.');
  const project = await db.content.findFirstOrThrow({ where: { isProject: true, scene: 'life', description: { contains: '<!-- INVESTMENT_WORKBENCH -->' } } });
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'visitor', mustChangePassword: false,
    grants: { create: { projectId: project.id } } } });
  userId = user.id;
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const base=${JSON.stringify(base)};
    const project=${project.id};
    const root=base+'/invest?project='+project;
    const checks=[];const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let stage='login';
    try {
      await page.clock.install();
      await page.goto(base+'/login');
      await page.getByRole('textbox',{name:'用户名',exact:true}).fill(${JSON.stringify(username)});
      await page.getByRole('textbox',{name:'密码',exact:true}).fill(${JSON.stringify(password)});
      await page.getByRole('button',{name:'打开观澜',exact:true}).click();
      await page.waitForURL('**/home**');
      await page.goto(root);
      await page.getByRole('heading',{name:'基础生活 | 钱 | 投资理财',exact:true}).waitFor();
      await page.getByLabel('可支配现金',{exact:true}).waitFor();
      if(await page.getByLabel('可支配现金',{exact:true}).inputValue()!=='0')throw new Error('Nonempty real account');
      stage='account';
      for(const [label,value] of Object.entries({'可支配现金':'100000','应急资金预留':'20000','一年内确定支出':'10000','第二至三年确定支出':'10000','可承担亏损金额':'20000','持有期限（月）':'60','历史回撤研究上限（%）':'30'}))await page.getByLabel(label,{exact:true}).fill(value);
      await page.getByRole('combobox',{name:'风险等级',exact:true}).selectOption('3');
      await page.getByRole('button',{name:'保存资金计划',exact:true}).click();
      await page.getByRole('status').filter({hasText:'资金计划已保存'}).waitFor();
      checks.push({accountSaved:true});
      stage='automatic polling';
      await page.getByRole('region',{name:'自动更新状态',exact:true}).waitFor();
      await page.getByRole('checkbox',{name:'自动刷新 · 60秒',exact:true}).check();
      await page.waitForLoadState('networkidle');
      await page.getByLabel('可支配现金',{exact:true}).fill('123456');
      const nextPoll=page.waitForRequest(request=>request.method()==='GET'&&request.url().includes('/api/investment/state?'));
      await page.clock.runFor(61000);
      await nextPoll;
      if(await page.getByLabel('可支配现金',{exact:true}).inputValue()!=='123456')throw new Error('Polling overwrote an unsaved account form');
      await page.getByLabel('可支配现金',{exact:true}).fill('100000');
      const stateReply=await page.request.get(base+'/api/investment/state?projectId='+project);
      const syncState=(await stateReply.json()).sync;
      if(!syncState.configured)await page.getByText('行情等待数据授权',{exact:true}).waitFor();
      checks.push({automaticPolling:true,preservesUnsavedForm:true,marketConfigured:syncState.configured});
      stage='demo';
      await page.getByRole('combobox',{name:'账户模式',exact:true}).selectOption('demo');
      await page.getByLabel('可支配现金',{exact:true}).waitFor();
      await page.getByRole('button',{name:'基金 / ETF 对比',exact:true}).click();
      await page.getByRole('checkbox',{name:'比较 DEMO01',exact:true}).check();
      await page.getByRole('checkbox',{name:'比较 DEMO02',exact:true}).check();
      await page.getByLabel('持有月数',{exact:true}).fill('12');
      await page.getByRole('button',{name:'比较已选 2 项',exact:true}).click();
      await page.getByRole('heading',{name:'同类费用与资料复核',exact:true}).waitFor();
      checks.push({samePeerComparison:true});
      stage='candidates';
      await page.getByRole('button',{name:'候选解释',exact:true}).click();
      await page.getByRole('button',{name:'检查候选与组合',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.invest-candidates article').length===3);
      await page.screenshot({path:'output/playwright/investment-candidates-desktop.png',fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:'output/playwright/investment-candidates-mobile.png',fullPage:true});
      const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      if(mobile.width!==mobile.scrollWidth)throw new Error('Mobile overflow');
      checks.push({topThree:true,mobile});
      stage='demo review';
      await page.getByRole('button',{name:'收益复盘',exact:true}).click();
      await page.getByRole('button',{name:'计算收益',exact:true}).click();
      await page.getByRole('img',{name:'账户时间加权收益曲线',exact:true}).waitFor();
      checks.push({demoReview:true});
      stage='real restored';
      await page.getByRole('combobox',{name:'账户模式',exact:true}).selectOption('real');
      await page.getByRole('button',{name:'账户总览',exact:true}).click();
      await page.getByLabel('可支配现金',{exact:true}).waitFor();
      if(await page.getByLabel('应急资金预留',{exact:true}).inputValue()!=='20000')throw new Error('Demo overwrote real');
      stage='import UI';
      await page.getByRole('button',{name:'资料与导入',exact:true}).click();
      const docs=await page.locator('.invest-docs button').count();
      if(docs!==8)throw new Error('Missing project documents');
      await page.getByRole('combobox',{name:'导入数据',exact:true}).selectOption('positions');
      const today=new Date().toLocaleDateString('en-CA');
      await page.getByLabel('可编辑导入内容',{exact:true}).fill(JSON.stringify([{code:'510000',name:'验收持仓（临时）',category:'etf',units:100,price:2,cost:180,asOf:today}]));
      await page.getByRole('button',{name:'校验并保存',exact:true}).click();
      await page.getByRole('status').filter({hasText:'已保存 1 条记录'}).waitFor();
      stage='valuation import';
      await page.getByRole('combobox',{name:'导入数据',exact:true}).selectOption('valuations');
      await page.getByLabel('可编辑导入内容',{exact:true}).fill(JSON.stringify([{date:'2025-01-01',value:10000,flow:0},{date:'2026-01-01',value:12000,flow:1000}]));
      await page.getByRole('button',{name:'校验并保存',exact:true}).click();
      await page.getByRole('status').filter({hasText:'已保存 2 条记录'}).waitFor();
      stage='product import';
      await page.getByRole('combobox',{name:'导入数据',exact:true}).selectOption('products');
      const timestamp=new Date().toISOString();
      await page.getByLabel('可编辑导入内容',{exact:true}).fill(JSON.stringify([{code:'510001',name:'验收档案（临时）',category:'etf',peer:'验收组',riskLevel:3,minMonths:60,sourceName:'验收用格式资料',sourceUrl:'https://www.sse.com.cn/',asOf:today,publishedAt:timestamp,fetchedAt:timestamp}]));
      await page.getByRole('button',{name:'校验并保存',exact:true}).click();
      await page.getByRole('status').filter({hasText:'已保存 1 条记录'}).waitFor();
      await page.getByRole('button',{name:'资料与导入',exact:true}).click();
      stage='automatic candidate gate';
      await page.getByRole('button',{name:'候选解释',exact:true}).click();
      await page.getByRole('status').filter({hasText:'今天无需操作'}).waitFor();
      checks.push({automaticCandidateGate:true});
      await page.getByRole('button',{name:'收益复盘',exact:true}).click();
      await page.getByRole('img',{name:'账户时间加权收益曲线',exact:true}).waitFor();
      const review=await page.request.get(base+'/api/investment/review?projectId='+project);
      const result=await review.json();
      if(result.profit!==1000||result.twr!==10||result.xirr!==10)throw new Error('Cash flow return incorrect');
      checks.push({uiImport:true,automaticReview:true,profit:result.profit,twr:result.twr,xirr:result.xirr});
      await page.reload();await page.getByRole('button',{name:'计算收益',exact:true}).waitFor();
      if(!page.url().includes('tab=review'))throw new Error('Tab not retained');
      stage='official channels';
      await page.getByRole('button',{name:'购买入口',exact:true}).click();
      await page.getByRole('button',{name:'复制产品代码',exact:true}).click();
      await page.getByRole('status').filter({hasText:'已复制代码 510001'}).waitFor();
      const link=page.getByRole('link',{name:'打开官方入口',exact:true}).first();
      if(await link.getAttribute('href')!=='https://www.1234567.com.cn/')throw new Error('Wrong official destination');
      const wait=page.waitForEvent('popup');await link.click();const popup=await wait;await popup.close();
      checks.push({officialPopup:true,copyCode:true,projectDocuments:docs});
      for(const width of [390,1440]){
        await page.setViewportSize({width,height:900});
        await page.getByRole('button',{name:'账户总览',exact:true}).click();
        await page.getByLabel('可支配现金',{exact:true}).waitFor();
        if(await page.getByRole('button',{name:'分享当前页面',exact:true}).count())throw new Error('Private financial page exposes snapshot sharing');
        const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
        if(size.width!==size.scrollWidth)throw new Error('Page overflow');
        await page.screenshot({path:'output/playwright/investment-'+width+'.png',fullPage:true});checks.push({viewport:size});
      }
      if(errors.length)throw new Error(errors.join(';'));
      return {ok:true,project,checks};
    }catch(error){await page.screenshot({path:'output/playwright/investment-failed.png',fullPage:true});throw new Error(stage+': '+error.message);}
  }`, { mode: 0o600 });
  cli(['open', `${base}/login`]);
  cli(['snapshot']);
  console.log(cli(['run-code', '--filename', script]));
} catch (error) {
  const output = error?.stdout || error?.message || 'Investment browser check failed';
  console.error(String(output).split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
  process.exitCode = 1;
} finally {
  try { cli(['close']); } catch { /* Browser may already be closed. */ }
  await unlink(script).catch(() => {});
  if (userId) {
    // Cleanup only needs SQLite; avoid loading the API and every adapter again.
    const cleanup = 'import os,sqlite3; u=os.environ.get("COMPARE_DATABASE_URL") or '+JSON.stringify('sqlite:///'+resolve('python/data/compare.db').replaceAll('\\','/'))+'; assert u.startswith("sqlite:///"), "Expected SQLite database"; c=sqlite3.connect(u[10:],timeout=30); c.execute("DELETE FROM investment_records WHERE user_id=?",('+userId+',)); c.commit(); c.close()';
    try { execFileSync(resolve('python/.venv/Scripts/python.exe'), ['-c', cleanup], { env: { ...process.env, PYTHONPATH: resolve('python') }, windowsHide: true, stdio: 'pipe', timeout: 180000 }); }
    catch { console.error('Investment verification records cleanup requires attention.'); process.exitCode = 1; }
    await db.accessLog.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
}
