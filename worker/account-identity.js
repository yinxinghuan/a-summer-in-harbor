import {createPlatformOwnerResolver} from './platform-owner.js';
/** Local candidate only. Existing Worker forwarding and PG stay the authority.
 * No production import, no cloud-save path, no browser-owner fallback. */
export function createAccountIdentityAdapter({enabled=false,gameId,readVerifiedContext}={}){
 const resolve=enabled?createPlatformOwnerResolver({gameId,readVerifiedContext}):null;
 return async request=>{
  if(!resolve)throw Object.assign(Error('ACCOUNT_ADAPTER_DISABLED'),{status:503});
  return resolve(request);
 };
}
