import art from './snap-pea-art.json';
import type {ContentRef} from '../life/types';
export function admittedPlant(ref:ContentRef){return ref.id===art.ref.id&&ref.revision===art.ref.revision&&ref.hash===art.ref.hash&&ref.capability===art.ref.capability}
export function lifeItemImage(ref:ContentRef,kind:'seed'|'produce'){return admittedPlant(ref)?art.files[kind].image:undefined}
export const lifeCropSheets=['young','growing','ready'].map(stage=>({
 id:'prop-life-snap-pea-v2-'+stage,image:art.files[stage as 'young'].image,width:256,height:256,framesWidth:1,framesHeight:1,
 textures:{stand:{animations:()=>[[{frameX:0,frameY:0,time:0,anchor:art.profile.root.map(n=>n/256),scale:[art.profile.scale,art.profile.scale],x:0,y:0}]]}},
}));
export function lifeCropGraphic(status:{ref:ContentRef;grown:number;ready:boolean;growMinutes:number}|null){
 if(!status||!admittedPlant(status.ref))return '';
 return 'prop-life-snap-pea-v2-'+(status.ready?'ready':status.grown<status.growMinutes/3?'young':'growing');
}
