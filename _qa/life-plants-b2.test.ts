import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initial,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {runtime} from '../server/runtime';
import {createLifeB2} from '../server/life-b2';
import {createLifePlantsB2,createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {ContentRegistry,snapPeaDefinition,definitionHash} from '../src/life/registry';
import {pinLegacy,addLot,sameRef} from '../src/life/save';
import {lifePlotStatus} from '../src/life/rules';
import {landWorld,landFootprint} from '../src/life/land';
import {dynamicWorld} from '../src/dynamic-assets/layout';
import {walkable,findPath} from '../src/engine/world';
import type {Command,LifeSave} from '../src/life/types';
import art from '../src/world/snap-pea-art.json';
// @ts-expect-error frozen async authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const seed=(scene='courtyard'):LifeSave=>({...initial('en',randomUUID()),scene,position:{...rooms[scene].spawn},visited:Object.keys(rooms),flags:['key','unpacked','garden-agreed','alternative-route'],items:{'seed-basil':2,'crop-basil':3},plots:{'crop-bed-2':{crop:'basil',grown:200,updatedAt:500,wetUntil:1220}},landV1:{schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'fixture-permission',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},minute:540,sourceAction:'fixture-bed'}]}});
function action(s:LifeSave,c:Command):Action{const counter=c.verb==='buy-seed'||c.verb==='sell',bed=c.verb==='plant'||c.verb==='water'||c.verb==='harvest';return {action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:counter?rooms.grocery.entities.find(e=>e.id==='crop-counter')!.approach:bed?{x:280,y:622}:s.position,target:counter?'crop-counter':bed?'land-bed-1':'life-bag',action:'life:'+c.verb,payload:{command:c}}}
const next=async(s:LifeSave,c:Command,b2=createLifePlantsB2(runtime))=>(await b2.runtime.prepare(s,action(s,c))).head;

test('pins: original @1 file untouched, definition unchanged, five byte hashes bound only to @2',()=>{
 const original=new ContentRegistry([snapPeaDefinition]).ref('crop:snap-pea'),r=createPlantsRegistry();assert.deepEqual(r.ref('crop:snap-pea'),original);assert.equal(r.get(original).assets.length,0);assert.equal(r.get(snapPeaV2Ref).assets.length,5);assert.equal(definitionHash(r.get(snapPeaV2Ref)),snapPeaV2Ref.hash);assert.equal(r.canStart(original),false);assert.equal(r.canStart(snapPeaV2Ref),true);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../src/life/registry.ts',import.meta.url))).digest('hex'),'92ad54a6c6e601a929f663d2eb8435ba76b4ebde1cc4725660877cd105693f38');
 for(const f of Object.values(art.files))assert.equal(createHash('sha256').update(readFileSync(new URL('../public/'+f.image.slice(2),import.meta.url))).digest('hex'),f.sha256);
});
test('pure GET, default B2 remains closed, bad hash/target/distance/fake or wrong-scene bed rejected without mutation',async()=>{
 const b2=createLifePlantsB2(runtime),s=seed('grocery'),before=structuredClone(s);assert.ok(b2.lifeProject(s).plants);assert.deepEqual(s,before);assert.equal(s.lifeV1,undefined);
 const reject=async(v:LifeSave,c:Command,pattern:RegExp,patch:Partial<Action>={})=>{const frozen=structuredClone(v);await assert.rejects(b2.runtime.prepare(v,{...action(v,c),...patch}),pattern);assert.deepEqual(v,frozen)};
 await assert.rejects(createLifeB2(runtime).runtime.prepare(s,action(s,{verb:'buy-seed',ref:snapPeaV2Ref})),/LIFE_SPATIAL_NOT_ADMITTED/);
 await reject(s,{verb:'buy-seed',ref:{...snapPeaV2Ref,hash:'0'.repeat(64)}},/CONTENT_REF_MISMATCH/);
 await reject(s,{verb:'buy-seed',ref:snapPeaV2Ref},/LIFE_TARGET/,{target:'bed'});
 await reject(s,{verb:'buy-seed',ref:snapPeaV2Ref},/TOO_FAR/,{position:rooms.grocery.spawn});
 await reject(s,{verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-1'},/PLOT_ADMISSION_REQUIRED/,{position:s.position});
 await reject(seed(),{verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-2'},/PLOT_ADMISSION_REQUIRED/);
});
test('actual bound bed loop: dry pause, growth, full yield, save seed and repeat with exact costs',async()=>{
 const b2=createLifePlantsB2(runtime),r=createPlantsRegistry();let s=await next(seed('grocery'),{verb:'buy-seed',ref:snapPeaV2Ref},b2);assert.deepEqual([s.cash,s.energy,s.townMinutes],[19,100,540]);
 // Unit fixtures relocate/read clocks explicitly; real input workflow is separately tested.
 s={...s,scene:'courtyard',position:rooms.courtyard.spawn};s=await next(s,{verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-1'},b2);assert.deepEqual([s.energy,s.townMinutes],[98,550]);assert.equal(lifePlotStatus({...s,townMinutes:1000},'life-bed-1',r)!.grown,0);
 s=await next(s,{verb:'water',plot:'life-bed-1'},b2);assert.deepEqual([s.energy,s.townMinutes],[96,560]);await assert.rejects(next(s,{verb:'water',plot:'life-bed-1'},b2),/WATER_UNAVAILABLE/);await assert.rejects(next(s,{verb:'harvest',plot:'life-bed-1'},b2),/CROP_NOT_READY/);
 s={...s,townMinutes:1270};assert.equal(lifePlotStatus(s,'life-bed-1',r)!.ready,true);s=await next(s,{verb:'harvest',plot:'life-bed-1'},b2);assert.equal(s.items['life-produce:snap-pea'],3);assert.equal(s.lifeV1!.plots['life-bed-1'],undefined);
 s=await next(s,{verb:'save-seed',ref:snapPeaV2Ref},b2);assert.deepEqual([s.items['life-produce:snap-pea'],s.items['life-seed:snap-pea']],[2,1]);const record=structuredClone(s.lifeV1!.collections['seed:crop:snap-pea']);assert.ok(sameRef(record.ref!,snapPeaV2Ref));
 s=await next(s,{verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-1'},b2);assert.deepEqual(s.lifeV1!.collections['seed:crop:snap-pea'],record);assert.equal(s.items['life-seed:snap-pea'],0);b2.runtime.assertReadable(s);
});
test('choices and shop boundary: all-sell $12 vs keep-one/sell-two $8+seed; closed shop and purse never consume',async()=>{
 const b2=createLifePlantsB2(runtime),r=createPlantsRegistry();let base=pinLegacy(seed('grocery'),r);addLot(base,r,snapPeaV2Ref,'produce',3,'fixture-harvest');
 let all=structuredClone(base);for(let i=0;i<3;i++)all=await next(all,{verb:'sell',ref:snapPeaV2Ref},b2);assert.equal(all.cash,37);
 let keep=await next(base,{verb:'save-seed',ref:snapPeaV2Ref},b2);for(let i=0;i<2;i++)keep=await next(keep,{verb:'sell',ref:snapPeaV2Ref},b2);assert.deepEqual([keep.cash,keep.items['life-seed:snap-pea']],[33,1]);
 for(const [s,pattern] of [[{...base,townMinutes:1020},/SHOP_CLOSED/],[{...base,cash:999},/PURSE_FULL/]] as const){const before=structuredClone(s);await assert.rejects(next(s,{verb:'sell',ref:snapPeaV2Ref},b2),pattern);assert.deepEqual(s,before)}
});
test('old @1 active/produce/collection settles at old ref; starts off preserves harvest and no pin replacement',async()=>{
 const b2=createLifePlantsB2(runtime,false),r=createPlantsRegistry(false),old=r.ref('crop:snap-pea');let s=pinLegacy(seed(),r);s.lifeV1!.plots['life-bed-1']={ref:old,grown:720,updatedAt:540,wetUntil:540};const oldRoot=structuredClone(s.plots);s=await next(s,{verb:'harvest',plot:'life-bed-1'},b2);assert.equal(s.lifeV1!.lots.find(l=>l.kind==='produce'&&l.ref.id===old.id)!.ref.revision,1);
 s=await next(s,{verb:'save-seed',ref:old},b2);const record=structuredClone(s.lifeV1!.collections['seed:crop:snap-pea']);s={...s,scene:'grocery',position:rooms.grocery.spawn};s=await next(s,{verb:'sell',ref:old},b2);assert.equal(s.cash,29);assert.deepEqual(s.plots,oldRoot);assert.deepEqual(s.lifeV1!.collections['seed:crop:snap-pea'],record);
 addLot(s,r,snapPeaV2Ref,'produce',1,'fixture-v2-harvest');s=await next(s,{verb:'save-seed',ref:snapPeaV2Ref},b2);assert.deepEqual(s.lifeV1!.collections['seed:crop:snap-pea'],record);await assert.rejects(next(s,{verb:'buy-seed',ref:snapPeaV2Ref},b2),/CONTENT_NOT_ENABLED/);assert.ok(b2.lifeProject(s).plants?.newStarts===false);
});
test('real land collider and route, no crop-sized collision extension',()=>{const s=seed(),w=landWorld(dynamicWorld(s.flags,true),s.landV1),foot=landFootprint(s.landV1!.plots[0].at);assert.ok(w.scenes.courtyard.obstacles.some(o=>JSON.stringify(o)===JSON.stringify(foot)));assert.equal(walkable(w,'courtyard',{x:280,y:592}),false);assert.ok(findPath(w,'courtyard',rooms.courtyard.spawn,{x:280,y:622}).length);assert.deepEqual(art.profile.root,[127.5,217]);assert.equal(art.profile.scale,10/72)});
test('SQLite CAS: racing buy yields one seed, repeat receipt/reopen stable, stop-start retains pinned batch',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-plants-')),config={path:join(dir,'qa.sqlite'),worldId:'plants-qa',gameId:'plants-qa'};let store=openAsyncSqliteAuthorityStore(config);
 const b2=createLifePlantsB2({...runtime,initial:(_l:any,id:string)=>({...seed('grocery'),id})});
 try{let authority=new AsyncSessionAuthority(store,b2.runtime),s:LifeSave=await authority.create('fixture-owner',randomUUID(),'en');const a=action(s,{verb:'buy-seed',ref:snapPeaV2Ref}),other={...a,action_id:randomUUID()},race=await Promise.allSettled([authority.action('fixture-owner',s.id,a),authority.action('fixture-owner',s.id,other)]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);const winner=race[0].status==='fulfilled'?a:other;s=await authority.get('fixture-owner',s.id);assert.deepEqual([s.version,s.cash,s.items['life-seed:snap-pea']],[1,19,1]);await authority.action('fixture-owner',s.id,winner);assert.deepEqual(await authority.get('fixture-owner',s.id),s);await store.close();store=openAsyncSqliteAuthorityStore(config);authority=new AsyncSessionAuthority(store,createLifePlantsB2(runtime,false).runtime);assert.deepEqual(await authority.get('fixture-owner',s.id),s);await authority.action('fixture-owner',s.id,winner);assert.deepEqual(await authority.get('fixture-owner',s.id),s);
 }finally{await store.close();rmSync(dir,{recursive:true,force:true})}
});

test('unbound old logical plot cannot silently acquire a newly cultivated bed position',async()=>{
 const r=createPlantsRegistry(),b2=createLifePlantsB2(runtime);let s=pinLegacy(seed(),r);s.landV1!.plots=[];s.lifeV1!.plots['life-bed-1']={ref:r.ref('crop:snap-pea'),grown:100,updatedAt:540,wetUntil:1260};const before=structuredClone(s),c:Command={verb:'cultivate',region:'courtyard-common',at:{x:288,y:604}};await assert.rejects(b2.runtime.prepare(s,{...action(s,c),target:'land-candidate:courtyard-common:288:604',position:{x:280,y:622}}),/ARCHIVED_PLOT_NEEDS_BINDING/);assert.deepEqual(s,before);assert.equal(b2.landProject(s,new URLSearchParams({region:'courtyard-common',x:'288',y:'604'})).reason,'ARCHIVED_PLOT_NEEDS_BINDING');
});

test('crop host binds the second authored region to its actual hill bed, not courtyard coordinates',async()=>{
 const b2=createLifePlantsB2(runtime),r=createPlantsRegistry();let s=pinLegacy(seed('hill'),r);
 s.landV1={schema:1,permissions:{'hill-edge':{revision:1,sourceAction:'fixture-permission',minute:540}},plots:[{id:'land-bed-1',region:'hill-edge',geometryRevision:1,at:{x:500,y:800},minute:540,sourceAction:'fixture-hill-bed'}]};
 addLot(s,r,snapPeaV2Ref,'seed',1,'fixture-hill-seed');const c:Command={verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-1'},a={...action(s,c),position:{x:492,y:818}};
 s=(await b2.runtime.prepare(s,a)).head;assert.equal(b2.lifeProject(s).plants!.plots[0].scene,'hill');assert.deepEqual(b2.lifeProject(s).plants!.plots[0].at,{x:500,y:800});
 await assert.rejects(b2.runtime.prepare(s,{...action(s,{verb:'water',plot:'life-bed-1'}),position:rooms.hill.spawn}),/TOO_FAR/);
 s=(await b2.runtime.prepare(s,{...action(s,{verb:'water',plot:'life-bed-1'}),position:{x:492,y:818}})).head;assert.deepEqual([s.energy,s.townMinutes],[96,560]);b2.runtime.assertReadable(s);
});
