import type {Point} from '../engine/world';
const d=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export const predictionHorizon=336;
export function traceLength(start:Point,points:Point[]){let total=0;for(const p of points){total+=d(start,p);start=p}return total}
/** ACKs consume a distance prefix of the live trace. Collinear extension or a
 * new turn during the request stays queued; nothing replaces the live suffix. */
export function consumeTrace(start:Point,live:Point[],accepted:Point[]){
 let left=traceLength(start,accepted),previous=start;const rest=live.map(p=>({...p}));
 if(left>traceLength(start,live)+1e-5)throw Error('MOTION_TRACE_DIVERGED');
 while(rest.length&&left>1e-7){const p=rest[0],length=d(previous,p);if(length>left+1e-7){previous={x:previous.x+(p.x-previous.x)*left/length,y:previous.y+(p.y-previous.y)*left/length};left=0;break}left-=length;previous=rest.shift()!}
 const end=accepted.at(-1)??start;if(d(previous,end)>1e-4)throw Error('MOTION_TRACE_DIVERGED');return rest;
}
