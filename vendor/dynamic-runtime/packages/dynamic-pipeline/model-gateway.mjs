import {canonical,sha256} from '../rule-compiler/index.mjs';
import {AuthorityError} from '../authority-session/error.mjs';
import {createModelQueue} from './model-queue.mjs';
const fail=(code,status=422)=>{throw new AuthorityError(code,status);};
const identifier=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const hash=v=>sha256(canonical(v));

/** Internal server gateway, not an HTTP endpoint. Budget id/maximum/transport
 * are trusted operator inputs. Reservations are never refunded or retried.
 * A process lost after reservation remains uncertain and requires inspection.
 */
export async function createModelGateway({store,budgetId,maximum=0,transport,timeoutMs=45000,requireExisting=false,ownerLimits,expiresAt,now=Date.now,meteringOnly=false,queueOptions}){
 if(typeof meteringOnly!=='boolean')fail('MODEL_GATEWAY_CONFIG');
 if(store?.environment!=='test'||!identifier(budgetId)||!Number.isSafeInteger(maximum)||maximum<0||maximum>1000||typeof transport!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)fail('MODEL_GATEWAY_CONFIG');
 if(expiresAt!==undefined&&(!Number.isSafeInteger(expiresAt)||expiresAt<=0))fail('MODEL_GATEWAY_CONFIG');
 if(ownerLimits!==undefined&&(!ownerLimits||Array.isArray(ownerLimits)||typeof ownerLimits!=='object'||!Object.keys(ownerLimits).length||Object.entries(ownerLimits).some(([o,n])=>!o.trim()||o.length>256||!Number.isSafeInteger(n)||n<0||n>maximum)))fail('MODEL_GATEWAY_CONFIG');
 const limits=ownerLimits?Object.freeze({...ownerLimits}):null,ownerBudget=o=>'owner-'+hash({budgetId,owner:o});
 await store.transaction(async r=>{for(const [id,max] of [[budgetId,maximum],...Object.entries(limits??{}).map(([o,n])=>[ownerBudget(o),n])]){const old=await r.modelBudget(id);if(old&&old.maximum!==max)fail('MODEL_BUDGET_CONFIG_CONFLICT');if(!old&&requireExisting)fail('MODEL_APPROVAL_LEDGER_MISSING');if(!old)await r.addModelBudget(id,max);}});
 const inFlight=new Map(),queue=meteringOnly?createModelQueue(queueOptions):null;
 const prior=r=>{if(r.status==='complete')return JSON.parse(r.response);if(r.status==='reserved')fail('MODEL_CALL_PENDING_OR_INTERRUPTED',409);fail(r.error??'MODEL_CALL_FAILED',503);};
 async function execute(owner,id,digest,payload){
  const cached=await store.transaction(async r=>{
   const old=await r.modelCall(budgetId,owner,id);if(old){if(old.digest!==digest)fail('MODEL_REQUEST_CONFLICT',409);return {found:true,value:prior(old)};}
   if(expiresAt!==undefined&&now()>=expiresAt)fail('MODEL_TEST_EXPIRED',410);
   const count=meteringOnly?r.countModelCall:r.useModelBudget;
   if(limits){if(!Object.hasOwn(limits,owner))fail('MODEL_OWNER_FORBIDDEN',403);await count(ownerBudget(owner));}
   await count(budgetId);await r.addModelCall(budgetId,owner,id,digest);return {found:false};
  });
  if(cached.found)return cached.value;
  const controller=new AbortController();let timer;
  try{
   const result=await Promise.race([Promise.resolve().then(()=>transport(structuredClone(payload),{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AuthorityError('MODEL_TIMEOUT',504));},timeoutMs);})]);
   const serialized=JSON.stringify(result);if(serialized===undefined||Buffer.byteLength(serialized)>65536)fail('MODEL_OUTPUT_INVALID');
   const value=JSON.parse(serialized);await store.transaction(r=>r.finishModelCall(budgetId,owner,id,'complete',value));return value;
  }catch(error){
   const code=['MODEL_TIMEOUT','MODEL_OUTPUT_INVALID','MODEL_HTTP_ERROR'].includes(error.code)?error.code:'MODEL_CALL_FAILED';
   // If persistence is unavailable the reservation remains reserved. Never
   // allow that uncertainty to cause a second external call on recovery.
   await store.transaction(r=>r.finishModelCall(budgetId,owner,id,'failed',undefined,code)).catch(()=>{});
   fail(code,503);
  }finally{clearTimeout(timer);}
 }
 return Object.freeze({
  async call({owner,id,purpose,payload}){
   if(typeof owner!=='string'||!owner.trim()||owner.length>256||!identifier(id)||!['dialogue','generation','semantic-review'].includes(purpose))fail('MODEL_REQUEST_INVALID');
   const serialized=JSON.stringify(payload);if(serialized===undefined||Buffer.byteLength(serialized)>65536)fail('MODEL_INPUT_INVALID');
   const value=JSON.parse(serialized),digest=hash({purpose,payload:value}),key=JSON.stringify([owner,id]);
   const old=inFlight.get(key);if(old){if(old.digest!==digest)fail('MODEL_REQUEST_CONFLICT',409);return structuredClone(await old.promise);}
   const promise=queue?queue.execute(key,()=>execute(owner,id,digest,value)):execute(owner,id,digest,value);inFlight.set(key,{digest,promise});
   try{return structuredClone(await promise);}finally{if(inFlight.get(key)?.promise===promise)inFlight.delete(key);}
  },
  queuePosition:(owner,id)=>queue?.position(JSON.stringify([owner,id]))??0,
  usage:()=>store.transaction(async r=>{const v=await r.modelBudget(budgetId);return meteringOnly?{...v,maximum:null,policy:'metering-only-v1'}:v;}),
  ownerUsage:owner=>limits&&Object.hasOwn(limits,owner)?store.transaction(async r=>{const v=await r.modelBudget(ownerBudget(owner));return meteringOnly?{...v,maximum:null,policy:'metering-only-v1'}:v;}):Promise.resolve(null),
 });
}

/** No credentials, alternate host, retries, images or video. Constructing this
 * adapter makes no network request; invoke only behind the approved gateway.
 */
export function createGameChatTransport({fetchImpl=globalThis.fetch}={}){
 return async({messages},{signal})=>{
  if(!Array.isArray(messages)||messages.length<2||messages.length>12||messages.some(m=>!m||Object.keys(m).sort().join(',')!=='content,role'||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'))fail('MODEL_INPUT_INVALID');
  const response=await fetchImpl('https://chat.aiwaves.tech/aigram/api/game-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal,redirect:'error'});
  if(!response.ok)fail('MODEL_HTTP_ERROR',503);
  // Cap the response before JSON parsing, including streamed error payloads.
  const reader=response.body?.getReader();if(!reader)fail('MODEL_OUTPUT_INVALID');
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072){await reader.cancel();fail('MODEL_OUTPUT_INVALID');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('MODEL_OUTPUT_INVALID');}
  const text=data?.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim()||text.length>6000)fail('MODEL_OUTPUT_INVALID');return text.trim();
 };
}
