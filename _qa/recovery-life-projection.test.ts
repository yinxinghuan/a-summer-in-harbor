import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import * as React from 'react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LifeBag} from '../src/ui/LifeBag';
import {LifeCropCounter,LifeCropPanel} from '../src/ui/LifeCropPanel';
import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {rooms,entityAt} from '../src/world/data';
import {createRuntime} from '../server/runtime';
import {createMovingClock} from '../server/candidate-clock';
import {withCompactMotion} from '../server/candidate-motion-authority';
import {createApiHandler} from '../server/http';
import {MotionRejection,motionHttpFailure} from '../server/motion-failure';
import {resolvedMotionFailure} from '../src/candidate/motion-errors';
import {createLifeProjection,lifeProjectionKey,type LifeProjectionHead} from '../src/candidate/life-projection';
import {lifeView} from '../server/life-view';
import {pinLegacy,addLot} from '../src/life/save';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const registry=createPlantsRegistry(),project=(s:any)=>lifeView(s,registry,{ref:snapPeaV2Ref,newStarts:true});
function seed(){
 const s:any=pinLegacy({...initial('en',randomUUID()),version:0,cursor:0,townMinutes:3899,scene:'market',position:{x:597,y:180},flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms)},registry);
 s.landV1={schema:1,permissions:{},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},sourceAction:'fixture',minute:540}]};
 s.lifeV1.plots['life-bed-1']={ref:snapPeaV2Ref,grown:719,updatedAt:3899,wetUntil:4619};
 s.lifeV1.order={id:'existing-order',definition:'theo-peas-v1',crop:snapPeaV2Ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};s.lifeV1.cooldownUntil=3900;
 addLot(s,registry,snapPeaV2Ref,'produce',2,'fixture');return s;
}
const bump=(s:any,extra:any={})=>({...s,version:s.version+1,cursor:s.cursor+1,...extra});
const deferred=<T>()=>{let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const turn=()=>new Promise<void>(r=>queueMicrotask(r));

test('unknown infrastructure results never become authored motion rejections or resolve pending',()=>{
 for(const error of [Error('ECONNRESET'),Object.assign(Error('commit reply lost'),{code:'ECONNRESET',status:400,terminal:true}),Object.assign(Error('VERSION_CONFLICT'),{code:'VERSION_CONFLICT',status:409,terminal:true})])assert.deepEqual(motionHttpFailure(error),{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}});
 assert.deepEqual(motionHttpFailure(new MotionRejection('MOTION_EXPIRED')),{status:409,body:{error:'MOTION_EXPIRED',terminal:true}});
 for(const e of [{message:'ECONNRESET',status:400,terminal:true},{message:'SERVICE_UNAVAILABLE',status:500,terminal:true},{message:'MOTION_EXPIRED',status:503,terminal:true},{message:'AUTH_REQUIRED',status:401,terminal:true},{message:'MOTION_EXPIRED',status:409,terminal:false}])assert.equal(resolvedMotionFailure(e),false);
 assert.equal(resolvedMotionFailure({message:'MOTION_EXPIRED',status:409,terminal:true}),true);
});

