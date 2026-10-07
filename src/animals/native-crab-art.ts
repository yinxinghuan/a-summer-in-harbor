import manifest from './native-crab-manifest.json';
import type {CrabFrame} from './native-crab';
/** Importing this consumer module never registers an animal or changes a save. */
export const nativeCrabManifest=manifest;
export const nativeCrabAnimation=(f:CrabFrame)=>f.visible?f.pose+'-'+f.direction:'hidden-'+f.direction;
export function nativeCrabSheet(){
 const textures:Record<string,any>={};
 for(const [name,f] of Object.entries(manifest.frames)){const pose=name.split('-')[1],d=name.split('-')[0];textures[pose+'-'+d]={animations:()=>[[{frameX:f.column,frameY:f.row,time:0,anchor:f.anchor,scale:[.5,.5],x:0,y:0}]]};if(pose==='stand')textures['hidden-'+d]={animations:()=>[[{frameX:f.column,frameY:f.row,time:0,anchor:f.anchor,scale:[0,0],x:0,y:0}]]}}
 textures.stand=textures['stand-down'];
 return {id:'animal-'+manifest.id,image:'./art/animals/crab-c1-v2/'+manifest.image,width:512,height:384,framesWidth:4,framesHeight:3,textures};
}
