import {createHash} from 'node:crypto';
import {validateQuestion,type Save,type Action} from '../src/story/state';
import {rooms,type Words} from '../src/world/data';
import {assertWeatherReadable,weatherAt,weatherKinds} from '../src/weather/state';
import {mintNode,mintStatus,type PlantUsesSave} from '../src/life/plant-uses';
import type {ContentRegistry} from '../src/life/registry';
import {assertPlantUsesReadable,mintDefinitionHash} from './plant-uses-rules';
import {dialogueContext} from './dialogue-context';

// Preparation only: no public entry, API, authority mutation or model adapter.
export const afterRainRuntimeEnabled=false;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value};
const integer=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>=0;
export type AfterRainClue={kind:'revisit-known-mint';node:string;definitionHash:string;scene:string;at:{x:number;y:number}};
export type AfterRainFacts={schema:1;kind:'confirmed-after-rain';factId:string;scope:string;snapshotVersion:number;currentMinute:number;scene:string;weatherNow:'cloudy';source:{kind:'confirmed-game-weather';ruleset:'harbor-weather-ecology-v1';parametersHash:string;policyActivatedAt:number};rain:{scheduledFrom:number;confirmedFrom:number;endedAt:number};clues:AfterRainClue[]};

/** Reads one authoritative head and the existing registry. No wall-clock,
 * migration, collection credit, forecast, news attribution or history scan. */
export function afterRainFacts(s:Save,registry:ContentRegistry):AfterRainFacts|null{
 assertWeatherReadable(s);
 if(!s.weatherV1||!s.weatherEcologyV1||!rooms[s.scene]?.outdoor)return null;
 if(typeof s.id!=='string'||!s.id.length||s.id.length>160||!integer(s.version))throw Error('INVALID_AFTER_RAIN_HEAD');
 const now=s.townMinutes??540,w=s.weatherV1,e=s.weatherEcologyV1,slot=w.parameters.slotMinutes;
 if(w.kind!=='cloudy')return null;
 // Original sequence repeats every four pinned slots: clear/cloudy/rain/cloudy.
 // The latest closed rain interval is computed directly, even for huge jumps.
 const firstEnd=540+3*slot,cycle=4*slot,k=Math.floor((now-firstEnd)/cycle),end=firstEnd+k*cycle,start=end-slot;
 if(!integer(start)||!integer(end)||now<end||now-end>=slot)return null;
 if(weatherAt(start,w.parameters)!=='light-rain'||weatherAt(end,w.parameters)!=='cloudy')throw Error('AFTER_RAIN_RULESET_DRIFT');
 const from=Math.max(start,w.activatedAt,e.activatedAt);
 if(from>=end)return null; // No backfill from before policy activation.
 const parametersHash=digest([w.ruleset,w.parameters,weatherKinds,e.ruleset]);
 const scope=digest([s.id,parametersHash,e.activatedAt]);
 const factId='after-rain:'+digest([scope,start,from,end]);
 const clues:AfterRainClue[]=[],plant=s as PlantUsesSave,m=plant.plantUsesV1?.mint;
 if(m){
  assertPlantUsesReadable(plant,registry); // Reuse the original stock/source/ref validators.
  if(m.definitionHash===mintDefinitionHash&&m.observedAt!==undefined&&m.observationSource&&mintStatus(plant).stock===2){
   clues.push({kind:'revisit-known-mint',node:mintNode.id,definitionHash:m.definitionHash,scene:mintNode.scene,at:{...mintNode.at}});
  }
 }
 return freeze({schema:1,kind:'confirmed-after-rain',factId,scope,snapshotVersion:s.version,currentMinute:now,scene:s.scene,weatherNow:'cloudy',source:{kind:'confirmed-game-weather',ruleset:e.ruleset,parametersHash,policyActivatedAt:e.activatedAt},rain:{scheduledFrom:start,confirmedFrom:from,endedAt:end},clues});
}

export type AfterRainTopic='rain-ended'|'known-mint-ready';
export type AfterRainTone='practical'|'reflective';
export type AfterRainDraft={schema:1;expected_version:number;factId:string;topic:AfterRainTopic;tone:AfterRainTone;effects:[]};
export type AcceptedAfterRainDraft={kind:'deterministic-weather-topic';factId:string;snapshotVersion:number;topic:AfterRainTopic;tone:AfterRainTone;source:AfterRainFacts['source'];text:Words;effects:[]};
/** An offline structured-choice gate. It is not an AI call or a save reducer.
 * Future adapters must run existing actor/nearness/budget/CAS guards first. */
export function admitAfterRainDraft(s:Save,registry:ContentRegistry,input:unknown):AcceptedAfterRainDraft{
 const f=afterRainFacts(s,registry);if(!f)throw Error('AFTER_RAIN_UNAVAILABLE');
 const d=input as AfterRainDraft;
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).sort().join(',')!=='effects,expected_version,factId,schema,tone,topic'||d.schema!==1||!Array.isArray(d.effects)||d.effects.length||!['rain-ended','known-mint-ready'].includes(d.topic)||!['practical','reflective'].includes(d.tone))throw Error('UNSUPPORTED_AFTER_RAIN_DRAFT');
 if(d.expected_version!==s.version)throw Error('AFTER_RAIN_VERSION_CONFLICT');
 if(d.factId!==f.factId)throw Error('AFTER_RAIN_FACT_MISMATCH');
 if(d.topic==='known-mint-ready'&&!f.clues.length)throw Error('AFTER_RAIN_TOPIC_NOT_GROUNDED');
 const text:Words=d.topic==='known-mint-ready'
  ?['小雨已经结束。你观察过的原野薄荷已可再访；采叶仍按原规则。','The light rain has ended. The mint clump you observed is ready to revisit; the original collection rules still apply.']
  :d.tone==='reflective'
   ?['这一阵小雨已经过去；先记下已经发生的事，下一阵天气仍需观察。','This spell of light rain has passed. Keep a record of what happened; the next spell still needs watching.']
   :['这一阵小雨已经结束，目前是阴天。','This spell of light rain has ended. It is cloudy now.'];
 return freeze({kind:'deterministic-weather-topic',factId:f.factId,snapshotVersion:s.version,topic:d.topic,tone:d.tone,source:f.source,text,effects:[]});
}

/** Dry adapter only. The existing authority supplies its real action/spatial/
 * actor/clock admission; no alternative authentication or geometry is built.
 * Original life, relationships and dated news stay in the unchanged context. */
export function prepareAfterRainDialogue(s:Save,a:Action,registry:ContentRegistry,originalAdmission:(s:Save,a:Action)=>ReturnType<typeof validateQuestion>,options:{localFixture:boolean}={localFixture:false}){
 if(!options.localFixture)return null;
 if(a.action!=='ask')throw Error('AFTER_RAIN_ASK_REQUIRED');
 const {person,question}=originalAdmission(s,a);
 const evidence=afterRainFacts(s,registry);if(!evidence)return null;
 const context=structuredClone(dialogueContext(s,person));
 return freeze({kind:'local-weather-dialogue-preparation' as const,person,question,expectedVersion:s.version,context:{...context,afterRainEvidence:evidence},modelCallEnabled:false as const,effects:[]});
}