test('real SQLite commit ambiguity keeps identical motion pending, resumes once, and old action pending still recovers',async()=>{
 let now=100000,fault:'before'|'after'|undefined,misclassified=false,legacyMisclassified=false;
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'local-recovery',environment:'test'}),owner=randomUUID();
 const clock=createMovingClock({now:()=>now,boot:'recovery'}),runtime={...createRuntime(undefined,undefined,clock),initial:(_l:any,id:string)=>({...seed(),id,lifeV1:undefined,landV1:undefined})};
 const unstable={...store,async transaction(fn:any){const mode=fault;fault=undefined;if(mode==='before')throw Object.assign(Error('ECONNRESET'),{code:'ECONNRESET',status:400,terminal:true});const value=await store.transaction(fn);if(mode==='after')throw Object.assign(Error('commit reply lost'),{code:'ECONNRESET',status:400,terminal:true});return value}};
 const authority=withCompactMotion(new AsyncSessionAuthority(store,runtime),unstable,runtime,clock,()=>now),head=await authority.create(owner,randomUUID(),'en'),api=createApiHandler({authority});
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
 values.set('harbor-journey',head.id);const saved={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'',origin:'http://localhost'}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:any)=>fn()}}});
 const attempts:any[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{const path=String(input).split('/api')[1];if(path==='/bootstrap')return new Response(JSON.stringify({mode:'local-authoring-test'}));const raw=init?.body;if(path.endsWith('/motion')){attempts.push(JSON.parse(raw));if(misclassified){misclassified=false;return new Response(JSON.stringify({error:'ECONNRESET',terminal:true}),{status:400})}}
  const req:any=Readable.from(raw?[Buffer.from(raw)]:[]);req.url='/api'+path;req.method=init?.method??'GET';req.headers={};let status=200,body='';const res:any={writeHead:(s:number)=>status=s,end:(v:any)=>body=String(v)};await api(req,res,owner);if(path.endsWith('/action')&&legacyMisclassified){legacyMisclassified=false;return new Response(JSON.stringify({error:'ECONNRESET',terminal:true}),{status:400})}return new Response(body,{status});
 }) as any;
 try{
  const client=await import('../src/story/client');let s=await client.connect('en');s=(await client.candidateMotion(s,'candidate-clock-enable',s.position,{millisecondsPerMinute:2000})).head;s=(await client.candidateMotion(s,'candidate-motion-open',s.position,{})).head;
  now+=1000;fault='after';await assert.rejects(client.candidateMotion(s,'candidate-motion-step',{x:472,y:608},{lease:s.movingClock!.lease!.id,sequence:1,points:[{x:597,y:608}]}),/SERVICE_UNAVAILABLE/);
  const pendingKey='harbor-pending-v2:'+s.id,envelope=storage.getItem(pendingKey)!;assert.ok(envelope);const committed=await authority.get(owner,s.id);assert.equal(committed.version,s.version+1);
  misclassified=true;await assert.rejects(client.connect('en'),/ECONNRESET/);assert.equal(storage.getItem(pendingKey),envelope);
  s=await client.connect('en');assert.deepEqual(s,committed);assert.equal(storage.getItem(pendingKey),null);const original=JSON.parse(envelope).action;assert.deepEqual(attempts.slice(-3),[original,original,original]);
  fault='before';await assert.rejects(client.candidateMotion(s,'candidate-motion-open',s.position,{}),/SERVICE_UNAVAILABLE/);const before=await authority.get(owner,s.id);assert.equal(before.version,s.version);const retry=storage.getItem(pendingKey)!;s=await client.connect('en');assert.equal(s.version,before.version+1);assert.deepEqual(attempts.slice(-2),[JSON.parse(retry).action,JSON.parse(retry).action]);
  const old:Action={action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'',action:'candidate-clock-enable',payload:{millisecondsPerMinute:4000}};
  const result=await authority.action(owner,s.id,old);storage.setItem(pendingKey,JSON.stringify({id:s.id,action:old}));s=await client.connect('en');assert.equal(s.version,result.head.version);assert.equal(storage.getItem(pendingKey),null);
  legacyMisclassified=true;const uncertain={...old,action_id:randomUUID(),expected_version:s.version,position:s.position,scene:s.scene};await assert.rejects(client.send(s,uncertain),/ECONNRESET/);assert.ok(storage.getItem(pendingKey));const final=await client.connect('en');assert.equal(final.version,s.version+1);assert.equal(final.townMinutes,s.townMinutes);assert.equal(storage.getItem(pendingKey),null);
 }finally{(globalThis as any).window=saved.window;globalThis.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete (globalThis as any).navigator;await store.close()}
});

test('600 harmless clock ACK versions reuse the real B2 DTO without clearing, re-reading or forging snapshot stamps',async()=>{
 let reads=0;const c=createLifeProjection(async h=>{reads++;return project(h)});let s=seed();c.update(s,'account-A:1','40b-plants@2');await c.settled();const first=c.present().view!;assert.equal(first.snapshotVersion,0);
 for(let i=0;i<600;i++){s=bump(s,{energy:98});const before=c.forHead(s,'account-A:1','40b-plants@2');assert.equal(before.current,true);const shown=c.update(s,'account-A:1','40b-plants@2');assert.equal(shown.view,first);assert.equal(shown.current,true)}
 await c.settled();assert.equal(reads,1);assert.equal(first.snapshotVersion,0);assert.equal(first.snapshotCursor,0);assert.equal(first.plants!.plots[0].status!.ready,false);assert.equal(first.order!.status,'active');
});

