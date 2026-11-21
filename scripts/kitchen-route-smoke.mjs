import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
// Route/lifecycle test. All voice starts are intercepted before the API/provider.
await mkdir('.local/qa', { recursive: true });
const result = { schema:'robotrace.kitchen-route-ui.v1', checks:[], interceptedStarts:0, errors:[] };
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context = await browser.newContext({baseURL:'http://127.0.0.1:5189',viewport:{width:1280,height:720},permissions:['microphone']});
await context.route('**/api/voice/start', async route => {result.interceptedStarts++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Isolated route test: provider connection intentionally intercepted.'})});});
const page = await context.newPage();page.on('pageerror',error=>result.errors.push(error.message));
try {
 await page.goto('/kitchen');
 await page.getByRole('heading',{name:'Free Kitchen Navigation Environment',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.mobile-voice [role=status]')?.textContent==='error');
 assert.equal(result.interceptedStarts,1);assert.equal(await page.locator('.mobile-command,.mobile-sandbox-task').count(),0);
 assert.equal(await page.getByRole('textbox').count(),0);
 result.checks.push({name:'Direct kitchen route opens correct heading, no text/task form, one automatic voice attempt',passed:true});
 await page.getByRole('button',{name:'Workcell',exact:true}).click();assert.equal(new URL(page.url()).pathname,'/');
 await page.goBack();await page.getByRole('heading',{name:'Free Kitchen Navigation Environment',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.mobile-voice [role=status]')?.textContent==='error');
 assert.equal(result.interceptedStarts,2);result.checks.push({name:'Browser navigation reenters kitchen and starts exactly one new connection attempt',passed:true});
 await page.goto('/kitchen?voice=off');await page.getByRole('heading',{name:'Free Kitchen Navigation Environment',exact:true}).waitFor();
 await page.waitForTimeout(500);assert.equal(result.interceptedStarts,2);assert.equal(await page.getByRole('button',{name:'Start simulation',exact:true}).isVisible(),true);
 result.checks.push({name:'Explicit QA opt-out prevents paid auto-start while keeping manual connection available',passed:true});
 await page.screenshot({path:'.local/qa/kitchen-route-voice-first.png'});assert.deepEqual(result.errors,[]);result.passed=true;
}catch(error){result.passed=false;result.failure=error.message;await page.screenshot({path:'.local/qa/kitchen-route-failure.png'}).catch(()=>{});process.exitCode=1;}
finally{await context.close();await browser.close();await writeFile('.local/qa/kitchen-route-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
