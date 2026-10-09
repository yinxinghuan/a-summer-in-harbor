import {acceptedAnimals} from '../src/animals/art';
import {canonical,contentHash,builtInCommissions} from './animal-content';
import type {AnimalCommission} from '../src/animal-life/types';
import type {GroundedObservation} from './animal-grounding';
import {animalChoiceSchema,animalBoundReviewSchema,animalBoundReviewFormat,animalResidents,animalContractLimits,animalChoiceConstraints,contractViolations,describeContractFields} from './animal-contract-schema';

export type BoundFinding={observationId:string|null;factId:string|null;ruleId:string};
export type BoundAnimalReview={format:typeof animalBoundReviewFormat;passed:boolean;findings:BoundFinding[]};
export type AnimalViolation=BoundFinding&{path:string;constraint:string};
export const animalScheduleSourceHash=contentHash(acceptedAnimals);
export const animalContractHash=contentHash({choice:animalChoiceSchema,review:animalBoundReviewSchema,constraints:animalChoiceConstraints,schedule:animalScheduleSourceHash});
export const registeredAnimalScheduleFacts=Object.freeze(acceptedAnimals.flatMap(a=>Object.entries(a.schedule).map(([period,slot])=>Object.freeze({animal:a.id,period,scene:slot.scene,activity:slot.activity}))));
export const admittedAnimalObservationFacts=Object.freeze(acceptedAnimals.flatMap<GroundedObservation>(a=>Object.entries(a.schedule).flatMap<GroundedObservation>(([period,s])=>{
 const common={animal:a.id,period:period as GroundedObservation['period'],scene:s.scene};
 if(a.species==='gull')return [Object.freeze({...common,behavior:'shore-space'})];
 if(a.species==='cat'&&(s.activity==='sun-rest'||s.activity==='sleep'))return [Object.freeze({...common,behavior:s.activity})];
 return [];
})));
/** Full schedule truth also includes unsupported notebook activities such as
 * cat-2 wandering in the market in the afternoon. Truth is not a new ability. */
export function isRegisteredAnimalScheduleFact(claim:unknown){return registeredAnimalScheduleFacts.some(f=>canonical(f)===canonical(claim));}
export function observationFactId(claim:unknown){return 'fact:'+contentHash({schedule:animalScheduleSourceHash,claim});}
const claimOf=(o:any)=>({animal:o?.animal,behavior:o?.behavior,period:o?.period,scene:o?.scene});
const reference=(o:any,i:number):Omit<BoundFinding,'ruleId'>=>({observationId:`obs-${i+1}`,factId:observationFactId(claimOf(o))});
export function inspectAnimalChoice(value:unknown,known:readonly string[],existing:readonly AnimalCommission[]=builtInCommissions){
 const d=value as any,issues:AnimalViolation[]=[],observations=Array.isArray(d?.observations)?d.observations.map((o:any,i:number)=>({...reference(o,i),claim:claimOf(o)})):[];
 const add=(ruleId:string,path:string,constraint:string,index?:number)=>issues.push({...(index===undefined?{observationId:null,factId:null}:reference(d.observations[index],index)),ruleId,path,constraint});
 for(const issue of contractViolations(d,animalChoiceSchema)){
  const m=/^\$\.observations\[(\d+)\]/.exec(issue.path),index=m?Number(m[1]):undefined;
  const rule=issue.path==='$.observations'&&issue.constraint==='count'?'ANIMAL_OBSERVATION_COUNT':index!==undefined?
   (issue.path.endsWith('.animal')?'ANIMAL_KNOWN_ANIMAL':'ANIMAL_OBSERVATION_FIELDS'):'ANIMAL_GROUNDED_FIELDS';
  add(rule,issue.path,issue.constraint,index);
 }
 if(d&&typeof d.resident==='string'&&animalResidents.includes(d.resident as any)&&!known.includes(d.resident))add('ANIMAL_UNKNOWN_RESIDENT','$.resident','already-introduced');
 const unique=new Set<string>();
 for(const [i,o] of (Array.isArray(d?.observations)?d.observations:[]).entries()){
  const a=acceptedAnimals.find(a=>a.id===o?.animal);
  if(!a){add('ANIMAL_KNOWN_ANIMAL',`$.observations[${i}].animal`,'registered-individual',i);continue}
  if(!admittedAnimalObservationFacts.some(f=>canonical(f)===canonical(claimOf(o))))add('ANIMAL_SCHEDULE_MISMATCH',`$.observations[${i}]`,'exact-individual-period-scene-activity',i);
  const key=o.animal+':'+o.behavior;
  if(unique.has(key))add('ANIMAL_DUPLICATE_REQUIREMENT',`$.observations[${i}]`,'unique-individual-behavior',i);unique.add(key);
 }
 if(d?.theme==='leave-space'&&(!Array.isArray(d.observations)||!d.observations.some((o:any)=>o?.behavior==='shore-space')))add('ANIMAL_THEME_MISMATCH','$.theme','leave-space-requires-gull');
 if(Array.isArray(d?.observations)){
  const requirements=d.observations.map((o:any)=>({animal:o?.animal,behavior:o?.behavior}));
  const key=(v:any[])=>canonical([...v].sort((a,b)=>canonical(a).localeCompare(canonical(b))));
  if(existing.some(v=>v.id===d.id||key(v.requirements)===key(requirements)))add('ANIMAL_COSMETIC_DUPLICATE','$','new-id-and-requirements');
 }
 return {contractHash:animalContractHash,rawCandidateHash:contentHash(value),observations,issues,knownResidents:known.filter(v=>animalResidents.includes(v as any))};
}
export type AnimalReviewPacket=ReturnType<typeof inspectAnimalChoice>;
/** The independent reviewer sees claims/references and registered truth, not
 * the deterministic answer. Reconciliation retains the private issues. */
