import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initial,type Save} from '../src/story/state';
import {flushMotionTrace} from '../src/candidate/motion-flush';
import {createMovingClock} from '../server/candidate-clock';
import {MotionRejection,motionHttpFailure} from '../server/motion-failure';
import {dynamicWorld} from '../src/dynamic-assets/layout';

function fixture(){
 let at=0,head:Save={...initial('en',randomUUID()),position:{x:733,y:557}},committed:any[]=[];
 const clock=createMovingClock({now:()=>at,boot:'same-p0-boot',worldForSave:s=>dynamicWorld(s.flags,false)});
 const send=async(s:Save,action:string,position:Save['position'],payload:unknown)=>{
  assert.equal(s.version,head.version);const result=clock(head,{action_id:randomUUID(),expected_version:s.version,scene:s.scene,position,target:'',action,payload});head=result.head;committed.push({action,position:{...head.position},at});return result;
 };
 const ready=async()=>{await send(head,'candidate-clock-enable',head.position,{millisecondsPerMinute:4000});await send(head,'candidate-motion-open',head.position,{})};
 const confirmed:any[]=[],wait=async(ms:number)=>{at+=ms};
 return {ready,send,wait,confirmed,committed,head:()=>head,advance:(ms:number)=>at+=ms,options:()=>({head,send,wait,confirmed:(s:Save,p:any[])=>confirmed.push({position:{...s.position},remaining:p})})};
}
test('a 2600ms local age keeps legal pending movement instead of restoring the old coordinate',async()=>{
 const f=fixture();await f.ready();f.advance(2600);const h=await flushMotionTrace({...f.options(),renew:true,points:[{x:783,y:557}]});assert.deepEqual(h.position,{x:783,y:557});assert.equal(f.committed.filter(c=>c.action==='candidate-motion-open').length,1);assert.deepEqual(f.confirmed.at(-1).remaining,[]);
});
test('server-expired movement is confirmed through a fresh bounded lease without deleting the trace',async()=>{
 const f=fixture();await f.ready();f.advance(4000);const h=await flushMotionTrace({...f.options(),renew:true,points:[{x:783,y:557}]});assert.deepEqual(h.position,{x:783,y:557});assert.equal(f.committed.filter(c=>c.action==='candidate-motion-open').length,2);const last=f.committed.at(-1),opened=f.committed.at(-2);assert.ok(last.at-opened.at>=50/112*1000);assert.ok(last.at-opened.at<=3000);assert.deepEqual(h.history,[]);
});
test('an idle renewal makes one request and retains the renderer route and coordinate',async()=>{
 const f=fixture();await f.ready();const count=f.committed.length;await flushMotionTrace({...f.options(),renew:true,force:true,points:[]});assert.equal(f.committed.length,count+1);assert.equal(f.committed.at(-1).action,'candidate-motion-open');assert.deepEqual(f.head().position,{x:733,y:557});
});
test('long pending turns drain as legal prefixes and preserve all corner segments',async()=>{
 const f=fixture();await f.ready();f.advance(4000);const h=await flushMotionTrace({...f.options(),points:[{x:783,y:557},{x:783,y:607},{x:833,y:607}]});assert.deepEqual(h.position,{x:833,y:607});assert.equal(f.committed.filter(c=>c.action==='candidate-motion-step').length,2);assert.ok(f.confirmed.some(c=>c.remaining.length>0));assert.deepEqual(f.confirmed.at(-1).remaining,[]);
});
test('unknown requests, version conflicts and invalid paths are not retried or discarded',async()=>{
 for(const error of ['MODEL_CALL_PENDING_OR_INTERRUPTED','VERSION_CONFLICT','INVALID_MOTION_PATH']){const f=fixture();await f.ready();let calls=0;await assert.rejects(flushMotionTrace({...f.options(),points:[{x:783,y:557}],send:async()=>{calls++;throw Error(error)}}),new RegExp(error));assert.equal(calls,1);assert.deepEqual(f.confirmed,[]);}
});
test('a failed fresh-lease attempt is bounded and keeps the pending path for recovery',async()=>{
 const f=fixture();await f.ready();let calls=0;await assert.rejects(flushMotionTrace({...f.options(),points:[{x:783,y:557}],send:async(s,a,p,v)=>{calls++;if(a==='candidate-motion-open')return f.send(s,a,p,v);throw new MotionRejection('MOTION_EXPIRED')}}),/MOTION_EXPIRED/);assert.equal(calls,3);assert.deepEqual(f.confirmed,[{position:{x:733,y:557},remaining:[{x:783,y:557}]}]);
});
test('a journey change prevents the old asynchronous result from editing the new renderer buffer',async()=>{
 const f=fixture();await f.ready();f.advance(500);await assert.rejects(flushMotionTrace({...f.options(),points:[{x:783,y:557}],isCurrent:()=>false}),/MOTION_FLUSH_CANCELLED/);assert.deepEqual(f.confirmed,[]);
});

test('normal jitter rejection waits only the authored deficit and retains every corner',async()=>{
 const f=fixture();await f.ready();f.advance(300);let rejected:any,waited=0;
 const send=async(...args:Parameters<typeof f.send>)=>{try{return await f.send(...args)}catch(e){rejected=e;throw e}};
 const points=[{x:763,y:557},{x:763,y:567},{x:773,y:567}];
 const h=await flushMotionTrace({...f.options(),send,points,wait:async ms=>{waited+=ms;await f.wait(ms)}});
 assert.equal(rejected.message,'MOTION_TOO_FAST');assert.equal(rejected.retryAfterMs,112);assert.equal(waited,112);assert.ok(waited<50/112*1000);assert.deepEqual(h.position,points.at(-1));
 assert.deepEqual(motionHttpFailure(rejected),{status:409,body:{error:'MOTION_TOO_FAST',terminal:true,retryAfterMs:112}});
});
test('an unknown failure with the same speed/expiry text cannot trigger a new request',async()=>{
 for(const name of ['MOTION_TOO_FAST','MOTION_EXPIRED']){const f=fixture();await f.ready();let calls=0;await assert.rejects(flushMotionTrace({...f.options(),points:[{x:763,y:557}],send:async()=>{calls++;throw Object.assign(Error(name),{status:503,terminal:false,retryAfterMs:1})}}),new RegExp(name));assert.equal(calls,1);assert.deepEqual(f.confirmed,[])}
});
test('a impossible speed path has no retry hint and cannot change the save',async()=>{
 const f=fixture();await f.ready();f.advance(1000);const before=structuredClone(f.head());await assert.rejects(f.send(before,'candidate-motion-step',{x:933,y:557},{lease:before.movingClock!.lease!.id,sequence:1,points:[{x:933,y:557}]}),e=>{assert.equal((e as MotionRejection).retryAfterMs,undefined);return (e as Error).message==='MOTION_TOO_FAST'});assert.deepEqual(f.head(),before);
});

test('more than one wire packet of joystick corners drains without dropping turns or exceeding 32 points',async()=>{
 const f=fixture();await f.ready();f.advance(1200);const start=f.head().position,points=Array.from({length:80},(_,i)=>({x:start.x+(i+1)*.3,y:start.y+(i%2)*.2}));const sent:any[]=[];
 const h=await flushMotionTrace({...f.options(),points,send:async(s,a,p,v:any)=>{if(a==='candidate-motion-step')sent.push(v.points);return f.send(s,a,p,v)}});
 assert.equal(sent.length,3);assert.deepEqual(sent.flat(),points);assert.ok(sent.every(v=>v.length<=28));assert.deepEqual(h.position,points.at(-1));assert.deepEqual(f.confirmed.at(-1).remaining,[]);
});
