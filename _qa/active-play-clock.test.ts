import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {globalPoint,localPoint,isCluster} from '../src/candidate/continuity';
import {rooms,entityAt} from '../src/world/data';
import {townPeriod,residentHere,fernStage} from '../src/world/residents';
import {createRuntime} from '../server/runtime';
import {createMovingClock} from '../server/candidate-clock';
import {withCompactMotion} from '../server/candidate-motion-authority';
import {createActivePlayClock,withActivePlayRuntime} from '../server/active-play-clock';
import {withActivePlayAuthority} from '../server/active-play-authority';
import {createApiHandler} from '../server/http';
import {applyActivePlayAck,activePlayActionId,confirmActivePlay} from '../src/candidate/active-play-types';
import {applyMotionAck,motionActionId} from '../src/candidate/clock-types';
import {createLifeProjection} from '../src/candidate/life-projection';
import {createActivePlayBudget} from '../src/candidate/active-play-budget';
import {lifeView} from '../server/life-view';
import {pinLegacy} from '../src/life/save';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const registry=createPlantsRegistry();
test('foreground budget is independent of 60/20/5/2/1 FPS, reading delay, idle input and sleep',()=>{
 for(const fps of [60,20,5,2,1]){const b=createActivePlayBudget(0,true);let credit=0;for(let t=1000/fps;t<=4000+.001;t+=1000/fps)credit+=b.take(t);assert.ok(Math.abs(credit-4000)<=1)}
 const b=createActivePlayBudget(0,true);b.set(false,400);assert.equal(b.take(1500),400);assert.equal(b.take(2500),0);b.set(true,2500);assert.equal(b.take(3000),500);assert.equal(b.take(9000),0);assert.equal(b.take(9200),200);
 const fractions=createActivePlayBudget(0,true);let credit=0;for(let i=1;i<=4000;i++)credit+=fractions.take(i/4);assert.equal(credit,1000);
});
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve}};
async function fixture(run:(f:any)=>Promise<void>,extra:any={}){
 let now=100000,fault:'before'|'after'|undefined,gated=false;const entered=deferred(),release=deferred();
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'active-play-test',environment:'test'}),owner=randomUUID(),client=randomUUID();
 const seed={...initial('en',randomUUID()),scene:'market',position:{x:597,y:180},flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms),...extra};
 const unstable={...store,async transaction(fn:any){const mode=fault;if(mode==='before'){fault=undefined;throw Object.assign(Error('database gone'),{code:'ECONNRESET',status:400,terminal:true})}let wrote=false;const result=await store.transaction((repo:any)=>fn({...repo,write:async(...args:any[])=>{wrote=true;return repo.write(...args)}}));if(mode==='after'&&wrote){fault=undefined;throw Object.assign(Error('commit reply gone'),{code:'ECONNRESET',status:400,terminal:true})}return result}};
 const build=(boot='test')=>{
  const motion=createMovingClock({now:()=>now,boot}),play=createActivePlayClock({now:()=>now,boot});
  const base=createRuntime(undefined,undefined,motion),runtime=withActivePlayRuntime({...base,initial:(_l:any,id:string)=>({...seed,id}),async prepare(s:Save,a:Action,...args:any[]){const r=await base.prepare(s,a,...args as [unknown,{owner:string}]);if(gated){gated=false;entered.resolve();await release.promise}return r}},play);
  const auth=new AsyncSessionAuthority(unstable,runtime,{now:()=>now});return withActivePlayAuthority(withCompactMotion(auth,unstable,runtime,motion,()=>now),unstable,runtime,play,()=>now);
 };
 let authority=build(),head:Save=await authority.create(owner,randomUUID(),'en');
 const command=(action:string,payload:any={},target=''):Action=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target,action,payload,...(head.activePlayClock?{activePlay:{client,lease:head.activePlayClock.lease?.id,activeMs:Math.min(3000,Math.max(0,now-(head.activePlayClock.lease?.lastAt??now)))}}:{})});
 const playAction=(action='candidate-active-tick',who=client):Action=>{const c=head.activePlayClock,last=c?.transport?.last.ack;return {...command(action),action_id:activePlayActionId(head.id,(last?.ordinal??0)+1),payload:{ordinal:(last?.ordinal??0)+1,previous:last?.token??'',client:who,...(action==='candidate-active-open'?{}:{lease:c?.lease?.id,sequence:(c?.lease?.sequence??0)+1,activeMs:Math.min(3000,Math.max(0,now-(c?.lease?.lastAt??now)))})}}};
 const f:any={owner,client,store,entered,release,command,playAction,advance:(n:number)=>now+=n,setNow:(n:number)=>now=n,gate:()=>gated=true,fault:(mode:any)=>fault=mode,
  get head(){return head},set head(v:Save){head=v},get authority(){return authority},restart:()=>authority=build('after-restart'),
  play:async(a=playAction())=>{const ack=await authority.activePlay(owner,head.id,a);confirmActivePlay(ack,head.id,a);head=applyActivePlayAck(head,ack);return ack},
  open:async()=>f.play(playAction('candidate-active-open')),pause:async()=>f.play(playAction('candidate-active-pause')),
  send:async(a:Action)=>{const r=await authority.action(owner,head.id,a);head=r.head;return r},refresh:async()=>head=await authority.get(owner,head.id),
  motion:async(action:string,points:any[]=[])=>{const c=head.movingClock,last=c?.transport?.last.ack;const a={...command(action),...(points.length?{position:isCluster(head.scene)?localPoint(head.scene,points.at(-1)):points.at(-1)}:{}),action_id:motionActionId(head.id,(last?.ordinal??0)+1),payload:{transport:1,ordinal:(last?.ordinal??0)+1,previous:last?.token??'',lease:c?.lease?.id,sequence:(c?.lease?.sequence??0)+1,points}};const ack=await authority.motion(owner,head.id,a);head=applyMotionAck(head,ack);return ack},
  http:async(path:string,a:any,auth=authority,who=owner)=>{const req:any=Readable.from([Buffer.from(typeof a==='string'?a:JSON.stringify(a))]);req.method='POST';req.url='/api/sessions/'+head.id+path;req.headers={};let status=0,body:any;await createApiHandler({authority:auth})(req,{writeHead:(v:number)=>status=v,end:(v:string)=>body=JSON.parse(v)} as any,who);return {status,body}}
 };try{await run(f)}finally{store.close()}
}

