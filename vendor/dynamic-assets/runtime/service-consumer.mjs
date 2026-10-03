import {canonical,digest,RuntimeResolver} from './core.mjs';
import {ConsumerError,exactFields,checkExpiry,validateGrant,verifyGrantPackage,verifyPinnedManifest,checkReply} from './consumer-contract.mjs';
export function createMemoryByteCache(){const values=new Map();return {get:async k=>values.get(k)?.slice(),set:async(k,v)=>{values.set(k,v.slice());},delete:async k=>{values.delete(k);},keys:async()=>[...values.keys()]};}
function scopedCache(store,prefix){if(!store)return undefined;return {get:k=>store.get(prefix+k),set:(k,v)=>store.set(prefix+k,v),delete:k=>store.delete(prefix+k),keys:async()=>(await store.keys()).filter(k=>typeof k==='string'&&k.startsWith(prefix)).map(k=>k.slice(prefix.length))};}
const denied=e=>e instanceof ConsumerError&&['AUTH_DENIED','GRANT_EXPIRED'].includes(e.code);
/** Browser-safe. Host supplies endpoint getter, exact build descriptor and prepackaged manifest/bytes. No token or platform identity invention. */
export async function createServiceConsumer({baseUrl,descriptor,manifestBytes,packagedFiles,fetchImpl=globalThis.fetch,cacheStore,maxCacheBytes=16*1024**2,timeoutMs=5000,now=Date.now,baseURI}={}){
 if(typeof baseUrl!=='function'||typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw new TypeError('Endpoint getter, transport and valid timeout required');
 const grant=JSON.parse(canonical(descriptor));await validateGrant(grant);if(!Number.isSafeInteger(maxCacheBytes)||maxCacheBytes<0||maxCacheBytes>16*1024**2||grant.pins.reduce((n,p)=>n+p.bytes,0)>32*1024**2)throw new ConsumerError('CONSUMER_BUDGET');
 const frozenManifests=new Map(),fallback=new Map();for(const p of grant.pins){const key=`${p.assetId}:${p.revision}`,m=manifestBytes.get(key);if(!(m instanceof Uint8Array)||m.length>128*1024)throw new ConsumerError('MANIFEST_SIZE');frozenManifests.set(key,m.slice());const b=packagedFiles.get(p.hash);if(b!==undefined){if(!(b instanceof Uint8Array)||b.length>5*1024**2)throw new ConsumerError('PACKAGED_SIZE');fallback.set(p.hash,b.slice());}}
 const {grantHash,catalog}=await verifyGrantPackage(grant,frozenManifests),prefix=`rpg-asset:${grantHash}:`,cache=scopedCache(cacheStore,prefix);
 const clear=async()=>{if(cache)for(const key of await cache.keys())await cache.delete(key);};
 async function request(action,pin,outerSignal){
  const endpoint=new URL(baseUrl(),baseURI);if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!endpoint.pathname.endsWith('/')||!(endpoint.protocol==='https:'||endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))throw new ConsumerError('INVALID_ENDPOINT');
  const url=new URL(action,endpoint),controller=new AbortController();let timer;const abort=()=>controller.abort();outerSignal?.addEventListener('abort',abort,{once:true});if(outerSignal?.aborted)controller.abort();
  const operation=(async()=>{const response=await fetchImpl(url.href,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consumerId:grant.scope.consumerId,grantHash,...(pin?{pin}: {})}),credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal});
   if([401,403,410].includes(response.status)){await response.body?.cancel();throw new ConsumerError(response.status===410?'GRANT_EXPIRED':'AUTH_DENIED');}if(!response.ok){await response.body?.cancel();throw new ConsumerError('DELIVERY_FAILURE');}
   if(response.redirected)throw new ConsumerError('REDIRECT_REJECTED');const limit=action==='blob'?pin.bytes:128*1024,declared=response.headers.get('content-length');if(declared!==null&&(!/^[0-9]+$/.test(declared)||Number(declared)>limit))throw new ConsumerError('RESPONSE_SIZE');
   const mime=response.headers.get('content-type')?.split(';')[0];if(mime!==(action==='blob'?pin.mime:'application/json'))throw new ConsumerError('RESPONSE_MIME');
   const chunks=[];let size=0;const reader=response.body?.getReader();if(!reader)throw new ConsumerError('EMPTY_RESPONSE');try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new ConsumerError('RESPONSE_SIZE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(size);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.length;}
   if(action==='check'){const reply=JSON.parse(new TextDecoder().decode(bytes));if(canonical(reply)!==canonical(checkReply(grant,grantHash)))throw new ConsumerError('CHECK_BINDING_MISMATCH');}
   else if(response.headers.get('x-consumer-grant')!==grantHash)throw new ConsumerError('RESPONSE_GRANT_MISMATCH');
   return bytes;
  })();
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ConsumerError('REQUEST_TIMEOUT'));},timeoutMs);});
  try{return await Promise.race([operation,deadline]);}finally{clearTimeout(timer);outerSignal?.removeEventListener('abort',abort);}
 }
 async function resolve(options={}){
  exactFields(options,['scope','roomHash','templateHash']);if(options.scope&&canonical(options.scope)!==canonical(grant.scope)||options.roomHash&&options.roomHash!==grant.room.hash||options.templateHash&&options.templateHash!==grant.template.hash)throw new ConsumerError('CONSUMER_SCOPE_MISMATCH');
  let authorizationFailure;const remote=async(action,pin,signal)=>{try{return await request(action,pin,signal);}catch(e){if(denied(e))authorizationFailure=e;throw e;}};
  try{
   checkExpiry(grant,now());
   // Authorization is independent of cached bytes. Every load and final commit checks the live binding.
   try{await remote('check');for(const pin of grant.pins)await verifyPinnedManifest(grant,pin,await remote('manifest',pin));}
   catch(e){if(denied(e))throw e;const resolver=new RuntimeResolver({catalog,readonlyLoad:async()=>{throw e;},maxCacheBytes,loadTimeoutMs:timeoutMs});const result=await resolver.resolveWithFallback(grant.room,{template:grant.room,packagedFiles:fallback});checkExpiry(grant,now());return {...result,reason:'service-check-or-source-unavailable',consumerGrantHash:grantHash,source:'exact-packaged-pair',remoteAuthorizationConfirmed:false};}
   const resolver=new RuntimeResolver({catalog,cacheStore:cache,maxCacheBytes,loadTimeoutMs:timeoutMs,readonlyLoad:(pin,{signal})=>remote('blob',pin,signal)});
   const result=await resolver.resolveWithFallback(grant.room,{template:grant.room,packagedFiles:fallback});
   if(authorizationFailure)throw authorizationFailure;
   try{await remote('check');}catch(e){if(denied(e))throw e;const offline=new RuntimeResolver({catalog,readonlyLoad:async()=>{throw e;},maxCacheBytes,loadTimeoutMs:timeoutMs});const safe=await offline.resolveWithFallback(grant.room,{template:grant.room,packagedFiles:fallback});checkExpiry(grant,now());return {...safe,reason:'final-check-unavailable',consumerGrantHash:grantHash,source:'exact-packaged-pair',remoteAuthorizationConfirmed:false};}
   checkExpiry(grant,now());return {...result,consumerGrantHash:grantHash,source:result.mode==='requested'?'service-or-verified-cache':'exact-packaged-pair',remoteAuthorizationConfirmed:true};
  }catch(e){if(denied(e))await clear();throw e;}
 }
 return Object.freeze({grantHash,scope:structuredClone(grant.scope),resolve,clearCache:clear});
}
