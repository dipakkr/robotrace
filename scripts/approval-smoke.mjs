import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport:{width:1280,height:720}});
const page = await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
const command=async text=>{await page.getByRole('textbox',{name:'Robot command'}).fill(text);await page.getByRole('button',{name:'Send command',exact:true}).click();};
const checks=[];
try {
 await page.goto('http://127.0.0.1:5189/');
 await page.getByRole('textbox',{name:'Robot command'}).waitFor();
 await page.getByRole('combobox',{name:'Simulation speed'}).selectOption('3');
 await command('Clear the after-meal counter');
 const review=page.getByRole('region',{name:'Review simulated motion'});await review.waitFor();
 const cancel=review.getByRole('button',{name:'Cancel countdown'});await cancel.waitFor();
 const bounds=await cancel.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=720);
 await cancel.click();await page.waitForTimeout(3300);
 assert.equal(await page.locator('.skill-active').count(),0);assert.equal(await review.getByRole('button',{name:'Approve & run',exact:true}).isEnabled(),true);checks.push('auto-switch Review and visible cancellation preserve pending plan');
 await review.getByRole('button',{name:'Discard plan'}).click();
 await command('Clear the after-meal counter');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('teachtrace.episodes.v1')||'[]')[0]?.outcome==='completed',null,{timeout:35000});
 const episode=await page.evaluate(()=>JSON.parse(localStorage.getItem('teachtrace.episodes.v1'))[0]);
 assert.equal(episode.completedActions,2);assert.equal(episode.status,'review');assert.ok(episode.events.some(e=>e.label.includes('automatically approved')));checks.push('three-second auto-run completes two actual placements and leaves evidence unsubmitted');
 const selected=page.locator('.tree-row.is-selected').first();const style=await selected.evaluate(e=>({shadow:getComputedStyle(e).boxShadow,border:getComputedStyle(e).borderLeftWidth,font:getComputedStyle(e).fontSize}));assert.equal(style.shadow,'none');assert.equal(style.border,'0px');checks.push('dense sidebar selection has no left stripe');
 await page.screenshot({path:'docs/screenshots/review-auto-completed.png',fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile('.local/qa/approval-smoke-results.json',JSON.stringify({passed:true,checks,style,errors},null,2));console.log(JSON.stringify({passed:true,checks,style}));
} finally {await browser.close();}
