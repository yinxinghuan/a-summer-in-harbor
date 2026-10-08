import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initial,type Save} from '../src/story/state';
import {flushMotionTrace} from '../src/candidate/motion-flush';
import {createMovingClock} from '../server/candidate-clock';
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
 const f=fixture();await f.ready();let calls=0;await assert.rejects(flushMotionTrace({...f.options(),points:[{x:783,y:557}],send:async(s,a,p,v)=>{calls++;if(a==='candidate-motion-open')return f.send(s,a,p,v);throw Error('MOTION_EXPIRED')}}),/MOTION_EXPIRED/);assert.equal(calls,3);assert.deepEqual(f.confirmed,[]);
});
test('a journey change prevents the old asynchronous result from editing the new renderer buffer',async()=>{
 const f=fixture();await f.ready();f.advance(500);await assert.rejects(flushMotionTrace({...f.options(),points:[{x:783,y:557}],isCurrent:()=>false}),/MOTION_FLUSH_CANCELLED/);assert.deepEqual(f.confirmed,[]);
});
