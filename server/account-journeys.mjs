/** Isolated candidate. All state stays in the existing authority DB.
 * resolveActor is an INTERNAL policy dependency. The explicit temporary-unverified
 * adapter accepts client IDs; that mode is not authenticated identity.
 * Every public entry/asset/media path must use the access guard before enabling. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {AsyncSessionAuthority} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status})};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const owner=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function createAccountJourneyService({enabled=false,store,runtime,verifyActor,resolveActor=verifyActor,decorateAuthority}={}){
 async function actor(request){
  if(!enabled)fail('ACCOUNT_SERVICE_DISABLED',503);
  if(typeof resolveActor!=='function')fail('PLATFORM_CONTEXT_UNAVAILABLE',401);
  const a=await resolveActor(request);
  if(!a||a.gameId!==store.gameId||!['account','browser'].includes(a.kind)||!owner(a.owner)||a.browserOwner!==undefined&&!owner(a.browserOwner)||typeof a.assertCurrent!=='function')fail('VERIFIED_ACTOR_REQUIRED',401);
  // Snapshot the selected policy context; assurance depends on that policy.
  const proof=Object.freeze({...a});await proof.assertCurrent();return proof;
 }
 async function access(repo,a,id){
  const binding=await repo.accountBinding(id);
  if(binding){if(a.kind!=='account'||binding.account!==a.owner)fail('SESSION_NOT_FOUND',404);return binding.legacy}
  if(!await repo.session(a.owner,id))fail('SESSION_NOT_FOUND',404);return a.owner;
 }
 const callContext=new AsyncLocalStorage();
 // Keep one authority instance: its existing in-flight action dedupe is retained.
 const guardedStore={...store,transaction:work=>store.transaction(async repo=>{
  const scope=callContext.getStore();if(!scope)fail('ACCOUNT_SCOPE_REQUIRED',500);
  const {a,id,storageOwner}=scope;await a.assertCurrent();if(await access(repo,a,id)!==storageOwner)fail('SESSION_ACCESS_CHANGED');
  const result=await work(repo);await a.assertCurrent();return result;
 })};
 const originalAuthority=new AsyncSessionAuthority(guardedStore,runtime);
 const authority=decorateAuthority?decorateAuthority(originalAuthority,guardedStore,runtime):originalAuthority;
 async function invoke(request,id,method,...args){
  const a=await actor(request);if(!uuid(id))fail('INVALID_SESSION');
  const storageOwner=await store.transaction(async repo=>{await a.assertCurrent();return access(repo,a,id)});
  const result=await callContext.run({a,id,storageOwner},()=>authority[method](storageOwner,id,...args));
  // A duplicate waiter must also pass its own current identity, not only the
  // identity of the first request whose in-flight action it reused.
  await store.transaction(async repo=>{await a.assertCurrent();await access(repo,a,id)});return result;
 }
 async function directoryFor(repo,a){
  const own=await repo.list(a.owner),bindings=a.kind==='account'?await repo.accountBindings(a.owner):[];
  const result=[];
  for(const row of own){const binding=await repo.accountBinding(row.id);if(!binding||a.kind==='account'&&binding.account===a.owner)result.push(row)}
  for(const binding of bindings){const row=await repo.session(binding.legacy,binding.session);if(!row)fail('ACCOUNT_BINDING_DANGLING',500);if(!result.some(x=>x.id===row.id))result.push(row)}
  return result.sort((a,b)=>b.updated-a.updated||a.id.localeCompare(b.id)).map(row=>{const h=JSON.parse(row.data);runtime.assertReadable(h);return {id:row.id,version:h.version,cursor:row.cursor,scene:runtime.scene(h),updated:row.updated}});
 }
 return Object.freeze({
  async withStorageAccess(request,id,work){
   const a=await actor(request);if(!uuid(id))fail('INVALID_SESSION');
   const check=()=>store.transaction(async repo=>{await a.assertCurrent();return access(repo,a,id)});
   const storageOwner=await check();const result=await work(storageOwner,a.owner);await check();return result;
  },
  async legacyDirectory(request){const a=await actor(request);if(a.kind!=='account'||!owner(a.browserOwner)||a.browserOwner===a.owner)fail('DUAL_PROOF_REQUIRED',401);return store.transaction(async repo=>{await a.assertCurrent();const d=await directoryFor(repo,{...a,kind:'browser',owner:a.browserOwner});await a.assertCurrent();return d})},
  async directory(request){const a=await actor(request);return store.transaction(async repo=>{await a.assertCurrent();const d=await directoryFor(repo,a);await a.assertCurrent();return d})},
  async claim(request,body){
   const a=await actor(request);if(a.kind!=='account'||!owner(a.browserOwner)||a.browserOwner===a.owner)fail('DUAL_PROOF_REQUIRED',401);
   if(!body||Object.keys(body).some(k=>!['journey','requestId','confirmed'].includes(k))||!uuid(body.journey)||!uuid(body.requestId)||body.confirmed!==true)fail('INVALID_CLAIM',400);
   const {journey,requestId}=body,digest=JSON.stringify([journey,a.browserOwner,'revoke-claimed-browser-v1']);
   return store.transaction(async repo=>{
    await a.assertCurrent();const previous=await repo.accountClaim(a.owner,requestId);
    if(previous){if(previous.digest!==digest)fail('CLAIM_ID_CONFLICT');await a.assertCurrent();return JSON.parse(previous.response)}
    const existing=await repo.accountBinding(journey);
    if(existing&&(existing.account!==a.owner||existing.legacy!==a.browserOwner))fail('CLAIM_CONFLICT');
    if(!await repo.session(a.browserOwner,journey))fail('LEGACY_SESSION_NOT_FOUND',404);
    if(!existing){if((await directoryFor(repo,a)).length>=100)fail('SESSION_LIMIT',429);await repo.addAccountBinding(journey,a.owner,a.browserOwner)}
    const receipt={journey,requestId,policy:'revoke-claimed-browser-v1'};
    await repo.addAccountClaim(a.owner,requestId,digest,receipt);await a.assertCurrent();return receipt;
   });
  },
  async create(request,enrollment,locale){const a=await actor(request);const guarded={...store,transaction:work=>store.transaction(async repo=>{await a.assertCurrent();if((await directoryFor(repo,a)).length>=100&&!await repo.enrollment(a.owner,enrollment))fail('SESSION_LIMIT',429);const result=await work(repo);if(await repo.accountBinding(result.id))fail('ENROLLMENT_ALREADY_CLAIMED',409);await a.assertCurrent();return result})};return new AsyncSessionAuthority(guarded,runtime).create(a.owner,enrollment,locale)},
  async get(request,id){return invoke(request,id,'get')},
  async events(request,id,after){return invoke(request,id,'events',after)},
  async checkpoint(request,id,body){return invoke(request,id,'checkpoint',body)},
  async action(request,id,body){return invoke(request,id,'action',body)},
  ...(decorateAuthority?{async motion(request,id,body){return invoke(request,id,'motion',body)},async activePlay(request,id,body){return invoke(request,id,'activePlay',body)}}:{}),
 });
}
