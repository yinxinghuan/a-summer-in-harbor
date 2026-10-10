import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRuntime} from '../server/runtime';
import {createMovingClock} from '../server/candidate-clock';
import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {world,worldWithFlags,rooms,entityAt} from '../src/world/data';
import {townPeriod,residentHere,fernStage} from '../src/world/residents';
import {plotStatus} from '../src/story/crops';
import {arrivalWarnings} from '../src/story/resident-guide';
import {continuousObjectiveEntrance} from '../src/candidate/navigation';
import {clusterWorld,clusterWalkable,globalPoint,localPoint,pointZone,longTravelMinutes,CLUSTER,traceZone,continuousPath} from '../src/candidate/continuity';
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
 const move=async(points:any[],ms=1000)=>{now+=ms;const end=points.at(-1)??globalPoint(head.scene,head.position),zone=traceZone(head.scene,globalPoint(head.scene,head.position),points),a=command('candidate-motion-step',{lease:head.movingClock.lease.id,sequence:head.movingClock.lease.sequence+1,points},localPoint(zone,end));return send(a)};
 try{await run({get head(){return head},get authority(){return authority},owner,command,send,enable,move,advance:(n:number)=>now+=n,restart:()=>{authority=make('new-boot')},store})}finally{store.close?.();rmSync(dir,{recursive:true,force:true})}
}

test('coastal crossings persist original local save identity and reverse without travel actions',async()=>{
 for(const [scene,start,end,target] of [['coast',{x:542,y:765},{x:542,y:845},'beach'],['coast',{x:1235,y:469},{x:1320,y:469},'path']] as const){await fixture(async f=>{await f.enable();await f.move([end],1250);assert.equal(f.head.scene,target);assert.deepEqual(f.head.position,localPoint(target,end));assert.ok(f.head.visited.includes(target));await f.move([start],1250);assert.equal(f.head.scene,scene);assert.deepEqual(f.head.position,start);},{scene,position:start})}
});
test('idle legacy overlap saves retain exact ID and local coordinates',()=>{for(const [scene,p] of [['coast',{x:542,y:830}],['beach',{x:472,y:165}],['path',{x:125,y:329}]] as const){const q=globalPoint(scene,p);assert.equal(traceZone(scene,q,[q]),scene);assert.deepEqual(localPoint(scene,q),p)}});
test('beach to path walks via coast and broken bridge stays blocked',()=>{const points=continuousPath(world,'beach',globalPoint('beach',rooms.beach.spawn),'path',globalPoint('path',rooms.path.spawn));assert.ok(points.length);assert.equal(traceZone('beach',globalPoint('beach',rooms.beach.spawn),points),'path');assert.equal(clusterWalkable(worldWithFlags([]),globalPoint('path',{x:460,y:300}),'path'),false);assert.equal(traceZone('coast',{x:800,y:790},[{x:800,y:810}]),'beach','the admitted shared pair now classifies actual movement beyond the old corridor')});
test('lighthouse ordinary ingress and return preserve the authored entrance coordinates',async()=>{const door=rooms.coast.entities.find(e=>e.destination==='lighthouse')!;await fixture(async f=>{await f.send({...f.command('travel'),target:door.id});assert.equal(f.head.scene,'lighthouse');const back=rooms.lighthouse.entities.find(e=>e.destination==='coast')!;assert.deepEqual(f.head.position,back.approach);await f.send({...f.command('travel'),target:back.id});assert.equal(f.head.scene,'coast');assert.deepEqual(f.head.position,door.approach);},{scene:'coast',position:door.approach})});
test('map navigation from beach passes the internal coast seam before the real lighthouse door',async()=>{const {walkingEntrance,entranceReachable}=await import('../src/world/map-navigation');const s={...initial('en','synthetic'),scene:'beach',position:{...rooms.beach.spawn},flags:['key','unpacked'],visited:Object.keys(rooms)};const door=rooms.coast.entities.find(e=>e.destination==='lighthouse')!;const e=walkingEntrance(s,'lighthouse')!;assert.equal(e.destination,'lighthouse');assert.deepEqual(globalPoint('beach',e.approach),globalPoint('coast',door.approach));assert.equal(entranceReachable(s,'lighthouse'),true)});
