import {useEffect,useRef,useState} from 'react';
import {Camera,ImagePlus,Loader2,Sparkles,X} from 'lucide-react';
import {fingerprintReference} from '../data/reference-fingerprint';
import type {ReferenceFingerprint} from '../data/reference-fingerprint';
import './PhotoRoomBuilder.css';
export interface PhotoRoomSpec {schema:'robotrace.room-spec.v1';title:string;widthMeters:number;depthMeters:number;fixtures:{id:string;kind:'desk'|'chair'|'bench';label:string;center:[number,number];size:[number,number]}[];windows:('back'|'left')[];tvWall:'right'|'none';assumptions:string[];safeSpawn:[number,number];calibrated:false;basis:'image-informed-estimated-office-layout'}
type Draft={spec:PhotoRoomSpec;model:string;requestDurationMs:number};
export default function PhotoRoomBuilder({onApply,onClose}:{onApply:(spec:PhotoRoomSpec,reference:ReferenceFingerprint)=>void;onClose?:()=>void}){
 const [reference,setReference]=useState<string|null>(null),[width,setWidth]=useState(7),[depth,setDepth]=useState(8),[draft,setDraft]=useState<Draft|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[decoding,setDecoding]=useState(false);
 const serial=useRef(0),request=useRef<AbortController|null>(null),fingerprint=useRef<ReferenceFingerprint|null>(null),inflight=useRef(false);
 useEffect(()=>()=>{serial.current++;request.current?.abort();},[]);
 const invalidate=()=>{serial.current++;request.current?.abort();request.current=null;inflight.current=false;setBusy(false);setDraft(null);fingerprint.current=null;setError('');};
 const load=async(file?:File)=>{
  if(!file)return;invalidate();const operation=serial.current;setReference(null);setDecoding(true);
  try{
   if(file.size>50*1024*1024||!file.type.startsWith('image/'))throw new Error('Choose an image up to 50 MiB. For HEIC photos, export JPEG or take a new JPEG photo.');
   const bitmap=await createImageBitmap(file);if(operation!==serial.current){bitmap.close();return;}
   const canvas=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');if(!context){bitmap.close();throw new Error('This browser cannot prepare the photo.');}context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   let jpeg=canvas.toDataURL('image/jpeg',.72);if(jpeg.length>800000)jpeg=canvas.toDataURL('image/jpeg',.45);if(jpeg.length>800000)throw new Error('Choose a smaller photo or crop it to the room.');
   if(operation===serial.current)setReference(jpeg);
  }catch(cause){if(operation===serial.current)setError(cause instanceof Error&&cause.message.includes('Choose')?cause.message:'The photo could not be decoded. Export JPEG/PNG, or use the camera with JPEG capture.');}
  finally{if(operation===serial.current)setDecoding(false);}
 };
 const generate=async()=>{
  if(!reference||inflight.current)return;inflight.current=true;const operation=++serial.current,submitted=reference,controller=new AbortController();request.current=controller;setBusy(true);setDraft(null);setError('');fingerprint.current=null;const timer=setTimeout(()=>controller.abort(),30000);
  try{
   const proof=await fingerprintReference(submitted,'image');if(operation!==serial.current)return;
   const response=await fetch('/api/rooms/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:{dataUrl:submitted},roomWidth:width,roomDepth:depth}),signal:controller.signal});const value=await response.json();if(operation!==serial.current)return;
   if(!response.ok)throw new Error(value.error??'The estimated room could not be drafted.');if(value.spec?.schema!=='robotrace.room-spec.v1'||!Array.isArray(value.spec.fixtures)||value.spec.fixtures.length>12||!Array.isArray(value.spec.assumptions))throw new Error('The service returned an unsupported room draft.');
   fingerprint.current=proof;setDraft(value);
  }catch(cause){if(operation===serial.current)setError(cause instanceof Error&&cause.name==='AbortError'?'Room drafting timed out. No environment was applied.':cause instanceof Error?cause.message:'Room drafting failed.');}
  finally{clearTimeout(timer);if(operation===serial.current){inflight.current=false;setBusy(false);request.current=null;}}
 };
 return <section className="photo-room-builder" aria-label="Create room from photo">
  <header><div><span className="eyebrow">PHOTO → ESTIMATED NAVIGATION SCENE</span><h2>Bring your room into the sandbox</h2></div>{onClose&&<button className="icon-button" aria-label="Close photo room builder" onClick={onClose}><X size={17}/></button>}</header>
  <p>Upload one office photo or use your camera. AI proposes desks, chairs and a clear robot start; the dimensions and occluded layout remain estimates.</p>
  <div className="photo-room-upload"><label><ImagePlus size={19}/><strong>Choose room photo</strong><input type="file" accept="image/*" aria-label="Choose office room photo" onChange={event=>void load(event.target.files?.[0])}/></label><label><Camera size={19}/><strong>Take photo</strong><input type="file" accept="image/*" capture="environment" aria-label="Take office room photo" onChange={event=>void load(event.target.files?.[0])}/></label></div>
  {decoding&&<p role="status"><Loader2 className="spin" size={14}/> Preparing local JPEG…</p>}
  {reference&&<img className="photo-room-reference" src={reference} alt="Selected office reference, retained only in this open draft"/>}
  <div className="photo-room-dimensions"><label>Estimated width (m)<input type="number" aria-label="Estimated room width" min={4} max={12} step={.5} value={width} onChange={event=>{invalidate();setWidth(Number(event.target.value));}}/></label><label>Estimated depth (m)<input type="number" aria-label="Estimated room depth" min={4} max={12} step={.5} value={depth} onChange={event=>{invalidate();setDepth(Number(event.target.value));}}/></label></div>
  <small>The submitted photo is resized locally. Generating sends that JPEG to the configured vision model; it is not stored by this app. No people or private text are reconstructed.</small>
  <button className="button button-primary photo-room-generate" disabled={!reference||busy||decoding||![width,depth].every(number=>number>=4&&number<=12)} onClick={()=>void generate()}>{busy?<Loader2 className="spin" size={15}/>:<Sparkles size={15}/>} {busy?'Drafting estimated room…':'Generate room draft'}</button>
  {error&&<p className="photo-room-error" role="alert">{error}</p>}
  {draft&&<div className="photo-room-draft"><span className="eyebrow">ESTIMATE · NOT CALIBRATED</span><label>Room title<input aria-label="Draft room title" maxLength={100} value={draft.spec.title} onChange={event=>setDraft({...draft,spec:{...draft.spec,title:event.target.value}})}/></label><p>{draft.spec.fixtures.length} furniture footprints · {draft.spec.widthMeters} × {draft.spec.depthMeters} m · navigation only</p><ul>{draft.spec.assumptions.map((assumption,index)=><li key={index}>{assumption}</li>)}</ul><small>{draft.model} · {Math.round(draft.requestDurationMs)} ms · reference SHA {fingerprint.current?.sha256.slice(0,12)}…</small><button className="button button-primary" disabled={!draft.spec.title.trim()} onClick={()=>{try{if(fingerprint.current)onApply(structuredClone(draft.spec),{...fingerprint.current});}catch(cause){setError(cause instanceof Error?cause.message:'The estimated room could not be applied.');}}}>Apply estimated room</button></div>}
 </section>;
}
