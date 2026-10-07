import type {Point,World,Rect} from '../engine/world';
import {profiles} from './config';
import {slotAt} from './behavior';
import {bodyAt,protectionForRoom} from './spatial';
import type {AnimalDef,AnimalState,Context,AnimalSave} from './types';
export type AnimalHostSave={scene:string;townMinutes?:number;animalsV1?:AnimalSave};
export type HostRoom={entities:{id:string;kind:string;at:Point;approach:Point;person?:string;passage?:unknown}[]};
/** Pass the current dynamicWorld(flags,enabled), current resident footpoints and save. */
export function harborContext(save:AnimalHostSave,world:World,rooms:Record<string,HostRoom>,playerPosition:Point,people:Context['people'],paused=false):Context{
 return {world,scene:save.scene,townMinutes:save.townMinutes??540,player:{...playerPosition,...world.actor},people,paused,forbidden:Object.fromEntries(Object.entries(rooms).map(([id,r])=>[id,protectionForRoom(r.entities)]))};
}
export function animalCollision(states:readonly AnimalState[]):Rect[]{return states.filter(s=>s.visible&&s.phase!=='flight').map(s=>bodyAt(s.foot,profiles[s.species]))}
/** Static entities for the existing scene-scoped binding; one ID in each authored scene. */
export function authoredAnimalEntities(defs:readonly AnimalDef[]){
 return defs.flatMap(def=>[...new Set(Object.values(def.schedule).map(slot=>slot.scene))].map(scene=>{const slot=Object.values(def.schedule).find(s=>s.scene===scene)!;const at=slot.points[0];return {scene,entity:{id:def.id,animalId:def.id,kind:'object' as const,label:(def.species==='cat'?['猫','Cat']:def.species==='gull'?['海鸥','Gull']:['狗','Dog']) as [string,string],at:{...at},approach:{x:at.x-8,y:at.y+34},actions:def.species==='cat'?['animal-call','animal-pet']:[]}}}));
}
/** A current observed point becomes the same hotspot and approach used by the renderer. */
export function animalTargets(states:readonly AnimalState[],scene:string){return states.filter(s=>s.visible&&s.scene===scene).map(s=>({id:s.id,animalId:s.id,kind:'object' as const,label:(s.species==='cat'?['猫','Cat']:['海鸥','Gull']) as [string,string],at:{...s.foot},approach:{x:s.foot.x-8,y:s.foot.y+(s.species==='gull'?88:34)},actions:s.species==='cat'&&s.phase!=='sleep'?['animal-call','animal-pet']:[]}))}
export function animalPresent(defs:readonly AnimalDef[],save:AnimalHostSave,id:string){const def=defs.find(d=>d.id===id),slot=def&&slotAt(def,save.townMinutes??540);return !!slot&&slot.scene===save.scene}
