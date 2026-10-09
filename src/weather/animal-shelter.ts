import type {Save} from '../story/state';
import type {AnimalDef,Slot} from '../animals/types';
import {animals,profiles} from '../animals/config';
import {weatherForSave} from './state';
import {periodAt} from '../animals/behavior';
/** Existing birch canopies, with individual ground parking beside their trunks.
 * No new art, collision removal, schedule, or permission to cross a portal. */
export const catRainCovers={
 station:{prop:'tree-east',points:[{x:1155,y:440},{x:1215,y:440},{x:1185,y:455}]},
 market:{prop:'square-birch',points:[{x:699,y:829},{x:759,y:829},{x:729,y:799}]},
 courtyard:{prop:'shade-east',points:[{x:725,y:535},{x:784,y:535},{x:755,y:555}]},
} as const;
export type AnimalWeatherSave=Pick<Save,'townMinutes'|'weatherV1'|'weatherEcologyV1'>;
export function weatherAnimalSlot(def:AnimalDef,s:AnimalWeatherSave):Slot|null{
 const base=def.schedule[periodAt(s.townMinutes??540)];if(!base)return null;
 const cover=catRainCovers[base.scene as keyof typeof catRainCovers];
 if(!s.weatherEcologyV1||def.species!=='cat'||!cover||base.activity==='sleep')return base;
 const i=animals.findIndex(a=>a.id===def.id),point=cover.points[Math.max(0,i)%cover.points.length],rawHome=base.points[Math.max(0,i)%base.points.length],size=profiles.cat.collision,homePoint={x:Math.max(base.region.x+size.w/2,Math.min(base.region.x+base.region.w-size.w/2,rawHome.x)),y:Math.max(base.region.y+size.h,Math.min(base.region.y+base.region.h,rawHome.y))};
 // The same bounded return corridor remains admissible after rain ends, so a
 // cat may walk home rather than teleport or forge a different observed foot.
 const x=Math.min(base.region.x,point.x-24),y=Math.min(base.region.y,point.y-26),right=Math.max(base.region.x+base.region.w,point.x+24),bottom=Math.max(base.region.y+base.region.h,point.y+12);
 return {...base,region:{x,y,w:right-x,h:bottom-y},...(weatherForSave(s)==='light-rain'?{activity:'shelter' as const,points:[point]}:{}),shelter:{point:{...point},homeRegion:{...base.region},homePoint:{...homePoint}}};
}
export function weatherAnimalSlots(s:AnimalWeatherSave){return Object.fromEntries(animals.flatMap(a=>{const slot=weatherAnimalSlot(a,s);return slot?.shelter?[[a.id,slot]]:[]}))}
export function rainCatShelterActive(s:AnimalWeatherSave,id:string){const def=animals.find(a=>a.id===id);return !!def&&weatherAnimalSlot(def,s)?.activity==='shelter'}
