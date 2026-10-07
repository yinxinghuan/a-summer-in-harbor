import {createHash} from 'node:crypto';
import {crops} from '../story/crops';
import type {ContentRef,CropDefinition} from './types';

const KEYS=['id','revision','capability','name','condition','actions','wetMinutes','growMinutes','seedCost','yield','salePrice','output','uses','saleSink','assets'].sort();
const integer=(n:unknown,min:number,max:number)=>Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
const canonical=(value:unknown):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}':JSON.stringify(value);
export const definitionHash=(def:CropDefinition)=>createHash('sha256').update(canonical(def)).digest('hex');
const mechanicalSignature=({id:_id,revision:_revision,name:_name,assets:_assets,...rules}:CropDefinition)=>canonical(rules);
export function validateCropDefinition(value:unknown):asserts value is CropDefinition{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('CONTENT_SHAPE');
 const d=value as CropDefinition;
 if(JSON.stringify(Object.keys(d).sort())!==JSON.stringify(KEYS))throw Error('CONTENT_FIELDS');
 if(!/^crop:[a-z][a-z0-9-]{1,39}$/.test(d.id)||!integer(d.revision,1,100))throw Error('CONTENT_ID');
 if(d.capability!=='watered-crop-v1'||d.condition!=='cultivated-bed-v1'||JSON.stringify(d.actions)!=='["plant","water","harvest"]'||d.output!=='produce'||JSON.stringify(d.uses)!=='["sell","save-seed","resident-order"]'||d.saleSink!=='crop-counter')throw Error('CAPABILITY_UNAVAILABLE');
 if(!Array.isArray(d.name)||d.name.length!==2||d.name.some(n=>typeof n!=='string'||!n.trim()||n.length>64))throw Error('CONTENT_NAME');
 if(!integer(d.wetMinutes,720,720)||!integer(d.growMinutes,60,4320)||!integer(d.seedCost,1,25)||!integer(d.yield,1,6)||!integer(d.salePrice,1,10)||d.yield*d.salePrice-d.seedCost>12)throw Error('ECONOMY_BOUND');
 // B1 recognizes fixed refs but cannot approve assets, geometry, rights or new media.
 if(!Array.isArray(d.assets)||d.assets.length>8||d.assets.some(a=>typeof a!=='string'||!/^asset:[a-zA-Z0-9_.:@-]{1,120}$/.test(a)))throw Error('ASSET_REF');
}
// Frozen 10c0983/f6e6be8 economics, not a live projection of a future crops table.
export const legacyDefinitions:readonly CropDefinition[]=[
 {id:'crop:radish',name:['萝卜','Radish'],growMinutes:360,seedCost:3,yield:2,salePrice:3},
 {id:'crop:basil',name:['罗勒','Basil'],growMinutes:720,seedCost:5,yield:3,salePrice:3},
 {id:'crop:tomato',name:['番茄','Tomato'],growMinutes:1440,seedCost:8,yield:4,salePrice:4},
].map(d=>({...d,name:d.name as [string,string],revision:1,capability:'watered-crop-v1',condition:'cultivated-bed-v1',actions:['plant','water','harvest'],wetMinutes:720,output:'produce',uses:['sell','save-seed','resident-order'],saleSink:'crop-counter',assets:[]}));
export const snapPeaDefinition:CropDefinition={id:'crop:snap-pea',revision:1,capability:'watered-crop-v1',name:['脆荚','Snap peas'],condition:'cultivated-bed-v1',actions:['plant','water','harvest'],wetMinutes:720,growMinutes:720,seedCost:6,yield:3,salePrice:4,output:'produce',uses:['sell','save-seed','resident-order'],saleSink:'crop-counter',assets:[]};
export class ContentRegistry{
 private readonly entries=new Map<string,{ref:ContentRef;def:CropDefinition}>();
 constructor(defs:readonly CropDefinition[]=[],private readonly logicFixtureEnabled:ReadonlySet<string>=new Set()){
  // Enablement is deliberately a local fixture option; no production adoption API.
  this.logicFixtureEnabled=new Set(logicFixtureEnabled);
  for(const d of legacyDefinitions){const c=crops[d.id.slice(5) as keyof typeof crops];if(!c||c.minutes!==d.growMinutes||c.cost!==d.seedCost||c.yield!==d.yield||c.price!==d.salePrice)throw Error('LEGACY_ENGINE_DRIFT')}
  for(const d of [...legacyDefinitions,...defs])this.add(d);
 }
 private add(value:CropDefinition){
  validateCropDefinition(value);const d=structuredClone(value),legacy=legacyDefinitions.find(l=>l.id===d.id);
  if(legacy&&definitionHash(d)!==definitionHash(legacy))throw Error('LEGACY_ID_LOCKED');
  const key=d.id+'@'+d.revision,hash=definitionHash(d),old=this.entries.get(key);
  if(old&&old.ref.hash!==hash)throw Error('CONTENT_REVISION_CONFLICT');
  if([...this.entries.values()].some(e=>e.def.id!==d.id&&mechanicalSignature(e.def)===mechanicalSignature(d)))throw Error('COSMETIC_SPECIES_DUPLICATE');
  const freeze=(v:any):any=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
  this.entries.set(key,freeze({ref:{id:d.id,revision:d.revision,hash,capability:d.capability},def:d}));
 }
 ref(id:string,revision=1):ContentRef{const e=this.entries.get(id+'@'+revision);if(!e)throw Error('UNKNOWN_CONTENT');return {...e.ref}}
 get(ref:ContentRef):CropDefinition{const e=ref&&this.entries.get(ref.id+'@'+ref.revision);if(!e||e.ref.hash!==ref.hash||e.ref.capability!==ref.capability)throw Error('CONTENT_REF_MISMATCH');return e.def}
 canStart(ref:ContentRef):boolean{this.get(ref);return legacyDefinitions.some(d=>d.id===ref.id)||this.logicFixtureEnabled.has(ref.id+'@'+ref.revision)}
 isLegacy(ref:ContentRef):boolean{return legacyDefinitions.some(d=>d.id===ref.id)}
 item(ref:ContentRef,kind:'seed'|'produce'):string{this.get(ref);const id=ref.id.slice(5);return this.isLegacy(ref)?(kind==='seed'?'seed-':'crop-')+id:'life-'+kind+':'+id}
}
