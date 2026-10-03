import {pathToFileURL} from 'node:url';
import templates from './templates.json' with {type:'json'};
import {createPgAssetStore} from './pg-store.mjs';
import {createHarborLibraryBridge} from './bridge.mjs';
import {loadPolicy,requestContext,fail} from './policy.mjs';
import {encodePackage} from '../../src/dynamic-assets/wire.mjs';
const codeRoot='/opt/rpg-assets-inventory/app-v2/8498f9013d55fcff61c2e0059d66fce897a01f78f709ef629badd173109d2d04';
export async function createDynamicAssets({pool,authority,config,edgeToken,policy,inventoryFactory}){
 policy??=await loadPolicy();
 const store=createPgAssetStore({pool,policy});let bridge,inflight=0;
 if(policy.entries.length){
  const factory=inventoryFactory??(await import(pathToFileURL(codeRoot+'/rpg-asset-library/server/src/read-inventory.mjs').href)).createInventoryCatalogPort;
  const context=Object.freeze({id:'harbor-authority-reader',scopes:['asset:read']});
  const rawCatalog=factory({root:'/opt/rpg-assets-inventory/data',authenticate:async c=>c===context?context:null,readContext:async()=>{const c=requestContext.getStore();if(!c)fail('ASSET_OWNER_DENIED');policy.assert(c.owner,c.sessionId);return context}});
  const catalog=Object.fromEntries(['searchPublished','getManifest','getFile'].map(method=>[method,async(...args)=>{let timer;try{return await Promise.race([rawCatalog[method](...args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('ASSET_SOURCE_TIMEOUT'),{status:503})),5000)})])}finally{clearTimeout(timer)}}]));
  bridge=createHarborLibraryBridge({authority,store,catalog,templates,config,edgeToken,policy});
 }
 async function project(owner,head){const entry=policy.entry(owner,head.id);if(!entry)return head;const attachments=await store.attachments(owner,head.id);return {...head,dynamicAssetRooms:templates.map(t=>t.roomId),roomAssetAttachments:attachments,dynamicAssetAvailable:policy.enabled(owner,head.id)}}
 return Object.freeze({policy,project,
  async context(owner,id,fn){return requestContext.run({owner,sessionId:id,dynamicGeometry:!!policy.entry(owner,id)},fn)},
  async handle(req,res,owner,id,room,action,body){
   policy.assert(owner,id);if(!bridge)fail('ASSET_QA_CLOSED');
   if(!['home','cafe','garden'].includes(room))fail('ROOM_ASSET_SCOPE_DENIED');
   const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(value))};
   return this.context(owner,id,async()=>{
    if(action==='prepare'){
     if(Object.keys(body??{}).length)fail('ASSET_REQUEST_INVALID',400);if(inflight>=2)fail('ASSET_BUSY',429);inflight++;
     try{const r=await bridge.prepare(req,id,room);if(r.kind!=='locked')return respond(409,{error:'ASSET_UNAVAILABLE',generationAuthorized:false});return respond(200,{attachment:store.attachment(r.record),package:encodePackage(r.record)})}finally{inflight--}
    }
    if(action==='package'){const record=await bridge.package(req,id,room);return respond(200,{attachment:store.attachment(record),package:encodePackage(record)})}
    const r=await bridge.deliver(req,id,room,action,body);res.writeHead(200,{'Content-Type':r.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Consumer-Grant':r.grantHash});res.end(r.bytes);
   })
  }
 });
}
export function assetHttpStatus(e){return e.status??({GRANT_EXPIRED:410,ASSET_GRANT_CHANGED:409,ROOM_ASSETS_NOT_PREPARED:403,SESSION_NOT_FOUND:403,EDGE_IDENTITY_REQUIRED:401}[e.code??e.message])??503}
