import test from 'node:test';import assert from 'node:assert/strict';
import {initial,validateQuestion,type Save,type Action} from '../src/story/state';
import {rooms,entityAt,worldWithFlags} from '../src/world/data';
import {admitSpatialAction} from '../src/story/binding';
import {presentEntity} from '../src/world/residents';
import {dialogueContext} from '../server/dialogue-context';
import {createWeatherState,weatherAt} from '../src/weather/state';
import {createWeatherEcology} from '../src/weather/ecology';
import {ContentRegistry} from '../src/life/registry';
import {mintNode,type PlantUsesSave} from '../src/life/plant-uses';
import {mintDefinitionHash,legacyMintDefinitionHash} from '../server/plant-uses-rules';
import {afterRainFacts,admitAfterRainDraft,afterRainRuntimeEnabled,prepareAfterRainDialogue,type AfterRainDraft} from '../server/after-rain-evidence';

const registry=new ContentRegistry();
function head(now=1100,activation=850,slot=180,id='after-rain-local-fixture'):Save{
 const s=initial('en',id);s.townMinutes=now;s.weatherV1=createWeatherState(now,{slotMinutes:slot,rainMinutesPerDay:60});s.weatherV1.activatedAt=540;
 s.weatherEcologyV1=createWeatherEcology(now);s.weatherEcologyV1.activatedAt=activation;return s;
}
function mint(s:Save,options:Record<string,unknown>={}):PlantUsesSave{
 return {...s,plantUsesV1:{schema:1,deliveries:0,mint:{node:mintNode.id,definitionHash:mintDefinitionHash,stock:2,recoverAt:null,leaves:0,observedAt:700,observationSource:'own-local-observation-receipt',...options}}} as PlantUsesSave;
}
function draft(s:Save,options:Record<string,unknown>={}):AfterRainDraft{return {schema:1,expected_version:s.version,factId:afterRainFacts(s,registry)!.factId,topic:'rain-ended',tone:'practical',effects:[],...options} as AfterRainDraft}

