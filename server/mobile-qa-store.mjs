import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,link,rm,readdir,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const MAX_BYTES=25*1024*1024, LIMIT=50;
const fileSystem={mkdir,readFile,writeFile,link,rm,readdir,lstat},queues=new Map();
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const label=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export function validateMobileQaMetadata(value){
 if(value===undefined)return {};
 if(!record(value)||Object.keys(value).some(key=>!['caseId','caseName','expected','campaignId'].includes(key)))throw fail('QA condition metadata must contain only bounded case/campaign labels.');
 const limits={caseId:80,caseName:160,expected:80,campaignId:100};
 for(const[key,item]of Object.entries(value))if(!label(item,limits[key]))throw fail('QA condition metadata needs nonempty bounded labels without control characters.');
 return {...value};
}
function metadata(result,qa){return {schema:'teachtrace.mobile-qa-run.v1',id:result.id.toLowerCase(),caseId:qa.caseId??'source-scene',caseName:qa.caseName??'Source scene (condition not supplied)',expected:qa.expected??'unspecified',campaignId:qa.campaignId??null,provenance:'client-declared-condition-labels'};}
function validateResult(result){
 if(!record(result)||result.schema!=='teachtrace.mobile-candidate-result.v1'||!UUID.test(result.id??'')
 ||!['invalid','refused','failed','blocked','completed'].includes(result.outcome)||typeof result.taskAccepted!=='boolean'
 ||!['human','baseline','llm'].includes(result.source)||!label(result.label,100)
 ||!Array.isArray(result.trajectory)||!result.trajectory.length||result.trajectory.length>2005
 ||!Array.isArray(result.checks)||result.checks.length>32||!result.checks.every(check=>record(check)&&label(check.id,120)&&typeof check.passed==='boolean')
 ||!['ticks','completedSteps','completedPickups','completedPlacements'].every(key=>Number.isSafeInteger(result[key])&&result[key]>=0)
 ||!['simulatedSeconds','evaluationDurationMs','distanceTravelled'].every(key=>Number.isFinite(result[key])&&result[key]>=0))throw fail('Only bounded actual mobile evaluation results can enter QA history.');
}
export function mobileQaSummary(saved){const r=saved.result;return {schema:saved.schema,id:saved.id,recordedAt:saved.recordedAt,caseId:saved.caseId,caseName:saved.caseName,expected:saved.expected,campaignId:saved.campaignId,provenance:saved.provenance,
 outcome:r.outcome,taskAccepted:r.taskAccepted,failureCategory:r.failureCategory??null,source:r.source,label:r.label,...(r.model!==undefined?{model:r.model}:{}),...(r.requestDurationMs!==undefined?{requestDurationMs:r.requestDurationMs}:{}),
 ticks:r.ticks,simulatedSeconds:r.simulatedSeconds,evaluationDurationMs:r.evaluationDurationMs,distanceTravelled:r.distanceTravelled,completedSteps:r.completedSteps,completedPickups:r.completedPickups,completedPlacements:r.completedPlacements,
 checks:r.checks.map(({id,name,passed,detail})=>({id,name,passed,detail})),protectedObjectCount:r.checks.filter(check=>check.id.startsWith('protected-')).length,protectedViolationCount:r.checks.filter(check=>check.id.startsWith('protected-')&&!check.passed).length,historySaved:true};}
/** Append-only private local QA history; only the latest fifty summaries are listed. */
export function createMobileQaStore({dataDirectory,fs=fileSystem}){
 const directory=resolve(dataDirectory,'.qa');
 async function get(id){if(typeof id!=='string'||!UUID.test(id))return null;const target=resolve(directory,`${id.toLowerCase()}.json`);
  try{const info=await fs.lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.size>MAX_BYTES)throw fail('Saved QA record failed integrity verification.',422);
   const raw=await fs.readFile(target,'utf8');if(Buffer.byteLength(raw)>MAX_BYTES)throw fail('Saved QA record exceeds its bound.',422);const saved=JSON.parse(raw);
   const {integrity,...unsigned}=saved;if(saved.schema!=='teachtrace.mobile-qa-run.v1'||saved.provenance!=='client-declared-condition-labels'||saved.id!==id.toLowerCase()||saved.result?.id.toLowerCase()!==saved.id||!Number.isFinite(Date.parse(saved.recordedAt))||integrity?.algorithm!=='SHA-256'||integrity?.sha256!==hash(unsigned))throw fail('Saved QA record failed integrity verification.',422);
   validateResult(saved.result);validateMobileQaMetadata({caseId:saved.caseId,caseName:saved.caseName,expected:saved.expected,...(saved.campaignId!==null?{campaignId:saved.campaignId}:{})});return saved;
  }catch(error){if(error.code==='ENOENT')return null;if(error.status)throw error;throw fail('Saved QA record could not be verified.',422);}
 }
 function serialize(work){const next=(queues.get(directory)??Promise.resolve()).catch(()=>{}).then(work);queues.set(directory,next);return next.finally(()=>{if(queues.get(directory)===next)queues.delete(directory);});}
 return {get,
  async save(result,input){validateResult(result);const qa=validateMobileQaMetadata(input),base=metadata(result,qa);return serialize(async()=>{
   const existing=await get(base.id);if(existing){if(hash(existing.result)!==hash(result)||['caseId','caseName','expected','campaignId'].some(key=>existing[key]!==base[key]))throw fail('A QA run identifier already belongs to a different result.',409);return existing;}
   const unsigned={...base,recordedAt:new Date().toISOString(),result:structuredClone(result)},saved={...unsigned,integrity:{algorithm:'SHA-256',encoding:'UTF-8 JSON.stringify(record without integrity)',sha256:hash(unsigned)}},raw=JSON.stringify(saved);
   if(Buffer.byteLength(raw)>MAX_BYTES)throw fail('QA recording exceeds the local history bound.',413);
   await fs.mkdir(directory,{recursive:true,mode:0o700});const temporary=resolve(directory,`.${base.id}-${randomUUID()}.tmp`);
   try{await fs.writeFile(temporary,raw,{flag:'wx',mode:0o600});await fs.link(temporary,resolve(directory,`${base.id}.json`));}finally{await fs.rm(temporary,{force:true}).catch(()=>{});}return saved;
  });},
  async list(){await queues.get(directory)?.catch(()=>{});let names;try{names=await fs.readdir(directory);}catch(error){if(error.code==='ENOENT')return {runs:[],limit:LIMIT,invalidRecordsSkipped:0};throw error;}
   const files=[];for(const name of names.filter(name=>UUID.test(name.replace(/\.json$/,''))&&name.endsWith('.json'))){try{const info=await fs.lstat(resolve(directory,name));files.push({name,time:info.mtimeMs});}catch{}}
   files.sort((a,b)=>b.time-a.time||b.name.localeCompare(a.name));const runs=[];let invalidRecordsSkipped=0;
   for(const file of files){try{const saved=await get(file.name.slice(0,-5));if(saved)runs.push(mobileQaSummary(saved));}catch{invalidRecordsSkipped++;}if(runs.length===LIMIT)break;}
   runs.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt));return {runs,limit:LIMIT,invalidRecordsSkipped};
  }
 };
}