test('time/crop/shop/order and actual goods/land changes refresh; loading retains display but cannot authorize actions',async()=>{
 const waits:{head:any;task:ReturnType<typeof deferred<ReturnType<typeof project>>>}[]=[];
 const c=createLifeProjection(h=>{const task=deferred<ReturnType<typeof project>>();waits.push({head:h,task});return task.promise});let s=seed();c.update(s,'A','fixed');await turn();waits[0].task.resolve(project(s));await c.settled();const first=c.present().view!;
 s=bump(s,{townMinutes:3900});c.update(s,'A','fixed');assert.equal(c.present().view,first);assert.equal(c.present().current,false);await turn();
 s=bump(s,{townMinutes:3901});c.update(s,'A','fixed');s=bump(s,{townMinutes:3902});c.update(s,'A','fixed');assert.equal(waits.length,2,'at most one in-flight');waits[1].task.resolve(project(waits[1].head));await turn();await turn();assert.equal(waits.length,3,'only latest queued time is read');assert.equal(c.present().current,false);waits[2].task.resolve(project(s));await c.settled();const updated=c.present().view!;assert.equal(updated.plants!.plots[0].status!.ready,true);assert.equal(updated.plants!.shopOpen,false);assert.equal(updated.order!.status,'expired');assert.equal(updated.order!.remainingGameMinutes,0);assert.equal(c.present().current,true);
 const business=structuredClone(s);business.version++;business.cursor++;addLot(business,registry,snapPeaV2Ref,'seed',1,'business');business.landV1.plots[0].at.x+=8;business.lifeV1.cooldownUntil=6000;business.items['life-gift:dani-page']=1;business.lifeV1.firstRewards.push('dani-share-first');business.lifeV1.collections['gift:life-gift:dani-page']={id:'gift:life-gift:dani-page',sourceAction:'business',minute:business.townMinutes};assert.notEqual(lifeProjectionKey(s),lifeProjectionKey(business));c.update(business,'A','fixed');await turn();assert.equal(c.present().view,updated);assert.equal(c.present().current,false);waits[3].task.resolve(project(business));await c.settled();const final=c.present().view!;assert.equal(final.batches.find(b=>b.kind==='seed'&&b.ref.id==='crop:snap-pea')!.quantity,1);assert.equal(final.plants!.plots[0].at.x,business.landV1.plots[0].at.x);assert.equal(final.gifts.find(g=>g.id==='life-gift:dani-page')!.quantity,1);
});

test('motion during a pending projection read does not cancel it; a matching latest version can confirm its response',async()=>{
 let reads=0;const task=deferred<ReturnType<typeof project>>();const c=createLifeProjection(()=>{reads++;return task.promise});const s=seed();c.update(s,'A','fixed');await turn();let next=s,intermediate=s;for(let i=0;i<12;i++){next=bump(next);if(i===4)intermediate=next;c.update(next,'A','fixed')}task.resolve(project(intermediate));await c.settled();assert.equal(reads,1);assert.equal(c.present().current,true);assert.equal(c.present().view!.snapshotVersion,intermediate.version);assert.ok(intermediate.version<next.version);
});

test('failed or mismatched reads keep prior display stale, require retry, and never mint newer DTO versions',async()=>{
 let fail=false,bad=false,reads=0;const c=createLifeProjection(async h=>{reads++;if(fail)throw Error('ECONNRESET');const view=project(h);return bad?{...view,snapshotVersion:view.snapshotVersion+10}:view});let s=seed();c.update(s,'A','fixed');await c.settled();const prior=c.present().view!;
 fail=true;s=bump(s,{townMinutes:3900});c.update(s,'A','fixed');await c.settled();assert.equal(c.present().view,prior);assert.equal(c.present().current,false);assert.equal(c.present().status,'error');const n=reads;for(let i=0;i<20;i++)c.update(bump(s),'A','fixed');await c.settled();assert.equal(reads,n,'no automatic failed-read loop for same inputs');
 fail=false;bad=true;c.retry();await c.settled();assert.equal(c.present().view,prior);assert.equal(c.present().current,false);assert.equal(prior.snapshotVersion,0);bad=false;c.retry();await c.settled();assert.equal(c.present().current,true);assert.equal(c.present().view!.gameMinute,3900);
});

