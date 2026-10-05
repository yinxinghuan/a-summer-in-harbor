import type {IncomingMessage,ServerResponse} from 'node:http';
// @ts-expect-error local candidate, same authority database
import {createAccountJourneyService} from './account-journeys.mjs';
import {temporaryActor,TEMPORARY_IDENTITY_MODE} from './temporary-identity';import {createAccountApiHandler} from './account-http';import {json} from './http';
/** Explicit opt-in after the existing edge/browser boundary. No new token or JWT. */
export function createTemporaryAccountTransport({mode,gameId,store,runtime,usage,noteMedia,dynamicAssets,newsProject}:any){
 if(mode!==TEMPORARY_IDENTITY_MODE)throw Error('TEMPORARY_IDENTITY_DISABLED');
 const contexts=new WeakSet<object>();
 const service=createAccountJourneyService({enabled:true,store,runtime,resolveActor:async(a:object)=>contexts.has(a)?a:null});
 const api=createAccountApiHandler({service,usage,noteMedia,dynamicAssets,newsProject});
 return async(req:IncomingMessage,res:ServerResponse,browserOwner:string)=>{
  const a=temporaryActor(req,res,{mode,gameId,browserOwner});contexts.add(a);
  const path=new URL(req.url!,'http://localhost').pathname;
  if(path==='/api/bootstrap'&&req.method==='POST')return json(res,200,{mode,platformIdentityVerified:false,kind:a.kind});
  return api(req,res,a);
 };
}
