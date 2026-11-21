import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export const SPEECH_QA_REVISION='robotrace-speech-qa.2';
const MAX=2*1024*1024,hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
/** Separate derived analysis cache; the sealed original experiment is never written here. */
export function createSpeechQaStore({dataDirectory,generate}){
 const directory=resolve(dataDirectory,'.speech-qa'),inFlight=new Map();
 async function get(record){
  if(!UUID.test(record?.id??''))return null;
  const path=resolve(directory,`${record.id}.json`);
  try{const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX)throw fail('Saved speech QA analysis failed integrity verification.');const raw=await readFile(path,'utf8');if(Buffer.byteLength(raw)>MAX)throw fail('Saved speech QA analysis is too large.');const saved=JSON.parse(raw),{integrity,...unsigned}=saved;if(integrity?.algorithm!=='SHA-256'||integrity.sha256!==hash(unsigned))throw fail('Saved speech QA analysis failed integrity verification.');
   if(saved.sourceRecord?.id!==record.id||saved.sourceRecord?.integrity?.sha256!==record.integrity.sha256||saved.proposalRevision!==SPEECH_QA_REVISION)return null;
   if(saved.analysis?.schema!=='robotrace.speech-test-cases.v1'||saved.analysis.sourceExperimentId!==record.id||saved.analysis.proposed!==true)throw fail('Saved speech QA analysis has an invalid source.');return {...saved.analysis,sourceRecord:saved.sourceRecord,proposalRevision:saved.proposalRevision,savedAt:saved.savedAt,historySaved:true,cached:true};
  }catch(error){if(error?.code==='ENOENT')return null;if(error?.status)throw error;throw fail('Saved speech QA analysis could not be verified.');}
 }
 async function create(record,input={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['model','reviewReplies','regenerate'].includes(key))||(input.regenerate!==undefined&&typeof input.regenerate!=='boolean')||(input.reviewReplies!==undefined&&typeof input.reviewReplies!=='boolean')||(input.model!==undefined&&(typeof input.model!=='string'||!input.model.trim()||input.model.length>100)))throw fail('Provide optional model, reviewReplies and regenerate fields.',400);
  if(inFlight.has(record.id))return inFlight.get(record.id);
  const promise=(async()=>{
   if(input.regenerate!==true){const cached=await get(record);if(cached)return cached;}
   const {regenerate,...options}=input,analysis=await generate(record.experiment,options),sourceRecord={id:record.id,savedAt:record.savedAt,integrity:structuredClone(record.integrity)},savedAt=new Date().toISOString();
   const unsigned={schema:'robotrace.speech-qa-cache.v1',sourceRecord,proposalRevision:SPEECH_QA_REVISION,savedAt,analysis},saved={...unsigned,integrity:{algorithm:'SHA-256',sha256:hash(unsigned)}},serialized=JSON.stringify(saved);
   if(Buffer.byteLength(serialized)>MAX)throw fail('Generated speech QA analysis exceeds its storage bound.',413);
   const temp=resolve(directory,`.${record.id}-${randomUUID()}.tmp`),destination=resolve(directory,`${record.id}.json`);
   try{await mkdir(directory,{recursive:true,mode:0o700});await writeFile(temp,serialized,{mode:0o600,flag:'wx'});await rename(temp,destination);}catch{await rm(temp,{force:true}).catch(()=>{});return {...analysis,sourceRecord,proposalRevision:SPEECH_QA_REVISION,historySaved:false,cached:false,warning:'Analysis completed but could not be saved locally. Export this result before closing.'};}
   return {...analysis,sourceRecord,proposalRevision:SPEECH_QA_REVISION,savedAt,historySaved:true,cached:false};
  })();inFlight.set(record.id,promise);try{return await promise;}finally{inFlight.delete(record.id);}
 }
 return {get,create};
}
