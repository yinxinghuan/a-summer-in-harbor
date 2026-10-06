import {rooms} from './data';
import dimensions from './art-dimensions.json';
/** Existing painted lamps only. Pixel coordinates pinned to house-cafe.png. */
export function authoredLights(scene:string){
 if(scene!=='station')return [];
 const prop=rooms[scene].props.find(p=>p.id==='cafe-building'&&p.art==='house-cafe');
 if(!prop)return [];
 const d=dimensions['house-cafe'],scale=prop.width/d.width;
 return [217,683].map((x,i)=>({id:'cafe-window-'+i,x:prop.at.x-prop.width/2+x*scale,y:prop.at.y-d.height*scale+526*scale,width:62*scale}));
}
