import {canonical,sha256} from '../rule-compiler/index.mjs';
import {AuthorityError,assertOwner} from '../authority-session/index.mjs';
export const playerUsagePolicy='player-ai-fair-use-v1';
const DAY=86400000,MINUTE=60000;
const defaults=Object.freeze({dialogue:{daily:1000,minute:20,lease:90000},room:{daily:100,minute:3,lease:330000}});
/** Request allowance is NOT the model-call ledger. Failures keep actual call
 * history while releasing player allowance. Reconciliation survives restart. */
export function createPlayerUsage({store,now=Date.now,limits=defaults,queuePosition=()=>0}){
 const day=t=>Math.floor(t/DAY)*DAY;
 for(const kind of ['dialogue','room'])if(!limits[kind]||['daily','minute','lease'].some(k=>!Number.isSafeInteger(limits[kind][k])||limits[kind][k]<1))throw Error('PLAYER_USAGE_CONFIG');
 async function reconcile(r,owner,row,time){
  if(row.status!=='reserved')return row;
  const evidence=row.kind==='room'?await r.proposal(owner,row.id):await r.receipt(owner,row.id);
  let status=row.status;
  if(row.kind==='dialogue'&&evidence)status=JSON.parse(evidence.response).rejectionCode?'released':'complete';
  if(row.kind==='room'&&evidence){const p=JSON.parse(evidence.data);if(p.status==='ready')status='complete';else if(['failed','rejected','stale'].includes(p.status))status='released';}
  if(status==='reserved'&&Number(row.deadline)<=time)status='released';
  if(status!==row.status)await r.settleUsageRequest(owner,row.kind,row.id,status);
  return {...row,status};
 }
 async function rows(r,owner,time){
  // Include yesterday's unfinished requests across midnight for concurrency.
  return Promise.all((await r.usageRequests(owner,day(time)-DAY)).map(x=>reconcile(r,owner,x,time)));
 }
 function view(all,time){
  const result={policy:playerUsagePolicy,serverNow:time,resetAt:day(time)+DAY,resetZone:'UTC',journeyRoomMaximum:2};
  for(const kind of ['dialogue','room']){
   const list=all.filter(x=>x.kind===kind),today=list.filter(x=>Number(x.created)>=day(time));
   const used=today.filter(x=>x.status==='complete').length,pending=list.filter(x=>x.status==='reserved').length;
   const reserved=today.filter(x=>x.status==='reserved').length,recent=list.filter(x=>Number(x.created)>time-MINUTE);
   result[kind]={maximum:limits[kind].daily,used,pending,remaining:Math.max(0,limits[kind].daily-used-reserved),nearLimit:used+reserved>=Math.ceil(limits[kind].daily*.8),retryAt:recent.length>=limits[kind].minute?Number(recent[recent.length-limits[kind].minute].created)+MINUTE:null};
  }
  return result;
 }
 return Object.freeze({
  async status(owner){assertOwner(owner);const time=now();const v=await store.transaction(async r=>view(await rows(r,owner,time),time));return {...v,queuePosition:queuePosition(owner)};},
  async reserve(owner,kind,id,payload){
   assertOwner(owner);if(!Object.hasOwn(limits,kind)||typeof id!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(id))throw new AuthorityError('INVALID_REQUEST',400);
   const digest=sha256(canonical(payload)),time=now();
   return store.transaction(async r=>{
    const previous=await r.usageRequest(owner,kind,id);
    if(previous){if(previous.digest!==digest)throw new AuthorityError('AI_REQUEST_CONFLICT',409);return {replay:true,...await reconcile(r,owner,previous,time)};}
    const v=view(await rows(r,owner,time),time)[kind];
    if(v.remaining===0)throw new AuthorityError(kind==='dialogue'?'AI_DIALOGUE_DAILY_LIMIT':'AI_ROOM_DAILY_LIMIT',429);
    if(v.retryAt)throw new AuthorityError('AI_COOLDOWN',429);
    if(v.pending)throw new AuthorityError('AI_REQUEST_IN_PROGRESS',429);
    await r.addUsageRequest(owner,kind,id,digest,time,time+limits[kind].lease);return {replay:false,status:'reserved'};
   });
  },
  async settle(owner,kind,id,success){return store.transaction(r=>r.settleUsageRequest(owner,kind,id,success?'complete':'released'));},
 });
}
