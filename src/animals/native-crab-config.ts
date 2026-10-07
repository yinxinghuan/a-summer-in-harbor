import type {Words} from '../world/data';
export const nativeCrabId='harbor-shore-crab-1';
export const nativeCrabPin=Object.freeze({id:'shore-crab-native-c1-v2',revision:2,atlasSHA256:'6447970fcf81c94f4c12e0d516b3d39081be955afeaa3d3323f33c16567cca46',rules:'native-crab-life-v1.0'});
export const nativeCrabPlaces=Object.freeze({coast:{x:1040,y:550},beach:{x:540,y:530},dock:{x:700,y:650}});
export const nativeCrabTitle:Words=['岸边的蟹','Shore crab'];
export const nativeCrabEntities=Object.entries(nativeCrabPlaces).map(([scene,at])=>({scene,entity:{id:nativeCrabId,animalId:nativeCrabId,kind:'object' as const,label:nativeCrabTitle,at:{...at},approach:{x:at.x-8,y:at.y-60},actions:[] as string[]}}));
