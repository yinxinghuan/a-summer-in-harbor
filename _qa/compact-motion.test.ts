import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Readable} from 'node:stream';
import {createApiHandler} from '../server/http';
import {createRuntime} from '../server/runtime';
import {createMovingClock} from '../server/candidate-clock';
import {withCompactMotion} from '../server/candidate-motion-authority';
import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {entityAt,rooms} from '../src/world/data';
import {applyMotionAck,motionActionId} from '../src/candidate/clock-types';
import {globalPoint,localPoint,pointZone,isCluster} from '../src/candidate/continuity';
import {createElapsedMotion} from '../src/engine/elapsed-motion';
import {moveWithCollision,advanceRoute} from '../src/engine/distance-motion';
import {appendMotionTrace} from '../src/candidate/motion-trace';
// @ts-expect-error frozen test authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
async function fixture(run:(f:any)=>Promise<void>,extra:Partial<Save>={}){
 const dir=mkdtempSync(join(tmpdir(),'harbor-compact-')),path=join(dir,'test.sqlite'),owner=randomUUID(),worldId=randomUUID(),options={path,worldId,gameId:'compact-local',environment:'test'};let store=openAsyncSqliteAuthorityStore(options),now=100000;
 const seed={...initial('en',randomUUID()),scene:'market',position:{x:597,y:180},flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms),...extra};
 const make=(boot='test-boot')=>{const motion=createMovingClock({now:()=>now,boot}),runtime={...createRuntime(undefined,undefined,motion),initial:(_l:any,id:string)=>({...seed,id})};return withCompactMotion(new AsyncSessionAuthority(store,runtime),store,runtime,motion,()=>now)};
 let authority=make(),head:Save=await authority.create(owner,randomUUID(),'en');
 const command=(action:string,payload:any={},position=head.position):Action=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position,target:'',action,payload});
 const compact=(action='candidate-motion-step',points:any[]=[])=>{const last=head.movingClock?.transport?.last.ack,end=points.at(-1)??globalPoint(head.scene,head.position),zone=isCluster(head.scene)?points.reduce((z:string,p:any)=>pointZone(p,z),head.scene):head.scene;const a=command(action,{transport:1,ordinal:(last?.ordinal??0)+1,previous:last?.token??'',lease:head.movingClock?.lease?.id,sequence:(head.movingClock?.lease?.sequence??0)+1,points},action==='candidate-motion-open'?head.position:localPoint(zone,end));return {...a,action_id:motionActionId(head.id,(last?.ordinal??0)+1)}};
 const send=async(a:Action)=>{const r=await authority.action(owner,head.id,a);head=r.head;return r};
 const motion=async(a=compact())=>{const ack=await authority.motion(owner,head.id,a);head=applyMotionAck(head,ack);return ack};
 const enable=async()=>{await send(command('candidate-clock-enable',{millisecondsPerMinute:2000}));await motion(compact('candidate-motion-open'))};
 const counts=()=>{const db=new DatabaseSync(path,{readOnly:true});try{return {receipts:db.prepare('SELECT count(*) n, sum(length(response)) bytes FROM async_receipts').get(),journal:db.prepare('SELECT count(*) n FROM async_journal').get(),prepared:db.prepare('SELECT count(*) n FROM async_prepared').get(),headBytes:db.prepare('SELECT length(data) n FROM async_journeys').get()}}finally{db.close()}};
 try{await run({get head(){return head},get authority(){return authority},get store(){return store},owner,command,compact,send,motion,enable,counts,advance:(ms:number)=>now+=ms,reopen:async()=>{await store.close();store=openAsyncSqliteAuthorityStore(options);authority=make('new-boot');head=await authority.get(owner,head.id)}})}finally{await store.close();rmSync(dir,{recursive:true,force:true})}
}
test('compact exact/concurrent replay, digest conflict, ordinal retirement and reopen never repeat committed motion',async()=>fixture(async f=>{
 await f.enable();f.advance(1000);const before=f.head,a=f.compact('candidate-motion-step',[{x:597,y:608}]);const [x,y]=await Promise.all([f.authority.motion(f.owner,f.head.id,a),f.authority.motion(f.owner,f.head.id,a)]);assert.deepEqual(x,y);assert.ok(!('head' in x));assert.ok(!('transport' in x.fields.clock));
 await assert.rejects(f.authority.motion(f.owner,f.head.id,{...a,payload:{...a.payload,points:[]}}),/ACTION_ID_CONFLICT/);
 await f.reopen();assert.deepEqual(await f.authority.motion(f.owner,f.head.id,a),x);assert.equal(f.head.version,before.version+1);assert.equal(f.head.scene,'bazaar');
 await f.motion(f.compact('candidate-motion-open'));await assert.rejects(f.authority.motion(f.owner,f.head.id,a),/MOTION_RECEIPT_RETIRED/);await assert.rejects(f.authority.motion(f.owner,f.head.id,{...f.compact(),action_id:a.action_id}),/ACTION_ID_CONFLICT/);assert.equal((await f.authority.get(f.owner,f.head.id)).townMinutes,540);
}));
test('confirmation token, fresh CAS, owner isolation and altered same ordinal are enforced',async()=>fixture(async f=>{
 await f.enable();const a=f.compact();await assert.rejects(f.authority.motion('other-owner',f.head.id,a),/SESSION_NOT_FOUND/);await assert.rejects(f.authority.motion(f.owner,f.head.id,{...a,payload:{...a.payload,previous:'wrong'}}),/MOTION_CONFIRMATION_REQUIRED/);await assert.rejects(f.authority.motion(f.owner,f.head.id,{...a,expected_version:a.expected_version-1}),/VERSION_CONFLICT/);
 const outcomes=await Promise.allSettled([f.authority.motion(f.owner,f.head.id,a),f.authority.motion(f.owner,f.head.id,{...a,action_id:randomUUID()})]);assert.equal(outcomes.filter((r:any)=>r.status==='fulfilled').length,1);assert.match((outcomes.find((r:any)=>r.status==='rejected') as any).reason.message,/ACTION_ID_CONFLICT/);
}));
test('legacy full receipts remain replayable after compact movement, including old protocol pending',async()=>fixture(async f=>{
 const enable=f.command('candidate-clock-enable',{millisecondsPerMinute:2000}),r=await f.send(enable);const open=f.command('candidate-motion-open'),oldOpen=await f.send(open);f.advance(1000);const step=f.command('candidate-motion-step',{lease:f.head.movingClock.lease.id,sequence:1,points:[{x:597,y:608}]},{x:472,y:608}),oldStep=await f.send(step);await f.motion(f.compact('candidate-motion-open'));f.advance(1000);await f.motion(f.compact('candidate-motion-step',[{x:597,y:720}]));
 for(const [a,result] of [[enable,r],[open,oldOpen],[step,oldStep]])assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),result);assert.equal(f.counts().receipts.n,3);
 await assert.rejects(f.authority.motion(f.owner,f.head.id,{...f.compact(),action_id:step.action_id}),/ACTION_ID_CONFLICT/);
}));
test('prepared crop action survives rejected motion and commits/replays original cost exactly once',async()=>fixture(async f=>{
 await f.enable();const a={...f.command('plant:radish'),target:'crop-bed-1'};await f.authority.prepareAction(f.owner,f.head.id,a);const before=f.head,c=f.compact();await assert.rejects(f.authority.motion(f.owner,f.head.id,c),/MOTION_BUSINESS_PREPARED/);assert.equal(f.counts().prepared.n,1);assert.equal((await f.authority.get(f.owner,f.head.id)).version,before.version);
 const result=await f.authority.commitPreparedAction(f.owner,f.head.id,a);assert.equal(result.head.townMinutes,550);assert.equal(result.head.energy,98);assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),result);assert.equal(f.counts().prepared.n,0);
}, {scene:'garden',position:entityAt('garden','crop-bed-1')!.approach,items:{'seed-radish':1}}));
test('one simulated hour has bounded persisted confirmation, no movement receipt/journal growth and compact response bytes',async()=>fixture(async f=>{
 await f.enable();const before=f.counts();let maxBytes=0;for(let i=0;i<4500;i++){f.advance(800);const ack=await f.motion(f.compact('candidate-motion-step',[{x:597,y:i%2?720:630.4}]));maxBytes=Math.max(maxBytes,Buffer.byteLength(JSON.stringify(ack)))}const after=f.counts();assert.deepEqual(after.receipts,before.receipts);assert.deepEqual(after.journal,before.journal);assert.ok(after.headBytes.n-before.headBytes.n<160);assert.ok(maxBytes<1800);assert.equal(f.head.townMinutes,2340);console.log('COMPACT_HOUR',JSON.stringify({batches:4500,before,after,maxResponseBytes:maxBytes}));
}));
test('compact speed/slack/boot/gap bounds, rate migration and turn/crop facts retain original limits',async()=>fixture(async f=>{
 await f.enable();await f.motion(f.compact('candidate-motion-step',[{x:597,y:716}]));assert.equal(f.head.movingClock.speedSlackUnits,0);await f.motion(f.compact('candidate-motion-open'));await assert.rejects(f.motion(f.compact('candidate-motion-step',[{x:597,y:712}])),/MOTION_TOO_FAST/);
 f.advance(4000);await assert.rejects(f.motion(),/MOTION_EXPIRED/);await f.reopen();await assert.rejects(f.motion(),/MOTION_EXPIRED/);await f.motion(f.compact('candidate-motion-open'));const ordinal=f.head.movingClock.transport.last.ack.ordinal;await f.send(f.command('candidate-clock-enable',{millisecondsPerMinute:4000}));assert.equal(f.head.movingClock.transport.last.ack.ordinal,ordinal);await f.motion(f.compact('candidate-motion-open'));assert.equal(f.head.movingClock.transport.last.ack.ordinal,ordinal+1);assert.equal(f.head.townMinutes,540);
}));
test('elapsed visible input has equal effective distance at 60/20/5/2/1 FPS; late key and release do not over-credit',()=>{
 for(const fps of [60,20,5,2,1]){const clock=createElapsedMotion(0,{x:1,y:0});let p={x:0,y:0},distance=0;for(let at=1000/fps;at<=4000+1e-6;at+=1000/fps)for(const s of clock.consume(at)){const r=moveWithCollision(p,{x:112*s.ms/1000,y:0},()=>true);p=r.position;distance+=r.distance}assert.ok(Math.abs(distance-448)<1e-5,`${fps} FPS distance ${distance}`)}
 const clock=createElapsedMotion(0,{x:0,y:0});clock.input(400,{x:1,y:0});clock.input(700,{x:0,y:0});assert.equal(clock.consume(1000).reduce((n,s)=>n+s.ms*s.input.x,0),300);
});
test('blocked/backward/background/long gaps and input storm are bounded with no deferred movement',()=>{
 const c=createElapsedMotion(0,1);assert.deepEqual(c.consume(2000),[]);assert.equal(c.consume(2100).reduce((n,s)=>n+s.ms,0),100);assert.deepEqual(c.consume(2200,true),[]);assert.deepEqual(c.consume(2000),[]);assert.deepEqual(c.consume(6000,true),[]);assert.equal(c.consume(6100).reduce((n,s)=>n+s.ms,0),100);for(let i=0;i<100;i++)c.input(6100+i,i);assert.ok(c.consume(6300).reduce((n,s)=>n+s.ms,0)<=136.01);
});
test('authority-batch sampling and rAF share one elapsed cursor; network suspension never duplicates elapsed',()=>{
 const c=createElapsedMotion(0,1);let effective=0;for(const at of [200,400,600,800])effective+=c.consume(at).reduce((n,s)=>n+s.ms*s.input,0);c.input(800,0);c.consume(1000,true);c.input(1800,1);effective+=c.consume(2000).reduce((n,s)=>n+s.ms*s.input,0);assert.equal(effective,1000);assert.deepEqual(c.consume(1990),[]);assert.equal(c.consume(2100).reduce((n,s)=>n+s.ms*s.input,0),100);
});
test('compact HTTP is closed without the candidate adapter, owner scoped and size limited',async()=>fixture(async f=>{
 await f.enable();const call=async(authority:any,body:any,owner=f.owner)=>{const api=createApiHandler({authority}),request:any=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);request.method='POST';request.url='/api/sessions/'+f.head.id+'/motion';request.headers={};let status=0,result:any;const response:any={writeHead:(s:number)=>status=s,end:(v:string)=>result=JSON.parse(v)};await api(request,response,owner);return {status,result}};
 assert.equal((await call({get:()=>{throw Error('NO')}},f.compact())).status,403);assert.equal((await call(f.authority,' '.repeat(16385))).status,413);const denied=await call(f.authority,f.compact(),'other-owner');assert.equal(denied.status,404);assert.deepEqual(denied.result,{error:'SESSION_NOT_FOUND',terminal:true});const result=await call(f.authority,f.compact());assert.equal(result.status,200);assert.equal(result.result.schema,1);assert.equal(result.result.head,undefined);
}));
test('low FPS collisions credit only legal distance; trace keeps route corners and slides while compressing straight paths',()=>{
 const c=createElapsedMotion(0,1),points:any[]=[],start={x:0,y:0};let p=start,distance=0;for(const s of c.consume(1000)){const r=moveWithCollision(p,{x:112*s.ms/1000,y:0},q=>q.x<=20,q=>appendMotionTrace(points,start,q));p=r.position;distance+=r.distance}assert.ok(distance<=20&&distance>19);assert.equal(points.length,1);
 const route=[{x:10,y:0},{x:10,y:10}],turns:any[]=[];const r=advanceRoute(start,route,20,()=>true,q=>appendMotionTrace(turns,start,q));assert.equal(r.distance,20);assert.deepEqual(turns,route);
});
test('late low-FPS key input and wall elapsed produce the same authority minutes from admitted displacement',async()=>fixture(async f=>{
 await f.enable();let p=globalPoint(f.head.scene,f.head.position),direction=-1;let effective=0;const clock=createElapsedMotion(0,{y:direction});for(let second=1;second<=4;second++){
  const start=p,points:any[]=[];for(const s of clock.consume(second*1000)){const r=moveWithCollision(p,{x:0,y:112*s.ms/1000*s.input.y},q=>q.y>=608&&q.y<=720,q=>appendMotionTrace(points,start,q));p=r.position;effective+=r.distance/112*1000}f.advance(1000);await f.motion(f.compact('candidate-motion-step',points));direction=-direction;clock.input(second*1000,{y:direction});
 }const credited=(f.head.townMinutes-540)*2000+f.head.movingClock.remainderMs+(f.head.movingClock.fractionalMs??0);assert.ok(Math.abs(credited-effective)<1e-5);assert.ok(effective<=4000);assert.equal(f.head.awakeMinutes,Math.floor((effective+1e-7)/2000));
}));
test('client persists one compact pending on lost response, retries identical ID and never GETs full head per successful batch',async()=>fixture(async f=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
 const saved={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'',origin:'http://localhost'}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_key:string,work:()=>any)=>work()}}});
 let lose=false,gateway=0,gets=0,delayed:Promise<void>|undefined,entered:(()=>void)|undefined;const requests:any[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{const path=String(input).split('/api')[1],body=init?.body?JSON.parse(init.body):undefined;requests.push({path,body});let result:any;
  const id=path.split('/')[2];if(path==='/bootstrap')result={mode:'local-authoring-test'};else if(path==='/sessions')result=await f.authority.directory(f.owner);else if(path.endsWith('/motion')){result=await f.authority.motion(f.owner,id,body);if(lose){lose=false;throw TypeError('NETWORK_RESPONSE_LOST')}if(delayed){const wait=delayed;delayed=undefined;entered?.();await wait}}else if(path.endsWith('/action'))result=await f.authority.action(f.owner,id,body);else {gets++;result=await f.authority.get(f.owner,id)}if(gateway&&(path.endsWith('/motion')||path.endsWith('/action'))){const status=gateway;gateway=0;return new Response(JSON.stringify({error:'GATEWAY_RETRY'}),{status})}return new Response(JSON.stringify(result),{status:200});
 }) as any;
 try{
  const client=await import('../src/story/client');let h=await client.connect('en');h=(await client.candidateMotion(h,'candidate-clock-enable',h.position,{millisecondsPerMinute:2000})).head;h=(await client.candidateMotion(h,'candidate-motion-open',h.position,{})).head;
  f.advance(1000);lose=true;await assert.rejects(client.candidateMotion(h,'candidate-motion-step',{x:472,y:608},{lease:h.movingClock!.lease!.id,sequence:1,points:[{x:597,y:608}]}),/NETWORK_RESPONSE_LOST/);assert.equal(client.hasPendingAction(),true);const envelope=JSON.parse([...values.entries()].find(([k])=>k.includes('harbor-pending-v2:'))![1]);assert.equal(envelope.channel,'motion');
  await assert.rejects(client.send(h,{action_id:randomUUID(),expected_version:h.version,scene:h.scene,position:h.position,target:'',action:'candidate-motion-open'}),/PENDING_ACTION/);
  gateway=200;await assert.rejects(client.connect('en'),/MOTION_REPLY_UNCONFIRMED/);assert.equal(client.hasPendingAction(),true);h=await client.connect('en');assert.equal(client.hasPendingAction(),false);assert.equal(h.scene,'bazaar');const same=requests.filter(r=>r.body?.action_id===envelope.action.action_id);assert.equal(same.length,3);assert.deepEqual(same[0],same[1]);
  const before=gets;f.advance(1000);h=(await client.candidateMotion(h,'candidate-motion-step',{x:597,y:180},{lease:h.movingClock!.lease!.id,sequence:2,points:[{x:597,y:720}]})).head;assert.equal(gets,before);assert.equal(h.townMinutes,541);
  // A historical /action envelope has no channel and still recovers through its original endpoint.
  const old=f.command('candidate-clock-enable',{millisecondsPerMinute:4000});old.expected_version=h.version;old.scene=h.scene;old.position=h.position;const result=await f.authority.action(f.owner,h.id,old);const pending='harbor-pending-v2:'+h.id;storage.setItem(pending,JSON.stringify({id:h.id,action:old}));h=await client.connect('en');assert.equal(h.version,result.head.version);assert.equal(client.hasPendingAction(),false);assert.ok(requests.some(r=>r.path.endsWith('/action')&&r.body.action_id===old.action_id));
  // Recoverable gateway 429/408 responses do not prove whether a prior attempt committed.
  gateway=429;const business={...f.command('candidate-clock-enable',{millisecondsPerMinute:4000}),expected_version:h.version,scene:h.scene,position:h.position};await assert.rejects(client.send(h,business),/GATEWAY_RETRY/);assert.equal(client.hasPendingAction(),true);h=await client.connect('en');assert.equal(h.version,business.expected_version+1);
  h=(await client.candidateMotion(h,'candidate-motion-open',h.position,{})).head;gateway=408;await assert.rejects(client.candidateMotion(h,'candidate-motion-step',h.position,{lease:h.movingClock!.lease!.id,sequence:1,points:[]}),/GATEWAY_RETRY/);assert.equal(client.hasPendingAction(),true);const prior=h.version;h=await client.connect('en');assert.equal(h.version,prior+1);assert.equal(client.hasPendingAction(),false);
  // A late reply from the previous journey cannot clear the new journey's pending or rebind its UI.
  const other=await f.authority.create(f.owner,randomUUID(),'en');let release!:()=>void;delayed=new Promise<void>(r=>release=r);const began=new Promise<void>(r=>entered=r);const late=client.candidateMotion(h,'candidate-motion-step',h.position,{lease:h.movingClock!.lease!.id,sequence:h.movingClock!.lease!.sequence+1,points:[]});await began;storage.setItem('harbor-journey',other.id);assert.equal((await client.connect('en')).id,other.id);release();await assert.rejects(late,/IDENTITY_CHANGED/);assert.ok(storage.getItem(pending));assert.equal(client.hasPendingAction(),false);assert.equal((await client.connect('en')).id,other.id);storage.setItem('harbor-journey',h.id);const returned=await client.connect('en');assert.equal(returned.id,h.id);assert.equal(returned.version,h.version+1);assert.equal(storage.getItem(pending),null);
 }finally{(globalThis as any).window=saved.window;globalThis.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete (globalThis as any).navigator}
}));

