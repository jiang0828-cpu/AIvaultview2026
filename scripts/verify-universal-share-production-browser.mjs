import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const fixture = JSON.parse(await readFile(process.env.UNIVERSAL_SHARE_FIXTURE || 'output/universal-share-production.json', 'utf8'));
for (const key of ['projectUrl', 'pageUrl']) if (!/^https:\/\/vault\.trialmatch\.xin\/s\/[A-Za-z0-9_-]{16}$/.test(fixture[key])) throw new Error('Expected exact production short links');
const session = `universal-prod-${Date.now()}`;
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/universal-production-check.js');
function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 4 * 1024 * 1024 });
  if (output.includes('### Error')) throw new Error(output.split('### Ran Playwright code')[0]);
  return output;
}
try {
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const fixture=${JSON.stringify(fixture)};const checks=[];const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    for(const kind of ['project','page']){
      if(kind==='page')await page.goto(fixture.pageUrl);
      await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
      if(await page.getByLabel('用户名',{exact:true}).count())throw new Error('Normal login mounted');
      await page.getByLabel('分享密码',{exact:true}).fill('123456');
      await page.getByRole('button',{name:'查看页面',exact:true}).click();
      const selector=kind==='project'?'.shared-project':'.share-snapshot';
      await page.locator(selector).waitFor();
      if(!await page.locator(selector).getByText(fixture.projectTitle,{exact:true}).count())throw new Error('Missing shared title');
      if(await page.locator('.sidebar').count())throw new Error('Library navigation escaped');
      for(const path of ['/api/contents','/api/auth/me','/api/trip-plans?projectId=29']){
        const response=await page.request.get('https://vault.trialmatch.xin'+path);
        if(response.status()!==401)throw new Error('Ordinary API exposed '+path);
      }
      for(const width of [320,390,1440]){
        await page.setViewportSize({width,height:950});
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Overflow '+kind+' '+width);
        await page.screenshot({path:'output/playwright/production-share-'+kind+'-'+width+'.png',fullPage:true});
      }
      if(kind==='project'){
        await page.locator('.shared-project-item').first().click();
        await page.getByRole('button',{name:'返回目录',exact:true}).waitFor();
        await page.getByRole('button',{name:'返回目录',exact:true}).click();
        await page.locator('.shared-project-item').first().waitFor();
      }else if(await page.locator('.share-snapshot button, .share-snapshot input').count())throw new Error('Writable controls in snapshot');
      checks.push(kind+' short link, anonymous password access, read-only scope and layouts at 320/390/1440');
    }
    await page.reload();await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
    if(await page.locator('.share-quote-controls').isVisible())throw new Error('Poetry controls reappeared');
    if(errors.length)throw new Error(errors.join(';'));
    const result={ok:true,checks,runtimeErrors:errors.length};
    await page.evaluate(value=>sessionStorage.setItem('universal-prod-result',JSON.stringify(value)),result);
    return result;
  }`);
  cli(['open', fixture.projectUrl]); cli(['snapshot']); cli(['run-code', '--filename', script]);
  const output = cli(['eval', 'JSON.parse(sessionStorage.getItem("universal-prod-result") || "null")']);
  const result = JSON.parse(output.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/)?.[1]?.trim() || 'null');
  if (!result?.ok) throw new Error('Missing production browser evidence');
  await writeFile(resolve('output/playwright/universal-share-production-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { try { cli(['close']); } catch { /* Keep original failure. */ } await unlink(script).catch(() => {}); }
