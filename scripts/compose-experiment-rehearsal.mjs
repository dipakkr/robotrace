import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';

// Format conversion and timestamp-based mixing of real captured files only.
// This does not synthesize speech, regenerate scenes, or establish sample sync.
const dir=resolve(process.argv[2]||'.local/qa/voice-experiment-live-final');
const result=JSON.parse(await readFile(resolve(dir,'results.json'),'utf8'));
assert.equal(result.passed,true,'Only a fully verified live rehearsal may be packaged by this script. Failed original evidence stays unchanged.');
assert.equal(result.mode,'actual-agora-murf-prerecorded-input');
assert.ok(Number.isFinite(result.browserPageCreatedAt),'The capture must record browser page-creation wall time; do not invent alignment for older videos.');
assert.ok(result.audioManifest?.length);
const video=(await readdir(dir)).find(file=>file.startsWith('page@')&&file.endsWith('.webm'));assert.ok(video);
const sourceVideo=resolve(dir,video),output=resolve(dir,'rehearsal-real-audio-approximate-alignment.mp4');
const args=['-hide_banner','-loglevel','error','-y','-i',sourceVideo],filters=[],inputs=[];
for(const [index,clip] of result.audioManifest.entries()){
 const file=resolve(dir,`${clip.direction}-${clip.id}.webm`),bytes=await readFile(file),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,clip.sha256);assert.equal(bytes.length,clip.bytes);
 const offset=Math.max(0,clip.startedAt-result.browserPageCreatedAt);args.push('-i',file);filters.push(`[${index+1}:a]aresample=48000,adelay=${Math.round(offset)}:all=1[a${index}]`);
 inputs.push({file:basename(file),id:clip.id,direction:clip.direction,bytes:bytes.length,sha256:hash,observedCaptureStartedAt:clip.startedAt,observedCaptureEndedAt:clip.endedAt,approximateOffsetMs:offset});
}
filters.push(`${inputs.map((_,index)=>`[a${index}]`).join('')}amix=inputs=${inputs.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad[audio]`);
args.push('-filter_complex',filters.join(';'),'-map','0:v:0','-map','[audio]','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart','-metadata','title=RoboTrace actual recorded rehearsal - prerecorded input, approximate audio alignment','-metadata','comment=Real Agora RTC/Murf assistant and recorded microphone tracks. Prerecorded speech input. Audio/video aligned approximately by observed wall times, not sample synchronized.',output);
execFileSync('ffmpeg',args,{stdio:'pipe'});
const manifest={schema:'robotrace.rehearsal-media-composition.v1',experimentId:result.experimentId,sourceVideo:video,sourceVideoSha256:createHash('sha256').update(await readFile(sourceVideo)).digest('hex'),output:basename(output),outputSha256:createHash('sha256').update(await readFile(output)).digest('hex'),browserPageCreatedAt:result.browserPageCreatedAt,alignment:'Approximate observed wall-clock offsets. Browser rendering, recorder encoding and playback latency are not sample synchronized.',input:'Prerecorded English laptop-microphone fixture; not a human-microphone acoustic test.',processing:'Unchanged captured video frames re-encoded to H.264; real separately recorded audio decoded, delayed by observed offsets, mixed, peak-limited and AAC-encoded. No regenerated speech or simulated captions.',audioSources:inputs};
await writeFile(resolve(dir,'video-audio-alignment.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({output,manifest:resolve(dir,'video-audio-alignment.json'),limitation:manifest.alignment},null,2));
