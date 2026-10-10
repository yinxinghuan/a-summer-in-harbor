import {rooms,world} from './data';
import {outdoors,passages} from './outdoors';
import dimensions from './art-dimensions.json';
import {walkable,type Point,type Rect} from '../engine/world';
import {globalPoint,localPoint,zonesFor,renderScene} from '../candidate/continuity';
export type BoundaryPiece={scene:string;art:'nature-juniper-v1'|'coastal-rocks'|'harbor-bollard-v1';rect:Rect};
const cache=new Map<string,BoundaryPiece[]>();
const material=(id:string,p:Point)=>outdoors[id]?.patches.slice().reverse().find(t=>p.x>=t.x&&p.x<t.x+t.w&&p.y>=t.y&&p.y<t.y+t.h)?.material;
/** Never paint a legal ground contact in any member of a continuous map. */
export function boundaryPaintClear(rect:Rect,zones:string[]){
 for(let y=rect.y;y<=rect.y+rect.h;y+=4)for(let x=rect.x;x<=rect.x+rect.w;x+=4)for(const id of zones){const q=localPoint(id,{x:x-world.actor.w/2,y:y-world.actor.h});if(walkable(world,id,q))return false;}
 return true;
}
/** Renderer-only exterior dressing: original bounds, IDs, collisions and save coordinates stay authoritative. */
export function boundaryPieces(scene:string):BoundaryPiece[]{
 const key=renderScene(scene),old=cache.get(key);if(old)return old;
 const zones=zonesFor(scene).filter(id=>rooms[id]?.outdoor),result:BoundaryPiece[]=[];
 for(const id of zones){const r=world.scenes[id].interior;
  for(const side of ['N','S','W','E'] as const){
   const art=id==='harbor'||id==='dock'?'harbor-bollard-v1':['coast','beach','path'].includes(id)&&side!=='N'?'coastal-rocks':'nature-juniper-v1';
   const w=art==='harbor-bollard-v1'?38:art==='coastal-rocks'?86:96,d=dimensions[art],h=w*d.height/d.width,vertical=side==='W'||side==='E',length=vertical?r.h:r.w,step=vertical?h*.68:w*.76;
   for(let t=0;t<=length;t+=step){const p={x:vertical?(side==='W'?r.x:r.x+r.w):r.x+t,y:vertical?r.y+t:(side==='N'?r.y:r.y+r.h)};
    // Keep the whole 180px route mouth clear, including an actor and source-art padding.
    if(Object.values(passages[id]??{}).some(exit=>exit.side===side&&Math.abs((vertical?exit.at.y:exit.at.x)-(vertical?p.y:p.x))<90+(vertical?h/2:w/2)))continue;
    const inside={x:Math.max(r.x+1,Math.min(r.x+r.w-1,p.x+(side==='W'?1:side==='E'?-1:0))),y:Math.max(r.y+1,Math.min(r.y+r.h-1,p.y+(side==='N'?1:side==='S'?-1:0)))};
    if(material(id,inside)==='water')continue; // Existing water already explains the impassable shore.
    const local={x:vertical?(side==='W'?p.x-w:p.x):p.x-w/2,y:vertical?p.y-h/2:(side==='N'?p.y-h:p.y),w,h};
    const rect={...globalPoint(id,local),w,h};if(!boundaryPaintClear(rect,zones))continue;
    result.push({scene:id,art,rect});
   }
  }
 }
 cache.set(key,result);return result;
}
export function boundaryAudit(){return Object.values(rooms).filter(r=>r.outdoor).map(r=>({scene:r.id,logicalBounds:r.interior,physicalMap:renderScene(r.id),routeOpenings:Object.entries(passages[r.id]??{}).map(([to,p])=>({to,side:p.side,at:p.at,clearWidth:180})),pieces:boundaryPieces(r.id).filter(p=>p.scene===r.id).length,policy:'exterior only; existing water and bridge retained; no new collision'}));}
