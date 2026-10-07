import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {runtime} from '../server/runtime';
import {withBasilPlantUses} from '../server/plant-basil';
import {createHarborLife} from '../server/life-assembly';
import {createPlantsRegistry} from '../server/life-plants-b2';
import {initial,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {mintNode,mintItem,type PlantUsesSave,type PlantUseVerb} from '../src/life/plant-uses';
import {mintDefinitionHash,assertPlantUsesReadable} from '../server/plant-uses-rules';
import {applyPlantUse} from '../server/plant-uses-rules';
import {lifeSnapshotKey} from '../src/life/snapshot';
import {sampleAnimal} from '../server/animal-life';
import {pinLegacy,addLot} from '../src/life/save';
// @ts-expect-error frozen authority adapter
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const seed=(scene='cafe'):PlantUsesSave=>({...initial('en',randomUUID()),scene,position:rooms[scene].spawn,visited:Object.keys(rooms),known:['theo','dani'],flags:['key','unpacked'],items:{'crop-basil':3}});
const b2=withBasilPlantUses(createHarborLife(runtime));
function action(s:PlantUsesSave,v:PlantUseVerb):Action{const bag=v==='close-basil'||v==='archive-mint',wild=v==='observe-mint'||v==='collect-mint',entity=rooms[s.scene].entities.find(e=>e.person===(v==='share-mint'?'dani':'theo'));return {action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:bag?s.position:wild?mintNode.approach:entity!.approach,target:bag?'life-bag':wild?mintNode.id:entity!.id,action:'plant-use:'+v};}
const next=async(s:PlantUsesSave,v:PlantUseVerb,host=b2)=>(await host.runtime.prepare(s,action(s,v))).head as PlantUsesSave;
async function accepted(s=seed()){return next(await next(s,'read-offer'),'accept-basil');}
async function rejects(s:PlantUsesSave,a:Action,re:RegExp,host=b2){const before=structuredClone(s);await assert.rejects(host.runtime.prepare(s,a),re);assert.deepEqual(s,before);}

test('basil disabled stops new offers but settles accepted order; mint commands closed and 623 records survive pure reads',async()=>{
 const disabled=withBasilPlantUses(createHarborLife(runtime),{enabled:false});const s=await accepted();
 await rejects(seed(),action(seed(),'read-offer'),/PLANT_USES_CLOSED/,disabled);assert.equal(disabled.lifeProject(s).plantUses.basilEnabled,false);
 assert.equal((await next(s,'deliver-basil',disabled)).cash,32);
 const r=createPlantsRegistry(),mint=applyPlantUse(seed('hill'),'collect-mint',randomUUID(),r,true).head;
 const before=structuredClone(mint);assert.equal(b2.lifeProject(mint).plantUses.mintEnabled,false);assert.equal(b2.lifeProject(mint).plantUses.wildFixtureOnly,false);assert.deepEqual(mint,before);
 for(const v of ['observe-mint','collect-mint','archive-mint','share-mint'] as const)await rejects(mint,{...action(mint,'archive-mint'),action:'plant-use:'+v},/MINT_CONTENT_CLOSED/);
 assert.equal(mint.items[mintItem],1);assert.equal(mint.plantUsesV1!.mint!.definitionHash,mintDefinitionHash);
});
test('new resident actions preserve animal notebook and invalidate previous sample, without a second plants assembly',async()=>{
 let s:any={...seed('station'),position:{x:750,y:680},known:['mara','theo']},p;
 for(let y=680;y<=840&&!p;y+=4)for(let x=720;x<=840;x+=4)try{b2.runtime.position(s,{x,y});sampleAnimal(s,'harbor-cat-1',{x,y});p={x,y};break}catch{}
 assert.ok(p);s=(await b2.runtime.prepare(s,{action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:p,target:'harbor-cat-1',action:'animal-life:sample',payload:{command:{verb:'sample'}}})).head;
 const before=structuredClone(s.animalNotebookV1);assert.ok(before.sample);s={...s,scene:'cafe',position:rooms.cafe.spawn};
 const after:any=await next(s,'read-offer');assert.equal(after.animalNotebookV1.sample,undefined);delete before.sample;assert.deepEqual(after.animalNotebookV1,before);assert.equal(b2.lifeProject(after).animals.sample,null);
 assert.equal(b2.lifeProject(after).plants!.newStarts,true);assert.deepEqual(b2.landProject({...after,scene:'hill',position:rooms.hill.spawn},new URLSearchParams({region:'hill-edge'})),createHarborLife(runtime).landProject({...after,scene:'hill',position:rooms.hill.spawn},new URLSearchParams({region:'hill-edge'})));
});
test('new projection dependency includes order state; legacy seeds remain unrestricted and invalid records fail safely',async()=>{
 const s=seed();assert.notEqual(lifeSnapshotKey(s),lifeSnapshotKey({...s,plantUsesV1:{schema:1,deliveries:1}} as any));
 const r=createPlantsRegistry();let legacy=seed();legacy.items['seed-basil']=99999;legacy=await next(legacy,'read-offer');
 const saved=(await b2.runtime.prepare(legacy,{action_id:randomUUID(),expected_version:legacy.version,scene:legacy.scene,position:legacy.position,target:'life-bag',action:'life:save-seed',payload:{command:{verb:'save-seed',ref:r.ref('crop:basil')}}})).head;assert.equal(saved.items['seed-basil'],100000);
 for(const shape of [null,{schema:1,deliveries:0,order:null},{schema:1,deliveries:0,mint:0},{schema:1,deliveries:0,secondMint:true}])assert.throws(()=>b2.runtime.assertReadable({...s,plantUsesV1:shape} as any),/UNSUPPORTED_PLANT_USES_SAVE/);
});

test('projection is pure, legacy stock remains unpinned until action, read premise and full delivery exact deltas',async()=>{
 let s=seed();const before=structuredClone(s);assert.equal(b2.lifeProject(s).plantUses.offerRead,false);assert.deepEqual(s,before);assert.equal(s.lifeV1,undefined);
 await rejects(s,action(s,'accept-basil'),/ORDER_PREMISE_UNREAD/);s=await accepted(s);assert.equal(s.plantUsesV1!.order!.dueMinute,3900);assert.equal(s.cash,25);assert.equal(s.items['crop-basil'],3);
 s=await next(s,'deliver-basil');assert.deepEqual([s.cash,s.items['crop-basil'],s.relations.theo,s.items['life-gift:theo-menu']],[32,1,2,1]);assert.equal(s.plantUsesV1!.order,undefined);assert.equal(s.lifeV1!.cooldownUntil,3420);assert.equal(s.plantUsesV1!.deliveries,1);b2.runtime.assertReadable(s);
 const memory=await next(s,'recall-delivery');assert.equal(memory.cash,s.cash);assert.deepEqual(memory.items,s.items);
});
test('trusted spatial gates: unknown resident, fake target/actor, far away, wrong scene, client proof and stale version',async()=>{
 const s=seed();await rejects({...s,known:[]},action(s,'read-offer'),/INTRODUCE_FIRST/);await rejects(s,{...action(s,'read-offer'),target:'crop-counter'},/PLANT_USE_TARGET/);await rejects(s,{...action(s,'read-offer'),position:rooms.cafe.spawn},/TOO_FAR/);
 await rejects(s,{...action(s,'read-offer'),actorPosition:{x:0,y:0}},/INVALID_ACTOR_POSITION/);await rejects(s,{...action(s,'read-offer'),scene:'grocery'},/SCENE_MISMATCH/);await rejects(s,{...action(s,'read-offer'),payload:{premiseRead:true}},/INVALID_PLANT_USE_COMMAND/);await rejects(s,{...action(s,'read-offer'),expected_version:99},/VERSION_CONFLICT/);
});
test('cash cap, missing goods, due exact boundary retain all inventory; expiry closes without reward',async()=>{
 const s=await accepted();await rejects({...s,cash:993},action(s,'deliver-basil'),/PURSE_FULL/);
 let empty=structuredClone(s);empty.items['crop-basil']=1;empty.lifeV1!.lots.find(l=>l.ref.id==='crop:basil'&&l.kind==='produce')!.quantity=1;await rejects(empty,action(empty,'deliver-basil'),/ITEMS_MISSING/);
 await rejects(s,action(s,'close-basil'),/ORDER_NOT_EXPIRED/);const late={...s,townMinutes:3900};await rejects(late,action(late,'deliver-basil'),/PERSON_AWAY|SHOP_CLOSED|ORDER_EXPIRED/);const closed=await next(late,'close-basil');assert.equal(closed.cash,25);assert.equal(closed.items['crop-basil'],3);assert.equal(closed.lifeV1!.cooldownUntil,6780);assert.equal(closed.plantUsesV1!.order,undefined);
 const edge=await next({...s,townMinutes:3899},'deliver-basil');assert.equal(edge.cash,32);
});
test('old/new orders share one slot; old first reward and three-day expiry cooldown unchanged',async()=>{
 const r=createPlantsRegistry();let s=pinLegacy(seed(),r) as PlantUsesSave;addLot(s,r,r.ref('crop:snap-pea'), 'produce',2,'old-fixture-harvest');s.lifeV1!.order={id:'old-fixture-order',definition:'theo-peas-v1',crop:r.ref('crop:snap-pea'),quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};
 s=await next(s,'read-offer');await rejects(s,action(s,'accept-basil'),/ORDER_ACTIVE/);const old=structuredClone(s.lifeV1!.order);
 const expired={...s,townMinutes:3900};const closed=(await b2.runtime.prepare(expired,{action_id:randomUUID(),expected_version:expired.version,scene:expired.scene,position:expired.position,target:'life-bag',action:'life:close-order',payload:{command:{verb:'close-order'}}})).head;assert.equal(closed.lifeV1!.cooldownUntil,8220);assert.deepEqual(s.lifeV1!.order,old);
 const basil=await accepted();await rejects(basil,{action_id:randomUUID(),expected_version:basil.version,scene:basil.scene,position:basil.position,target:'theo',action:'life:accept-order',payload:{command:{verb:'accept-order',ref:r.ref('crop:snap-pea')}}},/ORDER_ACTIVE/);
});
test('first gift shared with old delivery and repeat basil orders; new starts closed still settles accepted order',async()=>{
 let s=await next(await accepted(),'deliver-basil');const first=structuredClone(s.lifeV1!.collections),gift=s.items['life-gift:theo-menu'];s={...s,townMinutes:3420};s=await accepted(s);const stopped=withBasilPlantUses(createHarborLife(runtime),{newStarts:false});await rejects(s,action(s,'read-offer'),/PLANT_USES_STARTS_CLOSED/,stopped);
 const r=createPlantsRegistry();addLot(s,r,r.ref('crop:basil'),'produce',2,'next-fixture-harvest');s=await next(s,'deliver-basil',stopped);assert.equal(s.cash,39);assert.equal(s.relations.theo,2);assert.equal(s.items['life-gift:theo-menu'],gift);assert.deepEqual(s.lifeV1!.collections,first);
});
test('actual SQLite CAS and receipt replay: delivery once, changed-payload id rejected, restart keeps delivery and account isolation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-plant-uses-')),config={path:join(dir,'qa.sqlite'),worldId:'plant-uses-qa',gameId:'plant-uses-qa'};let store=openAsyncSqliteAuthorityStore(config);
 try{const host=withBasilPlantUses(createHarborLife({...runtime,initial:(_l:any,id:string)=>({...seed(),id})}));let authority=new AsyncSessionAuthority(store,host.runtime);let s:PlantUsesSave=await authority.create('fixture-owner',randomUUID(),'en');for(const v of ['read-offer','accept-basil'] as const)s=(await authority.action('fixture-owner',s.id,action(s,v))).head;
 const a=action(s,'deliver-basil'),other={...a,action_id:randomUUID()},race=await Promise.allSettled([authority.action('fixture-owner',s.id,a),authority.action('fixture-owner',s.id,other)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);const win=race[0].status==='fulfilled'?a:other;s=await authority.get('fixture-owner',s.id);assert.equal(s.cash,32);assert.equal(s.items['crop-basil'],1);await authority.action('fixture-owner',s.id,win);assert.deepEqual(await authority.get('fixture-owner',s.id),s);
 await assert.rejects(authority.action('fixture-owner',s.id,{...win,action:'plant-use:read-offer'}));await store.close();store=openAsyncSqliteAuthorityStore(config);authority=new AsyncSessionAuthority(store,withBasilPlantUses(createHarborLife(runtime),{newStarts:false}).runtime);assert.deepEqual(await authority.get('fixture-owner',s.id),s);await assert.rejects(authority.get('another-owner',s.id));
 }finally{await store.close();rmSync(dir,{recursive:true,force:true})}
});
