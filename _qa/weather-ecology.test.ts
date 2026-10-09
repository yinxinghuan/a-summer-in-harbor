import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {initial,type Save,type Action} from '../src/story/state';
import {rooms,people,entityAt} from '../src/world/data';
import {createWeatherState,weatherPatch,applyWeatherPatch,assertWeatherReadable} from '../src/weather/state';
import {createWeatherEcology,validWeatherEcology} from '../src/weather/ecology';
import {createWeatherSettlement} from '../server/weather';
import {mintDefinitionHash,legacyMintDefinitionHash} from '../server/plant-uses-rules';
import {mintStatus,type PlantUsesSave} from '../src/life/plant-uses';
import {createAnimalRuntime} from '../src/animals/behavior';import {acceptedAnimals} from '../src/animals/art';import {profiles} from '../src/animals/config';
import {gameAnimalContext} from '../src/animals/game';import {pointClear,bodyAt} from '../src/animals/spatial';
import {catRainCovers,weatherAnimalSlot} from '../src/weather/animal-shelter';import {applyAnimalInteraction} from '../src/animals/memory';
import {residentWeatherReaction,residentRainPause} from '../src/weather/resident-reactions';import {description} from '../src/story/descriptions';
import {createExplorationAssembly} from '../server/exploration-assembly';import {createReviewedAnimalLife} from '../server/reviewed-animal-life';
import {withWildMint} from '../server/wild-mint';import {withBasilPlantUses} from '../server/plant-basil';
import {activePlayActionId,applyActivePlayAck} from '../src/candidate/active-play-types';import {applyMotionAck,motionActionId} from '../src/candidate/clock-types';
import {sampleAnimal} from '../server/animal-life';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const weather=createWeatherSettlement({enabled:true,ecology:true});
function seed(minute=900,due=1620):PlantUsesSave{return {...initial('en',randomUUID()),townMinutes:minute,scene:'home',position:entityAt('home','bed')!.approach,flags:['key','unpacked','bag-returned'],known:Object.keys(people),visited:Object.keys(rooms),weatherV1:createWeatherState(minute),weatherEcologyV1:createWeatherEcology(minute),plantUsesV1:{schema:1,deliveries:0,mint:{node:'harbor-mint-hill-1',definitionHash:mintDefinitionHash,stock:1,recoverAt:due,leaves:0}}}}
function advance(s:PlantUsesSave,to:number){const next=structuredClone(s);next.townMinutes=to;weather.settle(s,next);return next}
test('native mint rain assistance is bounded, optional, never extra leaves or business rewards',()=>{
 const s=seed(),n=advance(s,1080);assert.equal(n.plantUsesV1!.mint!.recoverAt,1560);assert.equal(n.weatherEcologyV1!.mintRainUsed,60);
 for(const k of ['items','flags','history','relations','cash','energy'] as const)assert.deepEqual(n[k],s[k]);assert.deepEqual({...n.plantUsesV1!.mint,recoverAt:0},{...s.plantUsesV1!.mint,recoverAt:0});assertWeatherReadable(n);
 assert.deepEqual(advance(n,1080),n);const closed=createWeatherSettlement({enabled:false,newStarts:false,ecology:false}),end=structuredClone(n);end.townMinutes=1100;closed.settle(n,end);assert.ok(end.weatherEcologyV1);assert.equal(end.plantUsesV1!.mint!.recoverAt,1560);
 const old=seed();delete old.weatherEcologyV1;const untouched=structuredClone(old);untouched.townMinutes=1080;closed.settle(old,untouched);assert.equal(untouched.weatherEcologyV1,undefined);assert.deepEqual(untouched.plantUsesV1,old.plantUsesV1);
 const legacy=seed();legacy.plantUsesV1!.mint!.definitionHash=legacyMintDefinitionHash;assert.deepEqual(advance(legacy,1080).plantUsesV1,legacy.plantUsesV1);
});
test('minute, fragmented and sleep jumps are equivalent even when rain completes recovery mid-slot',()=>{
 for(const start of [899,900,950,1019,1435,1619,1620])for(const gap of [1,2,3,9,59,119,720]){
  const s=seed(start,start+gap);let one=structuredClone(s);for(let m=start+1;m<=start+180;m++)one=advance(one,m);
  const bulk=advance(s,start+180);assert.deepEqual(one,bulk,`${start}/${gap}`);if(gap<=180)assert.equal(mintStatus(one).stock,2);
  let fragment=advance(s,start+3);fragment=advance(fragment,start+61);fragment=advance(fragment,start+180);assert.deepEqual(fragment,bulk);
 }
});
test('current-minute activation does not retroactively help an old recovering plant',()=>{
 const s=seed(1080,1500);delete s.weatherEcologyV1;const n=advance(s,1100);assert.equal(n.weatherEcologyV1!.activatedAt,1080);assert.equal(n.plantUsesV1!.mint!.recoverAt,1500);
 const recovered=seed(960,950);assert.deepEqual(advance(recovered,1000).plantUsesV1,recovered.plantUsesV1);
 const before=seed(),collected=structuredClone(before);collected.townMinutes=910;collected.plantUsesV1!.mint!.recoverAt=1630;weather.settle(before,collected);assert.equal(collected.plantUsesV1!.mint!.recoverAt,1630);assert.equal(collected.weatherEcologyV1!.mintRainUsed,0);
});
test('daily rain budget survives re-collection, cannot reset on reload, and resets only at midnight',()=>{
 const s=advance(seed(),960);s.plantUsesV1!.mint!.recoverAt=1680;assert.equal(advance(s,1080).plantUsesV1!.mint!.recoverAt,1680);
 const next=advance(s,1740);assert.equal(next.weatherEcologyV1!.rainDay,1);assert.equal(next.weatherEcologyV1!.mintRainUsed,30);assert.equal(next.plantUsesV1!.mint!.recoverAt,1650);
 const huge=advance(seed(),Number.MAX_SAFE_INTEGER);assert.ok(validWeatherEcology(huge.weatherEcologyV1,huge.townMinutes!,huge.weatherV1));
});
test('unknown ecology policy/quota/checkpoint rejects; compact delta cannot rewrite mint identity/stock/leaf sources',()=>{
 const s=seed(),n=advance(s,920),patch=weatherPatch(s,n)!;assert.deepEqual(applyWeatherPatch({...s,townMinutes:920},patch,s),n);
 for(const change of [{ruleset:'new'},{mintRainUsed:61},{settledThrough:899},{extra:true},{rainDay:2}])assert.equal(validWeatherEcology({...s.weatherEcologyV1,...change},900,s.weatherV1),false);
 for(const bad of [{...patch,mintRecovery:{recoverAt:700}},{...patch,mintRecovery:{recoverAt:1000,stock:2}},{...patch,weatherEcologyV1:undefined}])assert.throws(()=>applyWeatherPatch({...s,townMinutes:920},bad as any,s),/WEATHER_REPLY_UNCONFIRMED/);
 const changed=structuredClone(s);changed.plantUsesV1!.mint!.leaves=1;assert.throws(()=>applyWeatherPatch({...changed,townMinutes:920},patch,s),/WEATHER_REPLY_UNCONFIRMED/);
});
test('three cats reach distinct actual safe cover feet along swept legal routes, pause and return without teleport',()=>{
 for(const [scene,id] of [['station','harbor-cat-1'],['market','harbor-cat-2'],['courtyard','harbor-cat-3']] as const){
  const s={...seed(899),scene,position:rooms[scene].spawn},r=createAnimalRuntime(acceptedAnimals),ctx=()=>gameAnimalContext(s,s.position);
  const initial=r.tick(0,ctx()).find(a=>a.id===id)!;assert.ok(initial.visible);
  s.townMinutes=900;s.weatherV1=createWeatherState(900,{slotMinutes:60,rainMinutesPerDay:60});s.weatherEcologyV1=createWeatherEcology(900);
  let a=r.tick(0,ctx()).find(a=>a.id===id)!;assert.deepEqual(a.foot,initial.foot,'rain entry foot preserved');const target=weatherAnimalSlot(acceptedAnimals.find(a=>a.id===id)!,s)!.shelter!.point;
  const poses=new Set<string>();for(let i=0;i<1000;i++){const last=a;a=r.tick(.04,ctx()).find(a=>a.id===id)!;assert.ok(a.visible);assert.ok(pointClear(a.foot,a.slot!,profiles.cat,ctx(),r.snapshot().filter(b=>b.id!==id)));assert.ok(Math.hypot(a.foot.x-last.foot.x,a.foot.y-last.foot.y)<=1.121,'no teleport');poses.add(a.pose);if(a.reason==='rain-shelter')break}
  assert.deepEqual(a.foot,target,scene+' shelter');assert.ok(poses.has('walkA')&&poses.has('walkB'));const sheltered={...a.foot};a=r.tick(100,{...ctx(),paused:true}).find(a=>a.id===id)!;assert.deepEqual(a.foot,sheltered);
  // Same period, new confirmed minute preserves the visible foot.
  s.townMinutes=901;s.weatherV1=createWeatherState(901,{slotMinutes:60,rainMinutesPerDay:60});s.weatherEcologyV1=createWeatherEcology(901);assert.deepEqual(r.tick(0,ctx()).find(a=>a.id===id)!.foot,sheltered);
  s.townMinutes=960;s.weatherV1=createWeatherState(960,{slotMinutes:60,rainMinutesPerDay:60});s.weatherEcologyV1=createWeatherEcology(960);a=r.tick(0,ctx()).find(a=>a.id===id)!;assert.deepEqual(a.foot,sheltered,'rain exit foot preserved');
  for(let i=0;i<1000;i++){const last=a;a=r.tick(.04,ctx()).find(a=>a.id===id)!;assert.ok(Math.hypot(a.foot.x-last.foot.x,a.foot.y-last.foot.y)<=1.121);if(!a.reason&&a.slot!.activity==='sun-rest'&&a.phase==='sun-rest'||!a.reason&&Math.hypot(a.foot.x-a.slot!.shelter!.homePoint.x,a.foot.y-a.slot!.shelter!.homePoint.y)<.1)break}
  const b=bodyAt(a.foot,profiles.cat),home=a.slot!.shelter!.homeRegion;assert.ok(b.x>=home.x&&b.x+b.w<=home.x+home.w&&b.y>=home.y&&b.y+b.h<=home.y+home.h,scene+' return');
 }
});
test('blocked canopy never grants shelter or bypasses obstacles/player, and rain pet uses same legal slot',()=>{
 const s={...seed(),scene:'market',position:rooms.market.spawn},ctx=gameAnimalContext(s,s.position),def=acceptedAnimals.find(a=>a.id==='harbor-cat-2')!,goal=weatherAnimalSlot(def,s)!.shelter!.point;
 const blocked={...ctx,forbidden:{...ctx.forbidden,market:[...ctx.forbidden.market,{x:goal.x-20,y:goal.y-20,w:40,h:30}]}};const r=createAnimalRuntime([def]);for(let i=0;i<40;i++)r.tick(.04,blocked);assert.notEqual(r.snapshot()[0].reason,'rain-shelter');assert.ok(pointClear(r.snapshot()[0].foot,r.snapshot()[0].slot!,profiles.cat,blocked,[]));
 const near={...ctx,player:{x:goal.x-8,y:goal.y+24,w:16,h:12}};const result=applyAnimalInteraction(undefined,acceptedAnimals,near,{target:def.id,verb:'pet',foot:goal});assert.equal(result.memory.individuals[def.id].familiarity,1);assert.equal(applyAnimalInteraction(result.memory,acceptedAnimals,near,{target:def.id,verb:'pet',foot:goal}).gained,false);
 assert.throws(()=>applyAnimalInteraction(undefined,acceptedAnimals,blocked,{target:def.id,verb:'pet',foot:goal}),/INVALID_ANIMAL_POSITION/);
 for(const gull of acceptedAnimals.filter(a=>a.species==='gull'))assert.deepEqual(weatherAnimalSlot(gull,s),gull.schedule.afternoon??null);
  const night={...s,townMinutes:1620,weatherV1:createWeatherState(1620),weatherEcologyV1:createWeatherEcology(1620)};for(const cat of acceptedAnimals.filter(a=>a.species==='cat'))assert.deepEqual(weatherAnimalSlot(cat,night),cat.schedule.night,'night sleep/pet/observation unchanged');
});
test('six resident reactions preserve known boundary, schedules/indoors and old animal sample contract',()=>{
 const s=seed();for(const p of ['mara','elena','arthur','dani','owen','avery']){assert.ok(residentWeatherReaction(s,p,true));assert.equal(residentWeatherReaction({...s,known:[]},p,true),undefined);assert.equal(residentWeatherReaction(s,p,false),undefined);assert.equal(residentRainPause({...s,weatherEcologyV1:undefined},p,true),false)}
 const place={...s,scene:'market'};assert.match(description(place,entityAt('market','dani')!)[1],/page dry/);assert.ok(!description({...place,known:[]},entityAt('market','dani')!)[1].includes('page dry'));
 const catSave={...seed(540),scene:'station',position:{x:780,y:671}};const base=sampleAnimal({...catSave,weatherEcologyV1:undefined},'harbor-cat-1',catSave.position),pinned=sampleAnimal(catSave,'harbor-cat-1',catSave.position);assert.deepEqual(base,pinned);
});
async function authorityFixture(run:(f:any)=>Promise<void>){
 let now=100000;const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'weather-ecology-local',environment:'test'}),owner=randomUUID(),client=randomUUID();
 const build=(boot='ecology-test')=>{const assembly=createExplorationAssembly({now:()=>now,boot,weather:{enabled:true,ecology:true},createLife:createReviewedAnimalLife,decorateLife:(r:any)=>withWildMint(withBasilPlantUses(r,{enabled:true}),{enabled:true}),initial:(_l:any,id:string)=>({...seed(),id})});return {assembly,authority:assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store)}};
 let {assembly,authority}=build(),head=await authority.create(owner,randomUUID(),'en');
 const action=(verb:string,payload?:any):Action=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target:'bed',action:verb,...(payload?{payload}:{}),...(head.activePlayClock?.lease?{activePlay:{client,lease:head.activePlayClock.lease.id,activeMs:0}}:{})});
 const clock=(verb='candidate-active-tick',activeMs=1000)=>{const c=head.activePlayClock,last=c?.transport?.last.ack;return {...action(verb),action_id:activePlayActionId(head.id,(last?.ordinal??0)+1),payload:{ordinal:(last?.ordinal??0)+1,previous:last?.token??'',client,...(verb==='candidate-active-open'?{}:{lease:c?.lease?.id,sequence:(c?.lease?.sequence??0)+1,activeMs})}}};
 const f:any={owner,client,store,clock,action,get head(){return head},set head(s:Save){head=s},get authority(){return authority},get assembly(){return assembly},advance:(ms:number)=>now+=ms,restart:()=>{({assembly,authority}=build('ecology-restart'))},play:async(a=clock())=>{const ack=await authority.activePlay(owner,head.id,a);head=applyActivePlayAck(head,ack);return ack},send:async(a:Action)=>{const r=await authority.action(owner,head.id,a);head=r.head;return r}};
 try{await run(f)}finally{store.close()}
}
test('SQLite original CAS compact idle commits bounded mint due once; replay/foreign owner/pause/restart safe',async()=>authorityFixture(async f=>{
 await f.play(f.clock('candidate-active-open'));for(let i=0;i<8;i++){f.advance(1000);const a=f.clock(),ack=await f.play(a);assert.deepEqual(await f.authority.activePlay(f.owner,f.head.id,a),ack)}
 assert.equal(f.head.townMinutes,902);assert.equal(f.head.plantUsesV1.mint.recoverAt,1618);const persisted=await f.authority.get(f.owner,f.head.id);assert.equal(persisted.plantUsesV1.mint.recoverAt,1618);assert.deepEqual(persisted.weatherEcologyV1,f.head.weatherEcologyV1);await assert.rejects(f.authority.get('foreign',f.head.id),/SESSION_NOT_FOUND/);
 await f.play(f.clock('candidate-active-pause',0));const before=structuredClone(f.head);f.advance(3600000);f.restart();await f.play(f.clock('candidate-active-open'));assert.deepEqual(f.head.weatherEcologyV1,before.weatherEcologyV1);assert.deepEqual(f.head.plantUsesV1,before.plantUsesV1);
 const bad=f.action('invalid-action');await assert.rejects(f.send(bad));assert.deepEqual((await f.authority.get(f.owner,f.head.id)).plantUsesV1,f.head.plantUsesV1);
}));
test('SQLite original rest receipt preserves existing mint identity and exact repeated result',async()=>authorityFixture(async f=>{
 const a=f.action('rest'),r=await f.send(a);assert.equal(r.head.plantUsesV1.mint.recoverAt,1560);assert.equal(r.head.weatherEcologyV1.mintRainUsed,60);assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),r);assert.equal(r.head.items['wild:harbor-mint-leaf'],undefined);
}));
test('SQLite combined movement confirmation carries only bounded mint recovery; finalizer business attacks fail atomically',async()=>authorityFixture(async f=>{
 await f.send({...f.action('candidate-clock-enable',{millisecondsPerMinute:4000}),target:''});await f.play(f.clock('candidate-active-open'));
 const move=async(foreground=false)=>{const last=f.head.movingClock?.transport?.last.ack,c=f.head.movingClock,l=f.head.activePlayClock.lease,a={...f.action('candidate-motion-open',{}),target:'',action_id:motionActionId(f.head.id,(last?.ordinal??0)+1),payload:{transport:1,ordinal:(last?.ordinal??0)+1,previous:last?.token??'',...(c?.lease?{lease:c.lease.id,sequence:c.lease.sequence+1}:{}),points:[],...(foreground?{foreground:{client:f.client,lease:l.id,sequence:l.sequence+1,activeMs:2000}}:{})}};const ack=await f.authority.motion(f.owner,f.head.id,a);assert.ok(!('items' in ack.fields));f.head=applyMotionAck(f.head,ack);return {a,ack}};
 await move();for(let i=0;i<4;i++){f.advance(2000);const {a,ack}=await move(true);assert.deepEqual(await f.authority.motion(f.owner,f.head.id,a),ack)}
 assert.equal(f.head.townMinutes,902);assert.equal(f.head.plantUsesV1.mint.recoverAt,1618);assert.deepEqual((await f.authority.get(f.owner,f.head.id)).plantUsesV1,f.head.plantUsesV1);
 const before=await f.authority.get(f.owner,f.head.id),finalize=f.assembly.runtime.finalizeMotion;f.assembly.runtime.finalizeMotion=(old:Save,next:PlantUsesSave)=>{finalize(old,next);next.plantUsesV1!.mint!.leaves=9};await assert.rejects(move(),/WEATHER_REPLY_UNCONFIRMED|UNSUPPORTED_MOTION_DELTA|UNSUPPORTED_PLANT_USES_SAVE/);assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);
}));
