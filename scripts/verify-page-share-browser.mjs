import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const url = process.env.PAGE_SHARE_URL;
if (!url || !/^https?:\/\/[^/]+\/(?:share|s)\//.test(url)) throw new Error('Set PAGE_SHARE_URL to the exact share link.');
const password = process.env.PAGE_SHARE_PASSWORD || '123456';
const expectedQuotes = process.env.EXPECTED_SHARE_QUOTES_FILE ? JSON.parse(await readFile(process.env.EXPECTED_SHARE_QUOTES_FILE, 'utf8')) : [];
const base = new URL(url).origin;
const npx = resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const script = resolve('output/playwright/page-share-check.js');
const session = `page-share-${Date.now()}`;
function cli(args) {
  const output = execFileSync(process.execPath, [npx, '--yes', '--package', '@playwright/cli', 'playwright-cli', `-s=${session}`, ...args],
    { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
  if (output.includes('### Error')) throw new Error(output.split('### Ran Playwright code')[0].replaceAll(password, '[REDACTED]'));
  return output;
}
try {
  await mkdir(resolve('output/playwright'), { recursive: true });
  await writeFile(script, `async page => {
    const checks=[];const errors=[];const requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(new URL(request.url()).pathname));
    await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
    if (${JSON.stringify(expectedQuotes)}.length) {
      const catalogue=${JSON.stringify(expectedQuotes)};
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now()+1000));
      await page.reload();
      await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
      await page.setViewportSize({width:320,height:900});
      const inputTop=(await page.getByLabel('分享密码',{exact:true}).boundingBox()).y;
      for(let index=0;index<catalogue.length;index++) {
        await page.locator('.share-quote-text').filter({hasText:catalogue[index].text}).waitFor();
        if(await page.locator('.share-quote cite').textContent()!==catalogue[index].source)throw new Error('Quote attribution mismatch '+index);
        if(await page.locator('.share-quote-text').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);return range.getClientRects().length>1;}))throw new Error('Quote wraps '+index);
        if(Math.abs((await page.getByLabel('分享密码',{exact:true}).boundingBox()).y-inputTop)>1)throw new Error('Quote shifted password input '+index);
        await page.clock.runFor(4500);
      }
      await page.locator('.share-quote-text').filter({hasText:catalogue[0].text}).waitFor();
      await page.clock.resume();
      checks.push({quoteCount:catalogue.length,completeCycle:true,attributionsMatch:true,singleLineAt320:true});
    }
    if (${process.env.CHECK_SHARE_QUOTES === '1'}) {
      const first=await page.locator('.share-quote-text').textContent();
      await page.waitForFunction(text=>document.querySelector('.share-quote-text')?.textContent!==text,first,{timeout:8000});
      if(await page.locator('.share-quote-controls').isVisible())throw new Error('Poetry controls should be hidden');
      for(const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:900});
        const quote=await page.locator('.share-quote-text').textContent();
        if(!quote||[...quote].length>14)throw new Error('Poetry must contain at most 14 characters');
        if(await page.locator('.share-quote-text').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);return range.getClientRects().length>1;}))throw new Error('Poetry must remain on one line');
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Poetry overflow at '+width);
        await page.screenshot({path:'output/playwright/share-quotes-'+width+'.png',fullPage:true,animations:'disabled'});
      }
      checks.push('poetry auto rotation, hidden controls and single-line layout at 320/390/768/1440');
    }
    if(await page.getByLabel('用户名',{exact:true}).count())throw new Error('Share requires a username');
    await page.getByLabel('分享密码',{exact:true}).fill('wrong-password');
    await page.getByRole('button',{name:'查看页面',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'分享密码不正确'}).waitFor();
    if(await page.locator('.trip-guide').count())throw new Error('Private trip rendered before correct password');
    checks.push('password-only gate and wrong-password rejection');
    await page.getByLabel('分享密码',{exact:true}).fill(' '+${JSON.stringify(password)}+' ');
    await page.getByRole('button',{name:'显示密码',exact:true}).click();
    if(await page.getByLabel('分享密码',{exact:true}).getAttribute('type')!=='text')throw new Error('Password visibility control failed');
    await page.getByRole('button',{name:'查看页面',exact:true}).click();
    await page.locator('#trip-guide-title').waitFor();
    if(await page.locator('.sidebar,.app-shell').count())throw new Error('Library navigation leaked');
    if(await page.getByRole('button',{name:'编辑',exact:true}).count())throw new Error('Edit button leaked');
    if(await page.getByRole('button',{name:'我的安排',exact:true}).count())throw new Error('Other trips navigation leaked');
    for(const path of ['/api/auth/me','/api/contents','/api/trip-plans?projectId=29']) {
      const response=await page.request.get(${JSON.stringify(base)}+path);
      if(response.status()!==401)throw new Error('Share unlocked library API '+path);
    }
    await page.waitForFunction(()=>{
      const images=[...document.querySelectorAll('.trip-guide img')];
      return images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0);
    },null,{timeout:30000});
    const images=await page.locator('.trip-guide img').evaluateAll(images=>images.map(image=>({loaded:image.complete&&image.naturalWidth>0})));
    if(!images.length||images.some(image=>!image.loaded))throw new Error('Trip artwork missing');
    checks.push('one read-only trip, bitmap artwork and library API isolation');
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Horizontal overflow '+width);
      await page.screenshot({path:'output/playwright/page-share-'+width+'.png',fullPage:true});
      checks.push({width,overflow:false});
    }
    if(requests.includes('/api/contents'))throw new Error('Share page fetched the library tree');
    await page.reload();await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
    checks.push('refresh returns to password gate');
    await page.getByLabel('分享密码',{exact:true}).evaluate((input,value)=>{input.value=value;},${JSON.stringify(password)});
    await page.getByRole('button',{name:'查看页面',exact:true}).click();
    await page.locator('#trip-guide-title').waitFor();
    checks.push('native autofill without a React change event reads the actual password');
    await page.reload();await page.getByRole('heading',{name:'打开分享页面',exact:true}).waitFor();
    await page.route('**/api/share-links/verify',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{message:'尝试次数过多，请稍后再试',retryAfter:30}})}));
    await page.getByLabel('分享密码',{exact:true}).fill(${JSON.stringify(password)});
    await page.getByRole('button',{name:'查看页面',exact:true}).click();
    await page.getByRole('status').filter({hasText:'秒后重试'}).waitFor();
    if(!await page.getByRole('button',{name:'查看页面',exact:true}).isDisabled())throw new Error('Retry countdown did not disable submission');
    checks.push('rate-limit countdown prevents repeated blocked submissions');
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Password gate overflows on mobile');
    await page.screenshot({path:'output/playwright/page-share-password-390.png',fullPage:true});
    if(errors.length)throw new Error('Runtime error: '+errors.join(';'));
    const evidence={ok:true,checks,runtimeErrors:errors.length};
    await page.evaluate(value=>sessionStorage.setItem('page-share-verification',JSON.stringify(value)),evidence);
    return evidence;
  }`, { mode: 0o600 });
  cli(['open', url]);
  cli(['snapshot']);
  cli(['run-code', '--filename', script]);
  const output = cli(['eval', 'JSON.parse(sessionStorage.getItem("page-share-verification") || "null")']);
  const evidence = JSON.parse(output.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/)?.[1]?.trim() || 'null');
  if (!evidence?.ok) throw new Error('Share browser evidence missing');
  await writeFile(resolve('output/playwright/page-share-result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} finally {
  try { cli(['close']); } catch { /* Preserve the original failure when browser creation failed. */ }
  await unlink(script).catch(() => {});
}
