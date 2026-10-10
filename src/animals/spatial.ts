import {findPath,type Point,type Rect,type World} from '../engine/world';
import type {AnimalState,Context,Slot,SpeciesProfile} from './types';
export const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const bodyAt=(p:Point,profile:Pick<SpeciesProfile,'collision'>):Rect=>({x:p.x-profile.collision.w/2,y:p.y-profile.collision.h,w:profile.collision.w,h:profile.collision.h});
export const finitePoint=(p:Point)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(r:Rect,b:Rect)=>b.x>=r.x&&b.y>=r.y&&b.x+b.w<=r.x+r.w&&b.y+b.h<=r.y+r.h;
/** Permanent ground only. A moving actor entering a display envelope must not
 * turn a valid visible foot into an instant relocation. */
export function terrainClear(p:Point,slot:Slot,profile:SpeciesProfile,ctx:Context){
 const scene=ctx.world.scenes[slot.scene];if(!scene||!finitePoint(p))return false;
 const b=bodyAt(p,profile);
 return inside(scene.interior,b)&&inside(slot.region,b)&&![...scene.obstacles,...(ctx.forbidden[slot.scene]??[])].some(r=>overlaps(b,r));
}
export function pointClear(p:Point,slot:Slot,profile:SpeciesProfile,ctx:Context,others:readonly AnimalState[],includePlayer=true){
 const b=bodyAt(p,profile);
 return terrainClear(p,slot,profile,ctx)&&
  (!includePlayer||slot.scene!==ctx.scene||!overlaps(b,ctx.player))&&
  !Object.values(ctx.people).some(p=>p.scene===slot.scene&&overlaps(b,p.body))&&
  !others.some(a=>a.visible&&a.scene===slot.scene&&overlaps(b,bodyAt(a.foot,ctxProfiles(a))));
}
/** Shared geometry only. New locomotion must still provide its own engine and
 * measured profile; this helper grants no species/art/save admission. */
export function bodyClear(p:Point,sceneId:string,region:Rect,profile:Pick<SpeciesProfile,'collision'>,ctx:Context,occupied:readonly Rect[]=[],includePlayer=true){
 const scene=ctx.world.scenes[sceneId];if(!scene||!finitePoint(p))return false;const b=bodyAt(p,profile);
 return inside(scene.interior,b)&&inside(region,b)&&![...scene.obstacles,...(ctx.forbidden[sceneId]??[])].some(r=>overlaps(b,r))&&
  (!includePlayer||sceneId!==ctx.scene||!overlaps(b,ctx.player))&&
  !Object.values(ctx.people).some(p=>p.scene===sceneId&&overlaps(b,p.body))&&!occupied.some(r=>overlaps(b,r));
}
// Per-species collision travels with the runtime, rather than defaulting to a human box.
import {profiles} from './config';
const ctxProfiles=(a:AnimalState)=>profiles[a.species];
export function candidates(slot:Slot):Point[]{
 const out=[...slot.points];
 for(let y=slot.region.y+8;y<=slot.region.y+slot.region.h;y+=8)for(let x=slot.region.x+8;x<=slot.region.x+slot.region.w-8;x+=8)out.push({x,y});
 return out;
}
export function freePoint(preferred:Point,slot:Slot,profile:SpeciesProfile,ctx:Context,others:readonly AnimalState[],minFromPlayer=0){
 const center={x:ctx.player.x+ctx.player.w/2,y:ctx.player.y+ctx.player.h/2};
 return [preferred,...candidates(slot)].filter(p=>pointClear(p,slot,profile,ctx,others)&&(!minFromPlayer||Math.hypot(p.x-center.x,p.y-center.y)>=minFromPlayer)).sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y))[0];
}
export function animalPath(from:Point,to:Point,slot:Slot,profile:SpeciesProfile,ctx:Context,others:readonly AnimalState[]):Point[]{
 const raw=ctx.world.scenes[slot.scene];if(!raw)return [];
 const obstacles=[...raw.obstacles,...(ctx.forbidden[slot.scene]??[]),...Object.values(ctx.people).filter(p=>p.scene===slot.scene).map(p=>p.body),...(slot.scene===ctx.scene?[ctx.player]:[]),...others.filter(a=>a.visible&&a.scene===slot.scene).map(a=>bodyAt(a.foot,profiles[a.species]))];
 const r=slot.region;const intersection={x:Math.max(raw.interior.x,r.x),y:Math.max(raw.interior.y,r.y),w:0,h:0};intersection.w=Math.min(raw.interior.x+raw.interior.w,r.x+r.w)-intersection.x;intersection.h=Math.min(raw.interior.y+raw.interior.h,r.y+r.h)-intersection.y;
 const w:World={...ctx.world,step:4,actor:{...profile.collision},scenes:{[slot.scene]:{...raw,interior:intersection,obstacles}}};
 const top=(p:Point)=>({x:p.x-profile.collision.w/2,y:p.y-profile.collision.h});
 return findPath(w,slot.scene,top(from),top(to)).map(p=>({x:p.x+profile.collision.w/2,y:p.y+profile.collision.h}));
}
export type ProtectionEntity={kind:string;id:string;at:Point;approach:Point;passage?:unknown};
/** Derive protection from the actual map entities. No duplicated crop coordinates. */
export function protectionForRoom(entities:readonly ProtectionEntity[]):Rect[]{
 return entities.flatMap(e=>e.kind==='portal'?[e.at,{x:e.approach.x+8,y:e.approach.y+6}].map(p=>({x:p.x-46,y:p.y-46,w:92,h:92})):e.id.startsWith('crop-bed-')?[{x:e.at.x-42,y:e.at.y-35,w:84,h:70}]:[]);
}
