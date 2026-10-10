import {rooms,world} from '../world/data';
import {walkable,findPath,type Point,type World,type Rect} from '../engine/world';
export const CLUSTER='market-bazaar';
export const COASTAL='coast-beach-path';
export type Seam={zones:[string,string];corridor:Rect;axis:'x'|'y';boundary:number;gates:Record<string,Point>};
export type Cluster={id:string;zones:string[];canvas:Rect;seams:Seam[]};
export const clusters:Record<string,Cluster>={
 [CLUSTER]:{id:CLUSTER,zones:['market','bazaar'],canvas:{x:0,y:0,w:1440,h:1632},seams:[{zones:['market','bazaar'],corridor:{x:555,y:620,w:100,h:60},axis:'y',boundary:650,gates:{market:{x:597,y:720},bazaar:{x:597,y:580}}}]},
 [COASTAL]:{id:COASTAL,zones:['coast','beach','path'],canvas:{x:0,y:0,w:2600,h:1744},seams:[
  {zones:['coast','beach'],corridor:{x:495,y:765,w:110,h:90},axis:'y',boundary:805,gates:{coast:{x:542,y:765},beach:{x:542,y:845}}},
  {zones:['coast','path'],corridor:{x:1235,y:425,w:100,h:100},axis:'x',boundary:1280,gates:{coast:{x:1235,y:469},path:{x:1320,y:469}}}
 ]}
};
export const offsets:Record<string,Point>={market:{x:0,y:540},bazaar:{x:125,y:0},coast:{x:0,y:0},beach:{x:70,y:650},path:{x:1155,y:140}};
export const clusterCanvas=clusters[CLUSTER].canvas,seam=clusters[CLUSTER].seams[0].corridor;
export const clusterFor=(id:string)=>clusters[id]??Object.values(clusters).find(c=>c.zones.includes(id));
export const zonesFor=(id:string)=>clusterFor(id)?.zones??[id];
export const isCluster=(id:string)=>id in offsets;
export const renderScene=(id:string)=>clusterFor(id)?.id??id;
export const globalPoint=(id:string,p:Point):Point=>({x:p.x+(offsets[id]?.x??0),y:p.y+(offsets[id]?.y??0)});
export const localPoint=(id:string,p:Point):Point=>({x:p.x-(offsets[id]?.x??0),y:p.y-(offsets[id]?.y??0)});
export const sameCluster=(a:string,b:string)=>isCluster(a)&&isCluster(b)&&renderScene(a)===renderScene(b);
export const internalPassage=(scene:string,destination?:string)=>!!destination&&sameCluster(scene,destination);
const inside=(r:Rect,p:Point,a=world.actor)=>p.x>=r.x&&p.y>=r.y&&p.x+a.w<=r.x+r.w&&p.y+a.h<=r.y+r.h;
const roomContains=(id:string,p:Point)=>inside({...globalPoint(id,world.scenes[id].interior),w:world.scenes[id].interior.w,h:world.scenes[id].interior.h},p);
/** Previous point is needed only for coastal crossings; an idle old overlap position never changes identity. */
export function pointZone(p:Point,preferred?:string,previous?:Point){
 const c=clusterFor(preferred??CLUSTER)??clusters[CLUSTER];
 if(c.id===COASTAL&&preferred&&previous){for(const s of c.seams){if(!s.zones.includes(preferred)||!inside(s.corridor,p)||!inside(s.corridor,previous))continue;
  const shift=s.axis==='x'?world.actor.w/2:world.actor.h/2,a=previous[s.axis]+shift,b=p[s.axis]+shift;
  const outgoing=s.zones[0]===preferred;if(outgoing?a<s.boundary&&b>=s.boundary:a>=s.boundary&&b<s.boundary)return s.zones[outgoing?1:0];
 }}
 if(preferred&&c.zones.includes(preferred)&&roomContains(preferred,p))return preferred;
 for(const id of c.zones)if(roomContains(id,p))return id;
 return c.id===CLUSTER?(p.y+6<650?'bazaar':'market'):(preferred??c.zones[0]);
}
export function clusterWalkable(base:World,p:Point,preferred?:string,previous?:Point){
 const c=clusterFor(preferred??CLUSTER)??clusters[CLUSTER];
 if(c.id===COASTAL){const zone=pointZone(p,preferred,previous);if(preferred&&zone!==preferred){if(!previous||!c.seams.some(s=>s.zones.includes(preferred)&&s.zones.includes(zone)&&inside(s.corridor,p)&&inside(s.corridor,previous)))return false;}return walkable(base,zone,localPoint(zone,p));}
 // Preserve the proven marketplace admission, including old overlap positions.
 if(preferred&&isCluster(preferred)&&walkable(base,preferred,localPoint(preferred,p)))return true;
 const zone=pointZone(p,preferred),q=localPoint(zone,p);
 if((preferred&&zone!==preferred||p.y<650&&p.y+base.actor.h>650)&&(p.x<555||p.x+base.actor.w>655))return false;
 if(walkable(base,zone,q))return true;
 return inside(seam,p)&&!c.zones.some(id=>base.scenes[id].obstacles.some(o=>{const at=globalPoint(id,o);return p.x<at.x+o.w&&p.x+base.actor.w>at.x&&p.y<at.y+o.h&&p.y+base.actor.h>at.y}));
}
/** Same sampled classification on client and server; no endpoint-only zone jump. */
export function traceZone(scene:string,start:Point,points:Point[]){let zone=scene,previous=start;for(const p of points){const n=Math.max(1,Math.ceil(Math.hypot(p.x-previous.x,p.y-previous.y)));let before=previous;for(let i=1;i<=n;i++){const q={x:previous.x+(p.x-previous.x)*i/n,y:previous.y+(p.y-previous.y)*i/n};zone=pointZone(q,zone,before);before=q;}previous=p;}return zone;}
export function continuousPath(base:World,from:string,a:Point,to:string,b:Point,localFind=(id:string,x:Point,y:Point)=>findPath(base,id,x,y)):Point[]{
 const part=(id:string,x:Point,y:Point)=>localFind(id,localPoint(id,x),localPoint(id,y)).map(p=>globalPoint(id,p));
 if(from===to)return part(from,a,b);if(!sameCluster(from,to))return [];
 const c=clusterFor(from)!,queue=[from],came=new Map<string,{from:string;seam:Seam}>();
 for(const id of queue)for(const s of c.seams){if(!s.zones.includes(id))continue;const next=s.zones.find(z=>z!==id)!;if(next!==from&&!came.has(next)){came.set(next,{from:id,seam:s});queue.push(next)}}
 if(!came.has(to))return [];const legs:{from:string;to:string;seam:Seam}[]=[];for(let id=to;id!==from;){const edge=came.get(id)!;legs.unshift({from:edge.from,to:id,seam:edge.seam});id=edge.from;}
 const points:Point[]=[];let at=a;for(const leg of legs){const first=part(leg.from,at,leg.seam.gates[leg.from]);if(!first.length)return [];points.push(...first,leg.seam.gates[leg.to]);at=leg.seam.gates[leg.to];}
 const last=part(to,at,b);return last.length?[...points,...last]:[];
}
function marketWorld(base:World):World{
 const rects=clusters[CLUSTER].zones.map(id=>{const r=base.scenes[id].interior;return {...globalPoint(id,r),w:r.w,h:r.h}});
 const union={x:40,y:120,w:1280,h:1380};
 // Block every area outside the original two rectangles and the narrow authored seam.
 const xs=[40,205,555,655,1005,1320],ys=[120,620,650,680,1500],obstacles:Rect[]=[];
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const r={x:xs[i],y:ys[j],w:xs[i+1]-xs[i],h:ys[j+1]-ys[j]},mid={x:r.x+r.w/2,y:r.y+r.h/2};
  if(!rects.some(b=>mid.x>=b.x&&mid.x<b.x+b.w&&mid.y>=b.y&&mid.y<b.y+b.h)&&!inside(seam,mid,{w:0,h:0}))obstacles.push(r);
 }
 for(const id of clusters[CLUSTER].zones)for(const o of base.scenes[id].obstacles)obstacles.push({...globalPoint(id,o),w:o.w,h:o.h});
 obstacles.push({x:40,y:648,w:515,h:4},{x:655,y:648,w:665,h:4});
 return {...base,width:1440,height:1632,scenes:{...base.scenes,[CLUSTER]:{interior:union,spawn:globalPoint('market',rooms.market.spawn),obstacles}}};
}
function coastalWorld(base:World):World{
 const r={x:40,y:80,w:1995,h:1250};
 // Static envelope is only map metadata. Swept movement uses the exact logical zone and authored seams above.
 return {...base,width:2600,height:1744,scenes:{...base.scenes,[COASTAL]:{interior:r,spawn:globalPoint('coast',rooms.coast.spawn),obstacles:[]}}};
}
export function clusterWorld(base:World):World{return coastalWorld(marketWorld(base));}
export function longTravelMinutes(from:string,to:string){
 const a=rooms[from]?.area,b=rooms[to]?.area;if(!a||!b||a===b)return 0;
 const queue=[{id:a,n:0}],seen=new Set([a]);
 for(const q of queue){if(q.id===b)return q.n*10;for(const e of rooms[q.id].entities){const next=e.destination&&rooms[e.destination]?.area;if(next&&!seen.has(next)){seen.add(next);queue.push({id:next,n:q.n+1})}}}
 throw Error('TRAVEL_ROUTE_UNAVAILABLE');
}
// One versioned release contract. Production needs no query-string activation.
export const candidateEnabled=()=>true;
export const experimentRate=()=>new URLSearchParams(location.search).get('clock')==='4000'?4000:2000;
export const activePlayEnabled=()=>true;
