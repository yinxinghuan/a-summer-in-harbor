import {legacyMintDefinitionHash,mintDefinitionHash} from '../server/plant-uses-rules';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtime} from '../server/runtime';
import {createHarborLife} from '../server/life-assembly';
import {withBasilPlantUses} from '../server/plant-basil';
import {withWildMintFixture} from './mint-rule-fixture';
import {initial,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {mintNode,mintItem,type PlantUsesSave,type PlantUseVerb} from '../src/life/plant-uses';
const seed=(scene='hill'):PlantUsesSave=>({...initial('en',randomUUID()),scene,position:rooms[scene].spawn,visited:Object.keys(rooms),known:['theo','dani'],flags:['key','unpacked'],items:{'crop-basil':3}});
const basil=()=>withBasilPlantUses(createHarborLife(runtime));
const fixture=(options:{enabled?:boolean;newStarts?:boolean}={enabled:true})=>withWildMintFixture(basil(),options);
function action(s:PlantUsesSave,v:PlantUseVerb):Action{const wild=v==='observe-mint'||v==='collect-mint',bag=v==='archive-mint';const entity=rooms[s.scene].entities.find(e=>e.person===(v==='share-mint'?'dani':'theo'));return {action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:wild?mintNode.approach:bag?s.position:entity!.approach,target:wild?mintNode.id:bag?'life-bag':entity!.id,action:'plant-use:'+v};}
const next=async(s:PlantUsesSave,v:PlantUseVerb,host=fixture())=>(await host.runtime.prepare(s,action(s,v))).head as PlantUsesSave;
const rejects=async(s:PlantUsesSave,a:Action,re:RegExp,host=fixture())=>{const copy=structuredClone(s);await assert.rejects(host.runtime.prepare(s,a),re);assert.deepEqual(s,copy)};
test('B defaults closed, same assembly, independent of basil; 623 states stay readable when closed',async()=>{
 const a=basil();assert.equal(withWildMintFixture(a),a);assert.equal(withWildMintFixture(a,{enabled:false}),a);
 const mint=await next(seed(),'collect-mint'),before=structuredClone(mint);assert.equal(a.lifeProject(mint).plantUses.mintEnabled,false);assert.deepEqual(mint,before);
 for(const v of ['observe-mint','collect-mint','archive-mint','share-mint'] as const)await rejects(mint,{...action(mint,'archive-mint'),action:'plant-use:'+v},/MINT_CONTENT_CLOSED/,a);
 const b=withWildMintFixture(withBasilPlantUses(createHarborLife(runtime),{enabled:false}),{enabled:true});assert.equal(b.lifeProject(mint).plantUses.basilEnabled,false);assert.equal(b.lifeProject(mint).plantUses.mintEnabled,true);assert.equal(b.lifeProject(mint).plantUses.wildFixtureOnly,true);assert.equal((await next(seed(),'collect-mint',b)).items[mintItem],1);
 const s=seed('cafe');await rejects(s,action(s,'read-offer'),/PLANT_USES_CLOSED/,b);
});
test('actual node stock floor, energy/time, exact recovery; no sale/seed/displaced land or cash',async()=>{
 let s=seed();const before=structuredClone(s);fixture().lifeProject(s);assert.deepEqual(s,before);
 s=await next(s,'collect-mint');assert.deepEqual([s.energy,s.townMinutes,s.cash,s.plantUsesV1!.mint!.stock,s.items[mintItem]],[98,550,25,1,1]);assert.equal(s.plantUsesV1!.mint!.recoverAt,1270);assert.equal(s.landV1,undefined);assert.equal(s.version,1);
 await rejects(s,action(s,'collect-mint'),/WILD_PLANT_RECOVERING/);await rejects({...s,townMinutes:1269},action({...s,townMinutes:1269},'collect-mint'),/WILD_PLANT_RECOVERING/);
 s=await next({...s,townMinutes:1270},'collect-mint');assert.equal(s.items[mintItem],2);assert.equal(s.plantUsesV1!.mint!.recoverAt,2000);assert.equal(s.cash,25);
 await rejects({...seed(),energy:1},action(seed(),'collect-mint'),/REST_NEEDED/);
});
test('archive consumes one, share once, stop new starts preserves completion and original source stamps',async()=>{
 let s=await next(seed(),'collect-mint');const source=s.plantUsesV1!.mint!.observationSource,stopped=fixture({enabled:true,newStarts:false});
 await rejects(s,action(s,'collect-mint'),/PLANT_USES_STARTS_CLOSED/,stopped);await rejects(s,action(s,'observe-mint'),/PLANT_USES_STARTS_CLOSED/,stopped);
 s=await next(s,'archive-mint',stopped);assert.equal(s.items[mintItem],undefined);assert.equal(s.plantUsesV1!.mint!.leaves,0);await rejects(s,action(s,'archive-mint'),/ITEMS_MISSING|MINT_ALREADY_ARCHIVED/,stopped);
 s={...s,scene:'garden',position:rooms.garden.spawn};s=await next(s,'share-mint',stopped);assert.equal(s.relations.dani,1);assert.equal(s.cash,25);assert.equal(s.plantUsesV1!.mint!.observationSource,source);await rejects(s,action(s,'share-mint'),/MINT_ALREADY_SHARED/,stopped);
 const closed=withWildMintFixture(basil());closed.runtime.assertReadable(s);assert.equal(closed.lifeProject(s).plantUses.mintEnabled,false);assert.ok(s.plantUsesV1!.mint!.archiveSource);assert.ok(s.plantUsesV1!.mint!.shareSource);
});
test('mint uses actual spatial, scene, version and payload gates; sample invalidates while notebook survives',async()=>{
 const s=seed(),a=action(s,'collect-mint');await rejects(s,{...a,target:'flora-herbs-v1'},/PLANT_USE_TARGET/);await rejects(s,{...a,scene:'garden'},/SCENE_MISMATCH/);await rejects(s,{...a,position:rooms.hill.spawn},/TOO_FAR/);await rejects(s,{...a,expected_version:99},/VERSION_CONFLICT/);await rejects(s,{...a,payload:{plant:'mint'}},/INVALID_PLANT_USE_COMMAND/);
 const moving={...s,position:{x:a.position.x-8,y:a.position.y},movingClock:{version:2 as const,millisecondsPerMinute:4000 as const,remainderMs:0}};await rejects(moving,a,/UNVERIFIED_POSITION/);
 const harvested=await next(s,'collect-mint');const notebook:any={version:1,records:[],commissions:[],sample:{old:true}}; // invalid samples are rejected by original animal reader, never quietly revived
 assert.throws(()=>fixture().runtime.assertReadable({...harvested,animalNotebookV1:notebook} as any));
 assert.equal(fixture().lifeProject(harvested).plants!.newStarts,true);assert.ok(fixture().lifeProject(harvested).animals);
});

test('v1 definition/hash and records remain readable without migration; v2 alone starts at new grass root',async()=>{
 let s=await next(seed(),'collect-mint');s.plantUsesV1!.mint!.definitionHash=legacyMintDefinitionHash;const before=structuredClone(s);basil().runtime.assertReadable(s);assert.deepEqual(s,before);assert.notEqual(legacyMintDefinitionHash,mintDefinitionHash);await rejects(s,action(s,'collect-mint'),/PLANT_USES_STARTS_CLOSED/);await rejects(s,action(s,'observe-mint'),/PLANT_USES_STARTS_CLOSED/);s=await next(s,'archive-mint');assert.equal(s.plantUsesV1!.mint!.definitionHash,legacyMintDefinitionHash);s={...s,scene:'garden',position:rooms.garden.spawn};s=await next(s,'share-mint');assert.equal(s.relations.dani,1);assert.equal(s.plantUsesV1!.mint!.definitionHash,legacyMintDefinitionHash);assert.equal((await next(seed(),'collect-mint')).plantUsesV1!.mint!.definitionHash,mintDefinitionHash);
});
