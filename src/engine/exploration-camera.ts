import type {Point,Rect} from './world';
export type CameraInsets={left:number;top:number;right:number;bottom:number};
/** All geometry here is presentation only. It never changes the walkable world. */
export function explorationCamera(visual:Rect,walk:Rect,size:Point,insets:CameraInsets,scale:number){
 const left=insets.left/scale,right=size.x-insets.right/scale;
 const top=insets.top/scale,bottom=size.y-insets.bottom/scale;
 // Foot anchor leaves room above for the full actor and nearby portal caption.
 const anchor={x:(left+right)/2,y:Math.min(bottom-12/scale,(top+bottom+86/scale)/2)};
 const x=Math.min(visual.x,walk.x-anchor.x),y=Math.min(visual.y,walk.y-anchor.y);
 const endX=Math.max(visual.x+visual.w,walk.x+walk.w+size.x-anchor.x);
 const endY=Math.max(visual.y+visual.h,walk.y+walk.h+size.y-anchor.y);
 return {anchor,bounds:{x,y,w:endX-x,h:endY-y}};
}
