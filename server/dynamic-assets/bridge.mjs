/** Restricted dynamic asset bridge.
 * Catalog/store/template ports are trusted server dependencies, never request data.
 * Browser-capability owner is NOT an AlterU account or a library role. */
import {verifiedEdgeOwner} from '../../server/public-config.ts';
import {GAME_UUID} from '../../src/game-id.ts';
import * as contract from '../../vendor/dynamic-assets/runtime/core.mjs';
import {publishedManifestEntry} from '../../vendor/dynamic-assets/runtime/eligibility.mjs';
import {selectEligibleAsset} from '../../vendor/dynamic-assets/runtime/selection-adapter.mjs';
import {prepareSelectedGrant} from '../../vendor/dynamic-assets/runtime/grant-preparation.mjs';
import {validateGrant,verifyGrantPackage,verifyPinnedManifest,checkExpiry,checkReply} from '../../vendor/dynamic-assets/runtime/consumer-contract.mjs';
import {createAssetSelector} from '../../vendor/dynamic-assets/selection.mjs';
const copy=structuredClone,bytes=text=>new TextEncoder().encode(text);
import {fail} from './policy.mjs';
export function createHarborLibraryBridge({authority,store,catalog,templates,config,edgeToken,policy,now=Date.now,ttlMs=3600000}){
 if(!authority?.get||!store?.get||!store?.putIfAbsent||!catalog?.searchPublished||!catalog?.getManifest||!catalog?.getFile||!Number.isInteger(ttlMs)||ttlMs<1000||ttlMs>86400000)fail('TRUSTED_ASSET_PORTS_REQUIRED');
 const definitions=new Map(templates.map(t=>[t.roomId,copy(t)]));const selector=createAssetSelector({contract});
 async function access(req,sessionId,roomId){
  const owner=verifiedEdgeOwner(req,config,edgeToken);policy.assert(owner,sessionId);const head=await authority.get(owner,sessionId),template=definitions.get(roomId);
  // The existing authority owns visits/admission; client does not supply profile or placement.
  if(!template||!template.id||head.scene!==roomId&&!(head.fieldNotes?.rooms??[]).some(r=>r.id===roomId))fail('ROOM_ASSET_SCOPE_DENIED');
  return {owner,head,template,key:{owner,sessionId,roomId}};
 }
 async function validateRecord(record,context){
  const g=record.grant;
  if(g.scope.gameId!==GAME_UUID||g.scope.worldId!==context.head.id||g.scope.roomId!==context.template.roomId||g.scope.templateId!==context.template.id||g.scope.templateVersion!==context.template.version||contract.canonical(g.scope.profile)!==contract.canonical(context.template.profile)||contract.canonical(g.template.body.layout)!==contract.canonical(context.template.layout)||contract.canonical(g.template.body.geometry)!==contract.canonical(context.template.geometry))fail('STORED_ASSET_SCOPE_MISMATCH');
  if(await validateGrant(g)!==record.grantHash)fail('STORED_GRANT_HASH');checkExpiry(g,now());
  await verifyGrantPackage(g,new Map(record.manifests));return record;
 }
 async function locked(req,sessionId,roomId){const context=await access(req,sessionId,roomId),record=await store.get(context.key);if(!record)fail('ROOM_ASSETS_NOT_PREPARED');return {context,record:await validateRecord(record,context)}}
 return Object.freeze({
  async prepare(req,sessionId,roomId){
   const c=await access(req,sessionId,roomId),existing=await store.get(c.key);if(existing){
    if(now()>=Date.parse(existing.grant.expiresAt)){
     for(const pin of existing.grant.pins){const text=await catalog.getManifest(pin);await verifyPinnedManifest(existing.grant,pin,bytes(text));}
     const renewed=copy(existing);renewed.grant.expiresAt=new Date(Math.min(now()+ttlMs,policy.expires(c.owner,sessionId))).toISOString();renewed.grantHash=await validateGrant(renewed.grant);
     return {kind:'locked',record:await validateRecord(await store.renew(c.key,existing.grantHash,renewed),c),replanned:false};
    }
    return {kind:'locked',record:await validateRecord(existing,c),replanned:false};
   }
   const t=c.template,texts=(await catalog.searchPublished({profile:t.profile,limit:100})).filter(text=>{const m=JSON.parse(text);return m.assetId===t.allowedAssetId&&Number(m.revision)===t.allowedRevision});if(texts.length>100)fail('CATALOG_BOUND');
   const entries=await Promise.all(texts.map(text=>{if(bytes(text).length>131072)fail('MANIFEST_SIZE');return publishedManifestEntry(JSON.parse(text))}));
   const selections=[];
   for(const slot of t.slots){
    const request={...slot.request,gameId:GAME_UUID,worldId:c.head.id,roomId,slotId:slot.slotId};
    const selected=await selectEligibleAsset({selector,profile:t.profile,need:slot.need,entries,request,recent:[]});
    if(selected.record.kind!=='reuse')return {kind:'unavailable',gap:selected.query.gap,generationAuthorized:false};
    selections.push(selected);
   }
   const manifests=new Map();
   for(const selected of selections){const pin=selected.record.pin,text=await catalog.getManifest(pin),m=JSON.parse(text);
    // Recheck exact search-to-read snapshot, never relabel a replaced manifest.
    const searched=texts.find(x=>{const v=JSON.parse(x);return v.assetId===pin.assetId&&Number(v.revision)===pin.revision});
    if(text!==searched)fail('CATALOG_CHANGED_DURING_SELECTION');manifests.set(`${m.assetId}:${m.revision}`,bytes(text));
   }
   const prepared=await prepareSelectedGrant({selector,scope:{consumerId:'harbor-'+crypto.randomUUID(),gameId:GAME_UUID,worldId:c.head.id,roomId,templateId:t.id,templateVersion:t.version},profile:t.profile,layout:t.layout,selections,manifestBytes:manifests,geometry:t.geometry,expiresAt:new Date(Math.min(now()+ttlMs,policy.expires(c.owner,sessionId))).toISOString()});
   if(prepared.grant.pins.reduce((n,p)=>n+p.bytes,0)>16*1024**2)fail('ROOM_ASSET_BYTES_BUDGET');
   const packaged=[];
   for(const pin of prepared.grant.pins){const m=JSON.parse(new TextDecoder().decode(manifests.get(`${pin.assetId}:${pin.revision}`)));const file=m.files.find(f=>/^original\./.test(f.path));const data=new Uint8Array(await catalog.getFile(pin,file));if(data.length!==pin.bytes||await contract.digest(data)!==pin.hash)fail('BLOB_INTEGRITY');packaged.push([pin.hash,data]);}
   // Persist a whole verified pair, never half a room. Host store must atomically put-if-absent.
   await access(req,sessionId,roomId);
   const result=await store.putIfAbsent(c.key,{...prepared,manifests:[...manifests],packaged});
   return {kind:'locked',record:await validateRecord(result,c),replanned:false};
  },
  async package(req,sessionId,roomId){const {record}=await locked(req,sessionId,roomId);return copy(record)},
  async deliver(req,sessionId,roomId,action,body){
   if(!['check','manifest','blob'].includes(action))fail('ASSET_ROUTE_MISSING');
   const {record}=await locked(req,sessionId,roomId),g=record.grant;
   const keys=action==='check'?['consumerId','grantHash']:['consumerId','grantHash','pin'];
   if(!body||Object.keys(body).some(k=>!keys.includes(k))||body.consumerId!==g.scope.consumerId||body.grantHash!==record.grantHash)fail('ASSET_GRANT_DENIED');
   if(action==='check')return {mime:'application/json',bytes:bytes(JSON.stringify(checkReply(g,record.grantHash))),grantHash:record.grantHash};
   const pin=g.pins.find(p=>p.slotId===body.pin?.slotId);if(!pin||contract.canonical(pin)!==contract.canonical(body.pin))fail('ASSET_PIN_DENIED');
   const text=await catalog.getManifest(pin),manifest=bytes(text);await verifyPinnedManifest(g,pin,manifest);
   let data=manifest,mime='application/json';
   if(action==='blob'){const file=JSON.parse(text).files.find(f=>/^original\./.test(f.path));data=new Uint8Array(await catalog.getFile(pin,file));mime=pin.mime;if(data.length!==pin.bytes||await contract.digest(data)!==pin.hash)fail('BLOB_INTEGRITY');}
   // Owner/scope/expiry/revocation rechecked after source I/O.
   const final=await locked(req,sessionId,roomId);if(final.record.grantHash!==record.grantHash)fail('ASSET_GRANT_CHANGED');
   return {mime,bytes:data,grantHash:record.grantHash};
  }
 });
}
