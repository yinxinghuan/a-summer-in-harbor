import {rooms,world} from '../world/data';
import {walkable,type Point,type World,type Rect} from '../engine/world';

/** Candidate projection only. Story IDs, original layouts and saved coordinates stay local. */
export const CLUSTER='market-bazaar';
export const offsets:Record<string,Point>={market:{x:0,y:540},bazaar:{x:125,y:0}};
export const clusterCanvas={x:0,y:0,w:1440,h:1632};
export const seam:Rect={x:555,y:620,w:100,h:60};
export const isCluster=(id:string)=>id in offsets;
export const renderScene=(id:string)=>isCluster(id)?CLUSTER:id;
export const globalPoint=(id:string,p:Point):Point=>({x:p.x+(offsets[id]?.x??0),y:p.y+(offsets[id]?.y??0)});
export const localPoint=(id:string,p:Point):Point=>({x:p.x-(offsets[id]?.x??0),y:p.y-(offsets[id]?.y??0)});
export const pointZone=(p:Point,preferred?:string)=>{
 if(preferred&&isCluster(preferred)){const r=world.scenes[preferred].interior;if(inside({...globalPoint(preferred,r),w:r.w,h:r.h},p))return preferred}
 for(const id of Object.keys(offsets)){const r=world.scenes[id].interior;if(inside({...globalPoint(id,r),w:r.w,h:r.h},p))return id}
 return p.y+6<650?'bazaar':'market';
};
export const sameCluster=(a:string,b:string)=>isCluster(a)&&isCluster(b);
export const internalPassage=(scene:string,destination?:string)=>!!destination&&sameCluster(scene,destination);
const inside=(r:Rect,p:Point,a=world.actor)=>p.x>=r.x&&p.y>=r.y&&p.x+a.w<=r.x+r.w&&p.y+a.h<=r.y+r.h;
export function clusterWalkable(base:World,p:Point,preferred?:string){
 // A saved overlap coordinate retains its original logical map. Crossing to
 // the other map is admitted only through the authored narrow passage.
 if(preferred&&isCluster(preferred)&&walkable(base,preferred,localPoint(preferred,p)))return true;
 const zone=pointZone(p,preferred),q=localPoint(zone,p);
 if((preferred&&zone!==preferred||p.y<650&&p.y+base.actor.h>650)&&(p.x<555||p.x+base.actor.w>655))return false;
 if(walkable(base,zone,q))return true;
 // Only this authored overlap bridges the actor's rectangle across the two local bounds.
 return inside(seam,p)&&!Object.keys(offsets).some(id=>base.scenes[id].obstacles.some(o=>{
  const at=globalPoint(id,o);return p.x<at.x+o.w&&p.x+base.actor.w>at.x&&p.y<at.y+o.h&&p.y+base.actor.h>at.y;
 }));
}
export function clusterWorld(base:World):World{
 const rects=Object.keys(offsets).map(id=>{const r=base.scenes[id].interior;return {...globalPoint(id,r),w:r.w,h:r.h}});
 const union={x:40,y:120,w:1280,h:1380};
 // Block every area outside the original two rectangles and the narrow authored seam.
 const xs=[40,205,555,655,1005,1320],ys=[120,620,650,680,1500],obstacles:Rect[]=[];
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const r={x:xs[i],y:ys[j],w:xs[i+1]-xs[i],h:ys[j+1]-ys[j]},mid={x:r.x+r.w/2,y:r.y+r.h/2};
  if(!rects.some(b=>mid.x>=b.x&&mid.x<b.x+b.w&&mid.y>=b.y&&mid.y<b.y+b.h)&&!inside(seam,mid,{w:0,h:0}))obstacles.push(r);
 }
 for(const id of Object.keys(offsets))for(const o of base.scenes[id].obstacles)obstacles.push({...globalPoint(id,o),w:o.w,h:o.h});
 obstacles.push({x:40,y:648,w:515,h:4},{x:655,y:648,w:665,h:4});
 return {...base,width:1440,height:1632,scenes:{...base.scenes,[CLUSTER]:{interior:union,spawn:globalPoint('market',rooms.market.spawn),obstacles}}};
}
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
