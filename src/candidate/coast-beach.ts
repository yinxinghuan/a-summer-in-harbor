import {rooms,world} from '../world/data';
import {waterBarriers,outdoors} from '../world/outdoors';
import {walkable,type World,type Point,type Rect} from '../engine/world';
const pair=['coast','beach'];
const offsets={coast:{x:0,y:0},beach:{x:70,y:650}};
export const coastBeachPair=(id?:string)=>!!id&&pair.includes(id);
const local=(id:string,p:Point)=>({x:p.x-offsets[id as keyof typeof offsets].x,y:p.y-offsets[id as keyof typeof offsets].y});
const global=(id:string,p:Point)=>({x:p.x+offsets[id as keyof typeof offsets].x,y:p.y+offsets[id as keyof typeof offsets].y});
/** Only real grounded props and appended runtime bodies are shared. Legacy water/barriers still limit each admitted dry domain. */
const bodiesCache=new WeakMap<World,Rect[]>();
export function coastBeachBodies(base:World):Rect[]{const old=bodiesCache.get(base);if(old)return old;const bodies=pair.flatMap(id=>{const staticCount=world.scenes[id].obstacles.length,terrainCount=waterBarriers(outdoors[id]).length+outdoors[id].barriers.length;return base.scenes[id].obstacles.filter((_o,i)=>i>=terrainCount&&i<staticCount||i>=staticCount).map(o=>({...global(id,o),w:o.w,h:o.h}))});bodiesCache.set(base,bodies);return bodies}
const penetration=(a:Rect,b:Rect)=>Math.min(a.x+a.w-b.x,b.x+b.w-a.x,a.y+a.h-b.y,b.y+b.h-a.y);
const overlap=(a:Rect,b:Rect)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
export function coastBeachWalkable(base:World,p:Point,previous?:Point){
 if(!pair.some(id=>walkable(base,id,local(id,p))))return false;
 const actor={...p,...base.actor},before=previous&&{...previous,...base.actor};
 return coastBeachBodies(base).every(o=>{const hit=overlap(actor,o);return !hit||!!before&&overlap(before,o)>0&&penetration(actor,o)<penetration(before,o)-1e-7});
}
/** Idle restore keeps its source identity; an actual move classifies only this pair. */
export function coastBeachZone(p:Point,preferred:string,previous?:Point){
 if(!previous||Math.hypot(p.x-previous.x,p.y-previous.y)<1e-9)return preferred;
 const contains=(id:string)=>{const q=local(id,p),r=world.scenes[id].interior;return q.x>=r.x&&q.y>=r.y&&q.x+world.actor.w<=r.x+r.w&&q.y+world.actor.h<=r.y+r.h};
 const next=contains('beach')&&p.y+world.actor.h/2>=805?'beach':contains('coast')?'coast':contains('beach')?'beach':preferred;
 // A grandfathered actor may still be exiting the target member's old solid.
 return walkable(world,next,local(next,p))?next:preferred;
}
/** Grid routes and each connecting leg use the same shared swept admission. */
export function coastBeachPath(base:World,from:Point,to:Point):Point[]{
 const step=base.step,key=(p:Point)=>`${p.x},${p.y}`,round=(p:Point)=>({x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step});
 const clear=(a:Point,b:Point)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));let prev=a;for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!coastBeachWalkable(base,q,prev))return false;prev=q}return true};
 if(!coastBeachWalkable(base,to))return [];
 const near=(p:Point,exit=false)=>{const c=round(p),out:Point[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const q={x:c.x+x*step,y:c.y+y*step};if(coastBeachWalkable(base,q)&&clear(exit?p:q,exit?q:p))out.push(q)}return out};
 const starts=near(from,true),ends=new Set(near(to).map(key));if(!starts.length||!ends.size)return [];
 const queue=[...starts],parents=new Map<string,Point|null>(starts.map(p=>[key(p),null]));let end:Point|undefined;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(ends.has(key(p))){end=p;break}for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const q={x:p.x+dx,y:p.y+dy};if(!parents.has(key(q))&&coastBeachWalkable(base,q)&&clear(p,q)){parents.set(key(q),p);queue.push(q)}}}
 if(!end)return [];const route:Point[]=[to];for(let p:Point|null=end;p;p=parents.get(key(p))??null)route.push(p);return route.reverse();
}
