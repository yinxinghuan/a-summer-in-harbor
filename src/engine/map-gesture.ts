export type View={x:number;y:number;z:number};
export type MapSize={w:number;h:number;contentW?:number;contentH?:number};
export function minZoom(s:MapSize){return Math.min(1,s.w/(s.contentW||s.w),s.h/(s.contentH||s.h))}
export function clampView(v:View,w:number,h:number,contentW=w,contentH=h):View{
 const z=Math.max(minZoom({w,h,contentW,contentH}),Math.min(3,v.z)),bx=Math.max(0,(contentW*z-w)/2),by=Math.max(0,(contentH*z-h)/2);
 return {z,x:Math.max(-bx,Math.min(bx,v.x))||0,y:Math.max(-by,Math.min(by,v.y))||0};
}
export function zoomView(v:View,z:number,focus:{x:number;y:number},w:number,h:number,contentW=w,contentH=h):View{
 const next=Math.max(minZoom({w,h,contentW,contentH}),Math.min(3,z)),r=next/v.z;
 return clampView({z:next,x:focus.x-(focus.x-v.x)*r,y:focus.y-(focus.y-v.y)*r},w,h,contentW,contentH);
}
/** Coordinates are relative to viewport center. Pure model, no React or storage. */
export class MapGesture{
 view:View={x:0,y:0,z:1};points=new Map<number,{x:number;y:number}>();moved=false;
 size:MapSize;
 constructor(size:MapSize){this.size=size}
 set(v:View){const s=this.size;this.view=clampView(v,s.w,s.h,s.contentW,s.contentH);return this.view}
 zoom(z:number,focus={x:0,y:0}){const s=this.size;return this.set(zoomView(this.view,z,focus,s.w,s.h,s.contentW,s.contentH))}
 down(id:number,p:{x:number;y:number}){if(!this.points.size)this.moved=false;this.points.set(id,p);if(this.points.size>1)this.moved=true}
 move(id:number,p:{x:number;y:number}){const old=this.points.get(id);if(!old)return this.view;const other=[...this.points].find(([key])=>key!==id)?.[1],dx=p.x-old.x,dy=p.y-old.y;if(!this.moved&&!other&&Math.hypot(dx,dy)<5)return this.view;this.moved=true;
 if(other){const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(p.x-other.x,p.y-other.y);if(before>0){this.zoom(this.view.z*after/before,{x:(old.x+other.x)/2,y:(old.y+other.y)/2});this.set({...this.view,x:this.view.x+dx/2,y:this.view.y+dy/2})}}
 else this.set({...this.view,x:this.view.x+dx,y:this.view.y+dy});this.points.set(id,p);return this.view}
 up(id:number){this.points.delete(id)}
 cancel(){this.points.clear();this.moved=true}
}
