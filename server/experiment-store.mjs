import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,link,rm,readdir,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tsImport} from 'tsx/esm/api';

const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const MAX_BYTES=20*1024*1024,LIMIT=50;
export const MAX_EXPERIMENT_AUDIO_BYTES=16*1024*1024;
const fileSystem={mkdir,readFile,writeFile,link,rm,readdir,lstat};
const queues=new Map();let shared;
const helpers=()=>shared??=tsImport('../src/data/voice-experiment.ts',import.meta.url);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

async function checked(experiment){
 const api=await helpers(),validation=api.validateVoiceExperiment(experiment);
 if(!validation.valid)throw fail(`The experiment recording is malformed: ${validation.errors.slice(0,3).join('; ').slice(0,500)}`);
 return {experiment:validation.experiment??experiment,report:api.buildVoiceExperimentReport(validation.experiment??experiment)};
}
/** Local append-only recordings; a saved report is recomputed from recorded evidence, never a posted grade. */
export function createExperimentStore({dataDirectory,fs=fileSystem}){
 const directory=resolve(dataDirectory,'.experiments');
 async function get(id){
  if(typeof id!=='string'||!UUID.test(id))return null;const normalized=id.toLowerCase(),target=resolve(directory,`${normalized}.json`);
  try{
   const info=await fs.lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_BYTES)throw fail('Saved experiment failed integrity verification.',422);
   const raw=await fs.readFile(target,'utf8');if(Buffer.byteLength(raw)>MAX_BYTES)throw fail('Saved experiment exceeds its recording bound.',422);
   const saved=JSON.parse(raw),{integrity,...unsigned}=saved;
   if(!exact(saved,['schema','id','savedAt','experiment','report','integrity'])||saved.schema!=='robotrace.voice-experiment-record.v1'||saved.id!==normalized||saved.experiment?.id!==normalized||!Number.isFinite(Date.parse(saved.savedAt))
    ||!exact(integrity,['algorithm','encoding','sha256'])||integrity.algorithm!=='SHA-256'||integrity.encoding!=='UTF-8 JSON.stringify(record without integrity)'||integrity.sha256!==hash(unsigned))throw fail('Saved experiment failed integrity verification.',422);
   let verified;try{verified=await checked(saved.experiment);}catch{throw fail('Saved experiment failed recorded-evidence validation.',422);}// The sealed historical grade belongs to its evaluator revision. Reopening must not rewrite it.
   if(saved.report?.evaluatorRevision===verified.report.evaluatorRevision&&hash(verified.report)!==hash(saved.report))throw fail('Saved experiment report disagrees with recomputed evidence.',422);
   return saved;
  }catch(error){if(error.code==='ENOENT')return null;if(error.status)throw error;throw fail('The saved experiment could not be verified.',422);}
 }
 function serialize(work){const next=(queues.get(directory)??Promise.resolve()).catch(()=>{}).then(work);queues.set(directory,next);return next.finally(()=>{if(queues.get(directory)===next)queues.delete(directory);});}
 async function audioClip(experimentId,clipId){
  if(!UUID.test(experimentId??'')||!UUID.test(clipId??''))return null;
  const folder=resolve(directory,`${experimentId.toLowerCase()}.audio`),target=resolve(folder,`${clipId.toLowerCase()}.json`);
  try{const info=await fs.lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw fail('Audio clip metadata failed verification.',422);
   const descriptor=JSON.parse(await fs.readFile(target,'utf8')),{integrity,...unsigned}=descriptor;
   if(descriptor.schema!=='robotrace.voice-experiment-audio.v1'||descriptor.id!==clipId.toLowerCase()||descriptor.experimentId!==experimentId.toLowerCase()||integrity?.sha256!==hash(unsigned))throw fail('Audio clip metadata failed verification.',422);
   const binary=resolve(folder,`${clipId.toLowerCase()}.bin`),binaryInfo=await fs.lstat(binary);
   if(!binaryInfo.isFile()||binaryInfo.isSymbolicLink()||binaryInfo.size!==descriptor.bytes||binaryInfo.size>MAX_EXPERIMENT_AUDIO_BYTES)throw fail('Recorded audio failed integrity verification.',422);
   const bytes=await fs.readFile(binary);if(createHash('sha256').update(bytes).digest('hex')!==descriptor.sha256)throw fail('Recorded audio failed integrity verification.',422);
   return {clip:descriptor,bytes};
  }catch(error){if(error.code==='ENOENT')return null;if(error.status)throw error;throw fail('The recorded audio clip could not be verified.',422);}
 }
 async function audioManifest(id){if(!UUID.test(id??''))return [];const folder=resolve(directory,`${id.toLowerCase()}.audio`);let names;try{names=await fs.readdir(folder);}catch(error){if(error.code==='ENOENT')return [];throw error;}
  const rows=[];for(const name of names.filter(name=>name.endsWith('.json')&&UUID.test(name.slice(0,-5))).sort()){const value=await audioClip(id,name.slice(0,-5));if(value)rows.push(value.clip);if(rows.length>32)throw fail('The audio manifest exceeds its supported clip count.',422);}return rows;
 }
 return {get,
  audioManifest,
  async audio(id,clipId){if(!await get(id))return null;return audioClip(id,clipId);},
  async saveAudio(id,clipId,metadata,mimeType,inputBytes){
   if(!UUID.test(id??'')||!UUID.test(clipId??'')||id!==id.toLowerCase()||clipId!==clipId.toLowerCase())throw fail('Experiment and audio clip identifiers must be lowercase UUIDs.');
   const saved=await get(id);if(!saved)throw fail('Save the experiment before attaching audio.',404);
   if(!exact(metadata,['direction','startedAt','endedAt'])||!['user','assistant'].includes(metadata.direction)||!Number.isFinite(metadata.startedAt)||!Number.isFinite(metadata.endedAt)||metadata.endedAt<metadata.startedAt||metadata.endedAt-metadata.startedAt>3600000||metadata.endedAt<saved.experiment.startedAt||metadata.startedAt>saved.experiment.endedAt)throw fail('Audio metadata must identify a timed user or assistant clip overlapping this experiment.');
   if(typeof mimeType!=='string'||mimeType.length>120||!/^audio\/(?:webm|ogg|wav|x-wav|mp4)(?:\s*;\s*codecs=[a-z\d.," -]+)?$/i.test(mimeType))throw fail('Use recorded WebM, Ogg, WAV or MP4 audio.');
   if(!Buffer.isBuffer(inputBytes)||!inputBytes.length||inputBytes.length>MAX_EXPERIMENT_AUDIO_BYTES)throw fail('Audio clips must contain 1 byte to 16 MiB.',413);
   const kind=mimeType.split(';')[0].trim().toLowerCase();
   const containerMatches=kind==='audio/webm'?inputBytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])):kind==='audio/ogg'?inputBytes.subarray(0,4).toString()==='OggS':kind==='audio/mp4'?inputBytes.subarray(4,8).toString()==='ftyp':inputBytes.subarray(0,4).toString()==='RIFF'&&inputBytes.subarray(8,12).toString()==='WAVE';
   if(!containerMatches)throw fail('The audio container does not match its declared recording type.');
   const bytes=Buffer.from(inputBytes),sha256=createHash('sha256').update(bytes).digest('hex');
   return serialize(async()=>{
    const existing=await audioClip(id,clipId);if(existing){if(existing.clip.sha256!==sha256||existing.clip.mimeType!==mimeType||['direction','startedAt','endedAt'].some(key=>existing.clip[key]!==metadata[key]))throw fail('This audio clip ID already belongs to a different recording.',409);return {saved:true,clip:existing.clip};}
    if((await audioManifest(id)).length>=32)throw fail('An experiment can retain at most 32 audio clips.',413);
    const unsigned={schema:'robotrace.voice-experiment-audio.v1',id:clipId,experimentId:id,...metadata,mimeType,bytes:bytes.length,sha256,recordedAt:new Date().toISOString()},clip={...unsigned,integrity:{algorithm:'SHA-256',sha256:hash(unsigned)}};
    const folder=resolve(directory,`${id}.audio`);await fs.mkdir(folder,{recursive:true,mode:0o700});const temporary=resolve(folder,`.${clipId}-${randomUUID()}`),binary=resolve(folder,`${clipId}.bin`);let linked=false,committed=false;
    try{await fs.writeFile(`${temporary}.bin`,bytes,{flag:'wx',mode:0o600});await fs.link(`${temporary}.bin`,binary);linked=true;await fs.writeFile(`${temporary}.json`,JSON.stringify(clip),{flag:'wx',mode:0o600});await fs.link(`${temporary}.json`,resolve(folder,`${clipId}.json`));committed=true;}
    finally{await fs.rm(`${temporary}.bin`,{force:true}).catch(()=>{});await fs.rm(`${temporary}.json`,{force:true}).catch(()=>{});if(linked&&!committed)await fs.rm(binary,{force:true}).catch(()=>{});}
    return {saved:true,clip};
   });
  },
  async save(input){
   if(!exact(input,['experiment']))throw fail('Provide one native experiment recording without a posted grade.');
   let raw;try{raw=JSON.stringify(input.experiment);}catch{throw fail('The experiment must contain serializable JSON.');}
   if(!raw||Buffer.byteLength(raw)>MAX_BYTES)throw fail('The experiment exceeds the 20 MiB local recording bound.',413);
   const frozen=JSON.parse(raw),verified=await checked(frozen),id=verified.experiment.id;
   if(!UUID.test(id)||id!==id.toLowerCase())throw fail('The experiment identifier must be a lowercase UUID.');
   return serialize(async()=>{
    const existing=await get(id);if(existing){if(hash(existing.experiment)!==hash(verified.experiment))throw fail('This experiment ID already belongs to another recording.',409);return {saved:true,id,savedAt:existing.savedAt,report:existing.report,integrity:existing.integrity};}
    const unsigned={schema:'robotrace.voice-experiment-record.v1',id,savedAt:new Date().toISOString(),experiment:verified.experiment,report:verified.report};
    const saved={...unsigned,integrity:{algorithm:'SHA-256',encoding:'UTF-8 JSON.stringify(record without integrity)',sha256:hash(unsigned)}},serialized=JSON.stringify(saved);
    if(Buffer.byteLength(serialized)>MAX_BYTES)throw fail('The experiment and report exceed the 20 MiB recording bound.',413);
    await fs.mkdir(directory,{recursive:true,mode:0o700});const temporary=resolve(directory,`.${id}-${randomUUID()}.tmp`);
    try{await fs.writeFile(temporary,serialized,{flag:'wx',mode:0o600});await fs.link(temporary,resolve(directory,`${id}.json`));}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}
    return {saved:true,id,savedAt:saved.savedAt,report:saved.report,integrity:saved.integrity};
   });
  },
  async list(){
   await queues.get(directory)?.catch(()=>{});let names;try{names=await fs.readdir(directory);}catch(error){if(error.code==='ENOENT')return {experiments:[],limit:LIMIT,invalidRecordsSkipped:0};throw error;}
   const candidates=[];for(const name of names.filter(name=>name.endsWith('.json')&&UUID.test(name.slice(0,-5)))){try{const info=await fs.lstat(resolve(directory,name));candidates.push({id:name.slice(0,-5),mtime:info.mtimeMs});}catch{}}
   candidates.sort((a,b)=>b.mtime-a.mtime||b.id.localeCompare(a.id));const experiments=[];let invalidRecordsSkipped=0;
   for(const item of candidates){try{const saved=await get(item.id);if(saved)experiments.push({id:saved.id,savedAt:saved.savedAt,startedAt:saved.experiment.startedAt,endedAt:saved.experiment.endedAt,report:saved.report});}catch{invalidRecordsSkipped++;}if(experiments.length>=LIMIT)break;}
   return {experiments,limit:LIMIT,invalidRecordsSkipped};
  },
  async jsonl(id){const saved=await get(id);if(!saved)return null;return (await helpers()).voiceExperimentJSONL(saved.experiment,saved.report)+(await audioManifest(id)).map(clip=>JSON.stringify({type:'audio-manifest',clip})+'\n').join('');}
 };
}
