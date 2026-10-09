import {acceptedAnimals} from '../src/animals/art';
import {rooms} from '../src/world/data';

/** Executable contract descriptor, not a claim of provider JSON Schema support.
 * Every string bound uses UTF-16 code units (String.length); never truncate. */
export type ContractSchema=
 | {type:'object';properties:Record<string,ContractSchema>}
 | {type:'array';items:ContractSchema;minItems:number;maxItems:number}
 | {type:'string';minCodeUnits:number;maxCodeUnits:number;enum?:readonly string[];pattern?:string;nullable?:boolean}
 | {type:'integer';minimum:number;maximum:number}
 | {type:'literal';value:string|number}
 | {type:'boolean'};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
const text=(min:number,max:number,extra:Partial<Extract<ContractSchema,{type:'string'}>>={}):ContractSchema=>({type:'string',minCodeUnits:min,maxCodeUnits:max,...extra});
const enumeration=(values:readonly string[]):ContractSchema=>text(Math.min(...values.map(s=>s.length)),Math.max(...values.map(s=>s.length)),{enum:values});
export const animalContractLimits=freeze({draftBytes:8000,reviewBytes:8000,minimumObservations:2,maximumObservations:4,maximumFindings:8,
 legacyFindingCodeUnits:300,compiledTextCodeUnits:{title:80,brief:500,page:500},maximumAdoptions:4});
export const animalResidents=freeze(['mara','ruth','owen','dani'] as const);
export const animalThemes=freeze(['compare-routines','leave-space'] as const);
export const animalBehaviors=freeze(['sun-rest','sleep','shore-space'] as const);
export const animalPeriods=freeze(['morning','afternoon','evening','night'] as const);
export const animalIdSchema=text(11,49,{pattern:'^animals:[a-z][a-z0-9-]{2,40}$'});
export const animalObservationSchema=freeze<ContractSchema>({type:'object',properties:{
 animal:enumeration(acceptedAnimals.map(a=>a.id)),behavior:enumeration(animalBehaviors),period:enumeration(animalPeriods),scene:enumeration(Object.keys(rooms)),
}});
export const animalChoiceSchema=freeze<ContractSchema>({type:'object',properties:{
 schema:{type:'literal',value:1},id:animalIdSchema,revision:{type:'literal',value:1},resident:enumeration(animalResidents),theme:enumeration(animalThemes),
 observations:{type:'array',minItems:animalContractLimits.minimumObservations,maxItems:animalContractLimits.maximumObservations,items:animalObservationSchema},
}});
export const animalReviewRuleIds=freeze([
 'ANIMAL_GROUNDED_FIELDS','ANIMAL_OBSERVATION_FIELDS','ANIMAL_OBSERVATION_COUNT','ANIMAL_KNOWN_ANIMAL','ANIMAL_SCHEDULE_MISMATCH',
 'ANIMAL_DUPLICATE_REQUIREMENT','ANIMAL_UNKNOWN_RESIDENT','ANIMAL_THEME_MISMATCH','ANIMAL_COSMETIC_DUPLICATE',
] as const);
export const animalChoiceConstraints=freeze([
 {ruleId:'ANIMAL_SCHEDULE_MISMATCH',description:'Each cat sun-rest/sleep must match its own registered period, scene and activity; shore-space requires a registered gull slot. A group does not move or co-locate individuals.'},
 {ruleId:'ANIMAL_DUPLICATE_REQUIREMENT',description:'Each individual+behavior pair occurs once, even if different periods are named.'},
 {ruleId:'ANIMAL_UNKNOWN_RESIDENT',description:'The resident must be in the introduced knownResidents list.'},
 {ruleId:'ANIMAL_THEME_MISMATCH',description:'leave-space requires at least one shore-space gull observation.'},
 {ruleId:'ANIMAL_COSMETIC_DUPLICATE',description:'The id and sorted individual+behavior requirements must not duplicate an existing commission.'},
] as const);
export const animalBoundReviewFormat='harbor-animal-review-v2';
export const animalFindingSchema=freeze<ContractSchema>({type:'object',properties:{
 observationId:text(5,5,{pattern:'^obs-[1-4]$',nullable:true}),factId:text(69,69,{pattern:'^fact:[a-f0-9]{64}$',nullable:true}),ruleId:enumeration(animalReviewRuleIds),
}});
export const animalBoundReviewSchema=freeze<ContractSchema>({type:'object',properties:{
 format:{type:'literal',value:animalBoundReviewFormat},passed:{type:'boolean'},findings:{type:'array',minItems:0,maxItems:animalContractLimits.maximumFindings,items:animalFindingSchema},
}});
export type SchemaViolation={path:string;constraint:string};
export function contractViolations(value:unknown,schema:ContractSchema,path='$'):SchemaViolation[]{
 const fail=(constraint:string)=>[{path,constraint}];
 if(schema.type==='literal')return value===schema.value?[]:fail('literal');
 if(schema.type==='boolean')return typeof value==='boolean'?[]:fail('boolean');
 if(schema.type==='integer')return Number.isSafeInteger(value)&&Number(value)>=schema.minimum&&Number(value)<=schema.maximum?[]:fail('integer');
 if(schema.type==='string'){
  if(value===null&&schema.nullable)return [];
  if(typeof value!=='string')return fail('string');
  if(value.length<schema.minCodeUnits||value.length>schema.maxCodeUnits)return fail('length');
  if(schema.enum&&!schema.enum.includes(value))return fail('enum');
  if(schema.pattern&&!new RegExp(schema.pattern).test(value))return fail('pattern');
  return [];
 }
 if(schema.type==='array'){
  if(!Array.isArray(value))return fail('array');
  const violations=value.length<schema.minItems||value.length>schema.maxItems?fail('count'):[];
  return violations.concat(value.flatMap((v,i)=>contractViolations(v,schema.items,`${path}[${i}]`)));
 }
 if(!value||typeof value!=='object'||Array.isArray(value))return fail('object');
 const v=value as Record<string,unknown>,expected=Object.keys(schema.properties).sort(),actual=Object.keys(v).sort();
 const violations=actual.join(',')!==expected.join(',')?fail('exact-fields'):[];
 return violations.concat(expected.flatMap(k=>contractViolations(v[k],schema.properties[k],`${path}.${k}`)));
}
export function describeContractFields(schema:ContractSchema,path='$'):string[]{
 if(schema.type==='object')return [`${path}: exactly ${Object.keys(schema.properties).join(', ')}; all required; extra keys forbidden`,...Object.entries(schema.properties).flatMap(([k,v])=>describeContractFields(v,`${path}.${k}`))];
 if(schema.type==='array')return [`${path}: ${schema.minItems}..${schema.maxItems} elements (inclusive)`,...describeContractFields(schema.items,`${path}[]`)];
 if(schema.type==='string')return [`${path}: ${schema.minCodeUnits}..${schema.maxCodeUnits} UTF-16 code units${schema.nullable?'; or null':''}${schema.enum?'; enum='+JSON.stringify(schema.enum):''}${schema.pattern?'; pattern='+schema.pattern:''}`];
 if(schema.type==='literal')return [`${path}: exactly ${JSON.stringify(schema.value)}`];
 if(schema.type==='integer')return [`${path}: safe integer ${schema.minimum}..${schema.maximum}`];
 return [`${path}: boolean`];
}
