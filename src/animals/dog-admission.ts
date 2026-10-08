import type {AnimalArt} from './render-contract';
import {animalReviewAccepted} from './render-contract';
import {animalSheet} from './rpgjs-sheet';
import type {AnimalDef} from './types';

/** Complete family required; stand-only assets cannot enable a dog. No roster mutation. */
export function prepareDogFamily(art:AnimalArt|undefined,definition:AnimalDef){
 if(!art||!animalReviewAccepted(art.review))return null;
 if(art.species!=='dog'||definition.species!=='dog'||definition.visualVersion!==art.visualVersion||!definition.ownerId)throw Error('DOG_CONTRACT_INCOMPLETE');
 for(const slot of Object.values(definition.schedule))if(slot.activity!=='follow'||!slot.points.length)throw Error('DOG_SCHEDULE_UNSUPPORTED');
 const sheet=animalSheet(art),frames=['stand','walkA','walkB'].flatMap(p=>['down','left','right','up'].map(d=>(art.frames as any)[p][d]));
 if(new Set(frames.map(f=>`${f.x}:${f.y}`)).size!==12)throw Error('DOG_POSES_REUSED');
 if(frames.some(f=>!/^[a-f0-9]{64}$/.test(f.sourceSha256)||!f.requestId||!f.taskId))throw Error('DOG_SOURCE_MISSING');
 const native=['stand','walkA','walkB'].flatMap(p=>['down','left','up'].map(d=>(art.frames as any)[p][d]));
 if(new Set(native.map(f=>f.sourceSha256)).size!==9)throw Error('DOG_NATIVE_SOURCE_REUSED');
 return {definition,sheet};
}

export const dogMotionContract=Object.freeze({revision:1,nativeDirections:['down','left','up'],nativePoses:['stand','walkA','walkB'],right:'whole-frame mirror of left',atlas:[384,512],frame:[128,128],root:[64,104],scale:.5,speed:36,stride:28,followStop:44,followMax:96,productionEnabled:true,groundGeometry:'native measured52x34, full display51x46 protected separately'});
