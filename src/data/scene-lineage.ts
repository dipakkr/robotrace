import type { WorldState } from '../sim/engine';
export type SceneDerivation = NonNullable<NonNullable<WorldState['sceneProvenance']>['derivation']>;
export interface SceneLineage { parentSceneSha256: string; canonicalization: 'teachtrace.parent-scene.canonical-json.v1'; basis: 'seeded-simulator-variation'; identityVerified: false; hashDurationMs: number }
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function canonicalSceneJSON(value:unknown,depth=0):string {
 if(depth>100)throw new Error('Scene nesting exceeds the lineage bound.');
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(item=>canonicalSceneJSON(item,depth+1)).join(',')}]`;
 if(!record(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('Scene lineage requires finite JSON values.');
 return `{${Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>`${JSON.stringify(key)}:${canonicalSceneJSON(value[key],depth+1)}`).join(',')}}`;
}
/** Source geometry/task digest, omitting run clocks, provenance and generated task identity. */
export async function createSceneLineage(world:WorldState,instruction:string):Promise<SceneLineage>{
 const started=performance.now(),scene=structuredClone(world) as Partial<WorldState>;
 if(typeof instruction!=='string'||!instruction.trim()||instruction.length>1500)throw new Error('A bounded parent task instruction is required.');
 for(const key of ['simTime','revision','lastCompletedStepId','sceneProvenance'] as const)delete scene[key];
 if(scene.customTask)delete scene.customTask.id;
 const bytes=new TextEncoder().encode(canonicalSceneJSON({schema:'teachtrace.parent-scene.v1',instruction,world:scene}));
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return {parentSceneSha256:Array.from(hash,byte=>byte.toString(16).padStart(2,'0')).join(''),canonicalization:'teachtrace.parent-scene.canonical-json.v1',basis:'seeded-simulator-variation',identityVerified:false,hashDurationMs:Math.round((performance.now()-started)*100)/100};
}
export function validateSceneDerivation(value:unknown):value is SceneDerivation{
 if(!record(value))return false;
 return Object.keys(value).every(key=>['parentSceneSha256','seed','index','kind','basis','identityVerified'].includes(key))&&typeof value.parentSceneSha256==='string'&&/^[a-f0-9]{64}$/.test(value.parentSceneSha256)
 &&Number.isInteger(value.seed)&&Number(value.seed)>=0&&Number(value.seed)<=0xffffffff&&Number.isInteger(value.index)&&Number(value.index)>=0&&Number(value.index)<100
 &&['layout','reach-challenge','human-occupied'].includes(String(value.kind))&&value.basis==='seeded-simulator-variation'&&value.identityVerified===false;
}
export function worldWithSceneDerivation(world:WorldState,derivation:SceneDerivation):WorldState{
 if(!validateSceneDerivation(derivation))throw new Error('The variation has invalid parent-scene lineage.');
 const next=structuredClone(world);next.sceneProvenance={...next.sceneProvenance,source:next.sceneProvenance?.source??'deterministic',reviewRequired:true,derivation:structuredClone(derivation)};return next;
}
