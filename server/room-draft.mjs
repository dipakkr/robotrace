import {performance} from 'node:perf_hooks';
import {plannerModels} from './planner-models.mjs';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const pair=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite);
const strict=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const schema=strict({title:{type:'string'},fixtures:{type:'array',minItems:1,maxItems:12,items:strict({kind:{type:'string',enum:['desk','chair','bench']},label:{type:'string'},center:{type:'array',minItems:2,maxItems:2,items:{type:'number',minimum:0,maximum:1}},size:{type:'array',minItems:2,maxItems:2,items:{type:'number',minimum:.02,maximum:.95}}})},windows:{type:'array',maxItems:2,items:{type:'string',enum:['back','left']}},tvWall:{type:'string',enum:['right','none']},assumptions:{type:'array',minItems:1,maxItems:8,items:{type:'string'}}});
function image(value){
 const match=typeof value==='string'&&value.length<=820000&&value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z\d+/]+={0,2})$/);
 if(!match||match[2].length%4)throw fail('Choose a JPEG, PNG or WebP image resized to at most 600 KiB.');
 const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>600*1024||bytes.toString('base64')!==match[2])throw fail('The reference image is malformed or exceeds 600 KiB.');
 const valid=match[1]==='jpeg'?bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-1)===217:match[1]==='png'?bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.length>=20&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!valid)throw fail('The image bytes do not match the declared image type.');return value;
}
export function normalizeRoomSpec(value,width=7,depth=8){
 if(![width,depth].every(value=>Number.isFinite(value)&&value>=4&&value<=12))throw fail('Estimated room dimensions are outside the supported bounds.',502);
 if(!exact(value,['title','fixtures','windows','tvWall','assumptions'])||!text(value.title,100)||!Array.isArray(value.fixtures)||value.fixtures.length<1||value.fixtures.length>12||!Array.isArray(value.windows)||value.windows.length>2||value.windows.some(wall=>!['back','left'].includes(wall))||new Set(value.windows).size!==value.windows.length||!['right','none'].includes(value.tvWall)||!Array.isArray(value.assumptions)||!value.assumptions.length||value.assumptions.length>8||!value.assumptions.every(item=>text(item,300)))throw fail('The room draft did not match the supported office-layout schema.',502);
 const adjustments=[];const displayed=values=>JSON.stringify(values.map(value=>Math.round(value*1e6)/1e6));
 const fixtures=value.fixtures.map((item,index)=>{
  if(!exact(item,['kind','label','center','size'])||!['desk','chair','bench'].includes(item.kind)||!text(item.label,80)||!pair(item.center)||!pair(item.size)||item.size.some(size=>size<.02||size>.95)||item.center.some((center,axis)=>center<-.15||center>1.15||center-item.size[axis]/2<-.150000001||center+item.size[axis]/2>1.150000001))throw fail('A draft furniture footprint is outside the bounded estimation margin or unsupported.',502);
  const low=item.center.map((center,axis)=>Math.max(0,center-item.size[axis]/2)),high=item.center.map((center,axis)=>Math.min(1,center+item.size[axis]/2));
  const size=high.map((high,axis)=>high-low[axis]),center=high.map((high,axis)=>(high+low[axis])/2);
  if(size.some(size=>size<.02))throw fail('An estimated edge footprint becomes too small after floor intersection.',502);
  const id=`hall-${item.kind}-${index+1}`;
  if(item.center.some((coordinate,axis)=>coordinate-item.size[axis]/2<0||coordinate+item.size[axis]/2>1))adjustments.push({id,originalCenter:[...item.center],originalSize:[...item.size],center,size});
  return {id,kind:item.kind,label:item.label.trim(),center,size};
 });
 const blocked=(x,z)=>fixtures.some(item=>Math.abs(x-(item.center[0]-.5)*width)<=item.size[0]*width/2+.31&&Math.abs(z-(item.center[1]-.5)*depth)<=item.size[1]*depth/2+.31);
 let safeSpawn=null;for(const nz of[.90,.80,.70,.60,.50,.40,.30,.20,.10]){for(const nx of[.12,.22,.32,.42,.52,.62,.72,.82,.88]){const point=[(nx-.5)*width,(nz-.5)*depth];if(!blocked(...point)){safeSpawn=point;break;}}if(safeSpawn)break;}
 if(!safeSpawn)throw fail('The estimated furniture leaves no supported clear robot start. Try a wider view or larger estimated floor.',502);
 return {schema:'robotrace.room-spec.v1',title:value.title.trim(),widthMeters:width,depthMeters:depth,fixtures,windows:[...value.windows],tvWall:value.tvWall,assumptions:[...value.assumptions,...adjustments.map(item=>`Estimated ${item.id} intersected with floor bounds: center ${displayed(item.originalCenter)} size ${displayed(item.originalSize)} became center ${displayed(item.center)} size ${displayed(item.size)}. This is bounded clipping, not measured geometry.`)],normalization:{basis:'estimated-floor-rectangle-intersection',clippedFixtures:adjustments},safeSpawn,calibrated:false,basis:'image-informed-estimated-office-layout'};
}
/** One explicitly requested vision call; no photo storage, reconstruction or execution. */
export async function draftPhotoRoom({env=process.env,fetchImpl=fetch,input}={}){
 if(!object(input)||Object.keys(input).some(key=>!['image','roomWidth','roomDepth','model'].includes(key))||!exact(input.image,['dataUrl']))throw fail('Provide one local image reference and optional estimated room dimensions.');
 const reference=image(input.image.dataUrl),width=input.roomWidth??7,depth=input.roomDepth??8;
 if(![width,depth].every(value=>Number.isFinite(value)&&value>=4&&value<=12))throw fail('Estimated room width and depth must each be between 4 and 12 simulated meters.');
 const models=plannerModels(env),model=input.model??models[0]?.id;if(!models.length)throw fail('The vision model is not configured on the local service.',503);if(!models.some(item=>item.id===model))throw fail('Choose a configured vision model.');
 let url;try{url=new URL(env.LLM_API_URL||'https://api.openai.com/v1/chat/completions');}catch{throw fail('The vision endpoint is not configured correctly.',503);}
 if(url.username||url.password||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw fail('The vision endpoint must use HTTPS or loopback.',503);
 const messages=[{role:'system',content:'Propose a bounded approximate office collaboration-room floor plan from one photo. This is NOT calibrated reconstruction or a digital twin. Use only visible desks, chairs, benches; at most twelve conservative axis-aligned rectangular footprints. Ignore people, personal identities, text, bags, laptops, bottles and private content. Do not invent a kitchen, Sink, Cup, robotic manipulation objects or hidden rooms. Every coordinate and size is NORMALIZED, never meters: center [0.5,0.5] and size [0.45,0.12] is an example desk. Use short labels of at most 60 characters. Coordinates are normalized floor X/Z in [0,1], X left-to-right, Z back-to-front; footprint center +/- half size must remain inside that floor. Size each axis between0.02 and0.95, and keep centers at least half that size from the floor edge; do not center a thick bench directly on a wall line. Back windows are at Z0, left windows at X0. Mark only clearly visible window walls and TV on right wall if visible. Leave the front/left aisle clear for a robot. Sizes and locations are guesses: list uncertainty/occlusion and assumed scale explicitly. Return only supplied JSON schema. If the image is not an office with supported furniture, do not invent furniture: refuse rather than fabricate.'},{role:'user',content:[{type:'text',text:`Estimated floor ${width}m wide and ${depth}m deep, operator-supplied/default scale, not measured. Draft an office layout only.`},{type:'image_url',image_url:{url:reference,detail:'low'}}]}];
 const payload={model,messages,...(url.hostname==='api.openai.com'?{max_completion_tokens:1400,response_format:{type:'json_schema',json_schema:{name:'robotrace_office_room',strict:true,schema}}}:{max_tokens:1400,response_format:{type:'json_object'}})},started=performance.now();
 try{
  const response=await fetchImpl(url.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${env.LLM_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw fail(`The vision provider rejected the draft (HTTP ${response.status}). No environment was applied.`,502);
  if(Number(response.headers?.get('content-length'))>65536)throw fail('The vision response exceeded its bound.',502);const raw=await response.text();if(raw.length>65536)throw fail('The vision response exceeded its bound.',502);
  let envelope;try{envelope=JSON.parse(raw);}catch{throw fail('The vision provider returned invalid JSON.',502);}const choice=envelope.choices?.[0];if(choice?.finish_reason!=='stop'||choice?.message?.refusal||!text(choice?.message?.content,16000))throw fail('The vision provider could not draft this supported room. No environment was applied.',502);
  let value;try{value=JSON.parse(choice.message.content);}catch{throw fail('The vision room response was not valid JSON.',502);}const spec=normalizeRoomSpec(value,width,depth);
  const serialized=JSON.stringify(spec);if(['LLM_API_KEY','MURF_API_KEY','AGORA_APP_CERTIFICATE','AGORA_CUSTOMER_SECRET'].map(key=>env[key]).filter(secret=>typeof secret==='string'&&secret.length>=8).some(secret=>serialized.includes(secret)))throw fail('The vision provider returned unsafe draft content.',502);
  return {spec,model,requestDurationMs:Math.max(0,Math.round((performance.now()-started)*100)/100),source:'llm-vision-room-draft',calibrated:false,completed:false};
 }catch(error){if(error.status)throw error;if(['TimeoutError','AbortError'].includes(error.name))throw fail('The room draft timed out. No environment was applied.',504);throw fail('The vision service could not be reached. No environment was applied.',502);}
}
