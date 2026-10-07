import type {Point} from '../engine/world';
/** Remove only forward collinear points; preserve every turn and collision slide. */
export function appendMotionTrace(points:Point[],start:Point,p:Point){
 const b=points.at(-1)??start;if(Math.hypot(p.x-b.x,p.y-b.y)<1e-7)return;
 const a=points.length>1?points.at(-2)!:start,dx=b.x-a.x,dy=b.y-a.y,ex=p.x-b.x,ey=p.y-b.y;
 if(points.length&&Math.abs(dx*ey-dy*ex)<1e-7&&dx*ex+dy*ey>=0)points[points.length-1]={...p};else points.push({...p});
}