test('confirmed recent closed rain produces one bounded factual interval without changing head',()=>{
 const s=head(),before=JSON.stringify(s),f=afterRainFacts(s,registry)!;assert.deepEqual(f.rain,{scheduledFrom:900,confirmedFrom:900,endedAt:1080});assert.equal(f.weatherNow,'cloudy');assert.equal(f.source.kind,'confirmed-game-weather');assert.equal(f.clues.length,0);assert.equal(JSON.stringify(s),before);assert.equal(weatherAt(f.rain.scheduledFrom,s.weatherV1!.parameters),'light-rain');assert.equal(weatherAt(f.rain.endedAt,s.weatherV1!.parameters),'cloudy');
});
test('current rain, pre-rain cloudy, clear and expired post-rain slot do not invent discovery',()=>{
 for(const now of [800,1000,1260,1350])assert.equal(afterRainFacts(head(now,600),registry),null);assert.ok(afterRainFacts(head(1259),registry));
});
test('old unpinned and first activation after rain stay pure; partial activation credits only subsequent interval',()=>{
 const s=initial('en','old-unpinned-fixture'),before=JSON.stringify(s);assert.equal(afterRainFacts(s,registry),null);assert.equal(JSON.stringify(s),before);assert.equal(afterRainFacts(head(1100,1100),registry),null);assert.equal(afterRainFacts(head(1100,1080),registry),null);assert.equal(afterRainFacts(head(1100,1050),registry)!.rain.confirmedFrom,1050);
});
test('actual existing indoor room denies the outdoor context',()=>{
 const s=head();s.scene='home';assert.equal(afterRainFacts(s,registry),null);s.scene='unknown-room';assert.equal(afterRainFacts(s,registry),null);
});
test('pinned60/120/720 slots derive original boundaries and never use default parameters',()=>{
 for(const [slot,now,from,to] of [[60,740,660,720],[120,930,780,900],[720,2750,1980,2700]]){
  const s=head(now,540,slot),f=afterRainFacts(s,registry)!;assert.equal(f.rain.scheduledFrom,from);assert.equal(f.rain.endedAt,to);
 }
});
test('very large multi-day jump returns latest one interval with constant output, no history sweep',()=>{
 const s=head(1080+720*1000000+10),f=afterRainFacts(s,registry)!;assert.equal(f.rain.endedAt,1080+720*1000000);assert.equal(f.rain.scheduledFrom,f.rain.endedAt-180);assert.equal(JSON.stringify(f).length<1400,true);assert.equal(f.clues.length,0);
});
test('stable episode ID survives repeated reads/version increment while journey and policy remain isolated',()=>{
 const s=head(),one=afterRainFacts(s,registry)!;assert.deepEqual(afterRainFacts(s,registry),one);s.version++;s.townMinutes=1101;s.weatherV1!.settledThrough=1101;s.weatherEcologyV1!.settledThrough=1101;assert.equal(afterRainFacts(s,registry)!.factId,one.factId);assert.notEqual(afterRainFacts(head(1100,850,180,'another-local-journey'),registry)!.factId,one.factId);assert.notEqual(afterRainFacts(head(1100,900),registry)!.factId,one.factId);
});
test('unknown weather fields and invalid checkpoint reject without repairing the save',()=>{
 for(const mutate of [(s:any)=>s.weatherV1.extra='future',(s:any)=>s.weatherEcologyV1.settledThrough=1099,(s:any)=>s.weatherEcologyV1.mintRainUsed=61]){
  const s=head();mutate(s);const before=JSON.stringify(s);assert.throws(()=>afterRainFacts(s,registry),/UNSUPPORTED_WEATHER/);assert.equal(JSON.stringify(s),before);
 }
});
test('only originally observed ready nativev2 mint contributes existing geometry; no items or leaves granted',()=>{
 const s=mint(head()),before=JSON.stringify(s),f=afterRainFacts(s,registry)!;assert.deepEqual(f.clues,[{kind:'revisit-known-mint',node:mintNode.id,definitionHash:mintDefinitionHash,scene:'hill',at:{x:550,y:690}}]);assert.equal(JSON.stringify(s),before);assert.equal(s.items['wild:harbor-mint-leaf']??0,0);assert.equal(s.plantUsesV1!.mint!.leaves,0);assert.equal(afterRainFacts(mint(head(),{stock:1,recoverAt:1080}),registry)!.clues.length,1);
});
test('unknown/unobserved, recovering and legacyv1 mint never becomes nativev2 discovery',()=>{
 assert.equal(afterRainFacts(mint(head(),{observedAt:undefined,observationSource:undefined}),registry)!.clues.length,0);
 assert.equal(afterRainFacts(mint(head(),{stock:1,recoverAt:1200}),registry)!.clues.length,0);
 assert.equal(afterRainFacts(mint(head(),{definitionHash:legacyMintDefinitionHash}),registry)!.clues.length,0);
});
test('future or forged plant observation/source fails original validators without modifying the source',()=>{
 for(const bad of [{observedAt:1110},{observationSource:undefined},{definitionHash:'unapproved'},{node:'fabricated-plant'}]){
  const s=mint(head(),bad),before=JSON.stringify(s);assert.throws(()=>afterRainFacts(s,registry),/UNSUPPORTED_PLANT_USES_SAVE/);assert.equal(JSON.stringify(s),before);
 }
});
test('only structured topics compile deterministic bilingual text with empty effects, no model/runtime enablement',()=>{
 assert.equal(afterRainRuntimeEnabled,false);const s=head(),before=JSON.stringify(s);for(const tone of ['practical','reflective']){const a=admitAfterRainDraft(s,registry,draft(s,{tone}));assert.equal(a.kind,'deterministic-weather-topic');assert.equal(a.text.length,2);assert.ok(a.text.every(t=>t.length>0));assert.deepEqual(a.effects,[])}assert.equal(JSON.stringify(s),before);
 const m=mint(head()),a=admitAfterRainDraft(m,registry,draft(m,{topic:'known-mint-ready'}));assert.match(a.text[1],/original collection rules/);
});
test('foreign/stale facts, stale versions and ungrounded plant topic fail closed',()=>{
 const s=head(),f=afterRainFacts(head(1100,850,180,'foreign-journey'),registry)!;
 assert.throws(()=>admitAfterRainDraft(s,registry,draft(s,{factId:f.factId})),/FACT_MISMATCH/);
 assert.throws(()=>admitAfterRainDraft(s,registry,draft(s,{expected_version:s.version+1})),/VERSION_CONFLICT/);
 assert.throws(()=>admitAfterRainDraft(s,registry,draft(s,{topic:'known-mint-ready'})),/TOPIC_NOT_GROUNDED/);
 assert.throws(()=>admitAfterRainDraft(head(1300),registry,draft(s)),/AFTER_RAIN_UNAVAILABLE/);
});
test('unknown effects/freeform/UTC/news attribution/schema/tone cannot enter the weather proposal contract',()=>{
 const s=head();for(const x of [{effects:[{give:'leaf'}]},{text:'A new hidden reward appeared.'},{sourceUrl:'https://example.com/fabricated-news'},{asOfUtc:'2030-01-01'},{schema:2},{tone:'prophetic'},{topic:'new-species'},{refs:['news:rewritten']}])assert.throws(()=>admitAfterRainDraft(s,registry,draft(s,x)),/UNSUPPORTED_AFTER_RAIN_DRAFT/);
});
test('output is deeply immutable; original fixed mint geometry and input are untouched',()=>{
 const s=mint(head()),f=afterRainFacts(s,registry)!;assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.source)&&Object.isFrozen(f.rain)&&Object.isFrozen(f.clues)&&Object.isFrozen(f.clues[0].at));assert.throws(()=>{(f.clues[0].at as any).x=999},TypeError);assert.equal(mintNode.at.x,550);assert.equal(s.plantUsesV1!.mint!.definitionHash,mintDefinitionHash);
});

