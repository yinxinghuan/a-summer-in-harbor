import {randomUUID} from 'node:crypto';
import {MotionRejection} from './motion-failure';
import type {MotionRejectionCode} from '../src/candidate/motion-errors';
import type {Save,Action} from '../src/story/state';
import {advanceTown,townMinutes} from '../src/world/residents';
import {advanceAwake} from '../src/story/fatigue';
import {battleLocksWorld} from '../src/story/turn-battle';
import {worldWithFlags} from '../src/world/data';
import {walkable,type Point,type World} from '../src/engine/world';
import {clusterWalkable,globalPoint,localPoint,isCluster,pointZone,sameCluster} from '../src/candidate/continuity';
const fail=(ok:unknown,code:MotionRejectionCode|'CLOCK_CHANGE_BUSY'|'INVALID_CLOCK_RATE')=>{if(!ok){if(code==='CLOCK_CHANGE_BUSY'||code==='INVALID_CLOCK_RATE')throw Error(code);throw new MotionRejection(code)}};
const validTransport=(c:Save['movingClock'])=>{if(!c?.transport)return true;const t=c.transport,a=t.last?.ack;return t.version===1&&typeof t.last?.digest==='string'&&/^[a-f0-9]{64}$/.test(t.last.digest)&&a?.schema===1&&a.mapVersion===1&&Number.isSafeInteger(a.ordinal)&&a.ordinal>0&&Number.isSafeInteger(a.version)&&a.version===a.baseVersion+1&&Number.isSafeInteger(a.cursor)&&typeof a.actionId==='string'&&typeof a.token==='string'&&a.token.length===36&&!!a.fields?.clock&&!('transport' in a.fields.clock)};
export const validClock=(s:Save)=>!s.movingClock||(s.movingClock.version===2&&validTransport(s.movingClock)&&(s.movingClock.fractionalMs===undefined||Number.isFinite(s.movingClock.fractionalMs)&&s.movingClock.fractionalMs>=0&&s.movingClock.fractionalMs<1)&&[2000,4000].includes(s.movingClock.millisecondsPerMinute)&&Number.isSafeInteger(s.movingClock.remainderMs)&&s.movingClock.remainderMs>=0&&s.movingClock.remainderMs<s.movingClock.millisecondsPerMinute&&(s.movingClock.speedSlackUnits===undefined||Number.isFinite(s.movingClock.speedSlackUnits)&&s.movingClock.speedSlackUnits>=0&&s.movingClock.speedSlackUnits<=4)&&(!s.movingClock.lease||typeof s.movingClock.lease.id==='string'&&typeof s.movingClock.lease.boot==='string'&&Number.isSafeInteger(s.movingClock.lease.sequence)&&s.movingClock.lease.sequence>=0&&Number.isSafeInteger(s.movingClock.lease.lastAt)&&s.movingClock.lease.lastAt>=0));
/** Server time only bounds admitted motion. There is no offline catch-up or client elapsed field. */
export function createMovingClock({now=Date.now,boot=randomUUID(),worldForSave=(s:Save)=>worldWithFlags(s.flags)}:{now?:()=>number;boot?:string;worldForSave?:(s:Save)=>World}={}){
 return (before:Save,a:Action)=>{
  fail(a.scene===before.scene&&a.expected_version===before.version,'VERSION_CONFLICT');
  const s=structuredClone(before),payload=(a.payload??{}) as any,w=worldForSave(s);
  if(a.action==='candidate-clock-enable'){
   fail(!s.activeChallenge&&!battleLocksWorld(s),'CLOCK_CHANGE_BUSY');
   fail([2000,4000].includes(payload.millisecondsPerMinute),'INVALID_CLOCK_RATE');
   fail(Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)<.01,'UNVERIFIED_POSITION');
   // Switching rates preserves accrued sub-minute time; never adds retroactive minutes.
   const progress=((s.movingClock?.remainderMs??0)+(s.movingClock?.fractionalMs??0))*payload.millisecondsPerMinute/(s.movingClock?.millisecondsPerMinute??payload.millisecondsPerMinute);
   s.movingClock={version:2,millisecondsPerMinute:payload.millisecondsPerMinute,remainderMs:Math.floor(progress),fractionalMs:progress-Math.floor(progress),speedSlackUnits:s.movingClock?.speedSlackUnits??4,...(s.movingClock?.transport?{transport:s.movingClock.transport}:{})};
  }else{
   fail(s.movingClock,'CLOCK_NOT_ENABLED');
   fail(!s.activeChallenge&&!battleLocksWorld(s),'CHALLENGE_ACTIVE');
   if(a.action==='candidate-motion-open'){
    fail(Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)<.01,'UNVERIFIED_POSITION');
    s.movingClock!.lease={id:randomUUID(),boot,sequence:0,lastAt:now()};
   }else{
    fail(a.action==='candidate-motion-step','INVALID_MOTION_ACTION');
    const lease=s.movingClock!.lease,at=now();
    fail(lease&&lease.boot===boot&&lease.id===payload.lease,'MOTION_EXPIRED');
    fail(payload.sequence===lease!.sequence+1,'MOTION_SEQUENCE');
    const elapsed=at-lease!.lastAt;fail(Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=3000,'MOTION_EXPIRED');
    fail(Array.isArray(payload.points)&&payload.points.length<=32,'INVALID_MOTION_PATH');
    const allowance=112*Math.min(elapsed,1250)/1000+(s.movingClock!.speedSlackUnits??4);
    let previous=isCluster(s.scene)?globalPoint(s.scene,s.position):s.position,distance=0,zone=s.scene;
    for(const point of payload.points as Point[]){
     fail(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'INVALID_MOTION_PATH');
     const d=Math.hypot(point.x-previous.x,point.y-previous.y),n=Math.max(1,Math.ceil(d));
     fail(distance+d<=allowance+1e-7,'MOTION_TOO_FAST');
     for(let i=1;i<=n;i++){const q={x:previous.x+(point.x-previous.x)*i/n,y:previous.y+(point.y-previous.y)*i/n};fail(isCluster(s.scene)?clusterWalkable(w,q,zone):walkable(w,s.scene,q),'INVALID_MOTION_PATH');const next=isCluster(s.scene)?pointZone(q,zone):zone;fail(next===zone||s.flags.includes('unpacked'),'SETTLE_FIRST');zone=next;if(!s.visited.includes(zone))s.visited.push(zone)}
     distance+=d;previous=point;
    }
    fail(distance<=allowance+1e-7,'MOTION_TOO_FAST');
    // A rolling four-unit interpolation allowance, NOT a free tolerance on every packet/lease.
    s.movingClock!.speedSlackUnits=Math.max(0,Math.min(4,allowance-distance));
    fail(zone===s.scene||sameCluster(zone,s.scene)&&s.flags.includes('unpacked'),'SETTLE_FIRST');
    s.scene=zone;s.position=isCluster(zone)?localPoint(zone,previous):{...previous};
    fail(Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)<.01,'MOTION_ENDPOINT');
    if(!s.visited.includes(zone))s.visited.push(zone);
    const movedMs=Math.min(distance/112*1000,elapsed,1250),total=s.movingClock!.remainderMs+(s.movingClock!.fractionalMs??0)+movedMs,whole=Math.floor(total+1e-7);
    const minutes=Math.floor(whole/s.movingClock!.millisecondsPerMinute);s.movingClock!.remainderMs=whole%s.movingClock!.millisecondsPerMinute;s.movingClock!.fractionalMs=Math.max(0,total-whole);
    if(!s.activePlayClock){advanceTown(s,minutes);advanceAwake(s,minutes)}else{s.movingClock!.remainderMs=0;s.movingClock!.fractionalMs=0}lease!.sequence=payload.sequence;lease!.lastAt=at;
   }
  }
  fail(validClock(s)&&townMinutes(s)>=townMinutes(before),'INVALID_CLOCK');s.version++;s.cursor++;
  return {head:s,text:['移动进度已保存。','Walking progress saved.'] as [string,string],kind:'action',accepted:true,actionId:a.action};
 };
}
/** Put outside existing life/news wrappers, whose spatial checks assume an ordinary business action. */
export function withMovingClock<T extends {prepare:(...args:any[])=>any;assertReadable:(s:any)=>void}>(base:T,motion=createMovingClock()){
 return {...base,spatialContext(s:Save){if(s.movingClock)throw Error('MOTION_CHECKPOINT_REQUIRED');return s},
  async prepare(s:Save,a:Action,...context:any[]){
   if(a.action.startsWith('candidate-')){if(a.action!=='candidate-clock-enable'&&s.movingClock?.transport)throw Error('MOTION_CHANNEL_REQUIRED');const result=motion(s,a);base.assertReadable(result.head);return result}
   if(s.movingClock&&Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)>4)throw Error('UNVERIFIED_POSITION');
   return base.prepare(s,a,...context);
  }};
}
