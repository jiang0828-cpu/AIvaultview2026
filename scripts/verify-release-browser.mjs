import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

const fixture = JSON.parse(await readFile('output/playwright/production-fixture.json', 'utf8'));
const base = 'https://vault.trialmatch.xin';
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const codeFile = resolve('output/playwright/release-browser-check.js');
const code = `async page => {
  const fixture=${JSON.stringify(fixture)};
  const base=${JSON.stringify(base)};
  const errors=[]; const checks=[];
  await page.setViewportSize({width:1440,height:1000});
  page.on('pageerror',error=>errors.push(error.message));
  await page.request.post(base+'/api/auth/logout',{data:{},headers:{Origin:base}});
  await page.goto(base+'/login');
  await page.getByRole('textbox',{name:'用户名',exact:true}).fill(fixture.username);
  await page.getByRole('textbox',{name:'密码',exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'打开观澜',exact:true}).click();
  await page.waitForURL('**/home**');
  await page.locator('.project-card').first().waitFor();
  if(await page.locator('.project-card').count()!==fixture.projectCount)throw new Error('Project card count mismatch');
  await page.screenshot({path:'output/playwright/release-overview-desktop.png',fullPage:true});
  checks.push('project overview');
  await page.reload();
  await page.locator('.project-card').first().waitFor();
  checks.push('session persistence');
  for(const [key,heading,path] of [
    ['health','健康管理','/home?project='],
    ['compare','消费比价工作台','/compare?project='],
  ]){
    const url=base+path+fixture.projects[key];
    await page.goto(url);
    await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    if(key==='health') await page.getByRole('button',{name:'建立第一份档案',exact:true}).waitFor();
    if(key==='compare') await page.getByRole('combobox',{name:'演示场景',exact:true}).waitFor();
    await page.screenshot({path:'output/playwright/release-'+key+'-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.reload();
    await page.getByRole('heading',{name:heading,exact:true}).waitFor();
    if(key==='health') await page.getByRole('button',{name:'建立第一份档案',exact:true}).waitFor();
    if(key==='compare') await page.getByRole('combobox',{name:'演示场景',exact:true}).waitFor();
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error(key+' mobile horizontal overflow');
    await page.screenshot({path:'output/playwright/release-'+key+'-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    checks.push(key+' desktop/mobile');
  }
  await page.goto(base+'/home?project='+fixture.projects.course);
  await page.getByRole('button',{name:/^02 课程文档｜第二期/}).click();
  await page.locator('.content-body').first().waitFor();
  await page.screenshot({path:'output/playwright/release-course-desktop.png',fullPage:true});
  checks.push('second AI course');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/home');
  await page.locator('.project-card').first().waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Overview mobile horizontal overflow');
  await page.screenshot({path:'output/playwright/release-overview-mobile.png',fullPage:true});
  if(errors.length)throw new Error('Browser runtime errors: '+errors.join('; '));
  return {ok:true,checks,runtimeErrors:errors.length};
}`;
try {
  await writeFile(codeFile, code, { mode: 0o600 });
  const result = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli',
    '-s=vault-release', 'run-code', '--filename', codeFile], { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  const safe = result.split('### Ran Playwright code')[0].replaceAll(fixture.password, '[REDACTED]');
  console.log(safe.trim());
  if (result.includes('### Error')) process.exitCode = 1;
} catch (error) {
  const output = String(error.stdout || 'Browser check failed').split('### Ran Playwright code')[0];
  console.error(output.replaceAll(fixture.password, '[REDACTED]'));
  process.exitCode = 1;
} finally { await unlink(codeFile); }
