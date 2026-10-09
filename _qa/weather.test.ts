import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {initial,type Save,type Action} from '../src/story/state';import {rooms,entityAt} from '../src/world/data';
import {weatherAt,createWeatherState,validWeatherState,applyWeatherPatch,weatherPatch} from '../src/weather/state';
import {createWeatherSettlement} from '../server/weather';import {createExplorationAssembly} from '../server/exploration-assembly';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';import {pinLegacy,assertLifeReadable} from '../src/life/save';
import {validPlots,plotStatus} from '../src/story/crops';import {lifePlotStatus} from '../src/life/rules';import {landRegions} from '../src/life/land';
import {applyActivePlayAck,confirmActivePlay,activePlayActionId} from '../src/candidate/active-play-types';
import {applyMotionAck,motionActionId} from '../src/candidate/clock-types';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const registry=createPlantsRegistry(),weather=createWeatherSettlement({enabled:true});
const garden=(minute=900):Save=>({...initial('en',randomUUID()),scene:'home',position:entityAt('home','bed')!.approach,townMinutes:minute,visited:Object.keys(rooms),flags:['key','unpacked','bag-returned','crop-starter'],plots:{'crop-bed-1':{crop:'basil',grown:0,updatedAt:minute,wetUntil:minute}},weatherV1:createWeatherState(minute)});
const advance=(s:Save,to:number)=>{const next=structuredClone(s);next.townMinutes=to;weather.settle(s,next);return next};
// Compact readers intentionally omit server-only request digests. Compare the
// actual persisted business head while separately retaining server fencing.
function semanticHead(s:Save){const n=structuredClone(s);for(const c of [n.activePlayClock,n.movingClock])if(c?.transport?.last)c.transport.last.digest='';return n}
test('weather boundaries use absolute committed minutes and frozen configurable parameters',()=>{
 for(const [m,k] of [[0,'cloudy'],[539,'cloudy'],[540,'clear'],[719,'clear'],[720,'cloudy'],[899,'cloudy'],[900,'light-rain'],[1079,'light-rain'],[1080,'cloudy'],[1259,'cloudy'],[1260,'clear'],[1439,'clear'],[1440,'cloudy']] as const)assert.equal(weatherAt(m),k);
 for(const m of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>weatherAt(m),/INVALID_WEATHER_INPUT/);
 assert.throws(()=>createWeatherSettlement({parameters:{slotMinutes:0,rainMinutesPerDay:60}}),/INVALID_WEATHER_INPUT/);
});
test('new weather starts at present minute; reads and lazy activation never credit the past',()=>{
 const before=garden(1080);delete before.weatherV1;before.plots!['crop-bed-1'].updatedAt=540;before.plots!['crop-bed-1'].wetUntil=540;
 const raw=JSON.stringify(before),next=structuredClone(before);next.townMinutes=1090;weather.settle(before,next);
 assert.equal(JSON.stringify(before),raw);assert.equal(next.plots!['crop-bed-1'].grown,0);assert.equal(next.weatherV1!.activatedAt,1080);assert.ok(validWeatherState(next.weatherV1,1090));
});
test('dry outdoor crop gains at most60 rain minutes per day, with no manual water event or reward',()=>{
 const s=garden(),n=advance(s,1080);assert.equal(n.plots!['crop-bed-1'].grown,60);assert.equal(n.weatherV1!.water['garden:crop-bed-1'],60);assert.ok(validPlots(n));
 assert.deepEqual(n.flags,s.flags);assert.deepEqual(n.history,s.history);assert.deepEqual(n.items,s.items);assert.equal(n.energy,s.energy);assert.equal(n.cash,s.cash);assert.deepEqual(n.relations,s.relations);
 assert.equal(plotStatus(n,'crop-bed-1')!.needsWater,true);assert.deepEqual(advance(n,1080),n);
});
test('minute-by-minute, one sleep jump and replay yield the same rain/growth ledger',()=>{
 let s=garden();for(let m=901;m<=1080;m++)s=advance(s,m);assert.deepEqual(s,advance(gardenFromId(s.id),1080));
 function gardenFromId(id:string){return {...garden(),id}}
});
test('manual wet time and rain never double-count; only dry rain consumes allowance',()=>{
 const s=garden();s.plots!['crop-bed-1'].wetUntil=930;const n=advance(s,960);
 assert.equal(n.plots!['crop-bed-1'].grown,60);assert.equal(n.weatherV1!.water['garden:crop-bed-1'],30);
 const wet=garden();wet.plots!['crop-bed-1'].wetUntil=1620;const end=advance(wet,1080);assert.equal(end.plots!['crop-bed-1'].grown,180);assert.deepEqual(end.weatherV1!.water,{});
});
test('rain quota cannot be reset by harvesting/replanting the same bed',()=>{
 const n=advance(garden(),960);n.plots!['crop-bed-1']={crop:'radish',grown:0,updatedAt:960,wetUntil:960};const end=advance(n,1080);assert.equal(end.plots!['crop-bed-1'].grown,0);assert.equal(end.weatherV1!.water['garden:crop-bed-1'],60);
});
test('multi-day sleep settles each rain interval, resets daily cap once, not actual-world time',()=>{
 const n=advance(garden(),2340);assert.equal(n.plots!['crop-bed-1'].grown,120);assert.equal(n.weatherV1!.rainDay,1);assert.equal(n.weatherV1!.water['garden:crop-bed-1'],60);
 const end=advance(n,3780);assert.equal(end.plots!['crop-bed-1'].grown,180);assert.equal(end.weatherV1!.rainDay,2);
});
test('new bed does not receive rain from before its own creation minute',()=>{
 const before=garden();before.plots={};const next=structuredClone(before);next.townMinutes=930;next.plots!['crop-bed-1']={crop:'basil',grown:0,updatedAt:920,wetUntil:920};weather.settle(before,next);assert.equal(next.plots!['crop-bed-1'].grown,10);
});
test('bound B2 bed grows in same rain; archived unbound plot remains byte-exact',()=>{
 const s=pinLegacy(garden(),registry),region=landRegions.find(r=>r.scene==='courtyard')!;
 s.landV1={schema:1,permissions:{[region.id]:{revision:1,sourceAction:'fixture',minute:540}},plots:[{id:'land-bed-1',region:region.id,geometryRevision:1,at:{x:288,y:604},sourceAction:'fixture',minute:540}]};
 s.lifeV1!.plots={'life-bed-1':{ref:snapPeaV2Ref,grown:0,updatedAt:900,wetUntil:900},'life-bed-2':{ref:snapPeaV2Ref,grown:0,updatedAt:900,wetUntil:900}};
 const n=advance(s,1080) as typeof s;assert.equal(lifePlotStatus(n,'life-bed-1',registry)!.grown,60);assert.deepEqual(n.lifeV1!.plots['life-bed-2'],s.lifeV1!.plots['life-bed-2']);assertLifeReadable(n,registry);
 assert.equal(n.lifeV1!.events.length,0);assert.equal(n.lifeV1!.lots.length,0);
});
test('zero-rain cap and very long jumps are bounded and preserve manual growth',()=>{
 const s=garden();s.weatherV1=createWeatherState(900,{slotMinutes:180,rainMinutesPerDay:0});s.plots!['crop-bed-1'].wetUntil=950;
 const n=advance(s,Number.MAX_SAFE_INTEGER);assert.equal(n.plots!['crop-bed-1'].grown,50);assert.ok(validWeatherState(n.weatherV1,Number.MAX_SAFE_INTEGER));
});
test('existing pinned parameters survive new defaults; closed starts retain previous weather readers',()=>{
 const old=garden();old.weatherV1=createWeatherState(900,{slotMinutes:60,rainMinutesPerDay:10});const n=structuredClone(old);n.townMinutes=920;createWeatherSettlement({enabled:false,newStarts:false}).settle(old,n);assert.equal(n.weatherV1!.parameters.slotMinutes,60);assert.ok(validWeatherState(n.weatherV1,920));
 const raw=garden();delete raw.weatherV1;const end=structuredClone(raw);end.townMinutes=920;createWeatherSettlement({enabled:false}).settle(raw,end);assert.equal(end.weatherV1,undefined);assert.deepEqual(end.plots,raw.plots);
});
test('invalid weather pins, kind, checkpoint, quota and unknown fields reject without auto repair',()=>{
 const s=garden();for(const patch of [{schema:2},{ruleset:'unknown'},{kind:'clear'},{settledThrough:899},{rainDay:3},{water:{'garden:crop-bed-1':61}},{extra:true}])assert.equal(validWeatherState({...s.weatherV1,...patch},900),false);
});
test('compact rain delta cannot replace refs/crops, add a bed or rewrite quantity/inventory',()=>{
 const s=garden(),n=advance(s,920),p=weatherPatch(s,n)!;assert.deepEqual(applyWeatherPatch({...s,townMinutes:920},p,s),n);
 const attack=structuredClone(p);attack.plots!['crop-bed-1'].crop='tomato';assert.throws(()=>applyWeatherPatch({...s,townMinutes:920},attack,s),/WEATHER_REPLY_UNCONFIRMED/);
 assert.throws(()=>applyWeatherPatch({...s,townMinutes:920},{...p,cash:999} as any,s),/WEATHER_REPLY_UNCONFIRMED/);
});
async function fixture(run:(f:any)=>Promise<void>,starts=true){
 let now=100000,seed=garden(899);seed.plots!['crop-bed-1'].updatedAt=899;seed.plots!['crop-bed-1'].wetUntil=899;
 if(!starts)delete seed.weatherV1;
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'weather-local-only',environment:'test'}),owner=randomUUID(),client=randomUUID();
 const build=(boot='weather-test')=>{const assembly=createExplorationAssembly({now:()=>now,boot,weather:{enabled:starts},initial:(_l:any,id:string)=>({...seed,id})});return {assembly,authority:assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store)}};
 let {assembly,authority}=build(),head=await authority.create(owner,randomUUID(),'en');
 const action=(verb:string,payload?:any,target='bed'):Action=>({action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target,action:verb,...(payload?{payload}:{}),...(head.activePlayClock?.lease?{activePlay:{client,lease:head.activePlayClock.lease.id,activeMs:0}}:{})});
 const clock=(verb='candidate-active-tick',activeMs=1000)=>{const c=head.activePlayClock,last=c?.transport?.last.ack;return {...action(verb),action_id:activePlayActionId(head.id,(last?.ordinal??0)+1),payload:{ordinal:(last?.ordinal??0)+1,previous:last?.token??'',client,...(verb==='candidate-active-open'?{}:{lease:c?.lease?.id,sequence:(c?.lease?.sequence??0)+1,activeMs})}}};
 const f:any={owner,client,store,clock,action,advance:(n:number)=>now+=n,get head(){return head},set head(s:Save){head=s},get authority(){return authority},get assembly(){return assembly},restart:()=>{({assembly,authority}=build('new-weather-boot'))},play:async(a=clock())=>{const ack=await authority.activePlay(owner,head.id,a);confirmActivePlay(ack,head.id,a);head=applyActivePlayAck(head,ack);return ack},send:async(a:Action)=>{const r=await authority.action(owner,head.id,a);head=r.head;return r}};
 try{await run(f)}finally{store.close()}
}
test('actual SQLite compact clock commits weather and rain once; duplicate response and foreign account fenced',async()=>fixture(async f=>{
 await f.play(f.clock('candidate-active-open'));for(let i=0;i<8;i++){f.advance(1000);const a=f.clock(),ack=await f.play(a);assert.deepEqual(await f.authority.activePlay(f.owner,f.head.id,a),ack)}
 assert.equal(f.head.townMinutes,901);assert.equal(f.head.weatherV1.kind,'light-rain');assert.equal(f.head.plots['crop-bed-1'].grown,1);
 const persisted=await f.authority.get(f.owner,f.head.id);assert.match(persisted.activePlayClock.transport.last.digest,/^[a-f0-9]{64}$/);assert.deepEqual(semanticHead(persisted),semanticHead(f.head));await assert.rejects(f.authority.get('second-account',f.head.id),/SESSION_NOT_FOUND/);
}));
test('paused/reload/server restart contributes no offline rain or minute',async()=>fixture(async f=>{
 await f.play(f.clock('candidate-active-open'));f.advance(1000);await f.play(f.clock('candidate-active-pause',1000));const before=structuredClone(f.head);
 f.advance(3600000);f.restart();await f.play(f.clock('candidate-active-open'));assert.equal(f.head.townMinutes,before.townMinutes);assert.deepEqual(f.head.plots,before.plots);assert.deepEqual(f.head.weatherV1,before.weatherV1);
}));
test('original rest receipt atomically crosses rain intervals and exactly replays without manual-water facts',async()=>fixture(async f=>{
 const a=f.action('rest'),r=await f.send(a);assert.equal(r.head.townMinutes,1079);assert.equal(r.head.plots['crop-bed-1'].grown,60);assert.equal(r.head.history.length,1);assert.deepEqual(await f.authority.action(f.owner,f.head.id,a),r);assert.equal((await f.authority.get(f.owner,f.head.id)).weatherV1.water['garden:crop-bed-1'],60);
}));
test('business failure commits neither weather nor accrued natural-time candidate',async()=>fixture(async f=>{
 await f.play(f.clock('candidate-active-open'));f.advance(2000);const before=await f.authority.get(f.owner,f.head.id),a=f.action('not-a-real-action');a.activePlay!.activeMs=2000;await assert.rejects(f.send(a));assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);
}));
test('compact combined movement patch updates weather and same-crop growth without full inventory',async()=>fixture(async f=>{
 await f.send(f.action('candidate-clock-enable',{millisecondsPerMinute:4000},''));await f.play(f.clock('candidate-active-open'));
 const move=async(foreground=false)=>{const last=f.head.movingClock?.transport?.last.ack,c=f.head.movingClock,play=f.head.activePlayClock,l=play.lease,a={...f.action('candidate-motion-open',{},''),action_id:motionActionId(f.head.id,(last?.ordinal??0)+1),payload:{transport:1,ordinal:(last?.ordinal??0)+1,previous:last?.token??'',...(c?.lease?{lease:c.lease.id,sequence:c.lease.sequence+1}:{}),points:[],...(foreground?{foreground:{client:f.client,lease:l.id,sequence:l.sequence+1,activeMs:2000}}:{})}};const ack=await f.authority.motion(f.owner,f.head.id,a);assert.ok(!('items' in ack.fields));f.head=applyMotionAck(f.head,ack);return {a,ack}};
 await move();for(let i=0;i<4;i++){f.advance(2000);const {a,ack}=await move(true);assert.deepEqual(await f.authority.motion(f.owner,f.head.id,a),ack)}
 assert.equal(f.head.townMinutes,901);assert.equal(f.head.plots['crop-bed-1'].grown,1);const persisted=await f.authority.get(f.owner,f.head.id);assert.match(persisted.movingClock.transport.last.digest,/^[a-f0-9]{64}$/);assert.deepEqual(semanticHead(persisted),semanticHead(f.head));
}));
for(const starts of [false,true])test('motion finalizer cannot use weather exemption to mutate business plots; starts '+starts,async()=>fixture(async f=>{
 await f.send(f.action('candidate-clock-enable',{millisecondsPerMinute:4000},''));const before=await f.authority.get(f.owner,f.head.id);
 f.assembly.runtime.finalizeMotion=(_before:Save,next:Save)=>{next.plots!['crop-bed-1'].crop='tomato';next.plots!['crop-bed-1'].grown+=5};
 const action={...f.action('candidate-motion-open',{},''),action_id:motionActionId(f.head.id,1),payload:{transport:1,ordinal:1,previous:'',points:[]}};
 await assert.rejects(f.authority.motion(f.owner,f.head.id,action),/UNSUPPORTED_MOTION_DELTA/);assert.deepEqual(await f.authority.get(f.owner,f.head.id),before);
},starts));
test('compact delta preserves archived B2 plots and rejects extra growth fields or quota rewind',()=>{
 const s=pinLegacy(garden(),registry),region=landRegions.find(r=>r.scene==='courtyard')!;s.landV1={schema:1,permissions:{[region.id]:{revision:1,sourceAction:'fixture',minute:540}},plots:[{id:'land-bed-1',region:region.id,geometryRevision:1,at:{x:288,y:604},sourceAction:'fixture',minute:540}]};s.lifeV1!.plots={'life-bed-1':{ref:snapPeaV2Ref,grown:0,updatedAt:900,wetUntil:900},'life-bed-2':{ref:snapPeaV2Ref,grown:0,updatedAt:900,wetUntil:900}};
 const n=advance(s,920),p=weatherPatch(s,n)!;assert.deepEqual(applyWeatherPatch({...s,townMinutes:920},p,s),n);
 const extra=structuredClone(p);(extra.lifePlots!['life-bed-1'] as any).cash=99;assert.throws(()=>applyWeatherPatch({...s,townMinutes:920},extra,s),/WEATHER_REPLY_UNCONFIRMED/);
 const old=n,next=advance(old,930),rewind=weatherPatch(old,next)!;rewind.weatherV1.water={};assert.throws(()=>applyWeatherPatch({...old,townMinutes:930},rewind,old),/WEATHER_REPLY_UNCONFIRMED/);
});
