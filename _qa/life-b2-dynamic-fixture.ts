/** Loopback QA only: unmodified local published export -> existing bridge/reader.
 * The edge and accounts are synthetic; no production role, store or network. */
import {readFileSync,readdirSync} from 'node:fs';import {join} from 'node:path';import {randomBytes,createHash} from 'node:crypto';
import templates from '../server/dynamic-assets/templates.json';
import {GAME_UUID} from '../src/game-id';
// @ts-expect-error existing frozen bridge
import {createHarborLibraryBridge} from '../server/dynamic-assets/bridge.mjs';
// @ts-expect-error existing request context
import {requestContext} from '../server/dynamic-assets/policy.mjs';
// @ts-expect-error existing byte transport
import {encodePackage} from '../src/dynamic-assets/wire.mjs';
// @ts-expect-error existing authority
import {AsyncSessionAuthority} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
export function localDynamicFixture(store:any,runtime:any,ids:Set<string>){
 const root=process.env.HARBOR_B2_QA_ASSET_EXPORT;if(!root)return undefined;
 const manifests=readdirSync(join(root,'manifests')).filter(f=>f.endsWith('.json')).map(f=>readFileSync(join(root,'manifests',f),'utf8'));
 for(const t of templates){const text=manifests.find(x=>{const m=JSON.parse(x);return m.assetId===t.allowedAssetId&&Number(m.revision)===t.allowedRevision});if(!text)throw Error('QA_FIXED_MANIFEST_MISSING');const m=JSON.parse(text),f=m.files.find((f:any)=>f.path==='original.png'),b=readFileSync(join(root,'assets',f.sha256,'original.png'));if(b.length!==f.bytes||createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('QA_FIXED_BYTES_MISMATCH')}
 const catalog={searchPublished:async()=>manifests,getManifest:async(pin:any)=>{const text=manifests.find(x=>{const m=JSON.parse(x);return m.assetId===pin.assetId&&Number(m.revision)===pin.revision});if(!text)throw Error('QA_PIN_UNKNOWN');return text},getFile:async(_pin:any,file:any)=>new Uint8Array(readFileSync(join(root,'assets',file.sha256,'original.png')))};
 const records=new Map<string,any>(),key=(k:any)=>JSON.stringify([k.owner,k.sessionId,k.roomId]),assetStore={get:async(k:any)=>records.get(key(k)),putIfAbsent:async(k:any,v:any)=>{if(!records.has(key(k)))records.set(key(k),structuredClone(v));return structuredClone(records.get(key(k)))},renew:async(k:any,_previous:any,v:any)=>{records.set(key(k),structuredClone(v));return structuredClone(v)}};
 const policy={entry:(_owner:string,id:string)=>ids.has(id)?{syntheticOnly:true}:null,assert:(owner:string,id:string)=>{if(!/^[a-f0-9]{64}$/.test(owner)||!ids.has(id))throw Error('QA_ASSET_SCOPE_DENIED')},expires:()=>Date.now()+86400000};
 const token=randomBytes(32).toString('hex'),bridge=createHarborLibraryBridge({authority:new AsyncSessionAuthority(store,runtime),store:assetStore,catalog,templates,config:{timePolicy:'user-approved-budget-only-20261001',expiresAt:null,publicOrigin:'http://127.0.0.1:5441'},edgeToken:token,policy});
 const context=(owner:string,id:string,fn:()=>any)=>requestContext.run({owner,sessionId:id,dynamicGeometry:ids.has(id)},fn);
 return {policy,context,project:async(_owner:string,head:any)=>ids.has(head.id)?{...head,dynamicAssetRooms:templates.map(t=>t.roomId)}:head,
  handle:async(_req:any,res:any,owner:string,id:string,room:string,op:string,body:any)=>context(owner,id,async()=>{
   policy.assert(owner,id);if(!['home','cafe','garden'].includes(room))throw Error('QA_ROOM_UNKNOWN');
   const req={headers:{'x-harbor-edge':token,'x-harbor-owner':owner,'x-harbor-game':GAME_UUID,origin:'http://127.0.0.1:5441'}};
   if(op==='prepare'||op==='package'){const r=op==='prepare'?await bridge.prepare(req,id,room):{record:await bridge.package(req,id,room),kind:'locked'};if(r.kind!=='locked')throw Error('QA_ASSET_UNAVAILABLE');const record=r.record,g=record.grant;res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({attachment:{grantHash:record.grantHash,roomHash:g.room.hash,templateHash:g.template.hash,scope:g.scope},package:encodePackage(record)}))}
   const r=await bridge.deliver(req,id,room,op,body);res.writeHead(200,{'Content-Type':r.mime,'Cache-Control':'no-store','X-Consumer-Grant':r.grantHash});res.end(r.bytes);
  })};
}
