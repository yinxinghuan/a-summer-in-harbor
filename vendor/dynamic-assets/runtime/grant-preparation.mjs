import {canonical,digest} from './core.mjs';
import {validateGrant,verifyGrantPackage} from './consumer-contract.mjs';
/** Pure server/authoring preparation. The host separately authorizes and stores
 * this descriptor. A client-created descriptor NEVER grants itself access. */
export async function prepareSelectedGrant({selector,scope,profile,layout,selections,manifestBytes,geometry={},expiresAt}){
 if(!Array.isArray(selections)||!selections.length||selections.some(s=>s.record?.kind!=='reuse'))throw Error('GRANT_REUSABLE_SELECTION_REQUIRED');
 for(const s of selections){const r=s.record.request;if(r.gameId!==scope.gameId||r.worldId!==scope.worldId||r.roomId!==scope.roomId)throw Error('GRANT_SELECTION_SCOPE');
  const p=s.query.need.placementScope;if(p&&(p.roomId!==scope.roomId||p.slotId!==r.slotId||p.geometryHash!==await digest(geometry[r.slotId])))throw Error('GRANT_SELECTION_GEOMETRY');}
 const catalog=selections.flatMap(s=>s.catalog).filter((r,i,all)=>all.findIndex(x=>x.assetId===r.assetId&&x.revision===r.revision)===i),evidence=selections.flatMap(s=>s.evidence).filter((r,i,all)=>all.findIndex(x=>x.assetId===r.assetId&&x.revision===r.revision)===i);
 const room=await selector.lockRoom({roomId:scope.roomId,profile,layout,records:selections.map(s=>s.record),catalog,evidence});
 const body={templateId:scope.templateId,templateVersion:scope.templateVersion,layout:room.layout,geometry};const template={body,hash:await digest(body)},manifestLocks=[];
 for(const pin of room.assets){if(manifestLocks.some(x=>x.assetId===pin.assetId&&Number(x.revision)===pin.revision))continue;const bytes=manifestBytes.get(`${pin.assetId}:${pin.revision}`);if(!(bytes instanceof Uint8Array))throw Error('GRANT_MANIFEST_REQUIRED');const m=JSON.parse(new TextDecoder().decode(bytes));manifestLocks.push({assetId:pin.assetId,revision:String(pin.revision),manifestSha256:await digest(bytes),files:m.files});}
 const grant={format:'rpg-consumer-read-grant-v1',scope:{...scope,templateHash:template.hash,profile},room,template,pins:room.assets,manifestLocks,expiresAt};const grantHash=await validateGrant(grant);await verifyGrantPackage(grant,manifestBytes);
 return {grant,grantHash};
}
