import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {animals,profiles} from '../src/animals/config';
import {createAnimalRuntime,periodAt,slotAt} from '../src/animals/behavior';
import {applyAnimalInteraction,animalSave,validAnimalSave} from '../src/animals/memory';
import {bodyAt,freePoint,overlaps,pointClear,protectionForRoom} from '../src/animals/spatial';
import {animalCollision,animalPresent,animalTargets,authoredAnimalEntities,harborContext} from '../src/animals/harbor-adapter';
import {animalPresentation,renderAnimal,type AnimalArt} from '../src/animals/render-contract';
import {findPath,type World} from '../src/engine/world';
import type {AnimalDef,AnimalState,Context,Slot} from '../src/animals/types';
const geometry=JSON.parse(readFileSync(new URL('../doc/qa/animals-integration-20261006/geometry.json',import.meta.url),'utf8'));
const metrics={scheduleCases:0,bodySafetyFrames:0,reachablePortalRoutes:0,occupiedOldSaveCases:0,clockJumpCases:0,actualGullRetreatCases:0,rendererTestedByThisSuite:false,generatedImagesUsedByThisSuite:0};
after(()=>writeFileSync(process.env.HARBOR_ANIMAL_MATRIX_OUT??new URL('../doc/qa/animals-integration-20261006/behavior-matrix.json',import.meta.url),JSON.stringify({testedAt:new Date().toISOString(),metrics,scope:'Node behavioral + captured actual map geometry, no renderer, no human comprehension, no phone device'},null,2)+'\n'));
const real=(scene:string,minutes=540,index=0):Context=>({world:geometry.worlds[index].world,scene,townMinutes:minutes,player:{...geometry.rooms[scene].spawn,...geometry.worlds[index].world.actor},people:geometry.people[minutes]??{},forbidden:geometry.forbidden,paused:false});
const slot:Slot={scene:'yard',region:{x:10,y:10,w:260,h:180},points:[{x:36,y:44},{x:230,y:44},{x:230,y:150},{x:36,y:150}],activity:'wander'};
const cat:AnimalDef={id:'cat-test',species:'cat',visualVersion:'fixture-cat',schedule:{morning:slot,afternoon:{...slot,activity:'sun-rest'},night:{...slot,activity:'sleep'}}};
const gull:AnimalDef={id:'gull-test',species:'gull',visualVersion:'fixture-gull',schedule:{morning:slot}};
const context=(patch:Partial<Context>={}):Context=>({world:{width:300,height:240,step:4,actor:{w:16,h:12},scenes:{yard:{interior:{x:0,y:0,w:300,h:220},spawn:{x:285,y:205},obstacles:[]}}},scene:'yard',townMinutes:540,player:{x:280,y:200,w:16,h:12},people:{},forbidden:{yard:[]},paused:false,...patch});
const visible=(a:AnimalState[])=>a.filter(a=>a.visible);
const sim=(runtime:ReturnType<typeof createAnimalRuntime>,ctx:Context,seconds:number,fps=60)=>{let states=runtime.snapshot();for(let i=0;i<Math.ceil(seconds*fps);i++)states=runtime.tick(1/fps,ctx);return states};

