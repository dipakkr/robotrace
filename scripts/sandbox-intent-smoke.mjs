import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const directory=resolve('.local/qa');await mkdir(directory,{recursive:true});
const results={schema:'teachtrace.sandbox-intent-smoke.v1',startedAt:new Date().toISOString(),scope:'Exactly one real LLM interpretation through the actual browser; actual controller execution and native exports. No voice provider sessions or mocked model responses.',checks:[],errors:[],interpretRequests:0,blockedOtherPosts:[],exports:[]};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({baseURL:'http://127.0.0.1:5189',viewport:{width:1440,height:900},acceptDownloads:true});
await context.route('**/api/**',async route=>{
 const request=route.request();if(request.method()!=='POST')return route.continue();
 if(new URL(request.url()).pathname==='/api/mobile/interpret'&&results.interpretRequests===0){results.interpretRequests++;return route.continue();}
 results.blockedOtherPosts.push(new URL(request.url()).pathname);return route.abort('blockedbyclient');
});
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>results.errors.push(error.message));
const app=()=>page.locator('.mobile-workspace');
async function exportAttempt(index){
 const pending=page.waitForEvent('download');await app().getByLabel('Recent sandbox recordings',{exact:true}).getByRole('button',{name:'Export task',exact:true}).nth(index).click();
 const download=await pending,path=resolve(directory,`sandbox-intent-task-${index}.json`);await download.saveAs(path);results.exports.push(path);
 const evidence=JSON.parse(await readFile(path,'utf8'));assert.equal(createHash('sha256').update(JSON.stringify(evidence.payload)).digest('hex'),evidence.integrity.digest);return evidence;
}
async function check(name,run){const detail=await run();results.checks.push({name,passed:true,detail});console.log(`PASS ${name} ${JSON.stringify(detail)}`);}
try{
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Mobile kitchen',exact:true}).click();await app().getByRole('combobox',{name:'Mobile simulation speed',exact:true}).selectOption('2');
 const command='Please fetch the cup for me and leave it at the sink, then take that same cup over to the table.';
 await check('one actual freeform interpretation returns grounded Cup Sink then Cup Table without executing in the API',async()=>{
  const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/mobile/interpret'&&response.request().method()==='POST');
  await page.getByRole('textbox',{name:'Mobile robot command',exact:true}).fill(command);await page.getByRole('button',{name:'Send mobile command',exact:true}).click();
  const response=await responsePromise;assert.equal(response.status(),200);const receipt=await response.json();results.interpretResponse=receipt;
  await writeFile(resolve(directory,'sandbox-intent-response.json'),JSON.stringify(receipt,null,2));
  assert.deepEqual(receipt.tasks,[{stationId:'sink',objectId:'cup'},{stationId:'table',objectId:'cup'}]);assert.equal(receipt.source,'llm-intent');assert.equal(receipt.completed,false);assert.ok(receipt.model);assert.ok(Number.isFinite(receipt.requestDurationMs));
  return{model:receipt.model,requestDurationMs:receipt.requestDurationMs,tasks:receipt.tasks};
 });
 await check('fresh current-world queue executes and retains two actual distinct native attempts',async()=>{
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Recent sandbox recordings"] button').length===2&&document.querySelector('.mobile-workspace header .state-pill')?.textContent==='idle',undefined,{timeout:45000});
  const history=app().locator('.mobile-sandbox-history');if(!await history.getAttribute('open'))await history.locator('summary').click();
  const second=await exportAttempt(0),first=await exportAttempt(1);results.nativeDigests=[first.integrity.digest,second.integrity.digest];assert.notEqual(...results.nativeDigests);
  for(const evidence of[first,second]){assert.equal(evidence.payload.finalWorld.mission.status,'completed');assert.ok(evidence.payload.checks.every(item=>item.passed));}
  const object=(world,id)=>world.objects.find(item=>item.id===id);
  assert.equal(object(first.payload.initialWorld,'cup').station,'counter');assert.equal(object(first.payload.finalWorld,'cup').station,'sink');
  assert.equal(object(second.payload.initialWorld,'cup').station,'sink');assert.equal(object(second.payload.finalWorld,'cup').station,'table');
  assert.ok(second.payload.initialWorld.simTime>=first.payload.finalWorld.simTime);
  const bowl=object(first.payload.initialWorld,'bowl');for(const evidence of[first,second])for(const sample of evidence.payload.trajectory)assert.deepEqual(object(sample.world,'bowl'),bowl);
  assert.equal(await app().locator('.activity-terminal-log').innerText().then(value=>value.includes(`Planner: ${results.interpretResponse.model}`)),true);
  return{firstSource:'counter',firstDestination:'sink',secondSource:'sink',secondDestination:'table',bowlUnchangedAcrossAllSamples:true,digests:results.nativeDigests};
 });
 await check('instruction-only interface has no object or destination task form and no other paid calls',async()=>{
  assert.equal(await app().getByRole('combobox',{name:/object|destination|task/i}).count(),0);assert.equal(results.interpretRequests,1);assert.deepEqual(results.blockedOtherPosts,[]);assert.deepEqual(results.errors,[]);
  const path=resolve(directory,'sandbox-intent-completed.png');await page.screenshot({path,fullPage:true});results.screenshot=path;return{interpretRequests:1,otherProviderRequests:0};
 });
 results.passed=true;
}catch(error){results.passed=false;results.failure=error.message;process.exitCode=1;const path=resolve(directory,'sandbox-intent-failure.png');await page.screenshot({path,fullPage:true}).catch(()=>{});results.screenshot=path;console.error(error.message);}
finally{results.finishedAt=new Date().toISOString();await writeFile(resolve(directory,'sandbox-intent-results.json'),JSON.stringify(results,null,2));await context.close();await browser.close();}
