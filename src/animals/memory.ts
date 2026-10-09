import type {Point} from '../engine/world';
import {profiles} from './config';
import {contextSlot} from './behavior';
import {pointClear} from './spatial';
import type {AnimalDef,AnimalSave,Context} from './types';
export function validAnimalSave(value:unknown,defs:readonly AnimalDef[],minutes:number):value is AnimalSave|undefined{
 if(!Number.isSafeInteger(minutes)||minutes<0)return false;
 if(value===undefined)return true;if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const s=value as AnimalSave;if(s.schema!==1||!s.individuals||typeof s.individuals!=='object'||Array.isArray(s.individuals))return false;
 const ids=new Set(defs.filter(d=>d.species==='cat').map(d=>d.id));
 return Object.keys(s).every(k=>['schema','individuals'].includes(k))&&Object.entries(s.individuals).every(([id,m])=>ids.has(id)&&!!m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).every(k=>['familiarity','lastPetMinute'].includes(k))&&Number.isSafeInteger(m.familiarity)&&m.familiarity>=0&&m.familiarity<=3&&(m.lastPetMinute===undefined||Number.isSafeInteger(m.lastPetMinute)&&m.lastPetMinute>=0&&m.lastPetMinute<=minutes));
}
/** Return a fresh optional field, never mutate or reinitialize the rest of the save. */
export function animalSave(value:unknown,defs:readonly AnimalDef[],minutes:number):AnimalSave{if(!validAnimalSave(value,defs,minutes))throw Error('UNSUPPORTED_ANIMAL_SAVE');return value===undefined?{schema:1,individuals:{}}:structuredClone(value)}
export function applyAnimalInteraction(previous:unknown,defs:readonly AnimalDef[],ctx:Context,a:{target:string;verb:'call'|'pet';foot:Point}){
 const memory=animalSave(previous,defs,ctx.townMinutes),def=defs.find(d=>d.id===a.target),slot=def&&contextSlot(def,ctx);
 if(!def||def.species!=='cat'||!slot||slot.scene!==ctx.scene)throw Error('ANIMAL_AWAY');
 if(slot.activity==='sleep')throw Error('ANIMAL_RESTING');
 if(!['call','pet'].includes(a.verb))throw Error('ANIMAL_ACTION_UNAVAILABLE');
 // Server supplies world/protection/resident bodies. Client cannot choose them.
 if(!pointClear(a.foot,slot,profiles[def.species],ctx,[],true))throw Error('INVALID_ANIMAL_POSITION');
 if(Math.hypot(ctx.player.x+ctx.player.w/2-a.foot.x,ctx.player.y+ctx.player.h/2-a.foot.y)>64)throw Error('TOO_FAR');
 const m=memory.individuals[a.target]??{familiarity:0};let gained=false;
 if(a.verb==='pet'&&(m.lastPetMinute===undefined||Math.floor(m.lastPetMinute/1440)<Math.floor(ctx.townMinutes/1440))){gained=m.familiarity<3;m.familiarity=Math.min(3,m.familiarity+1);m.lastPetMinute=ctx.townMinutes}
 memory.individuals[a.target]=m;
 return {memory,gained,text:(a.verb==='call'?['猫转过头，静静看着你。','The cat turns and watches you.']:gained?['它靠近你的手，慢慢放松下来。','It leans toward your hand and relaxes.']:['它安静地待了一会儿。','It stays quietly for a moment.']) as [string,string]};
}
