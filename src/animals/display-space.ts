import type {Point,Rect} from '../engine/world';
import type {AnimalState,Context} from './types';
import {bodyAt,bodyClear,overlaps} from './spatial';
import {profiles} from './config';

export type Measured={source:string;sha256:string;frames:Record<string,{relative:Rect}>};
export type Geometry={schema:number;activationAllowed:boolean;candidates:Record<string,Measured>;people:Record<string,Measured>;animals:Record<string,Measured>;props:Record<string,Measured&{scene:string;foot:Point}>};
export const previewPolicy=Object.freeze({gap:8,maxOffset:96,step:8,purpose:'static display envelopes, not ground colliders',activationAllowed:false});
const valid=(r:Rect)=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
const inside=(r:Rect,b:Rect)=>b.x>=r.x&&b.y>=r.y&&b.x+b.w<=r.x+r.w&&b.y+b.h<=r.y+r.h;
const translated=(r:Rect,p:Point):Rect=>({...r,x:r.x+p.x,y:r.y+p.y});
const padded=(r:Rect):Rect=>({x:r.x-previewPolicy.gap,y:r.y-previewPolicy.gap,w:r.w+2*previewPolicy.gap,h:r.h+2*previewPolicy.gap});
export function envelope(measured:Measured):Rect {
 if(!measured||!/^[a-f0-9]{64}$/.test(measured.sha256))throw Error('UNPINNED_GEOMETRY');
 const frames=Object.values(measured.frames??{}).map(f=>f.relative);if(!frames.length||frames.some(r=>!valid(r)))throw Error('INVALID_GEOMETRY');
 const x=Math.min(...frames.map(r=>r.x)),y=Math.min(...frames.map(r=>r.y));
 return {x,y,w:Math.max(...frames.map(r=>r.x+r.w))-x,h:Math.max(...frames.map(r=>r.y+r.h))-y};
}
export type PreviewContext={context:Context;states:readonly AnimalState[];geometry:Geometry;extraVisual?:readonly Rect[]};
export function previewReservations(scene:string,{context:ctx,states,geometry,extraVisual=[]}:PreviewContext){
 if(geometry.schema!==2||geometry.activationAllowed!==false)throw Error('PREVIEW_GEOMETRY_ONLY');
 const visual:Rect[]=[...extraVisual.map(r=>({...r}))],ground:Rect[]=[];
 for(const prop of Object.values(geometry.props))if(prop.scene===scene)visual.push(translated(envelope(prop),prop.foot));
 for(const [id,p] of Object.entries(ctx.people))if(p.scene===scene){
  if(!valid(p.body))throw Error('INVALID_OCCUPANCY');ground.push({...p.body});
  const box=translated(envelope(geometry.people['npc-'+id]),p.foot),radius=Math.max(0,(p.body.w-18)/2);
  visual.push({...box,x:box.x-radius,w:box.w+2*radius});
 }
 for(const animal of states)if(animal.slot?.scene===scene){
  const slot=animal.slot.region,v=envelope(geometry.animals[animal.visualVersion]),lift=profiles[animal.species].flightHeight;
  // Preserve each existing animal's whole authored territory and possible flight.
  // A quiet endpoint is not proof that its next legal stride stays elsewhere.
  visual.push({x:slot.x+v.x,y:slot.y+v.y-lift,w:slot.w+v.w,h:slot.h+v.h+lift});
 }
 for(const animal of states)if(animal.visible&&animal.scene===scene){
  ground.push(bodyAt(animal.foot,profiles[animal.species]));
  visual.push(translated(envelope(geometry.animals[animal.visualVersion]),{x:animal.foot.x,y:animal.foot.y-animal.elevation}));
 }
 if(ctx.scene===scene){
  ground.push({...ctx.player});
  visual.push(translated(envelope(geometry.people['harbor-hero']),{x:ctx.player.x+8,y:ctx.player.y+12}));
 }
 if([...visual,...ground].some(r=>!valid(r)))throw Error('INVALID_OCCUPANCY');
 return {visual,ground};
}
// One immutable context per renderer/authority tick; cache only within it.
const reservationCache=new WeakMap<PreviewContext,ReturnType<typeof previewReservations>>();
export function previewClear(foot:Point,scene:string,region:Rect,relative:Rect,input:PreviewContext){
 const ctx=input.context,s=ctx.world.scenes[scene];
 if(ctx.scene!==scene||!s||!valid(relative)||!valid(region)||!Number.isFinite(foot.x)||!Number.isFinite(foot.y))return false;
 const box=translated(relative,foot),protectedBox=padded(box),reserved=reservationCache.get(input)??previewReservations(scene,input);reservationCache.set(input,reserved);
 // The one-unit foot check reuses the original scene geometry; it grants no collider admission.
 return bodyClear(foot,scene,region,{collision:{w:1,h:1}},ctx,reserved.ground)&&inside(s.interior,protectedBox)&&inside(region,protectedBox)&&
  ![...s.obstacles,...(ctx.forbidden[scene]??[]),...reserved.ground,...reserved.visual].some(r=>overlaps(protectedBox,r));
}
export function choosePreviewFoot(preferred:Point,scene:string,region:Rect,relative:Rect,input:PreviewContext):Point|null {
 if(!Number.isFinite(preferred.x)||!Number.isFinite(preferred.y))throw Error('INVALID_PREFERRED_FOOT');
 if(previewClear(preferred,scene,region,relative,input))return {...preferred};
 const points:Point[]=[];
 for(let dy=-previewPolicy.maxOffset;dy<=previewPolicy.maxOffset;dy+=previewPolicy.step)
  for(let dx=-previewPolicy.maxOffset;dx<=previewPolicy.maxOffset;dx+=previewPolicy.step)
   if(Math.hypot(dx,dy)<=previewPolicy.maxOffset)points.push({x:preferred.x+dx,y:preferred.y+dy});
 points.sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y)||a.y-b.y||a.x-b.x);
 return points.find(p=>previewClear(p,scene,region,relative,input))??null;
}
