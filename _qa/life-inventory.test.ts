import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initial,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {ContentRegistry,snapPeaDefinition} from '../src/life/registry';
import {addLot,pinLegacy} from '../src/life/save';
import {lifeView} from '../server/life-view';
import {createInventoryLifeHost,lifeBagTarget} from '../server/life-inventory-host';
import {createLifeRuntime} from '../server/life-runtime';
import {runtime} from '../server/runtime';
import type {Command,LifeSave} from '../src/life/types';
// @ts-expect-error pinned runtime has no declaration
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

const old=(id:string=randomUUID()):LifeSave=>({...initial('en',id),scene:'garden',position:rooms.garden.spawn,items:{key:1,'crop-basil':3},flags:['key','unpacked']});
const action=(s:LifeSave,c:Command):Action=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:lifeBagTarget,action:'life:'+c.verb,payload:{command:c}});
test('B2 read view: old raw save remains unpinned; versioned inventory and consumed-seed discovery remain distinct',()=>{
 const r=new ContentRegistry([snapPeaDefinition,{...snapPeaDefinition,revision:2,seedCost:7,yield:2,salePrice:5}]);
 const s=old(),before=structuredClone(s),view=lifeView(s,r);
 assert.equal(view.persistence,'legacy-unpinned');assert.equal(view.batches[0].quantity,3);assert.deepEqual(view.collections,[]);assert.deepEqual(s,before);
 view.batches[0].quantity=999;view.batches[0].ref.hash='0'.repeat(64);assert.deepEqual(s,before);
 const q=pinLegacy(s,r),v1=r.ref('crop:snap-pea'),v2=r.ref('crop:snap-pea',2);
 addLot(q,r,v1,'produce',1,'qa-v1');addLot(q,r,v2,'produce',4,'qa-v2');
 q.lifeV1!.collections['seed:crop:snap-pea']={id:'seed:crop:snap-pea',ref:v1,minute:540,sourceAction:'qa-consumed-seed'};
 q.lifeV1!.order={id:'qa-order',definition:'theo-peas-v1',crop:v1,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};
 const dto=lifeView(q,r);assert.equal(dto.batches.filter(b=>b.ref.id==='crop:snap-pea').length,2);
 assert.equal(dto.order!.availablePinnedProduce,1);assert.equal(dto.order!.closeAvailable,false);
 assert.equal(dto.collections[0].physicalSeedQuantity,0);assert.equal(dto.collections[0].isRecord,true);
 q.townMinutes=3900;assert.equal(lifeView(q,r).order!.status,'expired');assert.equal(lifeView(q,r).order!.closeAvailable,true);
});
test('B2 explicit bag bindings reject every spatial/source verb and spoofed target; expiry retains exact version goods',async()=>{
 const r=new ContentRegistry([snapPeaDefinition]),rt=createLifeRuntime(runtime,r,createInventoryLifeHost()),s=old();
 const commands:Command[]=[{verb:'buy-seed',ref:r.ref('crop:snap-pea')},{verb:'plant',ref:r.ref('crop:snap-pea'),plot:'life-bed-1'},{verb:'water',plot:'life-bed-1'},{verb:'harvest',plot:'life-bed-1'},{verb:'sell',ref:r.ref('crop:basil')},{verb:'accept-order',ref:r.ref('crop:snap-pea')},{verb:'deliver-order'},{verb:'share-dani'},{verb:'observe-animal',animal:'harbor-cat-1',behavior:'sun-rest'},{verb:'display-gift',slot:'home-shelf-1'},{verb:'news-memento',edition:'qa-unverified'}];
 for(const c of commands)await assert.rejects(rt.prepare(s,action(s,c)),/LIFE_INVENTORY_NOT_ADMITTED/);
 await assert.rejects(rt.prepare(s,{...action(s,{verb:'save-seed',ref:r.ref('crop:basil')}),target:'crop-counter'}),/LIFE_INVENTORY_NOT_ADMITTED/);
 const q=pinLegacy(s,r),ref=r.ref('crop:snap-pea');addLot(q,r,ref,'produce',2,'qa-harvest');
 q.lifeV1!.order={id:'qa-expiring-order',definition:'theo-peas-v1',crop:ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};
 await assert.rejects(rt.prepare(q,action(q,{verb:'close-order'})),/ORDER_NOT_EXPIRED/);
 q.townMinutes=3900;const closed=await rt.prepare(q,action(q,{verb:'close-order'}));
 assert.equal(closed.head.lifeV1!.order,undefined);assert.equal(closed.head.items['life-produce:snap-pea'],2);assert.equal(closed.head.cash,q.cash);
});
test('B2 actual SQLite bag action: read is zero write; first conversion pins once with receipt/reopen and denied spatial action zero writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-life-inventory-')),config={path:join(dir,'qa.sqlite'),worldId:'qa-inventory',gameId:'qa-inventory'},r=new ContentRegistry();
 let store=openAsyncSqliteAuthorityStore(config);const rt=createLifeRuntime({...runtime,initial:(_locale:any,id:string)=>old(id)},r,createInventoryLifeHost());
 try{
  let authority=new AsyncSessionAuthority(store,rt),s:LifeSave=await authority.create('synthetic-inventory-owner',randomUUID(),'en');
  lifeView(s,r);assert.deepEqual(await authority.get('synthetic-inventory-owner',s.id),s);assert.equal(s.lifeV1,undefined);
  const cmd=action(s,{verb:'save-seed',ref:r.ref('crop:basil')});await authority.action('synthetic-inventory-owner',s.id,cmd);
  const head:LifeSave=await authority.get('synthetic-inventory-owner',s.id);assert.deepEqual([head.items['crop-basil'],head.items['seed-basil'],head.lifeV1!.events.length,head.version],[2,1,1,1]);
  await authority.action('synthetic-inventory-owner',s.id,cmd);assert.deepEqual(await authority.get('synthetic-inventory-owner',s.id),head);
  const denied=action(head,{verb:'water',plot:'life-bed-1'});await assert.rejects(authority.action('synthetic-inventory-owner',s.id,denied),/LIFE_INVENTORY_NOT_ADMITTED/);
  await store.transaction(async(repo:any)=>{assert.equal((await repo.events(s.id,-1)).length,1);assert.ok(!(await repo.receipt('synthetic-inventory-owner',denied.action_id)))});
  await store.close();store=openAsyncSqliteAuthorityStore(config);authority=new AsyncSessionAuthority(store,rt);
  assert.deepEqual(await authority.get('synthetic-inventory-owner',s.id),head);await authority.action('synthetic-inventory-owner',s.id,cmd);assert.deepEqual(await authority.get('synthetic-inventory-owner',s.id),head);
 }finally{await store.close();rmSync(dir,{recursive:true,force:true})}
});