test('identity/journey/assembly changes hide prior data synchronously and late reads cannot cross scopes',async()=>{
 const old=deferred<ReturnType<typeof project>>();let calls=0;const c=createLifeProjection(h=>++calls===1?old.promise:Promise.resolve(project(h)));const a=seed();c.update(a,'A:epoch1','fixed');await turn();const b={...seed(),id:randomUUID()};assert.equal(c.forHead(b,'B:epoch2','fixed').view,null);c.update(b,'B:epoch2','fixed');old.resolve(project(a));await c.settled();assert.equal(c.present().view!.snapshotVersion,b.version);assert.equal(c.present().current,true);assert.equal(c.forHead(b,'B:epoch3','fixed').view,null);assert.equal(c.forHead(b,'B:epoch2','changed-config').view,null);assert.equal(c.forHead(b,'B:epoch2','fixed',false).view,null);c.dispose();assert.equal(c.present().view,null);
});


test('patched B2 bag/crop components render continuously while stale actions remain disabled and legacy fallback stays strict',async()=>{
 // External fixed B2 JSX is evaluated by the Node test loader, which may use its classic JSX fallback.
 const previousReact=(globalThis as any).React;(globalThis as any).React=React;try{
 const original=seed(),view=project(original),moving=bump(original),noop=()=>{};
 const props={save:moving,view,locale:'en' as const,busy:false,onCommand:noop,projectionCurrent:true};
 const bag=renderToStaticMarkup(createElement(LifeBag,{...props,reload:noop}));
 assert.ok(bag.includes('Seeds &amp; harvest'));assert.ok(!bag.includes('Your progress changed'));assert.ok(!bag.includes('unavailable just now'));
 const crop=renderToStaticMarkup(createElement(LifeCropPanel,{...props,target:{id:'land-bed-1'} as any}));assert.ok(crop.includes('Watered growth: 719/720'));assert.ok(!crop.includes('Reading updated progress'));
 const stale=renderToStaticMarkup(createElement(LifeCropCounter,{...props,projectionCurrent:false}));assert.ok(stale.includes('data-life-counter'));assert.match(stale,/<button disabled=""/);
 const legacy=renderToStaticMarkup(createElement(LifeBag,{save:moving,view,locale:'en',busy:false,onCommand:noop,reload:noop}));assert.ok(legacy.includes('Your progress changed'),'callers without the new proof still use exact snapshot versions');
 const after=bump(moving,{townMinutes:3900}),updated=project(after);const expired=renderToStaticMarkup(createElement(LifeBag,{...props,save:after,view:updated,reload:noop}));assert.ok(expired.includes('Expired. Your produce remains'));
 const ready=renderToStaticMarkup(createElement(LifeCropPanel,{...props,save:after,view:updated,target:{id:'land-bed-1'} as any}));assert.ok(ready.includes('The pods are ready'));
 }finally{if(previousReact===undefined)delete (globalThis as any).React;else (globalThis as any).React=previousReact}
});


test('locked and paused bouts refresh actual B2 availability without changing plant or order facts',async()=>{
 let reads=0;const c=createLifeProjection(async h=>{reads++;return project(h)});const base={...seed(),scene:'gym',position:entityAt('gym','idris')!.approach,known:['idris'],flags:['key','unpacked','battle:class:accepted']};
 c.update(base,'A','fixed');await c.settled();assert.equal(c.present().view!.plants!.blocked,false);
 const command=(s:any,action:string,payload?:any):Action=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:s.turnBattle?.id??'idris',action,payload});
 const active=applyAction(base,command(base,'battle-start',{encounter:'training'})).head;
 c.update(active,'A','fixed');assert.equal(c.present().current,false);await c.settled();assert.equal(c.present().view!.plants!.blocked,true);assert.ok(c.present().view!.batches.every(b=>!b.saveSeedAvailable));
 const paused=applyAction(active,command(active,'battle-pause')).head;c.update(paused,'A','fixed');await c.settled();assert.equal(c.present().view!.plants!.blocked,false);assert.equal(reads,3);assert.deepEqual((paused as any).lifeV1,base.lifeV1);assert.deepEqual((paused as any).landV1,base.landV1);
});