test('old locked bout keeps ordinary turn cost and paused bout admits clock without rewriting it',async()=>{
 const seed={...initial('en',randomUUID()),scene:'gym',position:entityAt('gym','idris')!.approach,known:['idris'],flags:['key','unpacked','battle:class:accepted']};
 const a=(s:Save,action:string,payload?:any):Action=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:s.turnBattle?.id??'idris',action,payload});
 const active=applyAction(seed,a(seed,'battle-start',{encounter:'open-class'})).head;
 await fixture(async f=>{await assert.rejects(f.send(f.command('candidate-clock-enable',{millisecondsPerMinute:2000})),/CLOCK_CHANGE_BUSY/);const turn={...f.command('battle-move',{round:0,move:'strike'}),target:f.head.turnBattle.id};const r=await f.send(turn);assert.equal(r.head.townMinutes,542);assert.equal(r.head.energy,98);assert.deepEqual(await f.authority.action(f.owner,f.head.id,turn),r)},{...active,version:0,cursor:0});
 const paused=applyAction(active,a(active,'battle-pause')).head;
 await fixture(async f=>{const bout=structuredClone(f.head.turnBattle);await f.enable();assert.deepEqual(f.head.turnBattle,bout);f.advance(100);await f.motion(f.compact('candidate-motion-step',[{x:f.head.position.x+1,y:f.head.position.y}]));assert.deepEqual(f.head.turnBattle,bout);assert.equal(f.head.energy,100);assert.equal(f.head.townMinutes,540)},{...paused,version:0,cursor:0});
});