test('standing advances at experimental 4 seconds; admitted movement adds zero extra minutes',async()=>fixture(async f=>{
 await f.send(f.command('candidate-clock-enable',{millisecondsPerMinute:2000}));await f.motion('candidate-motion-open');await f.open();
 for(let i=0;i<4;i++){f.advance(1000);await f.play()}
 assert.equal(f.head.townMinutes,541);assert.equal(f.head.awakeMinutes,1);assert.equal(f.head.activePlayClock.millisecondsPerMinute,4000);
 const before=f.head.townMinutes;await f.motion('candidate-motion-open');f.advance(1000);await f.motion('candidate-motion-step',[{x:597,y:832}]);assert.equal(f.head.townMinutes,before);assert.equal(f.head.movingClock.remainderMs,0);
 assert.equal(f.head.items.key,undefined);assert.deepEqual(f.head.flags,['key','unpacked','bag-returned']);
}));
test('pause preserves partial progress, resume/long gaps/restart/backward time never catch up',async()=>fixture(async f=>{
 await f.open();f.advance(1500);await f.pause();assert.equal(f.head.activePlayClock.remainderMs,1500);assert.equal(f.head.activePlayClock.lease,undefined);
 f.advance(60000);await f.open();assert.equal(f.head.townMinutes,540);f.advance(2500);await f.play();assert.equal(f.head.townMinutes,541);
 f.advance(60000);const old=f.playAction();await assert.rejects(f.play(old),/ACTIVE_LEASE_EXPIRED/);await f.open();assert.equal(f.head.townMinutes,541);
 f.restart();await assert.rejects(f.play(),/ACTIVE_LEASE_EXPIRED/);await f.open();f.setNow(1);await assert.rejects(f.play(),/ACTIVE_LEASE_EXPIRED/);await f.open();assert.equal(f.head.townMinutes,541);
}));
test('multi-tab replay/digest/owner/lease fences admit one time writer and finite takeover',async()=>fixture(async f=>{
 const a=f.playAction('candidate-active-open'),ack=await f.play(a);assert.deepEqual(await f.authority.activePlay(f.owner,f.head.id,a),ack);
 await assert.rejects(f.authority.activePlay('other',f.head.id,a),/SESSION_NOT_FOUND/);
 const other=randomUUID();await assert.rejects(f.play(f.playAction('candidate-active-open',other)),/ACTIVE_LEASE_BUSY/);await assert.rejects(f.play(f.playAction('candidate-active-pause',other)),/ACTIVE_LEASE_EXPIRED/);
 f.advance(1000);const tick=f.playAction();const result=await Promise.all([f.authority.activePlay(f.owner,f.head.id,tick),f.authority.activePlay(f.owner,f.head.id,tick)]);assert.deepEqual(result[0],result[1]);f.head=applyActivePlayAck(f.head,result[0]);assert.equal(f.head.activePlayClock.remainderMs,1000);
 await assert.rejects(f.authority.activePlay(f.owner,f.head.id,{...tick,payload:{...tick.payload,client:other}}),/ACTION_ID_CONFLICT/);
 f.advance(3001);await f.play(f.playAction('candidate-active-open',other));assert.equal(f.head.activePlayClock.remainderMs,1000);assert.equal(f.head.townMinutes,540);
 await assert.rejects(f.play(),/ACTIVE_LEASE_EXPIRED/);
}));
test('explicit rest settles natural time and 180-minute cost atomically; replay/failure never double charge',async()=>fixture(async f=>{
 await f.open();f.advance(2000);await f.play();f.advance(2000);const a=f.command('rest',{},'bed'),r=await f.send(a);
 assert.equal(r.head.townMinutes,721);assert.equal(r.head.activePlayClock.lease,undefined);assert.equal(r.head.activePlayClock.remainderMs,0);assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),r);
 await f.open();f.advance(1500);const before=await f.authority.get(f.owner,f.head.id);await assert.rejects(f.send(f.command('not-an-action',{},'bed')),/SPATIAL_ACTION_NOT_ADMITTED/);assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);
 const wrong={...f.command('rest',{},'bed'),activePlay:{client:randomUUID(),lease:f.head.activePlayClock.lease.id}};await assert.rejects(f.send(wrong),/ACTIVE_CONFIRMATION_REQUIRED/);
}, {scene:'home',position:entityAt('home','bed')!.approach}));
test('prepared crop action captures settlement once and retains old prepared protection',async()=>fixture(async f=>{
 await f.open();f.advance(2000);await f.play();f.advance(2000);const a=f.command('plant:radish',{},'crop-bed-1');const prepared=await f.authority.prepareAction(f.owner,f.head.id,a);assert.equal(prepared.result.head.townMinutes,551);
 await assert.rejects(f.play(),/MOTION_BUSINESS_PREPARED/);f.advance(60000);const r=await f.authority.commitPreparedAction(f.owner,f.head.id,a);assert.equal(r.head.townMinutes,551);assert.equal(r.head.energy,98);assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),r);
}, {scene:'garden',position:entityAt('garden','crop-bed-1')!.approach,items:{'seed-radish':1}}));
test('heartbeat/action CAS race commits exactly one head and no partial business settlement',async()=>fixture(async f=>{
 await f.open();f.advance(2000);await f.play();f.advance(2000);f.gate();const a=f.command('rest',{},'bed'),pending=f.authority.action(f.owner,f.head.id,a);await f.entered.promise;
 await f.play();f.release.resolve();await assert.rejects(pending,/VERSION_CONFLICT/);await f.refresh();assert.equal(f.head.townMinutes,541);assert.equal(f.head.history.length,0);
 const result=await f.send(f.command('rest',{},'bed'));assert.equal(result.head.townMinutes,721);
}, {scene:'home',position:entityAt('home','bed')!.approach}));
test('HTTP unknown infrastructure outcomes remain 503/nonterminal; authored failures resolve and channel is gated',async()=>fixture(async f=>{
 assert.equal((await f.http('/active-play',f.playAction('candidate-active-open'),{})).status,403);
 assert.equal((await f.http('/active-play',' '.repeat(16385))).status,413);
 f.fault('before');assert.deepEqual(await f.http('/active-play',f.playAction('candidate-active-open')),{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}});
 const a=f.playAction('candidate-active-open');f.fault('after');assert.equal((await f.http('/active-play',a)).status,503);await f.refresh();const again=await f.http('/active-play',a);assert.equal(again.status,200);assert.equal(again.body.version,f.head.version);
 const bad=f.command('not-an-action',{},'bed');assert.deepEqual(await f.http('/action',bad),{status:409,body:{error:'SPATIAL_ACTION_NOT_ADMITTED',terminal:true}});
}, {scene:'home',position:entityAt('home','bed')!.approach}));
test('unknown active-play and action results persist/recover the identical original ID through real client/API',async()=>fixture(async f=>{
 const saved={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};values.set('harbor-journey',f.head.id);
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'',origin:'http://localhost'}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:any)=>fn()}}});
 let lose=false;const attempts:any[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{const path=String(input).split('/api')[1],body=init?.body?JSON.parse(init.body):undefined;if(path==='/bootstrap')return new Response(JSON.stringify({mode:'local-authoring-test'}));if(path==='/sessions')return new Response(JSON.stringify(await f.authority.directory(f.owner)));if(path.endsWith('/active-play')||path.endsWith('/action')){attempts.push({path,body});const r=await f.http(path.endsWith('/active-play')?'/active-play':'/action',body);if(lose){lose=false;throw TypeError('REPLY_LOST')}return new Response(JSON.stringify(r.body),{status:r.status})}return new Response(JSON.stringify(await f.authority.get(f.owner,f.head.id)))} ) as any;
 try{const c=await import('../src/story/client');let h=await c.connect('en');lose=true;await assert.rejects(c.candidateActivePlay(h,'candidate-active-open'),/REPLY_LOST/);assert.ok(c.hasPendingAction());h=await c.connect('en');assert.deepEqual(attempts[0],attempts[1]);assert.equal(h.version,1);
  f.advance(2000);h=(await c.candidateActivePlay(h,'candidate-active-tick')).head;f.advance(2000);lose=true;const a:Action={action_id:randomUUID(),expected_version:h.version,scene:h.scene,position:h.position,target:'bed',action:'rest'};await assert.rejects(c.send(h,a),/REPLY_LOST/);assert.ok(c.hasPendingAction());h=await c.connect('en');assert.equal(h.townMinutes,721);const retries=attempts.filter(x=>x.body.action_id===a.action_id);assert.equal(retries.length,2);assert.deepEqual(retries[0],retries[1]);assert.ok(!c.hasPendingAction());
 }finally{(globalThis as any).window=saved.window;globalThis.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete (globalThis as any).navigator}
}, {scene:'home',position:entityAt('home','bed')!.approach}));
test('real resident/fern and B2 crop/order/shop boundaries follow the same authoritative minute',async()=>{
 const raw:any=pinLegacy({...initial('en',randomUUID()),scene:'market',position:{x:597,y:180},townMinutes:3899,flags:['key','unpacked','bag-returned']},registry);
 raw.landV1={schema:1,permissions:{},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},sourceAction:'fixture',minute:540}]};
 raw.lifeV1.plots['life-bed-1']={ref:snapPeaV2Ref,grown:719,updatedAt:3899,wetUntil:4619};raw.lifeV1.order={id:'order',definition:'theo-peas-v1',crop:snapPeaV2Ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};
 await fixture(async f=>{let reads=0;const projection=createLifeProjection(async s=>{reads++;return lifeView(s as any,registry,{ref:snapPeaV2Ref,newStarts:true})});projection.update(f.head,'same','plants');await projection.settled();await f.open();
  for(let i=0;i<4;i++){f.advance(1000);await f.play();projection.update(f.head,'same','plants');await projection.settled()}
  assert.equal(reads,2);assert.equal(f.head.townMinutes,3900);const v=projection.present().view!;assert.equal(v.plants!.plots[0].status!.grown,720);assert.equal(v.order!.status,'expired');assert.equal(v.plants!.shopOpen,false);
 },raw);
 await fixture(async f=>{assert.equal(townPeriod(f.head),'morning');assert.equal(residentHere(f.head,'avery','station'),true);await f.open();f.advance(2000);await f.play();f.advance(2000);await f.play();assert.equal(townPeriod(f.head),'afternoon');assert.equal(residentHere(f.head,'avery','market'),true);assert.equal(fernStage(f.head),'unfurling')},{townMinutes:719,fernStartedAt:360});
});
test('old locked turn retains authored cost; paused bout permits active play without rewriting turn facts',async()=>{
 const s={...initial('en',randomUUID()),scene:'gym',position:entityAt('gym','idris')!.approach,known:['idris'],flags:['key','unpacked','battle:class:accepted']};
 const a=(h:Save,action:string,payload?:any):Action=>({action_id:randomUUID(),expected_version:h.version,scene:h.scene,position:h.position,target:h.turnBattle?.id??'idris',action,payload});
 const locked=applyAction(s,a(s,'battle-start',{encounter:'open-class'})).head;
 await fixture(async f=>{await assert.rejects(f.open(),/CHALLENGE_ACTIVE/);const r=await f.send(f.command('battle-move',{round:0,move:'strike'},f.head.turnBattle.id));assert.equal(r.head.townMinutes,542);assert.equal(r.head.energy,98)}, {...locked,version:0,cursor:0});
 const paused=applyAction(locked,a(locked,'battle-pause')).head;await fixture(async f=>{const before=structuredClone(f.head.turnBattle);await f.open();f.advance(2000);await f.play();f.advance(2000);await f.play();assert.equal(f.head.townMinutes,541);assert.deepEqual(f.head.turnBattle,before)}, {...paused,version:0,cursor:0});
});

