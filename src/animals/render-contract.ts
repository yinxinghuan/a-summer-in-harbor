import type {AnimalState,Pose,Facing,Species} from './types';
import {animalTargets} from './harbor-adapter';
import {bodyAt} from './spatial';
import {profiles} from './config';
export type Frame={x:number;y:number;w:number;h:number;anchor:[number,number];scale:number;sourceSha256:string;requestId:string;taskId:string};
export type AnimalArt={species:Species;visualVersion:string;image:string;atlas:{w:number;h:number};frames:Partial<Record<Pose,Partial<Record<Facing,Frame>>>>;review:{singleImage:'accepted'|'hold'|'rejected';family:'accepted'|'hold'|'rejected';targetScene:'accepted'|'hold'|'rejected';technical:'accepted'|'hold'|'rejected'}};
/** Runtime JSON is untrusted: require exactly four own data fields, never an empty/inherited gate. */
export function animalReviewAccepted(review:unknown):review is AnimalArt['review']{
 if(!review||typeof review!=='object'||Array.isArray(review))return false;
 const proto=Object.getPrototypeOf(review);if(proto!==Object.prototype&&proto!==null)return false;
 const required=['singleImage','family','targetScene','technical'] as const;
 if(Reflect.ownKeys(review).length!==required.length)return false;
 return required.every(key=>{const field=Object.getOwnPropertyDescriptor(review,key);return !!field&&'value' in field&&field.value==='accepted'});
}
/** Safe unrenderable result until actual art passes all four independent gates. */
export function renderAnimal(a:AnimalState,art?:AnimalArt){
 if(!a.visible)return null;if(!art||art.species!==a.species||art.visualVersion!==a.visualVersion||!animalReviewAccepted(art.review))return null;
 const f=art.frames[a.pose]?.[a.direction];if(!f||!/^\.\//.test(art.image)||!/^[a-f0-9]{64}$/.test(f.sourceSha256)||!f.requestId||!f.taskId||![f.x,f.y,f.w,f.h,...f.anchor,f.scale,art.atlas.w,art.atlas.h].every(Number.isFinite)||f.anchor.some(n=>n<0||n>1)||f.x<0||f.y<0||f.w<=0||f.h<=0||f.x+f.w>art.atlas.w||f.y+f.h>art.atlas.h||f.scale<=0)throw Error('INVALID_ANIMAL_FRAME');
 return {id:a.id,image:art.image,frame:f,foot:{...a.foot},offsetY:-a.elevation,collisionEnabled:a.phase!=='flight',interactionEnabled:a.species==='cat'&&a.phase!=='sleep',depthY:a.foot.y};
}
/** Product uses this atomic projection: no approved visual means no body or hotspot. */
export function animalPresentation(states:readonly AnimalState[],arts:Record<string,AnimalArt>,scene:string){
 const rendered=states.filter(s=>s.scene===scene).flatMap(state=>{const visual=renderAnimal(state,arts[state.visualVersion]);return visual?[{state,visual}]:[]});
 return {visuals:rendered.map(r=>r.visual),collisions:rendered.filter(r=>r.visual.collisionEnabled).map(r=>bodyAt(r.state.foot,profiles[r.state.species])),targets:animalTargets(rendered.map(r=>r.state),scene)};
}
