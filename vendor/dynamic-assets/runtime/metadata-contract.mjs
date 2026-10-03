/** Versioned asset metadata. No inferred view, camera or permission. */
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(v)&&v!=='unknown';
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const VIEW_CLASSES=Object.freeze(['top-down','side','isometric','elevated-2d']);
export const USAGE_CLASSES=Object.freeze(['background','story-photo','prop','tile','portrait','icon']);
const directions=Object.freeze({'object-front-screen-axis-v1':{front:'down',back:'up','left-side':'left','right-side':'right'},'screen-facing-v1':{north:'up',south:'down',east:'right',west:'left'},'non-directional-v1':{none:'none'}});
export function validPlacementScope(s){return !!(exact(s,['roomId','slotId','geometryHash'])&&id(s.roomId)&&id(s.slotId)&&sha(s.geometryHash));}
export function inspectMetadataVersion(m){
 const bad=reason=>({valid:false,reason});if(!m||typeof m!=='object')return bad('metadata-missing');
 const version=m.metadataSchemaVersion??1;if(![1,2].includes(version))return bad('metadata-schema-unsupported');
 if(version===1)return m.viewContract!==undefined||m.usageClass!==undefined?bad('metadata-version-required'):{valid:true,version:1,legacy:true};
 if(!VIEW_CLASSES.includes(m.view)||!USAGE_CLASSES.includes(m.usageClass))return bad('metadata-view-or-usage-class');
 if(!Array.isArray(m.uses)||!m.uses.length||m.uses.length>32||m.uses.some(x=>!id(x))||new Set(m.uses).size!==m.uses.length)return bad('metadata-uses');
 if(m.preferredUses!==undefined&&(!Array.isArray(m.preferredUses)||m.preferredUses.some(x=>!m.uses.includes(x))||new Set(m.preferredUses).size!==m.preferredUses.length))return bad('metadata-preferred-uses');
 const v=m.viewContract;
 if(!exact(v,['schemaVersion','view','orientationModel','screenFront','projectionId','calibration','applicability','evidenceRef'])||v.schemaVersion!==1||v.view!==m.view||!id(v.evidenceRef)||v.projectionId!==m.compatProfile?.projection)return bad('metadata-view-contract');
 if(!Object.hasOwn(directions,v.orientationModel)||!Object.hasOwn(directions[v.orientationModel],m.orientation)||!id(v.screenFront)||directions[v.orientationModel][m.orientation]!==v.screenFront)return bad('metadata-orientation-semantics');
 const c=v.calibration;
 if(c?.status==='unmeasured'){if(!exact(c,['status']))return bad('metadata-unmeasured-camera');}
 else if(c?.status==='calibrated'){
  if(!exact(c,['status','projectionModel','elevationDegrees','yawDegrees','evidenceRef'])||!['orthographic','perspective'].includes(c.projectionModel)||!Number.isFinite(c.elevationDegrees)||c.elevationDegrees<0||c.elevationDegrees>90||!Number.isFinite(c.yawDegrees)||Math.abs(c.yawDegrees)>180||!id(c.evidenceRef))return bad('metadata-camera-calibration');
 }else return bad('metadata-calibration-required');
 const a=v.applicability;
 if(a?.kind==='exact-slot'){if(!exact(a,['kind','roomId','slotId','geometryHash'])||!validPlacementScope({roomId:a.roomId,slotId:a.slotId,geometryHash:a.geometryHash}))return bad('metadata-exact-slot');}
 else if(a?.kind==='profile'){if(!exact(a,['kind'])||c.status!=='calibrated')return bad('metadata-profile-scope-needs-calibration');}
 else return bad('metadata-applicability');
 return {valid:true,version:2,legacy:false};
}
export function inspectPublicMetadata(m){
 if(!['rpg-asset-published-manifest-v1','rpg-asset-published-manifest-v2'].includes(m?.format))return {valid:false,reason:'manifest-schema-unsupported'};
 const result=inspectMetadataVersion(m);
 if(result.valid&&(m.format.endsWith('-v2')?result.version!==2:result.version!==1))return {valid:false,reason:'manifest-metadata-version-mismatch'};
 return result;
}