test('delayed pause only credits reported playable time; client budget cannot exceed server elapsed',async()=>fixture(async f=>{
 await f.open();f.advance(2000);const a=f.playAction('candidate-active-pause');(a.payload as any).activeMs=400;await f.play(a);assert.equal(f.head.activePlayClock.remainderMs,400);
 await f.open();f.advance(500);const tick=f.playAction();(tick.payload as any).activeMs=3000;await f.play(tick);assert.equal(f.head.activePlayClock.remainderMs,900);
 const invalid=f.playAction();(invalid.payload as any).activeMs=3001;await assert.rejects(f.play(invalid),/INVALID_ACTIVE_ACTION/);
}));
test('business database ambiguity before/after commit is nonterminal and exact replay charges once',async()=>fixture(async f=>{
 await f.open();f.advance(2000);await f.play();f.advance(2000);const a=f.command('rest',{},'bed'),before=await f.authority.get(f.owner,f.head.id);
 f.fault('before');assert.deepEqual(await f.http('/action',a),{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}});assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);
 f.fault('after');assert.deepEqual(await f.http('/action',a),{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}});const committed=await f.authority.get(f.owner,f.head.id);assert.equal(committed.townMinutes,721);const recovered=await f.http('/action',a);assert.equal(recovered.status,200);assert.equal(recovered.body.head.townMinutes,721);assert.equal((await f.authority.get(f.owner,f.head.id)).history.length,1);
},{scene:'home',position:entityAt('home','bed')!.approach}));
test('one simulated hour keeps bounded clock confirmation and no heartbeat receipts or journal growth',async()=>fixture(async f=>{
 await f.open();const before=Buffer.byteLength(JSON.stringify(await f.authority.get(f.owner,f.head.id)));let maxBytes=0;
 for(let i=0;i<4500;i++){f.advance(800);maxBytes=Math.max(maxBytes,Buffer.byteLength(JSON.stringify(await f.play())))}
 assert.equal(f.head.townMinutes,1440);assert.equal((await f.authority.events(f.owner,f.head.id,0)).length,0);const after=Buffer.byteLength(JSON.stringify(await f.authority.get(f.owner,f.head.id)));assert.ok(after-before<140);assert.ok(maxBytes<900);console.log('ACTIVE_HOUR',JSON.stringify({heartbeats:4500,minutes:900,beforeBytes:before,afterBytes:after,maxAckBytes:maxBytes,journal:0}));
}));
test('experimental rate is server-configured; a client cannot replace the chosen clock speed',()=>{
 const s=initial('en',randomUUID()),client=randomUUID(),a:Action={action_id:randomUUID(),expected_version:0,scene:s.scene,position:s.position,target:'',action:'candidate-active-open',payload:{client}};
 const clock=createActivePlayClock({now:()=>1000,boot:'rate',defaultRate:2000});const opened=clock.apply(s,a);assert.equal(opened.activePlayClock!.millisecondsPerMinute,2000);
 assert.throws(()=>clock.apply(opened,{...a,payload:{client,millisecondsPerMinute:4000}}),/INVALID_ACTIVE_RATE/);assert.throws(()=>createActivePlayClock({defaultRate:5000 as any}),/INVALID_ACTIVE_RATE/);
});
test('full purse is an authored gameplay rejection, leaves produce and time unchanged and does not become an unknown pending',async()=>fixture(async f=>{
 await f.open();f.advance(2000);await f.play();f.advance(2000);const before=await f.authority.get(f.owner,f.head.id),a=f.command('sell-crop:radish',{},'crop-counter');
 assert.deepEqual(await f.http('/action',a),{status:409,body:{error:'PURSE_FULL',terminal:true}});assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);assert.deepEqual(await f.http('/action',a),{status:409,body:{error:'PURSE_FULL',terminal:true}});
},{scene:'grocery',position:entityAt('grocery','crop-counter')!.approach,cash:999,items:{'crop-radish':1}}));
