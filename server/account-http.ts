import type {IncomingMessage,ServerResponse} from 'node:http';
import {createApiHandler,json} from './http';
/** Adapt every public read/write/sidecar through the same account access guard.
 * Raw authority/store remain internal, never an alternate public route. */
export function createAccountApiHandler({service,usage,noteMedia,dynamicAssets,newsProject,lifeProject,landProject}:any){
 return async(req:IncomingMessage,res:ServerResponse,actor:any)=>{
  const path=new URL(req.url!,'http://localhost').pathname;
  if(path==='/api/account/legacy'&&req.method==='GET')return json(res,200,await service.legacyDirectory(actor));
  if(path==='/api/account/claim'&&req.method==='POST'){
   let n=0,parts:Buffer[]=[];for await(const part of req){n+=part.length;if(n>2048)return json(res,413,{error:'REQUEST_TOO_LARGE'});parts.push(part)}
   return json(res,200,await service.claim(actor,JSON.parse(Buffer.concat(parts).toString()||'{}')));
  }
  const authority=Object.fromEntries(['directory','create','get','events','checkpoint','action',...['motion','activePlay'].filter(k=>typeof service[k]==='function')].map(k=>[k,(_who:unknown,...args:unknown[])=>service[k](actor,...args)]));
  // Account usage is shared across that account's journeys; storage artifacts
  // of an explicitly claimed legacy journey stay at their original owner.
  const id=path.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/|$)/)?.[1];
  const run=(storageOwner:string)=>{
   const media=noteMedia&&Object.fromEntries(['status','ensure','image'].map(k=>[k,(_who:unknown,...args:unknown[])=>noteMedia[k](storageOwner,...args)]));
   const dynamic=dynamicAssets&&{policy:{entry:(_who:string,s:string)=>dynamicAssets.policy.entry(storageOwner,s)},context:(_who:string,s:string,fn:()=>Promise<unknown>)=>dynamicAssets.context(storageOwner,s,fn),project:(_who:string,h:unknown)=>dynamicAssets.project(storageOwner,h),handle:(q:unknown,r:unknown,_who:string,...args:unknown[])=>dynamicAssets.handle(q,r,storageOwner,...args)};
   return createApiHandler({authority,usage,noteMedia:media,dynamicAssets:dynamic,newsProject,lifeProject,landProject})(req,res,actor.owner);
  };
  if(id){
   const chunks:Buffer[]=[];let status=200;let headers:any={};
   const output=res;
   res={writeHead:(code:number,h:any)=>{status=code;headers=h??{}},end:(b:any)=>{if(b!==undefined)chunks.push(Buffer.isBuffer(b)?b:b instanceof Uint8Array?Buffer.from(b):Buffer.from(String(b)))}} as unknown as ServerResponse;
   await service.withStorageAccess(actor,id,run);
   output.writeHead(status,headers);return output.end(Buffer.concat(chunks));
  }
  return run(actor.owner);
 };
}