function questionFixture(){
 const s=head(),e=entityAt('station','mara')!;s.scene='station';s.known=['mara'];s.position={...e.approach};
 const a:Action={action_id:'own-local-weather-question',expected_version:s.version,scene:s.scene,position:{...s.position},target:e.id,action:'ask',payload:{text:'What did the rain change this afternoon?'}};
 const originalAdmission=(current:Save,action:Action)=>{admitSpatialAction(current,action,worldWithFlags(current.flags));return validateQuestion(current,action)};
 return {s,a,originalAdmission};
}
test('dry original-admission adapter preserves resident life, relationship, current objective and original news without model calls',()=>{
 const {s,a,originalAdmission}=questionFixture(),before=JSON.stringify(s),base=dialogueContext(s,'mara'),out=prepareAfterRainDialogue(s,a,registry,originalAdmission,{localFixture:true})!;
 assert.equal(out.person,'mara');assert.equal(out.modelCallEnabled,false);assert.deepEqual(out.context.residentLife,base.residentLife);assert.deepEqual(out.context.relationshipNarrative,base.relationshipNarrative);assert.deepEqual(out.context.news,base.news);assert.deepEqual(out.context.currentObjective,base.currentObjective);assert.deepEqual(out.context.weather,base.weather);assert.equal(out.context.afterRainEvidence.factId,afterRainFacts(s,registry)!.factId);assert.equal(JSON.stringify(s),before);assert.equal(Object.isFrozen(s.items),false);assert.ok(Object.isFrozen(out.context.heldItems));
});
test('adapter default stays closed before calling admission; fixture never reopens paid routes',()=>{
 const {s,a}=questionFixture();let called=0;
 assert.equal(prepareAfterRainDialogue(s,a,registry,()=>{called++;throw Error('MUST_NOT_RUN')}),null);assert.equal(called,0);
 assert.throws(()=>prepareAfterRainDialogue(s,{...a,action:'travel'},registry,()=>{called++;throw Error('MUST_NOT_RUN')},{localFixture:true}),/ASK_REQUIRED/);assert.equal(called,0);
});
test('dry adapter reuses original introduction, version, scene and actual distance guards rather than inventing actor admission',()=>{
 const {s,a,originalAdmission}=questionFixture();
 assert.throws(()=>prepareAfterRainDialogue({...s,known:[]},a,registry,originalAdmission,{localFixture:true}),/INTRODUCE_FIRST/);
 assert.throws(()=>prepareAfterRainDialogue(s,{...a,expected_version:3},registry,originalAdmission,{localFixture:true}),/VERSION_CONFLICT/);
 assert.throws(()=>prepareAfterRainDialogue(s,{...a,position:{...rooms.station.spawn}},registry,originalAdmission,{localFixture:true}),/SPATIAL_ACTION_NOT_ADMITTED|TOO_FAR/);
 assert.throws(()=>prepareAfterRainDialogue(s,{...a,scene:'home'},registry,originalAdmission,{localFixture:true}),/INVALID_POSITION/);
});
test('Dani original dated news source remains intact alongside a separately labeled game-weather source',()=>{
 const s=head(740,540,60);s.known=['dani'];s.flags=['news:heard','news:record:academy-20261002-v1'];
 const candidates=Object.values(rooms).flatMap(room=>room.outdoor?room.entities.filter(e=>e.person==='dani').map(e=>({room,e})):[]);
 const spot=candidates.find(({room,e})=>presentEntity({...s,scene:room.id},e));assert.ok(spot,'Existing visible outdoor Dani required for local fixture');
 s.scene=spot.room.id;s.position={...spot.e.approach};const a:Action={action_id:'own-local-dani-weather-context',expected_version:s.version,scene:s.scene,position:{...s.position},target:spot.e.id,action:'ask',payload:{text:'What did the rain change?'}};
 const admission=(state:Save,action:Action)=>{admitSpatialAction(state,action,worldWithFlags(state.flags));return validateQuestion(state,action)};
 const base=dialogueContext(s,'dani'),before=JSON.stringify(s),out=prepareAfterRainDialogue(s,a,registry,admission,{localFixture:true})!;
 assert.ok(base.news);assert.deepEqual(out.context.news,base.news);assert.equal((out.context.news!.source as any).publishedAt,'2026-10-02');assert.equal((out.context.news!.source as any).fetchedAt,'2026-10-04');assert.equal(out.context.afterRainEvidence.source.kind,'confirmed-game-weather');assert.equal(JSON.stringify(s),before);
});
