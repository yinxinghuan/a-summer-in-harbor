import {acceptedAnimals} from '../src/animals/art';
import type {Period} from '../src/animals/types';
import type {AnimalCommission,Observation} from '../src/animal-life/types';
import {rooms,people,tx,type Words} from '../src/world/data';
import {canonical,contentHash,validateCommission} from './animal-content';
export const animalGroundingPolicy=Object.freeze({id:'animal-grounded-choice-v4',maximumFindings:8,maximumFindingLength:300,maximumObservations:4,freeNarrative:false});
export type GroundedObservation={animal:string;behavior:Observation;period:Period;scene:string};
export type AnimalStoryChoice={schema:1;id:string;revision:number;resident:AnimalCommission['resident'];theme:'compare-routines'|'leave-space';observations:GroundedObservation[]};
const fields=(v:any,keys:string)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
const periods:Period[]=['morning','afternoon','evening','night'];
const periodWords:Record<Period,Words>={morning:['上午','morning'],afternoon:['午后','afternoon'],evening:['傍晚','evening'],night:['夜间','night']};
const verbWords:Record<Observation,Words>={'sun-rest':['晒太阳','sun-resting'],sleep:['睡觉','sleeping'],'shore-space':['安静活动','moving quietly']};
/** AI chooses existing facts. All factual sentences are rendered from checked
 * structured facts; free model title/prose/effect fields are rejected outright. */
export function compileAnimalStoryChoice(v:unknown,known:readonly string[]):AnimalCommission {
 const d=v as AnimalStoryChoice;
 if(!fields(d,'id,observations,resident,revision,schema,theme')||d.schema!==1||!/^animals:[a-z][a-z0-9-]{2,40}$/.test(d.id)||!Number.isSafeInteger(d.revision)||d.revision<1||d.revision>100||!['mara','ruth','owen','dani'].includes(d.resident)||!known.includes(d.resident)||!['compare-routines','leave-space'].includes(d.theme))throw Error('ANIMAL_GROUNDED_FIELDS');
 if(!Array.isArray(d.observations)||d.observations.length<2||d.observations.length>4)throw Error('ANIMAL_GROUNDED_OBSERVATIONS');
 const unique=new Set<string>();
 for(const o of d.observations){
  if(!fields(o,'animal,behavior,period,scene')||!periods.includes(o.period))throw Error('ANIMAL_GROUNDED_OBSERVATIONS');
  const a=acceptedAnimals.find(a=>a.id===o.animal),slot=a?.schedule[o.period],key=o.animal+':'+o.behavior;
  if(!a||!slot||slot.scene!==o.scene||unique.has(key))throw Error('ANIMAL_SCHEDULE_MISMATCH');unique.add(key);
  if(o.behavior==='shore-space'?a.species!=='gull':a.species!=='cat'||!['sun-rest','sleep'].includes(o.behavior)||slot.activity!==o.behavior)throw Error('ANIMAL_SCHEDULE_MISMATCH');
 }
 if(d.theme==='leave-space'&&!d.observations.some(o=>o.behavior==='shore-space'))throw Error('ANIMAL_THEME_MISMATCH');
 const names=(o:GroundedObservation):Words=>{const a=acceptedAnimals.find(a=>a.id===o.animal)!,n=o.animal.split('-').at(-1);return a.species==='cat'?[`第${n}只海湾猫`,`harbor cat ${n}`]:[`第${n}只岸边海鸥`,`shore gull ${n}`]};
 const facts=(locale:'zh'|'en')=>d.observations.map(o=>locale==='en'?`${tx(names(o),locale)} ${tx(verbWords[o.behavior],locale)} in ${tx(rooms[o.scene].title,locale)} (${tx(periodWords[o.period],locale)})`:`${tx(names(o),locale)}${tx(periodWords[o.period],locale)}在${tx(rooms[o.scene].title,locale)}${tx(verbWords[o.behavior],locale)}`).join(locale==='en'?'; ':'；');
 const result:AnimalCommission={schema:1,id:d.id,revision:d.revision,capability:'animal-notebook-v1',resident:d.resident,
 title:d.theme==='compare-routines'?['各自的作息','Different daily routines']:['留一点安静的空间','Leave a little quiet space'],
 brief:[`“请分别观察：${facts('zh')}。给它们留出空间，不必催促。没有期限。”`,`“Watch each separately: ${facts('en')}. Leave them space. No deadline.”`],
 page:[`我与${tx(people[d.resident].name,'en')}分享了不同的观察：${facts('zh')}。`,`I shared different observations with ${tx(people[d.resident].name,'en')}: ${facts('en')}.`],
 requirements:d.observations.map(({animal,behavior})=>({animal,behavior}))};
 validateCommission(result);return result;
}
export const animalGroundingSourceHash=contentHash({policy:animalGroundingPolicy,animals:acceptedAnimals,places:Object.fromEntries(Object.entries(rooms).map(([id,r])=>[id,r.title]))});
/** Review protocol is exact, never silently truncate an invalid rejection. */
export function parseAnimalSemanticReview(raw:string){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>8000)throw Error('ANIMAL_REVIEW_INVALID');const v=JSON.parse(raw);
 if(!fields(v,'findings,format,passed')||v.format!=='harbor-animal-review-v1'||typeof v.passed!=='boolean'||!Array.isArray(v.findings)||v.findings.length>8||v.findings.some((s:unknown)=>typeof s!=='string'||!s.trim()||s.length>300)||v.passed&&v.findings.length)throw Error('ANIMAL_REVIEW_INVALID');
 return v as {format:string;passed:boolean;findings:string[]};
}
export function assertCompiledAnimalChoice(choice:unknown,definition:AnimalCommission){
 if(canonical(compileAnimalStoryChoice(choice,[definition.resident]))!==canonical(definition))throw Error('ANIMAL_GROUNDED_TAMPER');
}
