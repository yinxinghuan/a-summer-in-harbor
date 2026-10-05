/** Adapter-only: readVerifiedContext must be supplied by the supported host
 * integration. No guessed header, query ID, credential format or new login. */
const enc=new TextEncoder();
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');
const fail=code=>{throw Object.assign(Error(code),{code,status:401})};
export function createPlatformOwnerResolver({gameId,readVerifiedContext}={}){
 if(!/^[a-f0-9-]{36}$/.test(gameId??''))throw Error('PLATFORM_GAME_SCOPE_REQUIRED');
 return async request=>{
  if(typeof readVerifiedContext!=='function')fail('PLATFORM_CONTEXT_UNAVAILABLE');
  // This function is an internal trusted dependency, not a public API claim.
  const identity=await readVerifiedContext(request);
  if(!identity||identity.gameId!==gameId||typeof identity.namespace!=='string'||!identity.namespace.trim()||identity.namespace.length>128||typeof identity.subject!=='string'||!identity.subject.trim()||identity.subject.length>256)fail('PLATFORM_IDENTITY_REQUIRED');
  const tuple=[gameId,identity.namespace,identity.subject];
  return Object.freeze({kind:'platform-verified-v1',owner:await hash(['harbor-owner-v1',...tuple]),cacheScope:await hash(['harbor-cache-v1',...tuple])});
 };
}
