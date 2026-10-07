import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initial,type Save,type Action} from '../src/story/state';
import {rooms,type Entity} from '../src/world/data';
import {landRegions,landEntity,landGeometry,landPreview,landWorld,landFootprint,landProtection,assertLandReadable} from '../src/life/land';
import {dynamicWorld} from '../src/dynamic-assets/layout';
import {walkable,findPath} from '../src/engine/world';
import {createLifeB2} from '../server/life-b2';
import {runtime} from '../server/runtime';
import type {Command,LifeSave} from '../src/life/types';
// @ts-expect-error frozen async library
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const old=(scene='hill',id:string=randomUUID()):LifeSave=>({...initial('en',id),scene,position:{...rooms[scene].spawn},visited:['station',scene],flags:['key','unpacked','garden-agreed'],items:{'crop-basil':3,'seed-tomato':2},plots:{'crop-bed-2':{crop:'basil',grown:200,updatedAt:500,wetUntil:1220}}});
const action=(s:Save,c:Command,p?:{x:number;y:number}):Action=>{const land=c.verb==='permit-land'||c.verb==='cultivate',entity=land?landEntity(c.region,c.verb==='cultivate'?c.at:undefined):null;return {action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:p??entity?.approach??s.position,target:entity?.id??'life-bag',action:'life:'+c.verb,payload:{command:c}}};
const granted=(s:Save)=>({...s,landV1:{schema:1 as const,permissions:{[landRegions.find(r=>r.scene===s.scene)!.id]:{revision:1 as const,sourceAction:'synthetic-permission',minute:540}},plots:[]}});

