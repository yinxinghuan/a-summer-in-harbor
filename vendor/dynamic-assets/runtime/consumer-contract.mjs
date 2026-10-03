import {canonical,digest,verifyProfile,verifyRoom} from './core.mjs';
import {publishedManifestEntry} from './eligibility.mjs';
export const CONSUMER_PREFIX='/asset-library/api/v1/consumer';
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export class ConsumerError extends Error {constructor(code,message=code){super(message);this.code=code;}}
export function exactFields(value,fields){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!fields.includes(k)))throw new ConsumerError('INVALID_CONTRACT');}
export function checkExpiry(grant,now=Date.now()){const end=Date.parse(grant.expiresAt);if(!Number.isFinite(end))throw new ConsumerError('INVALID_EXPIRY');if(now>=end)throw new ConsumerError('GRANT_EXPIRED');}
export async function validateGrant(grant){
 exactFields(grant,['format','scope','room','template','pins','manifestLocks','expiresAt']);
 if(grant.format!=='rpg-consumer-read-grant-v1')throw new ConsumerError('INVALID_GRANT');
 const s=grant.scope;exactFields(s,['consumerId','gameId','worldId','roomId','templateId','templateVersion','templateHash','profile']);
 if(!['consumerId','gameId','worldId','roomId','templateId'].every(k=>id(s[k]))||!Number.isSafeInteger(s.templateVersion)||s.templateVersion<1||!hash(s.templateHash))throw new ConsumerError('INVALID_SCOPE');
 await verifyProfile(s.profile);
 if(canonical(s.profile)!==canonical(grant.room.profile)||s.roomId!==grant.room.roomId||!hash(grant.room.hash))throw new ConsumerError('ROOM_SCOPE_MISMATCH');
 exactFields(grant.template,['body','hash']);if(grant.template.hash!==s.templateHash||await digest(grant.template.body)!==s.templateHash||grant.template.body.templateId!==s.templateId||grant.template.body.templateVersion!==s.templateVersion||canonical(grant.template.body.layout)!==canonical(grant.room.layout))throw new ConsumerError('TEMPLATE_MISMATCH');
 if(!Array.isArray(grant.pins)||grant.pins.length<1||grant.pins.length>32||canonical(grant.pins)!==canonical(grant.room.assets)||new Set(grant.pins.map(p=>p.slotId)).size!==grant.pins.length)throw new ConsumerError('INVALID_PINS');
 if(!Array.isArray(grant.manifestLocks)||grant.manifestLocks.length!==new Set(grant.pins.map(p=>`${p.assetId}:${p.revision}`)).size)throw new ConsumerError('INVALID_MANIFEST_LOCKS');
 for(const p of grant.pins){exactFields(p,['slotId','assetId','revision','renditionId','hash','bytes','mime']);if(!['slotId','assetId','renditionId'].every(k=>id(p[k]))||!Number.isSafeInteger(p.revision)||p.revision<1||!hash(p.hash)||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>5*1024**2||!['image/png','image/webp'].includes(p.mime))throw new ConsumerError('INVALID_PIN');const locks=grant.manifestLocks.filter(m=>m.assetId===p.assetId&&Number(m.revision)===p.revision);if(locks.length!==1||!hash(locks[0].manifestSha256))throw new ConsumerError('INVALID_MANIFEST_LOCK');}
 if(!Number.isFinite(Date.parse(grant.expiresAt)))throw new ConsumerError('INVALID_EXPIRY');
 return digest(grant);
}
export async function verifyPinnedManifest(grant,pin,bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>128*1024)throw new ConsumerError('MANIFEST_SIZE');
 const lock=grant.manifestLocks.find(m=>m.assetId===pin.assetId&&Number(m.revision)===pin.revision);
 if(!lock||await digest(bytes)!==lock.manifestSha256)throw new ConsumerError('MANIFEST_HASH_MISMATCH');
 const m=JSON.parse(new TextDecoder().decode(bytes)),entry=await publishedManifestEntry(m),r=entry.rendition;
 if(entry.eligibility.reasons.length||r.status!=='published'||!entry.eligibility.available||canonical(entry.profile)!==canonical(grant.scope.profile))throw new ConsumerError('SOURCE_NOT_ELIGIBLE');
 if(r.assetId!==pin.assetId||r.revision!==pin.revision||r.renditionId!==pin.renditionId||r.hash!==pin.hash||r.bytes!==pin.bytes||r.mime!==pin.mime||canonical(m.files)!==canonical(lock.files))throw new ConsumerError('SOURCE_PIN_MISMATCH');
 const a=entry.usage.viewContract?.applicability;
 if(a?.kind==='exact-slot'&&(a.roomId!==grant.scope.roomId||a.slotId!==pin.slotId||!grant.template.body.geometry?.[pin.slotId]||await digest(grant.template.body.geometry[pin.slotId])!==a.geometryHash))throw new ConsumerError('SOURCE_PLACEMENT_SCOPE');
 return entry;
}
export async function verifyGrantPackage(grant,manifestBytes){const grantHash=await validateGrant(grant),entries=[];for(const pin of grant.pins){const b=manifestBytes.get(`${pin.assetId}:${pin.revision}`);entries.push(await verifyPinnedManifest(grant,pin,b));}const catalog=entries.map(e=>e.rendition);await verifyRoom(grant.room,catalog);return {grantHash,catalog};}
export function checkReply(grant,grantHash){return {format:'rpg-consumer-check-v1',grantHash,scope:grant.scope,roomHash:grant.room.hash,templateHash:grant.template.hash,expiresAt:grant.expiresAt};}
