import type {Point,World} from '../engine/world';
import {checkShore,castReach,waterAt,type ShoreCheck,type ShoreTarget} from './shore-water';
export const chargePower=(milliseconds:number)=>Math.max(0,Math.min(1,Number.isFinite(milliseconds)?milliseconds/1000:0));
export type CastPlan={samples:ShoreTarget[];limited:boolean};
/** Presentation/input adapter only. Every proposed landing still passes unchanged authority checkShore(aim). */
export function castPlan(scene:string,standing:Point,world:World):CastPlan|null{
 const nearest=checkShore(scene,standing,world);if(!nearest.ok)return null;
 const foot={x:standing.x+world.actor.w/2,y:standing.y+world.actor.h/2},dx=nearest.target.at.x-foot.x,dy=nearest.target.at.y-foot.y,len=Math.hypot(dx,dy)||1;
 let best:ShoreTarget[]=[];
 for(const degrees of [0,-30,30,-60,60]){const angle=degrees*Math.PI/180,ux=(dx*Math.cos(angle)-dy*Math.sin(angle))/len,uy=(dx*Math.sin(angle)+dy*Math.cos(angle))/len,points:ShoreTarget[]=[];
  for(let distance=Math.max(24,Math.ceil(nearest.target.distance+8));distance<=castReach;distance+=2){const at={x:foot.x+ux*distance,y:foot.y+uy*distance},w=waterAt(scene,at);
   if(!w||w.zone!==nearest.target.zone||w.water!==nearest.target.water)continue;
   // A visibly submerged landing, rather than the old quarter-unit border point.
   if([[6,0],[-6,0],[0,6],[0,-6]].some(([x,y])=>!waterAt(scene,{x:at.x+x,y:at.y+y})))continue;
   const checked=checkShore(scene,standing,world,at);if(checked.ok)points.push(checked.target);
  }
  if(points.length&&(!best.length||points.at(-1)!.distance-points[0].distance>best.at(-1)!.distance-best[0].distance))best=points;
 }
 // Thin water remains governed by the existing shore check; do not pretend that more power can cross a bank.
 return {samples:best,limited:!best.length||best.at(-1)!.distance-best[0].distance<24};
}
export function poweredCast(plan:CastPlan|null,power:number):ShoreCheck{
 if(!plan||!plan.samples.length)return{ok:false,reason:'WATER_TOO_FAR'};
 const samples=plan.samples,p=chargePower(power*1000),wanted=samples[0].distance+(samples.at(-1)!.distance-samples[0].distance)*p;
 return{ok:true,target:samples.reduce((best,x)=>Math.abs(x.distance-wanted)<Math.abs(best.distance-wanted)?x:best,samples[0])};
}
