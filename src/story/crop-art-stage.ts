import {crops,plotStatus,type GardenState} from './crops';
/** Visual stage is derived from canonical watered growth; never becomes a second saved clock. */
export function cropArtStage(s:GardenState,plotId:string){
 const p=plotStatus(s,plotId);if(!p)return null;
 const stage=p.ready?'ready':p.grown<crops[p.crop].minutes/3?'young':'growing';
 return {crop:p.crop,stage,key:`crop-${p.crop}-${stage}`,dry:p.needsWater} as const;
}
export const harvestArtKey=(crop:keyof typeof crops)=>`produce-${crop}`;
