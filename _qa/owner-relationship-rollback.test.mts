import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createExplorationAssembly} from '../server/exploration-assembly';import {withBasilPlantUses} from '../server/plant-basil';import {initial} from '../src/story/state';import {entityAt,rooms} from '../src/world/data';
test('retained basil release reader/action preserves optional relationship progress without database rollback',async()=>{
 const root=process.env.HARBOR_RELATIONSHIP_ROLLBACK_ROOT;if(!root)throw Error('EXPLICIT_ROLLBACK_ROOT_REQUIRED');
 const {createExplorationAssembly:legacyFactory}=await import(root+'/server/exploration-assembly.ts'),{withBasilPlantUses:legacyBasil}=await import(root+'/server/plant-basil.ts');
 const owner=createExplorationAssembly({now:()=>100000,boot:'new-relationships',decorateLife:(r:any)=>withBasilPlantUses(r)}),old=legacyFactory({now:()=>100000,boot:'old-basil',decorateLife:(r:any)=>legacyBasil(r,{newStarts:false})});
 let s:any={...initial('en',randomUUID()),position:entityAt('station','mara')!.approach,known:['mara'],flags:['key','unpacked'],visited:Object.keys(rooms)};
 s=(await owner.runtime.prepare(s,{action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'mara',action:'talk:rg-personal'})).head;
 const progress=structuredClone(s.relationshipsV1);old.runtime.assertReadable(s);assert.deepEqual(old.runtime.upgrade(structuredClone(s)),s);
 const next=(await old.runtime.prepare(s,{action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'home',action:'travel-map'})).head;assert.deepEqual(next.relationshipsV1,progress);assert.deepEqual(next.relations,s.relations);owner.runtime.assertReadable(next);assert.equal(old.lifeProject(next).plantUses.mintEnabled,false);
});