export function publicAnimalReviewPacket(packet:AnimalReviewPacket){
 const {issues:_,...publicPacket}=packet;return structuredClone(publicPacket);
}
export function parseBoundAnimalReview(raw:string):BoundAnimalReview{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>animalContractLimits.reviewBytes)throw Error('ANIMAL_REVIEW_INVALID');
 let v:any;try{v=JSON.parse(raw)}catch{throw Error('ANIMAL_REVIEW_INVALID')}
 if(contractViolations(v,animalBoundReviewSchema).length||v.passed&&v.findings.length||!v.passed&&!v.findings.length||v.findings.some((f:BoundFinding)=>(f.observationId===null)!==(f.factId===null)))throw Error('ANIMAL_REVIEW_INVALID');
 return v;
}
export class AnimalReviewUntrustedError extends Error{
 readonly code='ANIMAL_REVIEW_UNTRUSTED';
 constructor(readonly reasons:readonly string[],readonly originalReview:BoundAnimalReview){super('ANIMAL_REVIEW_UNTRUSTED');this.name='AnimalReviewUntrustedError'}
}
const findingKey=(v:BoundFinding)=>canonical({observationId:v.observationId,factId:v.factId,ruleId:v.ruleId});
/** Model output cannot override deterministic facts or manufacture a problem.
 * No model prose is interpreted as rules or silently converted into approval. */
export function assertBoundAnimalReview(review:BoundAnimalReview,packet:AnimalReviewPacket){
 parseBoundAnimalReview(JSON.stringify(review));
 const reasons:string[]=[],expected=new Set(packet.issues.map(findingKey)),seen=new Set<string>();
 for(const finding of review.findings){
  const key=findingKey(finding);
  if(seen.has(key))reasons.push('DUPLICATE_FINDING');seen.add(key);
  if(!expected.has(key))reasons.push('UNSUPPORTED_RULE_OR_FACT_REFERENCE');
 }
 if(review.passed&&expected.size)reasons.push('ACCEPTS_DETERMINISTIC_VIOLATION');
 if(!review.passed&&!expected.size)reasons.push('REJECTS_DETERMINISTICALLY_VALID_FACTS');
 if(!review.passed&&[...expected].some(k=>!seen.has(k)))reasons.push('UNCITED_DETERMINISTIC_VIOLATION');
 if(reasons.length)throw new AnimalReviewUntrustedError(Object.freeze([...new Set(reasons)]),structuredClone(review));
 return {trusted:true as const,passed:review.passed};
}
export function animalChoiceExample(known:readonly string[],existing:readonly AnimalCommission[]=builtInCommissions){
 const resident=known.find(v=>animalResidents.includes(v as any));if(!resident)throw Error('ANIMAL_SOURCE_UNAVAILABLE');
 const facts=admittedAnimalObservationFacts;
 let n=1;while(existing.some(d=>d.id===`animals:schema-example-${n}`))n++;
 for(let i=0;i<facts.length;i++)for(let j=i+1;j<facts.length;j++){
  const value={schema:1,id:`animals:schema-example-${n}`,revision:1,resident,theme:'compare-routines',observations:[facts[i],facts[j]]};
  if(!inspectAnimalChoice(value,known,existing).issues.length)return value;
 }
 throw Error('ANIMAL_EXAMPLE_UNAVAILABLE');
}
export const animalChoiceFieldGuide=Object.freeze([...describeContractFields(animalChoiceSchema),...animalChoiceConstraints.map(r=>r.ruleId+': '+r.description)]);
export const animalReviewFieldGuide=Object.freeze([...describeContractFields(animalBoundReviewSchema),'passed=true requires findings=[]; passed=false requires at least one actual problem','observationId and factId must both be null for a story-level issue, otherwise both must match one exact packet observation','Every finding must match a deterministic issue; cite all distinct issues; no free-text reasons, positive commentary or overrides']);
const issueWords:Record<string,[string,string]>={
 ANIMAL_GROUNDED_FIELDS:['顶层字段不符合固定合同','Top-level fields violate the fixed contract'],
 ANIMAL_OBSERVATION_FIELDS:['观察字段不符合固定合同','Observation fields violate the fixed contract'],
 ANIMAL_OBSERVATION_COUNT:[`观察数量须为${animalContractLimits.minimumObservations}–${animalContractLimits.maximumObservations}条`,`Observation count must be ${animalContractLimits.minimumObservations}–${animalContractLimits.maximumObservations}`],
 ANIMAL_KNOWN_ANIMAL:['动物个体未准入','Animal individual is not admitted'],
 ANIMAL_SCHEDULE_MISMATCH:['个体、时段、地点或行为与登记日程不符','Individual, period, scene or behavior conflicts with the registered schedule'],
 ANIMAL_DUPLICATE_REQUIREMENT:['同一个体与行为重复','Individual and behavior requirement repeats'],
 ANIMAL_UNKNOWN_RESIDENT:['居民尚未认识','Resident has not been introduced'],
 ANIMAL_THEME_MISMATCH:['安静空间主题缺少海鸥观察','Quiet-space theme requires a gull observation'],
 ANIMAL_COSMETIC_DUPLICATE:['ID或需求与既有委托重复','Id or requirements duplicate an existing commission'],
};
/** Author-rendered diagnostic, never model prose or production rule syntax. */
export function renderAnimalViolation(issue:AnimalViolation){
 const words=issueWords[issue.ruleId];if(!words)throw Error('ANIMAL_REVIEW_RULE_UNKNOWN');
 return {zh:`${words[0]}（${issue.path}；${issue.constraint}）`,en:`${words[1]} (${issue.path}; ${issue.constraint})`};
}
