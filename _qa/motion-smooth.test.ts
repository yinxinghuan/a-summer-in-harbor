import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createExplorationAssembly} from '../server/exploration-assembly';import {initial,type Save} from '../src/story/state';import {rooms} from '../src/world/data';
import {applyMotionAck,motionActionId} from '../src/candidate/clock-types';import {applyActivePlayAck,activePlayActionId} from '../src/candidate/active-play-types';import {consumeTrace,traceLength,predictionHorizon} from '../src/candidate/motion-outbox';
import {createActivePlayBudget} from '../src/candidate/active-play-budget';
// @ts-expect-error pinned existing authority, no new persistence implementation.
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
async function fixture(run:(f:any)=>Promise<void>){
 let now=100000;const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'smooth-local',environment:'test'}),owner=randomUUID(),client=randomUUID();
 const assembly=createExplorationAssembly({now:()=>now,boot:'smooth-boot',crabEnabled:true,resolveDialogue:async()=>{throw Error('MODEL_DISABLED')},initial:(l:string,id:string)=>({...initial(l as any,id),scene:'station',position:{x:733,y:557},flags:['key','unpacked','bag-returned'],known:['mara'],items:{key:1},visited:Object.keys(rooms)})});
 const authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store);let head:Save=await authority.create(owner,randomUUID(),'en');
 const action=(action:string,payload:any={},position=head.position)=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position,target:'',action,payload});
 const playAction=(name='candidate-active-open')=>{const l=head.activePlayClock?.transport?.last.ack;return {...action(name),action_id:activePlayActionId(head.id,(l?.ordinal??0)+1),payload:{ordinal:(l?.ordinal??0)+1,previous:l?.token??'',client,...(name==='candidate-active-open'?{}:{lease:head.activePlayClock?.lease?.id,sequence:head.activePlayClock!.lease!.sequence+1,activeMs:1000})}}};
 const command=(points:any[],activeMs=0,combined=true)=>{const last=head.movingClock?.transport?.last.ack,l=head.movingClock?.lease,play=head.activePlayClock?.lease;return {...action('candidate-motion-step',{},points.at(-1)??head.position),action_id:motionActionId(head.id,(last?.ordinal??0)+1),payload:{transport:1,ordinal:(last?.ordinal??0)+1,previous:last?.token??'',lease:l?.id,sequence:(l?.sequence??0)+1,points,...(combined?{foreground:{client,lease:play?.id,sequence:(play?.sequence??0)+1,activeMs}}:{})}}};
 const send=async(a:any)=>{const ack=await authority.motion(owner,head.id,a);head=applyMotionAck(head,ack);return ack};
 const enable=async()=>{head=(await authority.action(owner,head.id,action('candidate-clock-enable',{millisecondsPerMinute:4000}))).head;const a=command([],0,false);a.action='candidate-motion-open';await send(a);head=applyActivePlayAck(head,await authority.activePlay(owner,head.id,playAction()))};
 try{await run({get head(){return head},store,owner,client,authority,command,send,enable,playAction,advance:(ms:number)=>now+=ms,read:()=>authority.get(owner,head.id)})}finally{await store.close()}
}
test('ACK clipping preserves a collinear extension, later turn and return during a network request',()=>{
 const start={x:0,y:0},accepted=[{x:50,y:0}],live=[{x:100,y:0},{x:100,y:30},{x:80,y:30}];
 assert.deepEqual(consumeTrace(start,live,accepted),live);assert.equal(traceLength(accepted[0],consumeTrace(start,live,accepted)),100);
 assert.deepEqual(consumeTrace(start,live,[{x:100,y:0},{x:100,y:20}]),[{x:100,y:30},{x:80,y:30}]);assert.deepEqual(live,[{x:100,y:0},{x:100,y:30},{x:80,y:30}]);
 assert.throws(()=>consumeTrace(start,live,[{x:1,y:70}]),/MOTION_TRACE_DIVERGED/);assert.equal(predictionHorizon,336);
});
test('one atomic movement ACK advances existing natural time once, with old speed/TTL bounds and no extra motion time',()=>fixture(async f=>{
 await f.enable();const items=structuredClone(f.head.items),cash=f.head.cash;
 for(let i=0;i<6;i++){f.advance(1500);const before=f.head,ack=await f.send(f.command([{x:i%2?733:803,y:557}],1500));assert.equal(ack.version,before.version+1);assert.ok(ack.fields.play);assert.equal(ack.fields.play.lease.sequence,i+1)}
 assert.equal(f.head.townMinutes,542);assert.equal(f.head.activePlayClock.remainderMs,1000);assert.equal(f.head.movingClock.remainderMs,0);assert.deepEqual(f.head.items,items);assert.equal(f.head.cash,cash);
 const before=await f.read();f.advance(1500);await assert.rejects(f.send(f.command([{x:f.head.position.x+150,y:557}],1500)),/MOTION_TOO_FAST/);assert.deepEqual(await f.read(),before);
 f.advance(1600);await assert.rejects(f.send(f.command([],1000)),/MOTION_EXPIRED/);assert.deepEqual(await f.read(),before);
}));
test('foreign/expired/forged time fences roll back both movement and natural time',()=>fixture(async f=>{
 await f.enable();f.advance(1000);const before=await f.read(),a=f.command([{x:773,y:557}],1000);
 for(const change of [{client:randomUUID()},{lease:randomUUID()},{sequence:9},{activeMs:3001},{extra:true}]){const altered={...a,payload:{...a.payload,foreground:{...a.payload.foreground,...change}}};await assert.rejects(f.send(altered),/ACTIVE_LEASE_EXPIRED|ACTIVE_SEQUENCE|INVALID_ACTIVE_ACTION/);assert.deepEqual(await f.read(),before)}
 assert.equal((await f.send(a)).fields.position.x,773);
}));
test('exact/concurrent retry settles combined ACK once; altered same ordinal and another owner cannot write',()=>fixture(async f=>{
 await f.enable();f.advance(1000);const before=await f.read(),a=f.command([{x:773,y:557}],1000),acks=await Promise.all([f.authority.motion(f.owner,f.head.id,a),f.authority.motion(f.owner,f.head.id,a)]);assert.deepEqual(acks[0],acks[1]);const actual=await f.read();assert.equal(actual.version,before.version+1);assert.equal(actual.activePlayClock.remainderMs,1000);assert.deepEqual(await f.authority.motion(f.owner,f.head.id,a),acks[0]);
 await assert.rejects(f.authority.motion(f.owner,f.head.id,{...a,payload:{...a.payload,foreground:{...a.payload.foreground,activeMs:1001}}}),/ACTION_ID_CONFLICT/);await assert.rejects(f.authority.motion('other-owner',f.head.id,a),/SESSION_NOT_FOUND/);assert.deepEqual(await f.read(),actual);
}));
test('old separate clients remain compatible with the combined-capable authority',()=>fixture(async f=>{
 await f.enable();f.advance(1000);const old=await f.send(f.command([{x:763,y:557}],0,false));assert.equal(old.fields.play,undefined);assert.equal(f.head.activePlayClock.remainderMs,0);
 const tick=f.playAction('candidate-active-tick'),ack=await f.authority.activePlay(f.owner,f.head.id,tick);assert.equal(ack.fields.clock.remainderMs,1000);
}));
test('a definite rolled-back packet can refund only bounded eligibility; reset/offline remains zero catch-up',()=>{
 const b=createActivePlayBudget(0,true);assert.equal(b.take(900),900);b.refund(900);assert.equal(b.take(1000),1000);b.refund(4000);assert.equal(b.take(1000),3000);b.reset(1000,false);b.refund(-1);assert.equal(b.take(7000),0);
});
