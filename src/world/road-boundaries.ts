import type {OutdoorLayout,TerrainPatch} from './outdoors';
import type {Point} from '../engine/world';
export type RoadBoundary={from:Point;to:Point;road:'stone'|'sand';side:'N'|'E'|'S'|'W'};
export function terrainAt(layout:OutdoorLayout,p:Point):TerrainPatch['material']|undefined{return layout.patches.slice().reverse().find(t=>p.x>=t.x&&p.x<t.x+t.w&&p.y>=t.y&&p.y<t.y+t.h)?.material}
/** Visible top-material union, rather than one outline per overlapping patch.
 * Pure visual plan: never modifies waterBarriers, routes, portals or world. */
export function roadBoundaries(layout:OutdoorLayout):RoadBoundary[]{
 const b=layout.bounds;
 const axis=(key:'x'|'y',size:'w'|'h')=>[...new Set([b[key],b[key]+b[size],...layout.patches.flatMap(p=>[Math.max(b[key],Math.min(b[key]+b[size],p[key])),Math.max(b[key],Math.min(b[key]+b[size],p[key]+p[size]))])])].sort((a,c)=>a-c);
 const xs=axis('x','w'),ys=axis('y','h'),out:RoadBoundary[]=[];
 const add=(a:TerrainPatch['material']|undefined,c:TerrainPatch['material']|undefined,from:Point,to:Point,forward:RoadBoundary['side'],reverse:RoadBoundary['side'])=>{if(c==='grass'&&(a==='stone'||a==='sand'))out.push({from,to,road:a,side:forward});else if(a==='grass'&&(c==='stone'||c==='sand'))out.push({from,to,road:c,side:reverse})};
 for(let j=0;j<ys.length-1;j++)for(let i=1;i<xs.length-1;i++){const y=(ys[j]+ys[j+1])/2,x=xs[i];add(terrainAt(layout,{x:(xs[i-1]+x)/2,y}),terrainAt(layout,{x:(x+xs[i+1])/2,y}),{x,y:ys[j]},{x,y:ys[j+1]},'E','W')}
 for(let j=1;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){const x=(xs[i]+xs[i+1])/2,y=ys[j];add(terrainAt(layout,{x,y:(ys[j-1]+y)/2}),terrainAt(layout,{x,y:(y+ys[j+1])/2}),{x:xs[i],y},{x:xs[i+1],y},'S','N')}
 // Merge collinear intervals, preserving the material and which side is road.
 const groups=new Map<string,RoadBoundary[]>();for(const e of out){const vertical=e.from.x===e.to.x,key=[e.road,e.side,vertical?'v':'h',vertical?e.from.x:e.from.y].join(':');groups.set(key,[...(groups.get(key)??[]),e])}
 const merged:RoadBoundary[]=[];for(const edges of groups.values()){const vertical=edges[0].from.x===edges[0].to.x,k=vertical?'y':'x';edges.sort((a,c)=>a.from[k]-c.from[k]);for(const e of edges){const prior=merged.at(-1);if(prior&&prior.road===e.road&&prior.side===e.side&&prior.to.x===e.from.x&&prior.to.y===e.from.y)prior.to={...e.to};else merged.push({...e,from:{...e.from},to:{...e.to}})}}return merged;
}
export const roadArtContract=Object.freeze({texturePhase:160,nativeAtlas:[1024,1024],grid:[4,4],cell:[256,256],cellWorld:40,sourceWorldScale:160/1024,soilEdgeWidth:[6,12],stoneEdgeWidth:[8,12],families:['compacted-soil-grass','flat-stone-trim'],soilCells:['center','N','E','S','W','outer-NW','outer-NE','outer-SE','outer-SW','inner-NW','inner-NE','inner-SE','inner-SW','cap-N','cap-S','gravel'],stoneCells:['center','N','E','S','W','outer-NW','outer-NE','outer-SE','outer-SW','inner-NW','inner-NE','inner-SE','inner-SW','T-no-internal-edge','cross-no-internal-edge','end'],productionEnabled:true});
