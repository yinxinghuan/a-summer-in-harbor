import {canonical,digest,rendition,verifyProfile,verifyRoom} from './core.mjs';
import {inspectPublicMetadata,validPlacementScope} from './metadata-contract.mjs';
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,96}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const pin=r=>({renditionId:r.renditionId,assetId:r.assetId,revision:r.revision,hash:r.hash});
function exactKeys(obj,allowed){if(!obj||Object.getPrototypeOf(obj)!==Object.prototype||Object.keys(obj).some(k=>!allowed.includes(k)))throw new Error('unknown eligibility field');}
/** Strict constraints, not a consumer ranking/generation policy. Unknowns yield gaps. */
export function usageNeed(input){
 exactKeys(input,['needId','itemId','category','orientation','view','purpose','minWidth','maxWidth','minHeight','maxHeight','quantity','minDistinct','placementScope']);
 if(input.placementScope!==undefined&&!validPlacementScope(input.placementScope))throw new Error('invalid placement scope');
 if(!['needId','itemId','category','orientation','view','purpose'].every(k=>id(input[k]))||!['minWidth','maxWidth','minHeight','maxHeight','quantity','minDistinct'].every(k=>Number.isInteger(input[k])&&input[k]>0)||input.maxWidth>2048||input.maxHeight>2048||input.minWidth>input.maxWidth||input.minHeight>input.maxHeight||input.quantity>128||input.minDistinct>input.quantity)throw new Error('invalid usage need');
 return JSON.parse(canonical(input));
}
/** Adapter accepts only an already trusted public export; no signature/platform check implied. */
export async function publishedManifestEntry(manifest){
 if(!['rpg-asset-published-manifest-v1','rpg-asset-published-manifest-v2'].includes(manifest.format)||!Array.isArray(manifest.files))throw new Error('unsupported public manifest');
 const originals=manifest.files.filter(f=>/^original\.(png|webp)$/.test(f.path));if(originals.length!==1)throw new Error('one original required');const f=originals[0];
 if(typeof manifest.revision!=='string'||! /^[1-9][0-9]*$/.test(manifest.revision))throw new Error('immutable numeric service revision required');
 const r=rendition({renditionId:manifest.renditionId,assetId:manifest.assetId,revision:Number(manifest.revision),hash:f.sha256,itemId:manifest.semanticItemId,category:manifest.category,orientation:manifest.orientation,styleFamilyId:manifest.styleFamilyId,profileId:manifest.profileId,profileVersion:manifest.profileVersion,profileHash:manifest.profileHash,status:manifest.status,bytes:f.bytes,mime:f.mime});
 const reasons=[];let checkedProfile;const schema=inspectPublicMetadata(manifest);if(!schema.valid)reasons.push(schema.reason);
 try{checkedProfile=await verifyProfile({styleFamilyId:r.styleFamilyId,profileId:r.profileId,version:r.profileVersion,compatProfile:manifest.compatProfile,hash:r.profileHash});}catch{reasons.push('profile-definition-unverified');}
 const licensed=manifest.license?.allowed===true&&id(manifest.license?.id)&&manifest.license.id!=='unknown'&&typeof manifest.license?.name==='string'&&!!manifest.license.name.trim()&&typeof manifest.license?.notice==='string'&&!!manifest.license.notice.trim()&&manifest.rights?.status==='documented'&&typeof manifest.source?.url==='string'&&!!manifest.source.url.trim();
 if(!licensed)reasons.push('license-unapproved');
 // Public approval summary binds authoritatively approved version; precheck never grants approval.
 const approved=manifest.approval?.hash===r.hash&&sha(manifest.approval?.manifestHash)&&typeof manifest.approval?.actor==='string'&&!!manifest.approval.actor&&typeof manifest.approval?.at==='string'&&!!manifest.approval.at;
 if(!approved)reasons.push('quality-approval-missing');r.eligibility={licenseAllowed:!!licensed,qualityApproved:!!approved&&schema.valid,approvalHash:approved&&schema.valid?r.hash:null};
 const dimensions=Number.isInteger(manifest.width)&&manifest.width>0&&manifest.width<=2048&&Number.isInteger(manifest.height)&&manifest.height>0&&manifest.height<=2048;
 if(!dimensions)reasons.push('dimensions-unknown');
 if(!id(manifest.view)||manifest.view==='unknown')reasons.push('view-unknown');
 if(!Array.isArray(manifest.uses)||!manifest.uses.length||manifest.uses.some(u=>!id(u)))reasons.push('usage-constraints-unknown');
 return {rendition:r,profile:checkedProfile??null,usage:{view:manifest.view??null,width:manifest.width??null,height:manifest.height??null,uses:Array.isArray(manifest.uses)?[...manifest.uses]:[],preferredUses:Array.isArray(manifest.preferredUses)?manifest.preferredUses.filter(id):[],variantFamilyId:id(manifest.variantFamilyId)?manifest.variantFamilyId:id(manifest.familyId)?manifest.familyId:null,...(manifest.metadataSchemaVersion===2?{usageClass:manifest.usageClass,viewContract:structuredClone(manifest.viewContract)}:{})},eligibility:{licenseAllowed:!!licensed,qualityApproved:!!approved&&schema.valid,available:manifest.status==='published',reasons},publicManifestHash:await digest(manifest)};
}
function reasonsFor(e,n,p,ignoreOrientation=false){
 const r=e.rendition,u=e.usage,hard=[];
 if(r.itemId!==n.itemId||r.category!==n.category)hard.push('semantic-mismatch');
 if(r.styleFamilyId!==p.styleFamilyId)hard.push('style-family-mismatch');
 if(r.profileId!==p.profileId||r.profileVersion!==p.version||r.profileHash!==p.hash||!e.profile||e.profile.hash!==p.hash||e.profile.profileId!==p.profileId||e.profile.version!==p.version||e.profile.styleFamilyId!==p.styleFamilyId)hard.push('compat-profile-mismatch');
 if(!ignoreOrientation&&r.orientation!==n.orientation)hard.push('orientation-mismatch');
 if(u.view!==n.view)hard.push('view-mismatch');
 const scope=u.viewContract?.applicability;
 if(scope?.kind==='exact-slot'&&(!n.placementScope||['roomId','slotId','geometryHash'].some(k=>scope[k]!==n.placementScope[k])))hard.push('placement-scope-mismatch');
 if(!Number.isInteger(u.width)||!Number.isInteger(u.height)||u.width<n.minWidth||u.width>n.maxWidth||u.height<n.minHeight||u.height>n.maxHeight)hard.push('dimension-mismatch');
 if(!u.uses.includes(n.purpose))hard.push('purpose-capability-mismatch');
 const approval=[...e.eligibility.reasons];if(e.eligibility.licenseAllowed!==true||r.eligibility?.licenseAllowed!==true)approval.push('license-unapproved');if(e.eligibility.qualityApproved!==true||r.eligibility?.qualityApproved!==true||r.eligibility.approvalHash!==r.hash)approval.push('quality-approval-missing');if(r.status!=='published')approval.push('not-published');if(!e.eligibility.available)approval.push('unavailable');
 return {hard:[...new Set(hard)],approval:[...new Set(approval)]};
}
/** Unranked eligibility and gap report; consumer owns recent/diversity/budget decisions. */
export async function queryEligibility({profile,need,entries}){
 const checked=await verifyProfile(profile),n=usageNeed(need);const diagnostics=entries.map(e=>{const {hard,approval}=reasonsFor(e,n,checked);return {pin:pin(e.rendition),stage:hard.length?'hard-compatibility':approval.length?'published-license-quality':'eligible',reasons:hard.length?hard:approval};});
 const eligible=entries.filter(e=>{const d=reasonsFor(e,n,checked);return !d.hard.length&&!d.approval.length;}).map(e=>({pin:pin(e.rendition),usage:JSON.parse(canonical(e.usage)),publicManifestHash:e.publicManifestHash}));
 const compatibleSources=entries.filter(e=>{const d=reasonsFor(e,n,checked,true);return !d.hard.length&&!d.approval.length;}).map(e=>({pin:pin(e.rendition),orientation:e.rendition.orientation}));
 const body={schemaVersion:1,need:n,profileLock:{styleFamilyId:checked.styleFamilyId,profileId:checked.profileId,version:checked.version,hash:checked.hash},eligible,diagnostics,gap:{reason:eligible.length>=n.minDistinct?'eligible-supply-consumer-decision-required':compatibleSources.length?'direction-or-distinct-variant-gap':'no-approved-compatible-source',requiredQuantity:n.quantity,requiredDistinct:n.minDistinct,availableDistinct:eligible.length,minimumMissingDistinct:Math.max(0,n.minDistinct-eligible.length),compatibleSourcePins:compatibleSources,execution:'requirements-only',generationAuthorized:false}};
 return {...body,hash:await digest(body)};
}
/** Resume never replans. Build and runtime consume exactly this verified room lock. */
export async function readonlyLockedManifest(room,catalog){const checked=await verifyRoom(room,catalog);const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};return freeze(checked);}
