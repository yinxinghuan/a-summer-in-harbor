import type {Save} from '../story/state';
import type {Point} from '../engine/world';
import {globalPoint,isCluster,localPoint,pointZone} from './continuity';
import {resolvedMotionFailure} from './motion-errors';
import {motionPacketPoints} from './motion-outbox';

type Sender=(head:Save,action:string,position:Point,payload:unknown)=>Promise<{head:Save}>;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Keep every corner. A fresh lease admits a bounded prefix using fresh server
 * elapsed time; it never authorizes an expired lease or an old offline interval. */
function prefix(start:Point,points:Point[],limit:number){
 const taken:Point[]=[],rest=points.map(p=>({...p}));let previous=start,total=0;
 while(rest.length&&taken.length<motionPacketPoints){const p=rest[0],d=distance(previous,p),left=limit-total;
  if(d>left+1e-7){taken.push({x:previous.x+(p.x-previous.x)*left/d,y:previous.y+(p.y-previous.y)*left/d});total+=left;break;}
  taken.push(rest.shift()!);total+=d;previous=p;if(total>=limit-1e-7)break;
 }
 return {taken,rest,distance:total};
}
export async function flushMotionTrace({head,points,force=false,renew=false,limit=140,maxBatches=Infinity,send,wait,confirmed,isCurrent=()=>true}:{head:Save;points:Point[];force?:boolean;renew?:boolean;limit?:number;maxBatches?:number;send:Sender;wait:(ms:number)=>Promise<void>;confirmed:(head:Save,remaining:Point[],accepted:Point[])=>void;isCurrent?:()=>boolean}){
 let remaining=points.map(p=>({...p})),opened=false;
 const open=async()=>{head=(await send(head,'candidate-motion-open',head.position,{})).head;opened=true;};
 const accept=(accepted:Point[]=[])=>{if(!isCurrent())throw Error('MOTION_FLUSH_CANCELLED');confirmed(head,remaining.map(p=>({...p})),accepted);};
 if(!head.movingClock?.lease||renew&&!remaining.length){await open();accept();}
 // Opening an idle lease already renews it; do not spend another round trip.
 if(!remaining.length){if(force&&!opened){head=(await send(head,'candidate-motion-step',head.position,{lease:head.movingClock!.lease!.id,sequence:head.movingClock!.lease!.sequence+1,points:[]})).head;accept();}return head;}
 let batches=0;while(remaining.length&&batches++<maxBatches){
  const chunk=prefix(globalPoint(head.scene,head.position),remaining,limit);
  const step=async()=>{
   const zone=isCluster(head.scene)?chunk.taken.reduce((z,p)=>pointZone(p,z),head.scene):head.scene,end=chunk.taken.at(-1)!;
   return (await send(head,'candidate-motion-step',isCluster(zone)?localPoint(zone,end):end,{lease:head.movingClock!.lease!.id,sequence:head.movingClock!.lease!.sequence+1,points:chunk.taken})).head;
  };
  if(opened&&chunk.distance>0)await wait(Math.ceil(chunk.distance/112*1000)+1);
  try{head=await step();}catch(e:any){
   // Only a definite terminal expiry can be recovered. Unknown requests and
   // version/owner/path failures retain the normal durable recovery path.
   if(!resolvedMotionFailure(e)||!['MOTION_EXPIRED','MOTION_TOO_FAST'].includes(e.message))throw e;
   if(e.message==='MOTION_EXPIRED'){await open();accept()}if(!isCurrent())throw Error('MOTION_FLUSH_CANCELLED');
   const hint=e.message==='MOTION_TOO_FAST'&&Number.isSafeInteger(e.retryAfterMs)&&e.retryAfterMs>0&&e.retryAfterMs<=1251?e.retryAfterMs:Math.ceil(chunk.distance/112*1000)+1;
   await wait(hint);head=await step();
  }
  remaining=chunk.rest;accept(chunk.taken);opened=true;
 }
 return head;
}
