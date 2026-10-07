import {randomUUID} from 'node:crypto';
import type {Save,Action} from '../src/story/state';
import type {ActivePlayRate} from '../src/candidate/active-play-types';
import {advanceTown,townMinutes} from '../src/world/residents';
import {advanceAwake} from '../src/story/fatigue';
import {battleLocksWorld} from '../src/story/turn-battle';
import {MotionRejection} from './motion-failure';
import {brandActivePrepareFailure} from './active-business-failure';
export const activePlayLeaseMs=3000;
export function validActivePlay(s:Save){
 const c=s.activePlayClock;if(!c)return true;const l=c.lease,t=c.transport,a=t?.last?.ack;
 return c.schema===1&&[2000,4000].includes(c.millisecondsPerMinute)&&Number.isSafeInteger(c.remainderMs)&&c.remainderMs>=0&&c.remainderMs<c.millisecondsPerMinute&&(!l||typeof l.id==='string'&&l.id.length===36&&typeof l.client==='string'&&l.client.length===36&&typeof l.boot==='string'&&Number.isSafeInteger(l.sequence)&&l.sequence>=0&&Number.isSafeInteger(l.lastAt)&&l.lastAt>=0)&&(!t||typeof t.last.digest==='string'&&/^[a-f0-9]{64}$/.test(t.last.digest)&&a?.channel==='active-play'&&a.id===s.id&&a.version===a.baseVersion+1&&Number.isSafeInteger(a.ordinal)&&a.ordinal>0&&Number.isSafeInteger(a.cursor)&&typeof a.token==='string'&&a.token.length===36&&!('transport' in a.fields.clock));
}
/** No catch-up: a missing/stale/backward/other-boot lease contributes zero. */
export function createActivePlayClock({now=Date.now,boot=randomUUID(),defaultRate=4000 as ActivePlayRate}:{now?:()=>number;boot?:string;defaultRate?:ActivePlayRate}={}){
 if(![2000,4000].includes(defaultRate))throw Error('INVALID_ACTIVE_RATE');
 const eligible=(s:Save)=>!s.activeChallenge&&!battleLocksWorld(s);
 const settle=(s:Save,at:number,activeMs:number)=>{
  const c=s.activePlayClock,l=c?.lease;if(!c||!l)return;
  const elapsed=at-l.lastAt;
  if(l.boot!==boot||!eligible(s)||elapsed<0||elapsed>activePlayLeaseMs)return;
  const total=c.remainderMs+Math.min(elapsed,activeMs),minutes=Math.floor(total/c.millisecondsPerMinute);
  c.remainderMs=total%c.millisecondsPerMinute;advanceTown(s,minutes);advanceAwake(s,minutes);
 };
 const apply=(before:Save,a:Action)=>{
  const s=structuredClone(before),p=a.payload as any,at=now();
  if(!Number.isSafeInteger(at)||at<0)throw new MotionRejection('INVALID_ACTIVE_CLOCK');
  if(a.scene!==s.scene||Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)>.01)throw new MotionRejection('UNVERIFIED_POSITION');
  const c=s.activePlayClock??(s.activePlayClock={schema:1,millisecondsPerMinute:defaultRate,remainderMs:0}),l=c.lease;
  if(a.action==='candidate-active-open'){
   if(!eligible(s))throw new MotionRejection('CHALLENGE_ACTIVE');
   if(p.millisecondsPerMinute!==undefined&&p.millisecondsPerMinute!==c.millisecondsPerMinute)throw new MotionRejection('INVALID_ACTIVE_RATE');
   if(l&&l.client!==p.client&&l.boot===boot&&at>=l.lastAt&&at-l.lastAt<=activePlayLeaseMs)throw new MotionRejection('ACTIVE_LEASE_BUSY');
   // Resume/open never settles the earlier interval, including same-tab reload.
   c.lease={id:randomUUID(),client:p.client,boot,sequence:0,lastAt:at};
  }else{
   if(!Number.isSafeInteger(p.activeMs)||p.activeMs<0||p.activeMs>activePlayLeaseMs)throw new MotionRejection('INVALID_ACTIVE_ACTION');
   if(!l||l.id!==p.lease||l.client!==p.client||l.boot!==boot)throw new MotionRejection('ACTIVE_LEASE_EXPIRED');
   if(p.sequence!==l.sequence+1)throw new MotionRejection('ACTIVE_SEQUENCE');
   if(a.action==='candidate-active-pause'){settle(s,at,p.activeMs);delete c.lease}
   else if(a.action==='candidate-active-tick'){
    if(!eligible(s))throw new MotionRejection('CHALLENGE_ACTIVE');
    const elapsed=at-l.lastAt;if(elapsed<0||elapsed>activePlayLeaseMs)throw new MotionRejection('ACTIVE_LEASE_EXPIRED');
    settle(s,at,p.activeMs);l.sequence=p.sequence;l.lastAt=at;
   }else throw new MotionRejection('INVALID_ACTIVE_ACTION');
  }
  if(!validActivePlay(s)||townMinutes(s)<townMinutes(before))throw new MotionRejection('INVALID_ACTIVE_CLOCK');
  return s;
 };
 const business=(before:Save,a:Action)=>{
  const s=structuredClone(before),c=s.activePlayClock;if(!c)return s;
  const l=c.lease,fence=a.activePlay;
  if(l){if(!fence||fence.client!==l.client||fence.lease!==l.id||!Number.isSafeInteger(fence.activeMs)||fence.activeMs!<0||fence.activeMs!>activePlayLeaseMs)throw new MotionRejection('ACTIVE_CONFIRMATION_REQUIRED');settle(s,now(),fence.activeMs!);delete c.lease}
  return s;
 };
 return {apply,business};
}
/** Settlement is a candidate in the existing action CAS/receipt transaction.
 * Failed prepare/commit saves neither natural time nor business cost. */
export function withActivePlayRuntime<T extends {prepare:(...args:any[])=>any;assertReadable:(s:Save)=>void}>(base:T,clock:ReturnType<typeof createActivePlayClock>){
 return {...base,assertReadable(s:Save){if(!validActivePlay(s))throw Error('UNSUPPORTED_SAVE');base.assertReadable(s)},
  async prepare(s:Save,a:Action,...context:any[]){try{return await base.prepare(a.action.startsWith('candidate-')?s:clock.business(s,a),a,...context)}catch(error){throw s.activePlayClock||a.activePlay?brandActivePrepareFailure(error):error}}};
}
