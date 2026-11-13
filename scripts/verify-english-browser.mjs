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
const username = `qa-english-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('base64url');
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/english-check.js');
const session = `english-${Date.now()}`;
let userId;
function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  const safe = output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]');
  if (output.includes('### Error')) throw new Error(safe);
  if (args[0] === 'eval') {
    const result = output.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/)?.[1]?.trim();
    const evidence = JSON.parse(result || 'null');
    if (evidence?.ok !== true) throw new Error('English browser verification did not pass');
    return evidence;
  }
  return safe;
}
try {
  const english = await db.content.findFirstOrThrow({ where: { description: { contains: '<!-- ENGLISH_LEARNING_PROJECT -->' } }, include: { parent: true } });
  const castleId = english.parent.parentId;
  const user = await db.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'visitor', mustChangePassword: false,
    grants: { create: { projectId: castleId } } } });
  userId = user.id;
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const checks=[]; const errors=[]; let stage='login';
    page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.getByLabel('用户名',{exact:true}).fill(${JSON.stringify(username)});
      await page.getByLabel('密码',{exact:true}).fill(${JSON.stringify(password)});
      await page.getByRole('button',{name:'打开观澜',exact:true}).click();
      await page.waitForURL('**/home');
      await page.goto(${JSON.stringify(base + '/home?project=' + castleId + '&folder=' + english.parentId)});
      await page.locator('.project-content-card').filter({has:page.getByText('英语学习及实战',{exact:true})}).click();
      const space=page.getByRole('region',{name:'英语学习及实战',exact:true});
      const mode=name=>space.getByRole('navigation',{name:'英语学习模式'}).getByRole('button',{name:new RegExp(name)}).click();
      stage='alphabet'; await space.getByRole('heading',{name:'英语学习及实战',exact:true}).waitFor();
      if(await space.locator('.english-alphabet button').count()!==26)throw new Error('Missing alphabet');
      await space.locator('.english-alphabet button').last().click();
      await space.getByRole('heading',{name:'zebra'}).waitFor();
      // Stub speech only to verify the requested utterance, not the device voice quality.
      await page.evaluate(()=>{window.__englishSpoken=[];speechSynthesis.speak=utterance=>window.__englishSpoken.push(utterance.text);});
      await space.getByRole('button',{name:'听单词',exact:true}).click();
      if((await page.evaluate(()=>window.__englishSpoken.at(-1)))!=='zebra')throw new Error('Wrong speech text');
      checks.push('26 letters and explicit speech action');
      stage='scene'; await mode('场景词');
      await space.getByRole('button',{name:'颜色',exact:true}).click();
      await space.getByRole('heading',{name:'red'}).waitFor();
      if(await space.locator('.english-swatch').count()!==1)throw new Error('Missing color');
      stage='quiz';await mode('二选一');
      const options=space.locator('.english-options button');
      if(await options.count()!==2)throw new Error('Wrong choice count');
      await options.filter({hasText:/^red$/}).click();
      await space.getByText('答对了！再听一遍，大声说出来。',{exact:true}).waitFor();
      await space.getByRole('button',{name:'下一题',exact:true}).click();
      await options.filter({hasText:/^blue$/}).click();
      checks.push('five scenes, two-choice answers and saved progress');
      stage='dialogue'; await mode('小对话');
      await space.getByRole('button',{name:'点心时间',exact:true}).click();
      await space.getByText('Apple, please.',{exact:true}).waitFor();
      await space.getByRole('button',{name:'换你说下一句'}).click();
      stage='documents';await mode('课程文档');
      const docs=space.getByRole('navigation',{name:'英语课程文档'}).getByRole('button');
      if(await docs.count()!==6)throw new Error('Missing lessons');
      await docs.last().click();
      await space.locator('.english-document').getByRole('heading',{name:'英语学习记录',exact:true}).waitFor();
      await page.reload();
      await space.locator('.english-document').getByRole('heading',{name:'英语学习记录',exact:true}).waitFor();
      if(await space.locator('.english-achievement strong').textContent()!=='2')throw new Error('Lost practice progress');
      checks.push('four dialogues, six editable lessons and refresh state');
      for(const width of [1440,390]) {
        await page.setViewportSize({width,height:900});
        for(const name of ['字母卡','场景词','二选一','小对话','课程文档']) {
          await mode(name);
          const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
          if(dimensions.scroll>dimensions.width)throw new Error('Overflow '+width+' '+name);
          await page.screenshot({path:'output/playwright/english-'+width+'-'+['字母卡','场景词','二选一','小对话','课程文档'].indexOf(name)+'.png',fullPage:true});
        }
        checks.push({viewport:width,modes:5,overflow:false});
      }
      stage='navigation';await space.getByRole('button',{name:'返回通识',exact:true}).click();
      await page.getByRole('heading',{name:'通识',exact:true}).waitFor();
      await page.goBack();await space.getByRole('heading',{name:'英语学习及实战',exact:true}).waitFor();
      await space.getByRole('button',{name:'爱的城堡',exact:true}).click();
      await page.getByRole('heading',{name:'爱的城堡',exact:true}).waitFor();
      checks.push('section navigation, browser back and castle return');
      if(errors.length)throw new Error(errors.join(';'));
      await page.evaluate(result=>sessionStorage.setItem('english-verification',JSON.stringify(result)),{ok:true,checks});
      return {ok:true,checks};
    } catch(error) {
      await page.screenshot({path:'output/playwright/english-failed.png',fullPage:true});
      throw new Error(stage+': '+error.message);
    }
  }`, { mode: 0o600 });
  cli(['open', base + '/login']);
  cli(['snapshot']);
  cli(['run-code', '--filename', script]);
  const evidence = cli(['eval', 'JSON.parse(sessionStorage.getItem("english-verification") || "null")']);
  await writeFile(resolve('output/playwright/english-result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(String(error?.stdout || error?.message || 'English browser verification failed').split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
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
