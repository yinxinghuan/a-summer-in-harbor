import type {Point,Rect} from '../src/engine/world';
import type {Facing} from '../src/animals/types';
import {nativeCrabProfile} from '../src/animals/native-crab-profile';
import type {CrabLane} from '../src/animals/native-crab';
import {previewClear,previewPolicy,type PreviewContext} from './animal-stand-space';
/** Find an existing straight clear shore lane. Never move residents/props or
 * manufacture walkable terrain; all native pose bounds share one protected lane. */
export function chooseNativeCrabLane(preferred:Point,scene:string,region:Rect,relative:Rect,input:PreviewContext,facing:Facing):CrabLane|null {
 const a=facing==='down'||facing==='up'?'x':'y',points:Point[]=[];
 for(let dy=-96;dy<=96;dy+=8)for(let dx=-96;dx<=96;dx+=8)if(Math.hypot(dx,dy)<=96)points.push({x:preferred.x+dx,y:preferred.y+dy});
 points.sort((p,q)=>Math.hypot(p.x-preferred.x,p.y-preferred.y)-Math.hypot(q.x-preferred.x,q.y-preferred.y)||p.y-q.y||p.x-q.x);
 let fallback:CrabLane|null=null;
 for(const p of points){if(!previewClear(p,scene,region,relative,input))continue;
  for(const sign of [1,-1]){let distance=0;for(let n=1;n<=64;n++){if(!previewClear({...p,[a]:p[a]+n*sign},scene,region,relative,input))break;distance=n;}
   if(distance<(a==='x'?nativeCrabProfile.ground[facing].w:nativeCrabProfile.ground[facing].h)+8)continue;const lane:CrabLane={scene,region:{...region},ends:[{...p},{...p,[a]:p[a]+distance*sign}],facing};if(distance>=48)return lane;if(!fallback)fallback=lane;
  }
 }return fallback;
}
export const nativeCrabPreviewPolicy=Object.freeze({gap:previewPolicy.gap,maximumPreferredOffset:96,maximumLaneLength:64,minimumLaneLength:34,fullPoseEnvelope:true,groundColliderAdmitted:true,activationAllowed:false});

import {walkable,type World} from '../src/engine/world';
/** Legal nearby player start; pier shores cannot assume land north of the crab. */
export function chooseNativePlayerStart(foot:Point,facing:Facing,world:World,scene:string):Point|null {
 const above={x:foot.x-8,y:foot.y-88},left={x:foot.x-100,y:foot.y-12},right={x:foot.x+84,y:foot.y-12},below={x:foot.x-8,y:foot.y+92};
 return (facing==='down'||facing==='up'?[above,left,right,below]:[left,right,above,below]).find(p=>walkable(world,scene,p))??null;
}
