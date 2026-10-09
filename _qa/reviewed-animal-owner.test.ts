import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {mkdtempSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {initial} from '../src/story/state';import {rooms} from '../src/world/data';
import pack from '../server/content/reviewed-evening-gull-watch.json';
import {reviewedAnimalRegistry,createReviewedAnimalLife} from '../server/reviewed-animal-life';
import {AnimalContentRegistry,builtInCommissions,contentHash} from '../server/animal-content';
import {createHarborLife} from '../server/life-assembly';import {createExplorationAssembly} from '../server/exploration-assembly';
import {withWildMint} from '../server/wild-mint';import {withBasilPlantUses} from '../server/plant-basil';import {configuredNews} from '../server/news/configured';
import {runtime} from '../server/runtime';import {playStory} from './animal-m3-playthrough';import type {AnimalStoryChoice} from '../server/animal-grounding';
import {pinLegacy,addLot} from '../src/life/save';import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {applyPlantUse} from '../server/plant-uses-rules';
// @ts-expect-error existing pinned authority, local isolated SQLite only
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

test('fixed reviewed definition offers introduced Dani only, preserves legacy refs and does not mutate the head',()=>{
 const original=new AnimalContentRegistry(),registry=reviewedAnimalRegistry();
 for(const d of builtInCommissions)assert.deepEqual(registry.ref(d.id,d.revision),original.ref(d.id,d.revision));
 assert.deepEqual(registry.ref(pack.ref.id,pack.ref.revision),pack.ref);
 const closed=reviewedAnimalRegistry(false);
 for(const d of builtInCommissions)assert.equal(closed.canStart(closed.ref(d.id,d.revision)),true);
 assert.equal(closed.canStart(closed.ref(pack.ref.id,pack.ref.revision)),false);
 const life=createReviewedAnimalLife(runtime),head=initial('en',randomUUID()),before=structuredClone(head);
 assert.ok(!life.animalProject(head).commissions.some(d=>d.ref.id===pack.ref.id));assert.deepEqual(head,before);
 const known={...head,known:[...head.known,'dani']};const dto=life.animalProject(known);
 assert.equal(dto.commissions.filter(d=>d.ref.id===pack.ref.id).length,1);assert.equal(dto.commissions.find(d=>d.ref.id===pack.ref.id)!.enabled,true);
 assert.equal(known.animalNotebookV1,undefined);assert.deepEqual(head,before);
});

test('fixed commission completes via ordinary authority commands without proposal/adoption/model and survives SQLite reopen/replay',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-reviewed-owner-')),config={path:join(directory,'authority.sqlite'),worldId:'reviewed-owner-free',gameId:'reviewed-owner-free',environment:'test'},owner='local-reviewed-owner';
 const time={value:100000},decorateLife=(life:any)=>withWildMint(withBasilPlantUses(life,{enabled:true,newStarts:true}),{enabled:true,newStarts:true});
 const options={now:()=>time.value,boot:'reviewed-owner-free',crabEnabled:true,createLife:createReviewedAnimalLife,decorateLife,decorateRuntime:(r:any)=>configuredNews(r,new URL('../server/news/frozen-catalog-20261006.json',import.meta.url).pathname),initial:(l:any,id:string)=>{const registry=createPlantsRegistry(),s=pinLegacy({...initial(l,id),scene:'coast',position:{...rooms.coast.spawn},known:['mara','ruth','owen','dani'],visited:Object.keys(rooms),flags:['key','unpacked','route-open','market-open'],items:{key:1}},registry);addLot(s,registry,snapPeaV2Ref,'seed',2,'local-reviewed-owner-pea-seed');return applyPlantUse(s,'collect-mint','local-reviewed-owner-mint-source',registry,true).head}};
 let store=openAsyncSqliteAuthorityStore(config),assembly=createExplorationAssembly(options),authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store);const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>{throw Error('NO_MODEL_OR_NETWORK_IN_FREE_REVIEWED_PLAY')};
 try{
  let head=await authority.create(owner,randomUUID(),'en');head=(await authority.action(owner,head.id,{action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target:'home',action:'travel-map'})).head;
  assert.equal(head.animalNotebookV1,undefined);
  const played=await playStory(authority,assembly,owner,head,pack.groundedChoice as AnimalStoryChoice,time);
  assert.equal(played.head.animalNotebookV1.adopted,undefined);assert.equal(played.head.animalNotebookV1.pages.find((p:any)=>p.ref.id===pack.ref.id).ref.hash,pack.ref.hash);
  assert.equal(played.report.counts.observations,2);assert.equal(played.report.realAdditionalModelCalls,0);assert.deepEqual(played.head.items,head.items);assert.equal(played.head.cash,head.cash);
  writeFileSync(join(directory,'playthrough.json'),JSON.stringify(played,null,2)+'\n');
  await store.close();store=openAsyncSqliteAuthorityStore(config);
  // Preserve fixed content readers while closing new starts.
  assembly=createExplorationAssembly({...options,createLife:(base:any,plants:boolean,native:any)=>createHarborLife(base,plants,native,reviewedAnimalRegistry(false))});
  authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store);
  const reopened=await authority.get(owner,head.id);assert.equal(contentHash(reopened),contentHash(played.head));
  const replay=await authority.action(owner,head.id,played.shareAction);assert.deepEqual(replay.head,reopened);
  const page=assembly.animalProject(reopened).pages.find((p:any)=>p.ref.id===pack.ref.id);assert.deepEqual(page.title,pack.definition.title);assert.deepEqual(page.text,pack.definition.page);
  assert.equal(assembly.animalProject(reopened).commissions.find((d:any)=>d.ref.id===pack.ref.id).enabled,false);
  await assert.rejects(authority.get('other-normal-owner',head.id),/NOT_FOUND|SESSION/);
  console.log(JSON.stringify({scope:'new fixed registry on aba82cc, ordinary local SQLite commands and controlled time; not formal player/device',directory,counts:played.report.counts,noAdoption:true,noNetwork:true,reopen:true,replay:true}));
 }finally{globalThis.fetch=originalFetch;await store.close()}
});
