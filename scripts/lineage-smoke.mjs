import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {consumeEvidence} from './consume-evidence.mjs';
const directory=resolve('.local/qa');await mkdir(directory,{recursive:true});
const results={schema:'teachtrace.scene-lineage-ui-smoke.v1',startedAt:new Date().toISOString(),scope:'Actual seeded controller variations, loaded child recording, sealed export and standalone grouping; no training or provider calls.',checks:[],errors:[],providerCalls:0};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.addInitScript(()=>localStorage.setItem('teachtrace.auto-simulation-approval','false'));
await context.route('**/api/**',async route=>{if(route.request().method()==='POST'){results.providerCalls++;await route.abort('blockedbyclient');return;}await route.continue();});
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>results.errors.push(error.message));
const studio=()=>page.getByRole('dialog',{name:'Environment studio',exact:true});
async function exportJSON(button,name){const pending=page.waitForEvent('download');await button.click();const file=await pending,path=resolve(directory,name);await file.saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
try{
 await page.goto(process.env.SMOKE_BASE_URL||'http://127.0.0.1:5189/',{waitUntil:'domcontentloaded'});const children=[],batches=[];
 for(const index of[0,1]){
  await page.locator('.new-environment-button').click();await studio().getByRole('button',{name:'Household scenarios',exact:true}).click();await studio().getByRole('button',{name:'Load household scenario',exact:true}).first().click();
  await page.locator('.new-environment-button').click();await studio().getByRole('button',{name:'Generate variations',exact:true}).click();await studio().getByRole('combobox',{name:'Variation count',exact:true}).selectOption('5');await studio().getByRole('button',{name:'Generate & evaluate variations',exact:true}).click();await studio().locator('.variation-results article').last().waitFor();
  const batch=await exportJSON(studio().getByRole('button',{name:'Export variation evidence',exact:true}),`lineage-batch-${index}.json`);batches.push(batch);assert.match(batch.lineage.parentSceneSha256,/^[a-f0-9]{64}$/);assert.equal(batch.cases[index].index,index);assert.equal(batch.cases[index].seed,42);assert.ok(Number.isFinite(batch.lineage.hashDurationMs));
  await studio().locator('.variation-results article').nth(index).getByRole('button',{name:'Load this situation',exact:true}).click();await page.getByRole('combobox',{name:'Simulation speed',exact:true}).selectOption('3');await page.getByRole('textbox',{name:'Robot command',exact:true}).fill(batch.parent.instruction);await page.getByRole('button',{name:'Send command',exact:true}).click();await page.getByRole('button',{name:'Approve & run',exact:true}).click();
  await page.waitForFunction(index=>{const item=JSON.parse(localStorage.getItem('teachtrace.episodes.v1')||'[]')[0];return item?.outcome==='completed'&&item.initialWorld.sceneProvenance?.derivation?.index===index;},index,{timeout:45000});
  const evidence=await exportJSON(page.getByRole('button',{name:'Export evidence package',exact:true}),`lineage-child-${index}.teachtrace.json`);const derivation=evidence.episode.initialWorld.sceneProvenance.derivation;assert.deepEqual(derivation,{parentSceneSha256:batch.lineage.parentSceneSha256,seed:42,index,kind:'layout',basis:'seeded-simulator-variation',identityVerified:false});const consumed=consumeEvidence(evidence);children.push({evidence,consumed});
  results.checks.push({name:`loaded child ${index} records and exports its actual immutable parent lineage`,passed:true,parentSceneSha256:derivation.parentSceneSha256,index,states:evidence.episode.samples.length});
 }
 assert.equal(batches[0].lineage.parentSceneSha256,batches[1].lineage.parentSceneSha256);assert.notDeepEqual(children[0].evidence.episode.initialWorld.objects,children[1].evidence.episode.initialWorld.objects);
 assert.equal(children[0].consumed.manifest.grouping.frozenParentSceneSha256,children[1].consumed.manifest.grouping.frozenParentSceneSha256);assert.notEqual(children[0].consumed.manifest.grouping.computedSceneSha256,children[1].consumed.manifest.grouping.computedSceneSha256);
 for(const [index,child] of children.entries()){assert.equal(child.consumed.manifest.grouping.groupingSource,'declared-parent-scene-lineage');assert.equal(child.consumed.manifest.grouping.splitPerformed,false);assert.equal(child.consumed.manifest.grouping.upstreamLineageVerified,false);await writeFile(resolve(directory,`lineage-child-${index}-consumer-manifest.json`),JSON.stringify(child.consumed.manifest,null,2));}
 results.checks.push({name:'different recorded layouts remain in one declared parent group with distinct computed child hashes',passed:true,parent:children[0].consumed.manifest.grouping.frozenParentSceneSha256,childHashes:children.map(child=>child.consumed.manifest.grouping.computedSceneSha256)});
 assert.equal(results.providerCalls,0);assert.deepEqual(results.errors,[]);results.passed=true;console.log(JSON.stringify({passed:true,checks:results.checks}));
}catch(error){results.passed=false;results.failure=error.message;process.exitCode=1;await page.screenshot({path:resolve(directory,'lineage-smoke-failure.png'),fullPage:true}).catch(()=>{});}
finally{results.finishedAt=new Date().toISOString();await writeFile(resolve(directory,'lineage-smoke-results.json'),JSON.stringify(results,null,2));await browser.close();}
