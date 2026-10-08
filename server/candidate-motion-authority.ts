import {createHash,randomUUID} from 'node:crypto';
import {MotionRejection} from './motion-failure';
import type {MotionRejectionCode} from '../src/candidate/motion-errors';
import type {Save,Action} from '../src/story/state';
import {motionActionId,type MotionAck} from '../src/candidate/clock-types';
import {createMovingClock} from './candidate-clock';
const wire=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const fail=(code:MotionRejectionCode):never=>{throw new MotionRejection(code)};
const stable=(s:Save)=>{const {scene,position,townMinutes,awakeMinutes,energy,visited,movingClock,version,cursor,...rest}=s;return JSON.stringify(rest)};
/** Candidate-only domain extension. Uses the existing transaction/CAS head, never touches vendor, legacy receipts or prepared rows. */
export function withCompactMotion(authority:any,store:any,runtime:any,motion=createMovingClock(),now=Date.now,play?:{apply:(s:Save,a:Action)=>Save}){
 const inFlight=new Map<string,{hash:string;promise:Promise<MotionAck>}>();
 const method=async(owner:string,id:string,input:Action):Promise<MotionAck>=>{
  if(typeof owner!=='string'||!owner.trim()||owner.length>256)fail('AUTH_REQUIRED');
  const body=wire(input),p=body?.payload as any;
  if(!body||!/^[-a-zA-Z0-9]{16,80}$/.test(body.action_id)||!Number.isSafeInteger(body.expected_version)||body.expected_version<0||!['candidate-motion-open','candidate-motion-step'].includes(body.action)||p?.transport!==1||!Number.isSafeInteger(p.ordinal)||p.ordinal<1||typeof p.previous!=='string'||p.previous.length>80)fail('INVALID_MOTION_ACTION');
  try{runtime.validateAction(body)}catch(error:any){if(error?.message==='INVALID_ACTION')fail('INVALID_ACTION');throw error}
  if(body.action_id!==motionActionId(id,p.ordinal))fail('ACTION_ID_CONFLICT');
  const hash=createHash('sha256').update(JSON.stringify(canonical({id,body}))).digest('hex'),key=owner+':'+id+':'+body.action_id,old=inFlight.get(key);
  if(old){if(old.hash!==hash)fail('ACTION_ID_CONFLICT');return wire(await old.promise)}
  const run=async()=>store.transaction(async(repo:any)=>{
   // Never reuse a historical /action receipt identity in the new protocol.
   if(await repo.receipt(owner,body.action_id))fail('ACTION_ID_CONFLICT');
   const row=await repo.session(owner,id);if(!row)fail('SESSION_NOT_FOUND');
   const before:Save=runtime.upgrade(JSON.parse(row.data));if(JSON.stringify(before)!==row.data)fail('MIGRATION_REQUIRED');runtime.assertReadable(before);
   const last=before.movingClock?.transport?.last;
   if(last&&p.ordinal===last.ack.ordinal){if(body.action_id!==last.ack.actionId||hash!==last.digest)fail('ACTION_ID_CONFLICT');return last.ack}
   if(last&&p.ordinal<last.ack.ordinal)fail('MOTION_RECEIPT_RETIRED');
   if(p.ordinal!==(last?.ack.ordinal??0)+1||p.previous!==(last?.ack.token??''))fail('MOTION_CONFIRMATION_REQUIRED');
   if(before.version!==body.expected_version)fail('VERSION_CONFLICT');
   if(await repo.preparedCount(owner))fail('MOTION_BUSINESS_PREPARED');
   // Movement is synchronous authored geometry: compute and commit under the same writer transaction.
   // The same server elapsed, path sweep, boot and rolling slack checks run for both protocols.
   let next=motion(before,body).head;
   if(stable(next)!==stable(before)||next.id!==id||next.mapVersion!==before.mapVersion||next.version!==before.version+1)fail('UNSUPPORTED_MOTION_DELTA');
   // The two existing validations share one CAS/receipt. The unchanged motion
   // speed/path/TTL checks run first; a bad time fence rolls back the whole head.
   const f=p.foreground;
   if(f!==undefined){
    if(!play)fail('CANDIDATE_ACTIVE_CLOSED');
    if(!f||typeof f!=='object'||Object.keys(f).sort().join(',')!=='activeMs,client,lease,sequence'||typeof f.client!=='string'||!/^[-a-f0-9]{36}$/.test(f.client)||typeof f.lease!=='string'||f.lease.length!==36||!Number.isSafeInteger(f.sequence)||f.sequence<1||!Number.isSafeInteger(f.activeMs)||f.activeMs<0||f.activeMs>3000)fail('INVALID_ACTIVE_ACTION');
    next=play!.apply(next,{...body,scene:next.scene,position:next.position,action:'candidate-active-tick',payload:f});
   }
   const settled=JSON.stringify({...next,nativeCrabV1:undefined});runtime.finalizeMotion?.(before,next);
   if(JSON.stringify({...next,nativeCrabV1:undefined})!==settled)fail('UNSUPPORTED_MOTION_DELTA');
   const cursor=row.cursor+1,{transport:_,...clock}=next.movingClock!;
   const playFields=f?(({transport:_,...c})=>c)(next.activePlayClock!):undefined;
   const ack:MotionAck=wire({schema:1,id,mapVersion:next.mapVersion,baseVersion:before.version,version:next.version,cursor,ordinal:p.ordinal,actionId:body.action_id,token:randomUUID(),fields:{...(playFields?{play:playFields}:{}),...(next.nativeCrabV1?{nativeCrabV1:next.nativeCrabV1}:{}),scene:next.scene,position:next.position,townMinutes:next.townMinutes,awakeMinutes:next.awakeMinutes,energy:next.energy,visited:next.visited,clock}});
   next.cursor=cursor;next.movingClock!.transport={version:1,last:{digest:hash,ack}};runtime.assertReadable(next);
   // Atomic head + latest confirmation. No addReceipt/addEvent/clearPrepared call.
   await repo.write(owner,next,cursor,now());return ack;
  });
  const promise=Promise.resolve().then(run);inFlight.set(key,{hash,promise});try{return wire(await promise)}finally{if(inFlight.get(key)?.promise===promise)inFlight.delete(key)}
 };
 return new Proxy(authority,{get(target,key){if(key==='motion')return method;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value}});
}
