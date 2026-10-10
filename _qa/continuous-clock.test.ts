import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRuntime} from '../server/runtime';
import {createMovingClock} from '../server/candidate-clock';
import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {world,rooms,entityAt} from '../src/world/data';
import {townPeriod,residentHere,fernStage} from '../src/world/residents';
import {plotStatus} from '../src/story/crops';
import {arrivalWarnings} from '../src/story/resident-guide';
import {continuousObjectiveEntrance} from '../src/candidate/navigation';
import {clusterWorld,clusterWalkable,globalPoint,localPoint,pointZone,traceZone,longTravelMinutes,CLUSTER} from '../src/candidate/continuity';
import {findPath} from '../src/engine/world';
// @ts-expect-error frozen test authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
async function fixture(run:(f:any)=>Promise<void>,extra:Partial<Save>={}){
 const dir=mkdtempSync(join(tmpdir(),'harbor-motion-')),owner='synthetic-'+randomUUID(),store=openAsyncSqliteAuthorityStore({path:join(dir,'test.sqlite'),worldId:randomUUID(),gameId:'local-motion',environment:'test'});let now=100000;
 const seed={...initial('en',randomUUID()),scene:'market',position:{x:597,y:180},flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms),...extra};
 const make=(boot='test-boot')=>new AsyncSessionAuthority(store,{...createRuntime(undefined,undefined,createMovingClock({now:()=>now,boot})),initial:(_l:any,id:string)=>({...seed,id})});
 let authority=make(),head=await authority.create(owner,randomUUID(),'en');
 const command=(action:string,payload:any={},position=head.position):Action=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position,target:'',action,payload});
 const send=async(a:Action)=>{const r=await authority.action(owner,head.id,a);head=r.head;return r};
 const enable=async(rate=2000)=>{await send(command('candidate-clock-enable',{millisecondsPerMinute:rate}));await send(command('candidate-motion-open'))};
 const move=async(points:any[],ms=1000)=>{now+=ms;const start=globalPoint(head.scene,head.position),end=points.at(-1)??start,zone=traceZone(head.scene,start,points),a=command('candidate-motion-step',{lease:head.movingClock.lease.id,sequence:head.movingClock.lease.sequence+1,points},localPoint(zone,end));return send(a)};
 try{await run({get head(){return head},get authority(){return authority},owner,command,send,enable,move,advance:(n:number)=>now+=n,restart:()=>{authority=make('new-boot')},store})}finally{store.close?.();rmSync(dir,{recursive:true,force:true})}
}
test('cluster uses a narrow real dry path, local identity roundtrips and old world stays intact',()=>{
 const before=JSON.stringify(world),c=clusterWorld(world),a=globalPoint('market',{x:597,y:180}),b=globalPoint('bazaar',{x:472,y:580});
 assert.ok(findPath(c,CLUSTER,a,b).length);assert.ok(clusterWalkable(world,{x:597,y:645}));assert.equal(clusterWalkable(world,{x:800,y:645}),false);assert.deepEqual(localPoint('market',a),{x:597,y:180});assert.equal(JSON.stringify(world),before);assert.equal(Object.keys(rooms).length,23,'the approved chapel is the sole room added to the former22-room baseline');assert.ok(rooms.chapel);
});
test('objective arrow walks across the removed portal to the real notice without changing story IDs',()=>{
 const s={...initial('en',randomUUID()),scene:'market',position:{x:597,y:180},flags:['key','unpacked','bag-returned']};const target=continuousObjectiveEntrance(s)!;assert.equal(target.id,'continuous--bazaar--notice');const destination=globalPoint(s.scene,target.approach);assert.deepEqual(destination,globalPoint('bazaar',entityAt('bazaar','notice')!.approach));assert.ok(findPath(clusterWorld(world),CLUSTER,globalPoint(s.scene,s.position),destination).length);assert.equal(s.scene,'market');
});
test('migration preserves old facts, crop stamps, local coordinates and committed time',async()=>fixture(async f=>{const before=structuredClone(f.head);await f.enable();for(const k of ['townMinutes','position','flags','items','plots','history','relations','scene','mapVersion'])assert.deepEqual(f.head[k],before[k]);assert.equal(f.head.movingClock.version,2)}, {townMinutes:900,fernStartedAt:540,plots:{'crop-bed-1':{crop:'radish',grown:80,updatedAt:900,wetUntil:1400}}}));
test('legacy overlap positions keep original logical zone and exact coordinates while idle',async()=>{for(const extra of [{scene:'market',position:{x:597,y:90}},{scene:'bazaar',position:{x:472,y:660}}])await fixture(async f=>{await f.enable();await f.move([],1000);assert.equal(f.head.scene,extra.scene);assert.deepEqual(f.head.position,extra.position);assert.equal(f.head.townMinutes,540)},extra)});
test('movement across seam and back credits duration once, never twenty minutes per crossing',async()=>fixture(async f=>{await f.enable();await f.move([{x:597,y:608}]);assert.equal(f.head.scene,'bazaar');assert.equal(f.head.townMinutes,540);await f.move([{x:597,y:720}]);assert.equal(f.head.scene,'market');assert.equal(f.head.townMinutes,541);assert.equal(f.head.awakeMinutes,1)}));
test('4000ms rate and remainder partition give same result for separate or combined segments',async()=>fixture(async f=>{await f.enable(4000);for(let i=0;i<4;i++)await f.move([{x:597,y:i%2?720:608}]);assert.equal(f.head.townMinutes,541);assert.equal(f.head.movingClock.remainderMs,0)}));
test('same receipt, concurrent duplicate and altered ID payload cannot double the clock',async()=>fixture(async f=>{await f.enable();f.advance(1000);const a=f.command('candidate-motion-step',{lease:f.head.movingClock.lease.id,sequence:1,points:[{x:597,y:608}]},{x:472,y:608});const [r1,r2]=await Promise.all([f.authority.action(f.owner,f.head.id,a),f.authority.action(f.owner,f.head.id,a)]);assert.deepEqual(r1,r2);await assert.rejects(f.authority.action(f.owner,f.head.id,{...a,payload:{...(a.payload as any),sequence:2}}),/ACTION_ID_CONFLICT/);assert.equal((await f.authority.get(f.owner,f.head.id)).townMinutes,540)}));
test('idle heartbeat, reading gap, background/offline expiry and server restart never catch up',async()=>fixture(async f=>{await f.enable();await f.move([],1000);assert.equal(f.head.townMinutes,540);f.advance(4000);await assert.rejects(f.move([],0),/MOTION_EXPIRED/);f.restart();await assert.rejects(f.move([],0),/MOTION_EXPIRED/);assert.equal((await f.authority.get(f.owner,f.head.id)).townMinutes,540)}));
test('teleport, accelerated motion, arbitrary client minutes, invalid paths and old sequences rejected',async()=>fixture(async f=>{await f.enable();await assert.rejects(f.move([{x:597,y:608}],10),/MOTION_TOO_FAST/);f.advance(1000);const a=f.command('candidate-motion-step',{lease:f.head.movingClock.lease.id,sequence:1,points:[{x:800,y:645}],minutes:999999},{x:800,y:105});await assert.rejects(f.authority.action(f.owner,f.head.id,a),/INVALID_MOTION_PATH|MOTION_TOO_FAST/);await assert.rejects(f.authority.checkpoint(f.owner,f.head.id,{expected_version:f.head.version,sceneId:f.head.scene,position:{x:800,y:800}}),/MOTION_CHECKPOINT_REQUIRED/);assert.equal(f.head.townMinutes,540)}));
test('four-unit interpolation slack cannot be farmed by zero-time packets or reopening leases',async()=>fixture(async f=>{await f.enable();await f.move([{x:597,y:716}],0);assert.equal(f.head.movingClock.speedSlackUnits,0);await f.send(f.command('candidate-motion-open'));await assert.rejects(f.move([{x:597,y:712}],0),/MOTION_TOO_FAST/);assert.equal(f.head.townMinutes,540)}));
test('ordinary portals cost zero, explicit long map trips have declared region hop cost',()=>{
 const s={...initial('en',randomUUID()),scene:'market',position:entityAt('market','to-secondhand')!.approach,flags:['key','unpacked'],movingClock:{version:2 as const,millisecondsPerMinute:2000 as const,remainderMs:0},visited:Object.keys(rooms)};
 const a:Action={action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'to-secondhand',action:'travel'};const next=applyAction(s,a).head;assert.equal(next.townMinutes,540);assert.equal(longTravelMinutes('market','bazaar'),0);assert.equal(longTravelMinutes('market','station'),10);
 const guide={...s,scene:'station',townMinutes:709,known:['samira'],flags:['talk:samira:routine'],visited:['station','market']};assert.deepEqual(arrivalWarnings(guide,'market'),[]);assert.match(arrivalWarnings({...guide,townMinutes:710},'market')[0][1],/10 minutes/);assert.match(arrivalWarnings({...guide,movingClock:undefined},'market')[0][1],/twenty minutes/);
});
test('residents, crops, fern and fatigue cross the same committed clock thresholds',async()=>fixture(async f=>{await f.enable();for(let i=0;i<4;i++)await f.move([{x:597,y:i%2?720:608}]);assert.equal(f.head.townMinutes,720);assert.equal(townPeriod(f.head),'afternoon');assert.equal(residentHere(f.head,'samira','market'),false);assert.equal(fernStage(f.head),'unfurling');assert.equal(plotStatus(f.head,'crop-bed-1')!.ready,true);assert.equal(f.head.awakeMinutes,660);assert.equal(f.head.energy,95)}, {townMinutes:718,awakeMinutes:658,fernStartedAt:358,plots:{'crop-bed-1':{crop:'radish',grown:358,updatedAt:718,wetUntil:1438}}}));
test('sleep and explicit crop labor stay atomic; preparation/replay does not repeat minutes',async()=>fixture(async f=>{
 await f.enable();const a={...f.command('plant:radish'),target:'crop-bed-1'};
 const prepared=await f.authority.prepareAction(f.owner,f.head.id,a);assert.equal(prepared.status,'prepared');assert.equal((await f.authority.get(f.owner,f.head.id)).townMinutes,540);
 const r=await f.authority.commitPreparedAction(f.owner,f.head.id,a),replay=await f.authority.action(f.owner,f.head.id,a);assert.deepEqual(r,replay);assert.equal(r.head.townMinutes,550);assert.equal(r.head.energy,98);assert.equal(r.head.plots['crop-bed-1'].updatedAt,540);
 const s={...r.head,scene:'home',position:entityAt('home','bed')!.approach},sleep:Action={action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'bed',action:'sleep'};
 const result=applyAction(s,sleep).head;assert.equal(result.townMinutes,1980);assert.equal(result.awakeMinutes,0);assert.equal(result.energy,100);assert.equal(result.movingClock?.lease,undefined);
}, {scene:'garden',position:entityAt('garden','crop-bed-1')!.approach,items:{'seed-radish':1}}));
