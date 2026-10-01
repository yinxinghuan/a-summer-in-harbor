export type Point={x:number;y:number}
export type Rect=Point&{w:number;h:number}
export type World={width:number;height:number;step:number;actor:{w:number;h:number};scenes:Record<string,{interior:Rect;spawn:Point;obstacles:Rect[]}>}
export function walkable(world:World,scene:string,p:Point){
 const s=world.scenes[scene],a=world.actor;if(!s||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false
 const r=s.interior
 return p.x>=r.x&&p.y>=r.y&&p.x+a.w<=r.x+r.w&&p.y+a.h<=r.y+r.h&&!s.obstacles.some(o=>p.x<o.x+o.w&&p.x+a.w>o.x&&p.y<o.y+o.h&&p.y+a.h>o.y)
}
export function findPath(world:World,scene:string,from:Point,to:Point):Point[]{
 const step=world.step,key=(p:Point)=>`${p.x},${p.y}`,round=(p:Point)=>({x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step})
 const clear=(a:Point,b:Point)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let i=1;i<=n;i++)if(!walkable(world,scene,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true}
 if(!walkable(world,scene,from)||!walkable(world,scene,to))return []
 const nearby=(p:Point)=>{const center=round(p),points:Point[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const q={x:center.x+x*step,y:center.y+y*step};if(walkable(world,scene,q)&&clear(p,q))points.push(q)}return points.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))}
 const starts=nearby(from),ends=new Set(nearby(to).map(key));if(!starts.length||!ends.size)return []
 const queue=[...starts],parents=new Map<string,Point|null>(starts.map(p=>[key(p),null]));let end:Point|undefined
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(ends.has(key(p))){end=p;break}
  for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){const q={x:p.x+dx,y:p.y+dy};if(!parents.has(key(q))&&walkable(world,scene,q)&&clear(p,q)){parents.set(key(q),p);queue.push(q)}}
 }
 if(!end)return [];const route:Point[]=[to];for(let p:Point|null=end;p;p=parents.get(key(p))??null)route.push(p);return route.reverse()
}
