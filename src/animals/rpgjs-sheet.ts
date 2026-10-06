import {profiles} from './config';
import type {AnimalState} from './types';
import type {AnimalArt,Frame} from './render-contract';
import {animalReviewAccepted} from './render-contract';
/** Complete approved frame data only. Diagnostic candidates stay in the separate QA harness. */
export function animalSheet(art:AnimalArt){
 if(!animalReviewAccepted(art?.review))throw Error('ANIMAL_ART_NOT_ACCEPTED');
 const required=art.species==='cat'?['stand','walkA','walkB','sun-rest','sleep']:art.species==='gull'?['stand','walkA','walkB','wing-up','wing-down']:['stand','walkA','walkB'];
 if(required.some(pose=>['down','left','right','up'].some(direction=>!(art.frames as any)[pose]?.[direction])))throw Error('ANIMAL_FAMILY_INCOMPLETE');
 const values=Object.values(art.frames).flatMap(d=>Object.values(d??{})).filter((v):v is Frame=>!!v),base=values[0];
 if(!base||values.some(f=>f.w!==base.w||f.h!==base.h||f.x%base.w||f.y%base.h)||art.atlas.w%base.w||art.atlas.h%base.h)throw Error('ANIMAL_ATLAS_NOT_GRID');
 const textures:Record<string,unknown>={};
 for(const [pose,directions]of Object.entries(art.frames))for(const [direction,f]of Object.entries(directions??{}))if(f)textures[pose+'-'+direction]={animations:()=>[[{frameX:f.x/f.w,frameY:f.y/f.h,time:0,anchor:f.anchor,scale:[f.scale,f.scale],x:0,y:0}]]};
 for(const [pose,directions]of Object.entries(art.frames))if(pose.startsWith('wing-'))for(const [direction,f]of Object.entries(directions??{}))if(f)for(let lift=1;lift<=profiles[art.species].flightHeight;lift++)textures[pose+'-'+direction+':'+lift]={animations:()=>[[{frameX:f.x/f.w,frameY:f.y/f.h,time:0,anchor:f.anchor,scale:[f.scale,f.scale],x:0,y:-lift}]]};
 textures.stand=textures['stand-down'];
 return {id:'animal-'+art.visualVersion,image:art.image,width:art.atlas.w,height:art.atlas.h,framesWidth:art.atlas.w/base.w,framesHeight:art.atlas.h/base.h,textures};
}

/** Elevation moves only the graphic; the event foot and depth stay on the ground. */
export const animalAnimation=(a:AnimalState)=>a.pose+'-'+a.direction+(a.phase==='flight'&&Math.round(a.elevation)>0?':'+Math.round(a.elevation):'');