test('B2 projections/preview are pure, legacy three beds and old passage do not grant cultivation',async()=>{
 const b2=createLifeB2(runtime),s=old(),before=structuredClone(s);
 assert.equal(b2.lifeProject(s).persistence,'legacy-unpinned');assert.equal(landPreview(s,'hill-edge',{x:500,y:800}).canConfirm,false);assert.deepEqual(s,before);assert.equal(s.lifeV1,undefined);assert.equal(s.landV1,undefined);
 const courtyard=old('courtyard');assert.equal(landPreview(courtyard,'courtyard-common',{x:288,y:604}).permitted,false);
 await assert.rejects(b2.runtime.prepare(s,action(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}})),/LAND_PERMISSION/);assert.deepEqual(s,before);
});
test('B2 both author regions: explicit permit then exact costs, immutable legacy data and rendered collision',async()=>{
 const b2=createLifeB2(runtime);
 for(const r of landRegions){const oldSave=old(r.scene),at=r.scene==='hill'?{x:500,y:800}:{x:288,y:604};
  const permission=await b2.runtime.prepare(oldSave,action(oldSave,{verb:'permit-land',region:r.id}));let s=permission.head;
  assert.equal(s.lifeV1,undefined);assert.deepEqual([s.cash,s.energy,s.townMinutes],[25,100,540]);
  await assert.rejects(b2.runtime.prepare(s,action(s,{verb:'permit-land',region:r.id})),/LAND_ALREADY_PERMITTED/);
  const result=await b2.runtime.prepare(s,action(s,{verb:'cultivate',region:r.id,at}));s=result.head;
  assert.deepEqual([s.cash,s.energy,s.townMinutes,s.awakeMinutes,s.landV1!.plots.length],[25,96,560,20,1]);assert.equal(s.lifeV1,undefined);
  assert.deepEqual(s.plots,oldSave.plots);assert.deepEqual(s.flags,oldSave.flags);assert.deepEqual(s.items,oldSave.items);assert.deepEqual(s.position,landEntity(r.id,at).approach);
  const w=landWorld(dynamicWorld(s.flags,true),s.landV1);assert.ok(w.scenes[r.scene].obstacles.some(o=>JSON.stringify(o)===JSON.stringify(landFootprint(at))));assert.equal(walkable(w,r.scene,{x:at.x-8,y:at.y-12}),false);assert.ok(findPath(w,r.scene,s.position,rooms[r.scene].spawn).length);b2.runtime.assertReadable(s);
 }
});
test('B2 rejection never mutates: outside/unknown/old-player/current-player/overlap/capacity/locks/energy',async()=>{
 const b2=createLifeB2(runtime);let s=granted(old());
 const rejects=async(v:Save,c:Command,pattern:RegExp,p?:{x:number;y:number})=>{const before=structuredClone(v);await assert.rejects(b2.runtime.prepare(v,action(v,c,p)),pattern);assert.deepEqual(v,before)};
 await rejects(s,{verb:'cultivate',region:'hill-edge',at:{x:648,y:920}},/LAND_OUTSIDE/);
 await rejects(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/TOO_FAR/,{x:90,y:534});
 await rejects({...s,position:{x:492,y:788}},{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/LAND_PLAYER_SPACE/);
 await rejects(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/LAND_PLAYER_SPACE/,{x:492,y:788});
 await rejects({...s,energy:3},{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/REST_NEEDED/);
 await rejects({...s,activeChallenge:{id:'qa',scene:'hill',kind:'sparring'}},{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/CHALLENGE_ACTIVE/);
 const malformed=action(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}});(malformed.payload as any).command.at.z=0;assert.throws(()=>b2.runtime.validateAction(malformed),/INVALID_LIFE_COMMAND/);
 await assert.rejects(b2.runtime.prepare(s,{...action(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}}),target:'crop-bed-1'}),/LAND_TARGET/);
 s=(await b2.runtime.prepare(s,action(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}}))).head as any;
 await rejects(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}},/LAND_OVERLAP/);
 s=(await b2.runtime.prepare(s,action(s,{verb:'cultivate',region:'hill-edge',at:{x:552,y:840}}))).head as any;
 await rejects(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:840}},/LAND_CAPACITY|LAND_OVERLAP/);assert.equal(s.landV1!.plots.length,2);
 await assert.rejects(b2.runtime.prepare(s,action(s,{verb:'observe-animal',animal:'harbor-cat-1',behavior:'sun-rest'})),/LIFE_SPATIAL_NOT_ADMITTED/);
});
test('B2 strict save validation and future generic resident protection, fatigue delta is previewed',async()=>{
 const s=granted(old()),before=structuredClone(s);assertLandReadable(s);
 for(const l of [{...s.landV1,extra:true},{...s.landV1,schema:2},{...s.landV1,permissions:{fake:{revision:1,sourceAction:'x',minute:0}}},{...s.landV1,plots:[null]}])assert.throws(()=>assertLandReadable({...s,landV1:l as any}));
 const future:Entity[]=[...rooms.hill.entities,...[1,2,3].map(n=>({id:'future-'+n,person:'future-'+n,label:['邻居','Neighbor'] as [string,string],kind:'person' as const,at:{x:500,y:800+n*4},approach:{x:492,y:842+n*4}}))];
 assert.equal(landGeometry(s,'hill-edge',{x:500,y:800},s.position,landProtection('hill',future)),'LAND_PROTECTED');assert.deepEqual(s,before);
 const tired={...s,awakeMinutes:650};assert.equal(landPreview(tired,'hill-edge',{x:500,y:800}).cost.totalEnergy,9);
});
test('B2 actual SQLite CAS/reopen/late receipt: permission and bed persist once, denied actions have no receipts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-b2-')),config={path:join(dir,'qa.sqlite'),worldId:'b2-qa',gameId:'b2-qa'},b2=createLifeB2({...runtime,initial:(_l:any,id:string)=>old('hill',id)});
 let store=openAsyncSqliteAuthorityStore(config);
 try{let authority=new AsyncSessionAuthority(store,b2.runtime),s:Save=await authority.create('synthetic-b2-A',randomUUID(),'en');const p=action(s,{verb:'permit-land',region:'hill-edge'});await authority.action('synthetic-b2-A',s.id,p);s=await authority.get('synthetic-b2-A',s.id);
  const a=action(s,{verb:'cultivate',region:'hill-edge',at:{x:500,y:800}}),other={...a,action_id:randomUUID()};const raced=await Promise.allSettled([authority.action('synthetic-b2-A',s.id,a),authority.action('synthetic-b2-A',s.id,other)]);assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);
  const winner=raced[0].status==='fulfilled'?a:other,head=await authority.get('synthetic-b2-A',s.id);assert.deepEqual([head.version,head.energy,head.townMinutes,head.landV1.plots.length],[2,96,560,1]);
  await authority.action('synthetic-b2-A',s.id,winner);assert.deepEqual(await authority.get('synthetic-b2-A',s.id),head);await assert.rejects(authority.action('synthetic-b2-A',s.id,{...winner,payload:{command:{verb:'cultivate',region:'hill-edge',at:{x:552,y:840}}}}),/ACTION_ID_CONFLICT/);
  await assert.rejects(authority.get('synthetic-b2-B',s.id),/SESSION_NOT_FOUND/);await store.close();store=openAsyncSqliteAuthorityStore(config);authority=new AsyncSessionAuthority(store,b2.runtime);assert.deepEqual(await authority.get('synthetic-b2-A',s.id),head);await authority.action('synthetic-b2-A',s.id,p);assert.deepEqual(await authority.get('synthetic-b2-A',s.id),head);
  const bad=action(head,{verb:'news-memento',edition:'unverified'});await assert.rejects(authority.action('synthetic-b2-A',s.id,bad),/LIFE_SPATIAL_NOT_ADMITTED/);await store.transaction(async(repo:any)=>{assert.equal((await repo.events(s.id,-1)).length,2);assert.ok(!(await repo.receipt('synthetic-b2-A',bad.action_id)))});
 }finally{await store.close();rmSync(dir,{recursive:true,force:true})}
});
