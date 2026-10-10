import {world} from '../world/data';
import {waterBarriers,outdoors} from '../world/outdoors';
import {walkable,type World,type Point,type Rect} from '../engine/world';
const groups=[['market','bazaar'],['coast','beach','path']];
export const sharedGroup=(id?:string)=>groups.find(g=>g.includes(id??''));
const offsets={market:{x:0,y:540},bazaar:{x:125,y:0},coast:{x:0,y:0},beach:{x:70,y:650},path:{x:1155,y:140}};

const local=(id:string,p:Point)=>({x:p.x-offsets[id as keyof typeof offsets].x,y:p.y-offsets[id as keyof typeof offsets].y});
const global=(id:string,p:Point)=>({x:p.x+offsets[id as keyof typeof offsets].x,y:p.y+offsets[id as keyof typeof offsets].y});
/** Shared solids include grounded props, runtime bodies and marketplace building barriers; each original dry domain remains authoritative. */
const bodiesCache=new WeakMap<World,Map<string,Rect[]>>();
export function sharedBodies(base:World,scene:string):Rect[]{const pair=sharedGroup(scene)!;const key=pair[0],old=bodiesCache.get(base)?.get(key);if(old)return old;const bodies=pair.flatMap(id=>{const staticCount=world.scenes[id].obstacles.length,terrainCount=waterBarriers(outdoors[id]).length+outdoors[id].barriers.length;return base.scenes[id].obstacles.filter((_o,i)=>i>=terrainCount&&i<staticCount||i>=staticCount||pair[0]==='market'&&i>=waterBarriers(outdoors[id]).length&&i<terrainCount).map(o=>({...global(id,o),w:o.w,h:o.h}))});const cache=bodiesCache.get(base)??new Map();cache.set(key,bodies);bodiesCache.set(base,cache);return bodies}
const penetration=(a:Rect,b:Rect)=>Math.min(a.x+a.w-b.x,b.x+b.w-a.x,a.y+a.h-b.y,b.y+b.h-a.y);
const overlap=(a:Rect,b:Rect)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
export function sharedWalkable(base:World,scene:string,p:Point,previous?:Point){
 const pair=sharedGroup(scene)!;
 if(!pair.some(id=>walkable(base,id,local(id,p))))return false;
 const actor={...p,...base.actor},before=previous&&{...previous,...base.actor};
 return sharedBodies(base,scene).every(o=>{const hit=overlap(actor,o);return !hit||!!before&&overlap(before,o)>0&&penetration(actor,o)<penetration(before,o)-1e-7});
}
/** Idle restores retain their source identity; moving classification must remain readable by the original save contract. */
export function sharedZone(p:Point,preferred:string,previous?:Point){
 if(!previous||Math.hypot(p.x-previous.x,p.y-previous.y)<1e-9)return preferred;
 const contains=(id:string)=>{const q=local(id,p),r=world.scenes[id].interior;return q.x>=r.x&&q.y>=r.y&&q.x+world.actor.w<=r.x+r.w&&q.y+world.actor.h<=r.y+r.h};
 const pair=sharedGroup(preferred)!;
 const next=pair[0]==='market'?(p.y+world.actor.h/2>=650?'market':'bazaar'):contains('path')&&p.x+world.actor.w/2>=1280?'path':contains('beach')&&p.y+world.actor.h/2>=805?'beach':'coast';
 if(walkable(world,next,local(next,p)))return next;
 if(walkable(world,preferred,local(preferred,p)))return preferred;
 return pair.find(id=>walkable(world,id,local(id,p)))??preferred;
}
/** Grid routes and each connecting leg use the same shared swept admission. */
export function sharedPath(base:World,scene:string,from:Point,to:Point):Point[]{
 const step=base.step,key=(p:Point)=>`${p.x},${p.y}`,round=(p:Point)=>({x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step});
 const clear=(a:Point,b:Point)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));let prev=a;for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!sharedWalkable(base,scene,q,prev))return false;prev=q}return true};
 if(!sharedWalkable(base,scene,to))return [];
 const near=(p:Point,exit=false)=>{const c=round(p),out:Point[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const q={x:c.x+x*step,y:c.y+y*step};if(sharedWalkable(base,scene,q)&&clear(exit?p:q,exit?q:p))out.push(q)}return out};
 const starts=near(from,true),ends=new Set(near(to).map(key));if(!starts.length||!ends.size)return [];
 const queue=[...starts],parents=new Map<string,Point|null>(starts.map(p=>[key(p),null]));let end:Point|undefined;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(ends.has(key(p))){end=p;break}for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const q={x:p.x+dx,y:p.y+dy};if(!parents.has(key(q))&&sharedWalkable(base,scene,q)&&clear(p,q)){parents.set(key(q),p);queue.push(q)}}}
 if(!end)return [];const route:Point[]=[to];for(let p:Point|null=end;p;p=parents.get(key(p))??null)route.push(p);return route.reverse();
}
