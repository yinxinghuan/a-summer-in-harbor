import {canonical} from './core.mjs';
import {queryEligibility} from './eligibility.mjs';
/** Hard eligibility precedes the ONE shared asset-selection policy. This
 * adapter neither ranks nor generates nor authorizes a grant. */
export async function eligibleSelectionSupply({profile,need,entries,request}){
 if(['itemId','category','orientation'].some(k=>request[k]!==need[k])||canonical(request.dimensions)!==canonical(Object.fromEntries(['minWidth','maxWidth','minHeight','maxHeight'].map(k=>[k,need[k]]))))throw Error('SELECTION_NEED_MISMATCH');
 if(need.placementScope&&(request.roomId!==need.placementScope.roomId||request.slotId!==need.placementScope.slotId))throw Error('SELECTION_PLACEMENT_SCOPE');
 const query=await queryEligibility({profile,need,entries});
 const allowed=entries.filter(e=>query.eligible.some(x=>canonical(x.pin)===canonical(Object.fromEntries(['renditionId','assetId','revision','hash'].map(k=>[k,e.rendition[k]])))));
 // Do not promote unknown usage or arbitrary model tags into trusted evidence.
 const usable=allowed.filter(e=>e.usage.usageClass===request.usage);
 const catalog=usable.map(e=>e.rendition),evidence=usable.map(e=>({renditionId:e.rendition.renditionId,assetId:e.rendition.assetId,revision:e.rendition.revision,hash:e.rendition.hash,width:e.usage.width,height:e.usage.height,usages:[e.usage.usageClass],tags:[...new Set([...e.usage.uses,...e.usage.preferredUses])],available:true}));
 return {query,catalog,evidence,usageClassExcluded:allowed.length-usable.length};
}
export async function selectEligibleAsset({selector,profile,need,entries,request,recent=[]}){if(typeof selector?.select!=='function')throw new TypeError('Shared selector required');const supply=await eligibleSelectionSupply({profile,need,entries,request});return {...supply,record:await selector.select({profile,request,catalog:supply.catalog,evidence:supply.evidence,recent})};}