test('clock uses committed minutes, exact period boundaries, no invalid coercion',()=>{
 assert.deepEqual([0,359,360,719,720,1019,1020,1259,1260,1439,1800].map(periodAt),['night','night','morning','morning','afternoon','afternoon','evening','evening','night','night','morning']);
 for(const n of [-1,NaN,Infinity,3.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>periodAt(n),/INVALID_TOWN_TIME/);
});
test('approved roster absence audit: exactly three cats and four gulls, no dog or crab expansion',()=>{
 const expected=['harbor-cat-1','harbor-cat-2','harbor-cat-3','harbor-gull-1','harbor-gull-2','harbor-gull-3','harbor-gull-4'];
 assert.deepEqual(animals.map(a=>a.id).sort(),expected.sort());assert.equal(new Set(animals.map(a=>a.id)).size,7);
 assert.equal(animals.filter(a=>a.species==='dog').length,0);assert.equal(new Set(animals.map(a=>a.visualVersion)).size,2);
 assert.throws(()=>createAnimalRuntime([cat,cat]),/DUPLICATE/);
});
test('all actual map schedules have safe visible position in base/unlocked/dynamic geometry',()=>{
 for(let index=0;index<3;index++)for(const minutes of [540,720,1020,1260])for(const scene of ['station','market','courtyard','coast','beach','dock']){
  const ctx=real(scene,minutes,index),states=createAnimalRuntime(animals).tick(0,ctx),expected=animals.filter(a=>slotAt(a,minutes)?.scene===scene).map(a=>a.id).sort();
  assert.deepEqual(visible(states).map(s=>s.id).sort(),expected,`${index}/${minutes}/${scene}: missing or extra visible animals`);
  for(const state of visible(states))assert.ok(pointClear(state.foot,state.slot!,profiles[state.species],ctx,states.filter(a=>a.id!==state.id)),state.id);
  metrics.scheduleCases++;
 }
});
test('actual map continuous walking avoids obstacles, people, water, plots and door regions',()=>{
 for(const minutes of [540,720,1020,1260])for(const scene of ['station','market','courtyard','coast','beach','dock']){
  const ctx=real(scene,minutes,2),runtime=createAnimalRuntime(animals);for(let i=0;i<180;i++){
   const states=runtime.tick(1/30,ctx);for(const state of visible(states)){assert.ok(pointClear(state.foot,state.slot!,profiles[state.species],ctx,states.filter(a=>a.id!==state.id)),`${minutes}/${scene}/${state.id}/${i}`);metrics.bodySafetyFrames++}
  }
 }
});
test('animal ground bodies leave all previously reachable actual portal approaches reachable',()=>{
 for(const minutes of [540,720,1020,1260])for(const scene of ['station','market','courtyard','coast','beach','dock']){
  const ctx=real(scene,minutes),states=createAnimalRuntime(animals).tick(0,ctx);const original=ctx.world.scenes[scene];
  const changed={...ctx.world,scenes:{...ctx.world.scenes,[scene]:{...original,obstacles:[...original.obstacles,...animalCollision(states)]}}};
  for(const e of geometry.rooms[scene].entities.filter((e:any)=>e.kind==='portal')){
   const baseline=findPath(ctx.world,scene,original.spawn,e.approach);if(!baseline.length)continue;
   assert.ok(findPath(changed,scene,original.spawn,e.approach).length,`${scene}/${e.id}/${minutes}`);metrics.reachablePortalRoutes++;
  }
 }
 assert.ok(metrics.reachablePortalRoutes>20);
});
test('old-save overlap changes only animal, across every scheduled actual placement',()=>{
 for(const def of animals)for(const minute of [540,720,1020,1260]){
  const scheduled=slotAt(def,minute);if(!scheduled)continue;const ctx=real(scheduled.scene,minute),runtime=createAnimalRuntime([def]),a=visible(runtime.tick(0,ctx))[0];assert.ok(a);
  ctx.player={x:a.foot.x-8,y:a.foot.y-6,w:16,h:12};const before=structuredClone(ctx.player);const out=runtime.tick(0,ctx)[0];
  assert.deepEqual(ctx.player,before);assert.ok(!out.visible||!overlaps(bodyAt(out.foot,profiles[out.species]),ctx.player));metrics.occupiedOldSaveCases++;
 }
});
test('new resident overlapping animal updates one shared footpoint, not player or owner',()=>{
 const ctx=context(),r=createAnimalRuntime([cat]),a=r.tick(0,ctx)[0];ctx.people.new={scene:'yard',foot:{...a.foot},body:bodyAt(a.foot,profiles.cat)};const old=structuredClone(ctx);
 const out=r.tick(0,ctx)[0];assert.ok(out.visible);assert.ok(!overlaps(bodyAt(out.foot,profiles.cat),ctx.people.new.body));assert.deepEqual(ctx,old);
 assert.deepEqual(animalTargets([out],'yard')[0].at,out.foot);assert.deepEqual(animalCollision([out])[0],bodyAt(out.foot,profiles.cat));
});
test('blocked safety region hides animal, no player relocation; reappears when safe',()=>{
 const ctx=context({forbidden:{yard:[{...slot.region}]}}),r=createAnimalRuntime([cat]);const before=structuredClone(ctx.player),out=r.tick(0,ctx)[0];assert.equal(out.visible,false);assert.equal(out.reason,'no-safe-position');assert.deepEqual(ctx.player,before);
 ctx.forbidden={yard:[]};assert.equal(r.tick(.02,ctx)[0].visible,true);
});
test('sun rest, attention and night sleep: no nocturnal petting',()=>{
 const ctx=context({townMinutes:720}),r=createAnimalRuntime([cat]);const rest=r.tick(0,ctx)[0];assert.equal(rest.pose,'sun-rest');
 assert.ok(r.react(cat.id,'call',ctx));assert.equal(r.tick(.016,ctx)[0].pose,'stand');assert.equal(sim(r,ctx,2.1)[0].pose,'sun-rest');
 ctx.townMinutes=1260;const sleeping=r.tick(0,ctx)[0];assert.equal(sleeping.pose,'sleep');const foot=structuredClone(sleeping.foot);assert.deepEqual(sim(r,ctx,5)[0].foot,foot);assert.equal(r.react(cat.id,'pet',ctx),false);
 assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,{target:cat.id,verb:'pet',foot}),/ANIMAL_RESTING/);
});
test('cat walk cadence has both contacts, consistent travel at 30/60/120Hz',()=>{
 const outputs=[30,60,120].map(fps=>{const r=createAnimalRuntime([cat]),poses=new Set<string>();for(let i=0;i<fps;i++)poses.add(r.tick(1/fps,context())[0].pose);assert.ok(poses.has('walkA')&&poses.has('walkB')&&poses.has('stand'));return r.snapshot()[0]});
 for(const s of outputs.slice(1))assert.ok(Math.hypot(s.foot.x-outputs[0].foot.x,s.foot.y-outputs[0].foot.y)<.01);
});
test('pause and giant frame do not accumulate elapsed or game time',()=>{
 const r=createAnimalRuntime([cat]),ctx=context(),initial=r.tick(0,ctx)[0];ctx.paused=true;assert.deepEqual(r.tick(900,ctx)[0].foot,initial.foot);assert.equal(r.committedMinute(),540);
 ctx.paused=false;assert.ok(r.tick(900,ctx)[0].distance<=profiles.cat.speed*.04+.001);assert.equal(ctx.townMinutes,540);assert.throws(()=>r.tick(-1,ctx),/INVALID_FRAME_TIME/);
});
test('gull moves to safe nearby landing, wings cycle, lands and cooldown prevents immediate loop',()=>{
 const r=createAnimalRuntime([gull]),ctx=context(),start=r.tick(0,ctx)[0];ctx.player={x:start.foot.x+23,y:start.foot.y+12,w:16,h:12};
 const poses=new Set<string>();let tookOff=false,peak=0,landed=false;
 for(let i=0;i<240;i++){const a=r.tick(1/60,ctx)[0];poses.add(a.pose);peak=Math.max(peak,a.elevation);if(a.phase==='flight'){tookOff=true;assert.equal(animalCollision([a]).length,0)}if(tookOff&&a.phase!=='flight'){landed=true;assert.equal(a.elevation,0);assert.equal(a.pose,'stand');assert.ok(a.cooldown>0);assert.ok(Math.hypot(a.foot.x-(ctx.player.x+8),a.foot.y-(ctx.player.y+6))>=92-1e-4);const foot=structuredClone(a.foot);ctx.player={x:foot.x+23,y:foot.y+12,w:16,h:12};assert.notEqual(r.tick(.02,ctx)[0].phase,'flight');break}}
 assert.ok(tookOff&&landed);assert.ok(poses.has('wing-up')&&poses.has('wing-down'));assert.ok(peak>15);
});
test('every gull day schedule in real geometry supports approached takeoff and safe landing',()=>{
 for(const minutes of [540,720,1020])for(const def of animals.filter(d=>d.species==='gull')){
  const scheduled=slotAt(def,minutes)!,ctx=real(scheduled.scene,minutes,2),r=createAnimalRuntime(animals),a=r.tick(0,ctx).find(a=>a.id===def.id)!;
  ctx.player={x:a.foot.x+23,y:a.foot.y+12,w:16,h:12};let takeoff=false,landed=false;
  for(let i=0;i<300;i++){const states=r.tick(1/60,ctx),g=states.find(a=>a.id===def.id)!;if(g.phase==='flight')takeoff=true;assert.ok(!g.visible||pointClear(g.foot,g.slot!,profiles.gull,ctx,states.filter(s=>s.id!==g.id)));if(takeoff&&g.phase!=='flight'){landed=true;assert.equal(g.elevation,0);break}}
  assert.ok(takeoff&&landed,`${def.id}/${minutes} retreat impossible`);metrics.actualGullRetreatCases++;
 }
});
test('gull has no safe retreat: stands with cooldown, no warp or perpetual flight',()=>{
 const small={...slot,region:{x:10,y:10,w:58,h:50},points:[{x:34,y:34}]};const d={...gull,schedule:{morning:small}};const r=createAnimalRuntime([d]),ctx=context(),a=r.tick(0,ctx)[0];ctx.player={x:55,y:50,w:16,h:12};const out=r.tick(.02,ctx)[0];assert.equal(out.phase,'idle');assert.equal(out.reason,'no-safe-retreat');assert.equal(out.elevation,0);assert.deepEqual(out.foot,a.foot);
});
test('gull retreat cannot cross an obstacle separating landing regions',()=>{
 const ctx=context(),r=createAnimalRuntime([gull]);const s=r.tick(0,ctx)[0];ctx.world.scenes.yard.obstacles.push({x:70,y:0,w:12,h:220});ctx.player={x:45,y:50,w:16,h:12};
 const out=sim(r,ctx,3)[0];assert.ok(out.foot.x<70);assert.notEqual(out.phase,'flight');assert.equal(out.elevation,0);
});
test('follow fixture stops short of owner and freezes when owner is absent or across map',()=>{
 const dog:AnimalDef={id:'dog-algorithm-test',species:'dog',visualVersion:'none',ownerId:'owner',schedule:{morning:{...slot,points:[{x:120,y:100}],activity:'follow'}}};const ctx=context({people:{owner:{scene:'yard',foot:{x:200,y:100},body:{x:191,y:92,w:18,h:8}}}}),r=createAnimalRuntime([dog]);
 const out=sim(r,ctx,8)[0];assert.ok(Math.hypot(out.foot.x-200,out.foot.y-100)<=48);assert.ok(!overlaps(bodyAt(out.foot,profiles.dog),ctx.people.owner.body));
 ctx.people.owner.scene='other';const after=r.tick(.02,ctx)[0],foot=structuredClone(after.foot);assert.equal(after.reason,'owner-away');assert.deepEqual(sim(r,ctx,2)[0].foot,foot);delete ctx.people.owner;assert.equal(r.tick(.02,ctx)[0].reason,'owner-away');
});
test('time jump, cut-map and restore remove old snapshots and do not duplicate individuals',()=>{
 const r=createAnimalRuntime(animals);
 for(const [scene,minutes] of [['station',540],['courtyard',1260],['coast',1980],['dock',2160],['market',2460],['courtyard',2700],['station',3420]] as [string,number][]){const ctx=real(scene,minutes);const states=r.tick(0,ctx);assert.equal(new Set(visible(states).map(s=>s.id)).size,visible(states).length);assert.ok(visible(states).every(s=>slotAt(animals.find(a=>a.id===s.id)!,minutes)?.scene===scene));assert.ok(states.every(s=>s.elevation===0&&s.route.length===0&&s.attention===0));metrics.clockJumpCases++}
 r.reset();assert.equal(visible(r.snapshot()).length,0);assert.ok(visible(r.tick(0,real('station'))).length>0);
});
test('old save default is optional, no other field changed; different journeys isolated',()=>{
 const old={scene:'station',townMinutes:540,position:{x:540,y:760},news:{id:'edition-old'},turnBattle:{id:'existing'},cash:25,flags:['bridge-fixed'],known:['mara'],relations:{mara:3}},before=structuredClone(old);
 const result=animalSave(undefined,animals,540);assert.deepEqual(result,{schema:1,individuals:{}});assert.deepEqual(old,before);
 result.individuals['harbor-cat-1']={familiarity:2};assert.deepEqual(animalSave(undefined,animals,540),{schema:1,individuals:{}});
});
test('strict memory rejects invalid values and future cooldowns without rewriting old state',()=>{
 assert.ok(validAnimalSave(undefined,animals,540));
 for(const bad of [null,[],{schema:2,individuals:{}},{schema:1,individuals:{ghost:{familiarity:1}}},{schema:1,individuals:{'harbor-cat-1':{familiarity:4}}},{schema:1,individuals:{'harbor-cat-1':{familiarity:1,lastPetMinute:541}}},{schema:1,individuals:{'harbor-cat-1':{familiarity:NaN}}},{schema:1,individuals:{'harbor-cat-1':{familiarity:1,owner:'spoof'}}}])assert.equal(validAnimalSave(bad,animals,540),false);
});
test('call and pet authority: one gain per game day, capped familiarity, input state immutable',()=>{
 const r=createAnimalRuntime([cat]),ctx=context(),a=r.tick(0,ctx)[0];ctx.player={x:a.foot.x+22,y:a.foot.y+15,w:16,h:12};const request={target:cat.id,verb:'pet' as const,foot:a.foot};
 const first=applyAnimalInteraction(undefined,[cat],ctx,request);assert.equal(first.memory.individuals[cat.id].familiarity,1);const before=structuredClone(first.memory);const repeat=applyAnimalInteraction(first.memory,[cat],ctx,request);assert.equal(repeat.gained,false);assert.deepEqual(first.memory,before);
 for(const day of [1,2,3]){ctx.townMinutes=day*1440+540;const next=applyAnimalInteraction(first.memory,[cat],ctx,request);first.memory=next.memory}assert.equal(first.memory.individuals[cat.id].familiarity,3);
 assert.equal(applyAnimalInteraction(undefined,[cat],ctx,{...request,verb:'call'}).memory.individuals[cat.id].familiarity,0);
});
test('authority rejects spoofed target/scene, impossible foot, water/obstacles and distant player',()=>{
 const ctx=context(),a=createAnimalRuntime([cat]).tick(0,ctx)[0],request={target:cat.id,verb:'pet' as const,foot:a.foot};assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,request),/TOO_FAR/);
 ctx.player={x:a.foot.x+23,y:a.foot.y+12,w:16,h:12};
 assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,{...request,target:'ghost'}),/ANIMAL_AWAY/);
 assert.throws(()=>applyAnimalInteraction(undefined,[cat],{...ctx,scene:'other'},request),/ANIMAL_AWAY/);
 assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,{...request,foot:{x:NaN,y:3}}),/INVALID_ANIMAL_POSITION/);
 assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,{...request,foot:{x:0,y:0}}),/INVALID_ANIMAL_POSITION/);
 ctx.forbidden.yard.push(bodyAt(a.foot,profiles.cat));assert.throws(()=>applyAnimalInteraction(undefined,[cat],ctx,request),/INVALID_ANIMAL_POSITION/);
});
test('gulls and unseen/night entities never acquire pet actions or familiarity',()=>{
 const ctx=context(),a=createAnimalRuntime([gull]).tick(0,ctx)[0];ctx.player={x:a.foot.x+23,y:a.foot.y+12,w:16,h:12};assert.throws(()=>applyAnimalInteraction(undefined,[gull],ctx,{target:gull.id,verb:'pet',foot:a.foot}),/ANIMAL_AWAY/);
 assert.equal(animalTargets([a],'yard')[0].actions.length,0);assert.equal(animalTargets([a],'other').length,0);assert.equal(animalPresent([gull],{scene:'yard',townMinutes:1260},gull.id),false);
});
test('map protection derives actual crop bed and portal points, including empty beds',()=>{
 const zones=protectionForRoom([{id:'door',kind:'portal',at:{x:10,y:20},approach:{x:3,y:40}},{id:'crop-bed-1',kind:'object',at:{x:100,y:100},approach:{x:90,y:130}}]);assert.equal(zones.length,3);assert.ok(zones.some(r=>overlaps(r,{x:100,y:100,w:1,h:1})));
 assert.ok(geometry.forbidden.garden.length>=5);assert.ok(authoredAnimalEntities(animals).every(x=>x.entity.kind==='object'&&!('person'in x.entity)));
 const ctx=harborContext({scene:'yard'},context().world,{yard:{entities:[]}}, {x:100,y:100},{},true);assert.equal(ctx.townMinutes,540);assert.equal(ctx.paused,true);assert.equal(ctx.player.w,16);
});
test('missing or HOLD artwork never renders placeholder, source frame provenance required',()=>{
 const a=createAnimalRuntime([cat]).tick(0,context())[0];assert.equal(renderAnimal(a),null);
 const art:AnimalArt={species:'cat',visualVersion:'fixture-cat',image:'./animals/not-an-asset.png',atlas:{w:96,h:80},frames:{},review:{singleImage:'hold',family:'hold',targetScene:'hold',technical:'hold'}};assert.equal(renderAnimal(a,art),null);
 art.review={singleImage:'accepted',family:'accepted',targetScene:'accepted',technical:'accepted'};assert.throws(()=>renderAnimal(a,art),/INVALID_ANIMAL_FRAME/);
});
test('product projection without approved art emits no invisible body or clickable hotspot',()=>{
 const states=createAnimalRuntime(animals).tick(0,real('station'));
 assert.ok(visible(states).length>0);assert.deepEqual(animalPresentation(states,{},'station'),{visuals:[],collisions:[],targets:[]});
});
