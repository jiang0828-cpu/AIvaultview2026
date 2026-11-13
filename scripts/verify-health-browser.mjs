import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';

dotenv.config();
const base = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const db = new PrismaClient();
const username = `qa-health-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/health-check.js');
const session = `health-${Date.now()}`;
let userId;

function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  const safe = output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
  if (output.includes('### Error')) throw new Error(safe);
  if (args[0] === 'eval') {
    const result = output.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/)?.[1]?.trim();
    if (!result) throw new Error(`Browser check did not return verification evidence (${(output.match(/^### .*/gm) || []).join(', ')})`);
    const evidence = JSON.parse(result);
    if (evidence.ok !== true) throw new Error('Browser verification did not pass');
    return JSON.stringify(evidence);
  }
  return safe.trim();
}

try {
  const project = await db.content.findFirstOrThrow({ where: { isProject: true, scene: 'life', description: { contains: '<!-- FAMILY_HEALTH_PROJECT -->' } } });
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'visitor', mustChangePassword: false,
    grants: { create: { projectId: project.id } } } });
  userId = user.id;
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const base=${JSON.stringify(base)};
    const project=${project.id};
    const api=base+'/api/health/workspace?projectId='+project;
    const checks=[]; const errors=[]; let stage='login';
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    const nav=name=>page.getByRole('navigation',{name:'健康管理导航'}).getByRole('button',{name,exact:true}).click();
    const snapshot=async()=>{const response=await page.request.get(api);if(!response.ok())throw new Error('Snapshot failed '+response.status());return response.json();};
    const fill=async(fields)=>{const dialog=page.getByRole('dialog');for(const [name,value] of Object.entries(fields))await dialog.getByLabel(name,{exact:true}).fill(value);};
    const save=async()=>{const waiting=page.waitForResponse(r=>r.url()===api&&r.request().method()==='PUT');await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();const response=await waiting;if(!response.ok())throw new Error('Save failed '+response.status());await page.getByRole('dialog').waitFor({state:'hidden'});};
    try {
      await page.getByRole('textbox',{name:'用户名',exact:true}).fill(${JSON.stringify(username)});
      await page.getByRole('textbox',{name:'密码',exact:true}).fill(${JSON.stringify(password)});
      await page.getByRole('button',{name:'打开观澜',exact:true}).click();await page.waitForURL('**/home**');
      await page.goto(base+'/home?project='+project);
      await page.getByRole('heading',{name:'健康管理',exact:true}).waitFor();
      await page.getByRole('button',{name:'建立第一份档案',exact:true}).waitFor();
      await page.screenshot({path:'output/playwright/health-empty-desktop.png',fullPage:true});
      stage='members';
      await page.getByRole('button',{name:'建立第一份档案',exact:true}).click();
      await fill({'姓名 / 昵称':'验收成员','出生日期':'1990-01-02','家庭关系':'本人','过敏物及具体反应':'验收用虚构信息，请勿作为医疗资料','紧急联系人及电话':'验收联系人'});
      await page.getByRole('dialog').getByRole('checkbox').check();await save();
      await nav('健康档案');
      await page.getByRole('button',{name:'新增成员档案',exact:true}).click();
      await fill({'姓名 / 昵称':'验收家人','家庭关系':'家人'});await page.getByRole('dialog').getByRole('checkbox').check();await save();
      let state=await snapshot(); if(state.data.members.length!==2)throw new Error('Member persistence');
      const member=state.data.members.find(m=>m.name==='验收成员');
      await page.getByRole('combobox',{name:'查看成员',exact:true}).selectOption(member.id);
      stage='measurements';await nav('日常记录');
      for(const value of ['60','61']){
        await page.getByRole('button',{name:'新增健康记录',exact:true}).click();
        const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'记录项目',exact:true}).selectOption('weight');
        const numeric=dialog.locator('input[type=number]').first();if(await numeric.inputValue()!=='')throw new Error('Measurement prefilled');
        await numeric.fill(value);await fill({'测量条件（如时间、姿势、餐前餐后）':'验收虚构数据，仅用于测试'});await save();
      }
      await page.getByRole('combobox',{name:'趋势项目',exact:true}).selectOption('weight');
      await page.getByRole('img',{name:'体重最近2条记录趋势',exact:true}).waitFor();
      if(await page.locator('.health-trend svg circle').count()<2)throw new Error('Trend blank');
      await page.screenshot({path:'output/playwright/health-trend-desktop.png',fullPage:true});
      stage='actions';await nav('行动计划');
      await page.getByRole('button',{name:'新增行动',exact:true}).click();
      await fill({'行动内容':'验收晚饭后散步','责任人':'本人','截止日期':today});
      await page.getByRole('dialog').getByRole('combobox',{name:'重复安排',exact:true}).selectOption('daily');
      await page.getByRole('dialog').getByRole('checkbox').check();await save();
      await page.getByTitle('编辑行动',{exact:true}).first().click();
      await page.getByRole('dialog').getByRole('combobox',{name:'行动状态',exact:true}).selectOption('done');
      await fill({'完成结果 / 凭证 / 下一步':'验收完成记录，不代表真实活动'});await save();
      state=await snapshot();if(state.data.actions.length!==2||state.data.actions.filter(a=>a.status==='done').length!==1)throw new Error('Recurrence failed');
      await page.getByRole('button',{name:'记录周回顾',exact:true}).click();await fill({'本周有什么变化？':'验收周回顾','下周最重要的事和责任人':'继续核对待办，本人'});await save();
      stage='care';await nav('就医协作');await page.getByRole('button',{name:'新增药物',exact:true}).click();
      await fill({'药物通用名 / 补充剂名称':'验收药单占位（非真实药物）','每次剂量（照医嘱）':'仅按处方原文记录，不提供剂量','下次核对日期':today});await save();
      await page.getByRole('button',{name:'新增就医事项',exact:true}).click();
      await fill({'就医 / 检查日期':today,'医生 / 医疗机构':'验收社区中心','主要问题 / 检查事项':'核对既有报告','最想问医生的问题':'是否需要复查？'});
      await page.getByRole('dialog').getByRole('combobox',{name:'就医状态',exact:true}).selectOption('waiting');await save();
      await nav('今日');
      if(await page.getByRole('region',{name:'今日待办'}).locator('article').count()!==2)throw new Error('Care reminders missing from Today');
      await nav('就医协作');
      await page.getByRole('button',{name:'就诊摘要',exact:true}).first().click();
      const summary=await page.locator('.health-print-summary').innerText();if(!summary.includes('验收药单占位')||!summary.includes('验收成员')||summary.includes('成员：验收家人'))throw new Error('Summary scope');
      const downloadWaiting=page.waitForEvent('download');await page.getByRole('button',{name:'下载文本',exact:true}).click();const download=await downloadWaiting;
      checks.push({summaryDownload:download.suggestedFilename()});
      await page.emulateMedia({media:'print'});
      if(!await page.locator('.health-print-summary').isVisible())throw new Error('Print summary hidden');
      await page.pdf({path:'output/playwright/health-summary-print.pdf',format:'A4',printBackground:true});
      await page.screenshot({path:'output/playwright/health-summary-print.png',fullPage:true});
      await page.emulateMedia({media:'screen'});
      await page.getByTitle('关闭摘要',{exact:true}).click();
      stage='guides';await nav('健康指南');const guideNav=page.getByRole('navigation',{name:'健康指南文档'});if(await guideNav.getByRole('button').count()!==9)throw new Error('Missing guides');
      await guideNav.getByRole('button').nth(2).click();await page.locator('.health-guide-document table').first().waitFor();
      if((await page.locator('.health-guide-document').innerText()).includes('FAMILY_HEALTH_DOC'))throw new Error('Internal guide marker visible');
      await page.setViewportSize({width:390,height:900});await page.screenshot({path:'output/playwright/health-guide-mobile.png',fullPage:true});
      stage='refresh';await page.reload();await page.getByRole('combobox',{name:'查看成员',exact:true}).waitFor();
      state=await snapshot();if(state.data.members.length!==2||state.data.measurements.length!==2||state.data.medications.length!==1||state.data.visits.length!==1||state.data.reviews.length!==1)throw new Error('Data lost on reload');
      checks.push({members:2,measurements:2,recurringActions:2,medications:1,visits:1,reviews:1,guides:9});
      for(const width of [390,1440]){
        await page.setViewportSize({width,height:900});const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
        if(size.scrollWidth>size.width)throw new Error('Page overflow '+width);checks.push({viewport:size});await page.screenshot({path:'output/playwright/health-today-'+width+'.png',fullPage:true});
      }
      stage='conflict';await nav('健康档案');
      const remote=structuredClone(state.data);remote.members[0].goals='另一页面已更新';
      const changed=await page.request.put(api,{data:{version:state.version,data:remote}});if(!changed.ok())throw new Error('Concurrent update failed');
      await page.getByTitle('编辑成员档案',{exact:true}).first().click();await fill({'紧急联系人及电话':'未保存的冲突草稿'});
      const conflictWait=page.waitForResponse(r=>r.url()===api&&r.request().method()==='PUT');await page.getByRole('dialog').getByRole('button',{name:'保存',exact:true}).click();
      if((await conflictWait).status()!==409)throw new Error('Missing CAS conflict');
      if(await page.getByRole('dialog').getByLabel('紧急联系人及电话',{exact:true}).inputValue()!=='未保存的冲突草稿')throw new Error('Conflict input lost');
      await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.getByText('已加载最新资料',{exact:true}).waitFor();
      stage='clear';await page.getByRole('button',{name:'清除本账号资料',exact:true}).click();await page.getByText('本账号健康资料已清除',{exact:true}).waitFor();
      state=await snapshot();if(Object.values(state.data).some(rows=>rows.length))throw new Error('Clear retained health data');
      checks.push({conflictPreserved:true,clearRemovedPrivateData:true});
      if(errors.length)throw new Error('Page errors: '+errors.join(';'));
      await page.evaluate(result=>sessionStorage.setItem('health-verification',JSON.stringify(result)),{ok:true,checks});
      return {ok:true,checks};
    } catch(error) {
      await page.evaluate(result=>sessionStorage.setItem('health-verification',JSON.stringify(result)),{ok:false,stage,message:error.message});
      await page.screenshot({path:'output/playwright/health-failed.png',fullPage:true});throw new Error(stage+' '+error.message);
    }
  }`, { mode: 0o600 });
  cli(['open', `${base}/login`]);
  cli(['run-code', '--filename', script]);
  console.log(cli(['eval', 'JSON.parse(sessionStorage.getItem("health-verification") || "null")']));
  const printPdf = await PDFDocument.load(await readFile(resolve('output/playwright/health-summary-print.pdf')));
  console.log(JSON.stringify({ printPages: printPdf.getPageCount() }));
} catch (error) {
  const output = error?.stdout || error?.message || 'Health browser verification failed';
  console.error(String(output).split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
  process.exitCode = 1;
} finally {
  try { cli(['close']); } catch { /* Browser may already be closed. */ }
  await unlink(script).catch(() => {});
  if (userId) {
    await db.accessLog.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
}
