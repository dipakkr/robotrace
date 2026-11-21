import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
// Read-only verification of a previously captured live experiment. No voice start.
const source=resolve(process.argv[2]||'.local/qa/voice-experiment-live');
const prior=JSON.parse(await readFile(resolve(source,'results.json'),'utf8'));
const id=prior.experimentId;assert.ok(id);
const dir=resolve(source,'saved-proof');await mkdir(dir,{recursive:true});
const result={schema:'robotrace.saved-experiment-read-only-proof.v1',id,checks:[],errors:[],limitation:'Does not change or relabel the original failed live workflow. Reopens its actual persisted evidence without another provider session.'};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({baseURL:'http://127.0.0.1:5189',viewport:{width:1440,height:900}});const page=await context.newPage();page.setDefaultTimeout(15000);
await context.route('**/api/voice/start',route=>route.abort('blockedbyclient'));page.on('pageerror',e=>result.errors.push(e.message));
try{
 const raw=await context.request.get(`/api/experiments/${id}`);assert.equal(raw.status(),200);const saved=await raw.json();result.reportCounts=saved.record.report.counts;result.clips=[];
 for(const clip of saved.audioManifest){const path=`/api/experiments/${id}/audio/${clip.id}`,response=await context.request.get(path);assert.equal(response.status(),200);const bytes=await response.body(),hash=createHash('sha256').update(bytes).digest('hex');const upload=prior.uploads.find(item=>item.path===path);assert.ok(upload);assert.equal(bytes.length,clip.bytes);assert.equal(bytes.length,upload.bytes);assert.equal(hash,clip.sha256);assert.equal(hash,upload.sha256);const file=resolve(dir,`${clip.direction}-${clip.id}.webm`);await writeFile(file,bytes);execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-f','null','-'],{stdio:'pipe'});result.clips.push({id:clip.id,direction:clip.direction,bytes:bytes.length,sha256:hash,decoded:true});}
 assert.ok(result.clips.some(c=>c.direction==='user')&&result.clips.some(c=>c.direction==='assistant'));result.checks.push({name:'Actual separate microphone/assistant clips download with identical upload SHA-256/length and independently decode',passed:true});
 const response=await context.request.get(`/api/experiments/${id}/export.jsonl`);assert.equal(response.status(),200);const text=await response.text();await writeFile(resolve(dir,'experiment.jsonl'),text);const lines=text.trim().split('\n').map(line=>JSON.parse(line));result.types=[...new Set(lines.map(line=>line.type))];for(const type of ['experiment','event','transcript','native-attempt','requested-vs-observed','report','audio-manifest'])assert.ok(result.types.includes(type));result.sampleCount=saved.record.experiment.events.filter(e=>e.type==='world-sample').length;assert.ok(result.sampleCount>100);result.checks.push({name:'JSONL carries actual native attempts, speech, sampled states, honest evaluations and audio manifests',passed:true});
 await page.goto('/kitchen?voice=off');await page.getByRole('button',{name:'AI deployment checks'}).click();const qa=page.getByRole('dialog',{name:'Voice experiment QA console'});await qa.locator('.experiment-run').filter({hasText:id.slice(0,8)}).click();await qa.getByRole('link',{name:'Export JSONL',exact:true}).waitFor();
 await qa.getByRole('button',{name:'Replay action',exact:true}).first().click();const slider=qa.getByRole('slider',{name:'Seek experiment action'});await qa.getByRole('button',{name:'Play replay',exact:true}).click();await page.waitForTimeout(750);result.replayFrame=Number(await slider.inputValue());assert.ok(result.replayFrame>0);result.checks.push({name:'Report opens the persisted session and plays its native recorded frames',passed:true});
 await qa.locator('summary').filter({hasText:/^Audio clips/}).click();const audio=qa.locator('audio').first();await audio.evaluate(e=>e.play());await page.waitForTimeout(500);assert.equal(await audio.evaluate(e=>e.paused),false);assert.equal(await audio.evaluate(e=>e.error?.message??null),null);result.checks.push({name:'Persisted audio plays through the human report native player',passed:true});
 await page.screenshot({path:resolve(dir,'saved-real-evidence.png'),fullPage:true});assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.failure=e.stack;result.passed=false;process.exitCode=1;await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true}).catch(()=>{});}
finally{await context.close();await browser.close();await writeFile(resolve(dir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
