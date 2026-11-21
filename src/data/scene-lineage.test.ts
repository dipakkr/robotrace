import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialWorld } from '../sim/engine';
import { canonicalSceneJSON, createSceneLineage, validateSceneDerivation, worldWithSceneDerivation } from './scene-lineage';
test('parent digest ignores key order and run clocks, without mutating source',async()=>{
 const world=createInitialWorld(),before=structuredClone(world),reordered=Object.fromEntries(Object.entries(world).reverse()) as typeof world;reordered.simTime=100;reordered.revision=90;
 assert.equal((await createSceneLineage(world,'Sort all parts')).parentSceneSha256,(await createSceneLineage(reordered,'Sort all parts')).parentSceneSha256);assert.deepEqual(world,before);
 assert.equal(canonicalSceneJSON({z:1,a:[2,1]}),'{"a":[2,1],"z":1}');assert.throws(()=>canonicalSceneJSON({x:Infinity}),/finite JSON/);
});
test('different children share parent group; unrelated geometry and task differ',async()=>{
 const world=createInitialWorld(),lineage=await createSceneLineage(world,'Sort all parts'),changed=structuredClone(world);changed.objects[0].position[0]+=.08;
 const derivation={parentSceneSha256:lineage.parentSceneSha256,seed:42,index:0,kind:'layout' as const,basis:'seeded-simulator-variation' as const,identityVerified:false as const};
 const a=worldWithSceneDerivation(world,derivation),b=worldWithSceneDerivation(changed,{...derivation,index:1});assert.notDeepEqual(a.objects,b.objects);assert.equal(a.sceneProvenance!.derivation!.parentSceneSha256,b.sceneProvenance!.derivation!.parentSceneSha256);
 assert.notEqual((await createSceneLineage(changed,'Sort all parts')).parentSceneSha256,lineage.parentSceneSha256);assert.notEqual((await createSceneLineage(world,'Move red to tray A')).parentSceneSha256,lineage.parentSceneSha256);assert.equal(world.sceneProvenance,undefined);
});
test('lineage clones inputs, preserves photo metadata and rejects invalid ancestry claims',async()=>{
 const world=createInitialWorld();world.sceneProvenance={source:'ai-draft',reviewRequired:true,reference:{kind:'image',sha256:'a'.repeat(64),calibrated:false,rightsVerified:false,basis:'submitted-reference-frame'}};
 const derivation={parentSceneSha256:(await createSceneLineage(world,'Sort all parts')).parentSceneSha256,seed:0,index:99,kind:'human-occupied' as const,basis:'seeded-simulator-variation' as const,identityVerified:false as const};
 const child=worldWithSceneDerivation(world,derivation);derivation.seed=22;assert.equal(child.sceneProvenance!.derivation!.seed,0);assert.deepEqual(child.sceneProvenance!.reference,world.sceneProvenance.reference);
 for(const patch of[{parentSceneSha256:'fake'},{seed:-1},{index:100},{kind:'real-demo'},{identityVerified:true}])assert.equal(validateSceneDerivation({...derivation,...patch}),false);
});
