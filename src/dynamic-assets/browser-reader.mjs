/** Exact trusted journey attachment in; verified bytes out. No login, role, search or spending. */
import {createServiceConsumer} from '../../vendor/dynamic-assets/runtime/service-consumer.mjs';
import {validateGrant} from '../../vendor/dynamic-assets/runtime/consumer-contract.mjs';
import {decodePackage} from './wire.mjs';
import {canonical} from '../../vendor/dynamic-assets/runtime/core.mjs';
export async function createHarborDynamicReader({attachment,wire,baseUrl,baseURI,fetchImpl,cacheStore,now}){
 const record=decodePackage(wire);
 if(await validateGrant(record.grant)!==attachment.grantHash||record.grantHash!==attachment.grantHash||record.grant.room.hash!==attachment.roomHash||record.grant.template.hash!==attachment.templateHash||canonical(record.grant.scope)!==canonical(attachment.scope))throw Error('JOURNEY_ASSET_BINDING_MISMATCH');
 const origin=new URL(baseURI).origin;
 const prefix=`/${attachment.scope.gameId}/api/sessions/${attachment.scope.worldId}/assets/${attachment.scope.roomId}/`;
 const endpoint=()=>{const u=new URL(baseUrl(),baseURI);if(u.origin!==origin||u.pathname!==prefix||u.search||u.hash)throw Error('SAME_GAME_ASSET_ENDPOINT_REQUIRED');return u.href};endpoint();
 const client=await createServiceConsumer({descriptor:record.grant,manifestBytes:new Map(record.manifests),packagedFiles:new Map(record.packaged),baseUrl:endpoint,baseURI,fetchImpl,cacheStore,now});
 return Object.freeze({async resolve(){
  const result=await client.resolve({scope:attachment.scope,roomHash:attachment.roomHash,templateHash:attachment.templateHash});
  const manifests=new Map(record.manifests),geometry=record.grant.template.body.geometry;
  const assets=result.files.map(file=>{const pin=record.grant.pins.find(p=>p.slotId===file.slotId),m=JSON.parse(new TextDecoder().decode(manifests.get(`${pin.assetId}:${pin.revision}`))),g=geometry?.[pin.slotId];
   if(!g||!Array.isArray(g.anchor)||g.anchor.length!==2||!g.anchor.every(Number.isFinite)||!Number.isFinite(g.scale)||g.scale<=0||!Number.isFinite(g.imageOffset?.x)||!Number.isFinite(g.imageOffset?.y))throw Error('RENDER_GEOMETRY_REQUIRED');
   return {propId:pin.slotId,bytes:file.bytes,mime:pin.mime,sourceWidth:m.width,sourceHeight:m.height,width:m.width*g.scale,geometry:{anchor:[...g.anchor],scale:g.scale,offset:{...g.imageOffset}}};
  });
  return {...result,assets};
 },clearCache:client.clearCache});
}
