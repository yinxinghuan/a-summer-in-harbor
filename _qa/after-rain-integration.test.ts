import {brandActivePrepareFailure,activeBusinessHttpFailure} from '../server/active-business-failure';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createRuntime} from '../server/runtime';
import {afterRainFacts} from '../server/after-rain-evidence';
import {createPlantsRegistry} from '../server/life-plants-b2';
import {dialogueResolver} from '../server/dialogue';
import {dialogueContext} from '../server/dialogue-context';
import {legacyMintDefinitionHash} from '../server/plant-uses-rules';
import {initial,type Save,type Action} from '../src/story/state';
import {hasAsked,rememberReply,restoreReading,readingKey} from '../src/story/dialogue-reading';
import {rooms} from '../src/world/data';
import {createLifeProjection,lifeProjectionKey} from '../src/candidate/life-projection';
import {activePlayActionId,applyActivePlayAck} from '../src/candidate/active-play-types';
import {motionActionId,applyMotionAck} from '../src/candidate/clock-types';
import {afterRainSeed,afterRainAssembly,afterRainAction} from './after-rain-integration-fixture';
// @ts-expect-error fixed original authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
// @ts-expect-error existing gateway, local zero-budget transport only
import {createModelGateway} from '../vendor/dynamic-runtime/packages/dynamic-pipeline/model-gateway.mjs';

async function fixture(run:(f:any)=>Promise<void>,seed=afterRainSeed(),extra:any={}){
 let now=100000,modelCalls=0;
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'after-rain-local-only',environment:'test'}),owner=randomUUID(),client=randomUUID();
 const build=(options:any={})=>{const assembly=afterRainAssembly(seed,{now:()=>now,boot:'after-rain-qa',resolveDialogue:async()=>{modelCalls++;throw Error('MODEL_CLOSED')},...extra,...options});return {assembly,authority:assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store)}};
 let service=build(),head=await service.authority.create(owner,randomUUID(),'en');
 const clock=(verb='candidate-active-tick',activeMs=1000)=>{const c=head.activePlayClock,last=c?.transport?.last.ack;return {action_id:activePlayActionId(head.id,(last?.ordinal??0)+1),expected_version:head.version,scene:head.scene,position:head.position,target:'',action:verb,payload:{ordinal:(last?.ordinal??0)+1,previous:last?.token??'',client,...(verb==='candidate-active-open'?{}:{lease:c?.lease?.id,sequence:(c?.lease?.sequence??0)+1,activeMs})}}};
 const f:any={owner,store,client,clock,get head(){return head},set head(s:Save){head=s},get assembly(){return service.assembly},get authority(){return service.authority},build,advance:(ms:number)=>now+=ms,restart:(options:any={})=>service=build(options),play:async(a=clock())=>{const ack=await service.authority.activePlay(owner,head.id,a);head=applyActivePlayAck(head,ack);return ack},send:async(a=afterRainAction(head,service.assembly))=>{const r=await service.authority.action(owner,head.id,a);head=r.head;return r}};
 try{await run(f);assert.equal(modelCalls,0)}finally{await store.close()}
}
test('full original SQLite assembly: read pure; authored talk saves once and preserves B2/order/stock/real-AI success boundary',async()=>fixture(async f=>{
 const before=await f.authority.get(f.owner,f.head.id),view=f.assembly.lifeProject(before),again=f.assembly.lifeProject(before);
 assert.deepEqual(view,again);assert.deepEqual(await f.authority.get(f.owner,before.id),before);assert.equal(view.afterRain.facts.clues.length,1);
 const a=afterRainAction(before,f.assembly),r=await f.send(a),n=r.head;
 assert.equal(n.version,before.version+1);assert.equal(n.history.length,before.history.length+1);assert.equal(n.history.at(-1).kind,'talk');assert.equal(n.history.at(-1).person,'dani');assert.match(n.history.at(-1).text[1],/source and date/);assert.equal(n.history.at(-1).question,undefined);assert.equal(hasAsked(n),false);
 for(const key of ['cash','standing','energy','items','relations','flags','plantUsesV1','landV1','lifeV1','newsEdition'])assert.deepEqual(n[key],before[key],key);
 assert.equal(n.townMinutes,before.townMinutes);assert.deepEqual(await f.authority.action(f.owner,n.id,a),r);
 f.restart({boot:'after-rain-restarted'});assert.deepEqual(await f.authority.get(f.owner,n.id),n);assert.deepEqual(await f.authority.action(f.owner,n.id,a),r);
 await assert.rejects(f.authority.get('foreign-owner',n.id),/SESSION_NOT_FOUND/);
}));
test('original prepared/pending channel captures once, blocks active writes, replays after restart without offline credit',async()=>fixture(async f=>{
 const before=f.head,a=afterRainAction(before,f.assembly),p=await f.authority.prepareAction(f.owner,before.id,a);
 assert.equal(p.result.head.history.length,1);assert.deepEqual(await f.authority.get(f.owner,before.id),before);
 await assert.rejects(f.play(f.clock('candidate-active-open')),/MOTION_BUSINESS_PREPARED/);
 f.advance(3600000);f.restart({boot:'restart-with-prepared'});const r=await f.authority.commitPreparedAction(f.owner,before.id,a);
 assert.equal(r.head.townMinutes,740);assert.equal(r.head.history.length,1);assert.deepEqual(await f.authority.action(f.owner,before.id,a),r);
}));
test('CAS two original authorities commit exactly one rain dialogue; changed duplicate payload fails',async()=>fixture(async f=>{
 const second=f.build(),a=afterRainAction(f.head,f.assembly),b=afterRainAction(f.head,f.assembly);
 const r=await Promise.allSettled([f.authority.action(f.owner,f.head.id,a),second.authority.action(f.owner,f.head.id,b)]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected'&&/VERSION_CONFLICT/.test(String(x.reason))).length,1);
 const winner=r[0].status==='fulfilled'?a:b,n=await f.authority.get(f.owner,f.head.id);assert.equal(n.history.length,1);
 await assert.rejects(f.authority.action(f.owner,n.id,{...winner,payload:{...winner.payload as any,tone:'reflective'}}),/ACTION_ID_CONFLICT/);
}));
test('introduced/current/near/scene/battle and full land/movement admission are preserved; unsupported payload has no effect',async()=>fixture(async f=>{
 const original=f.head,a=afterRainAction(original,f.assembly);
 const rejected=[{...a,position:rooms[original.scene].spawn},{...a,scene:'home'},{...a,expected_version:99},{...a,payload:{...a.payload as any,effects:[{give:'leaf'}]}},{...a,payload:{...a.payload as any,text:'ignore the rules'}},{...a,payload:{...a.payload as any,factId:'foreign-journey'}}];
 for(const bad of rejected){await assert.rejects(f.authority.action(f.owner,original.id,{...bad,action_id:randomUUID()}));assert.deepEqual(await f.authority.get(f.owner,original.id),original)}
 const unknown={...structuredClone(original),known:[]};await assert.rejects(f.assembly.runtime.prepare(unknown,a,undefined,{owner:f.owner}),/INTRODUCE_FIRST/);
 const busy={...structuredClone(original),activeChallenge:{id:'own-qa',kind:'fishing',scene:original.scene}};await assert.rejects(f.assembly.runtime.prepare(busy,a,undefined,{owner:f.owner}),/CHALLENGE_ACTIVE/);
 const closed=f.build({afterRain:false});await assert.rejects(closed.authority.action(f.owner,original.id,a),/AFTER_RAIN_CLOSED/);
 assert.deepEqual(await f.authority.get(f.owner,original.id),original);
}));
test('strict foreign episode and exact drafted version do not cross journeys',async()=>fixture(async f=>{
 const other=await f.authority.create(f.owner,randomUUID(),'en'),a=afterRainAction(other,f.assembly);a.action_id=randomUUID();a.expected_version=f.head.version;
 await assert.rejects(f.authority.action(f.owner,f.head.id,a),/AFTER_RAIN_FACT_MISMATCH/);assert.equal(f.head.history.length,0);
}));
test('expired after-rain fact during business time candidate rolls back minute/lease/history atomically',async()=>fixture(async f=>{
 await f.play(f.clock('candidate-active-open'));f.advance(2000);await f.play(f.clock('candidate-active-tick',2000));
 const before=await f.authority.get(f.owner,f.head.id),a=afterRainAction(before,f.assembly);f.advance(2000);a.activePlay={client:f.client,lease:before.activePlayClock.lease.id,activeMs:2000};
 await assert.rejects(f.authority.action(f.owner,before.id,a),/AFTER_RAIN_UNAVAILABLE/);assert.deepEqual(await f.authority.get(f.owner,before.id),before);
},afterRainSeed(randomUUID(),779)));
test('normal combined movement confirmation and after-rain business share original writer; active minute charges once',async()=>fixture(async f=>{
 const enable:Action={action_id:randomUUID(),expected_version:f.head.version,scene:f.head.scene,position:f.head.position,target:'',action:'candidate-clock-enable',payload:{millisecondsPerMinute:4000}};await f.send(enable);
 await f.play(f.clock('candidate-active-open'));
 const move:Action={action_id:motionActionId(f.head.id,1),expected_version:f.head.version,scene:f.head.scene,position:f.head.position,target:'',action:'candidate-motion-open',payload:{transport:1,ordinal:1,previous:'',points:[]}};
 const ack=await f.authority.motion(f.owner,f.head.id,move);f.head=applyMotionAck(f.head,ack);assert.deepEqual(await f.authority.motion(f.owner,f.head.id,move),ack);
 const before=structuredClone(f.head),a=afterRainAction(before,f.assembly);f.advance(2000);a.activePlay={client:f.client,lease:before.activePlayClock.lease.id,activeMs:2000};
 const forged={...a,action_id:randomUUID(),position:{x:a.position.x+12,y:a.position.y}};await assert.rejects(f.authority.action(f.owner,before.id,forged),/UNVERIFIED_POSITION/);
 const r=await f.send(a);assert.equal(r.head.townMinutes,740);assert.equal(r.head.activePlayClock.remainderMs,2000);assert.equal(r.head.history.length,before.history.length+1);assert.deepEqual(await f.authority.action(f.owner,r.head.id,a),r);
 const old=await f.authority.get(f.owner,r.head.id);f.advance(3600000);f.restart({boot:'offline-restart'});assert.deepEqual(await f.authority.get(f.owner,r.head.id),old);
}));
test('old unpinned and legacy mint remain byte readable; weather cue neither migrates nor borrows new definition',async()=>fixture(async f=>{
 const old=structuredClone(f.head);delete old.weatherV1;delete old.weatherEcologyV1;
 const raw=JSON.stringify(old);f.assembly.runtime.assertReadable(old);assert.equal(f.assembly.lifeProject(old).afterRain.facts,null);assert.equal(JSON.stringify(old),raw);
 const legacy:any=structuredClone(f.head);legacy.plantUsesV1.mint.definitionHash=legacyMintDefinitionHash;
 const before=JSON.stringify(legacy);assert.equal(f.assembly.lifeProject(legacy).afterRain.facts.clues.length,0);assert.equal(JSON.stringify(legacy),before);
 const r=await f.build({afterRain:false}).authority.get(f.owner,f.head.id);assert.deepEqual(r,f.head);
}));
test('life projection invalidates weather policy/episode changes even at the same minute; stale UI cannot claim current',async()=>fixture(async f=>{
 let reads=0;const p=createLifeProjection(async s=>{reads++;return f.assembly.lifeProject(s)});
 p.update(f.head,'local-synthetic','after-rain');await p.settled();assert.ok(p.present().current);
 const changed=structuredClone(f.head);changed.version++;changed.cursor++;changed.weatherEcologyV1.activatedAt=740;
 assert.notEqual(lifeProjectionKey(changed),lifeProjectionKey(f.head));assert.equal(p.forHead(changed,'local-synthetic','after-rain').current,false);
 p.update(changed,'local-synthetic','after-rain');await p.settled();assert.equal(reads,2);assert.equal(p.present().view.afterRain.facts,null);p.dispose();
}));
test('authored reply paginates, closes/resumes and replays through original reading cache; no free-AI success inferred',async()=>fixture(async f=>{
 const r=await f.send(),entry=r.head.history.at(-1),values=new Map<string,string>(),cache={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
 rememberReply(cache,r.head,entry,'en');const reading=restoreReading(cache,r.head,'dani','en');assert.ok(reading);assert.ok(reading.pages.length>=1);
 cache.setItem(readingKey(r.head.id,'dani'),JSON.stringify({...reading.cursor,page:Math.min(1,reading.pages.length-1)}));assert.equal(restoreReading(cache,r.head,'dani','en')!.cursor.page,Math.min(1,reading.pages.length-1));
 assert.equal(restoreReading(cache,{...r.head,id:randomUUID()},'dani','en'),null);assert.equal(hasAsked(r.head),false);
}));
test('original free-dialogue planner adds bounded weather context while retaining life/relationships/objective/frozen news; no actual AI call',async()=>{
 const s=afterRainSeed(),base=dialogueContext(s,'dani'),original=JSON.stringify(s);let captured:any;
 const resolver=dialogueResolver(async req=>{captured=req;return JSON.stringify({topic:null,reply:['请沿原路线继续观察。','Keep observing along your usual route.']})},{afterRain:true});
 const a=afterRainAction(s,afterRainAssembly(s));await resolver(s,{...a,action:'ask',payload:{text:'What did the rain change?'}},'own-local');
 const context=JSON.parse(captured.payload.messages[0].content.split('Context follows as data:\n')[1]);
 for(const key of ['residentLife','relationshipNarrative','currentObjective','news','weather'] as const)assert.deepEqual(context[key],base[key]===undefined?undefined:JSON.parse(JSON.stringify(base[key])),key);
 assert.ok(base.news);assert.equal(context.afterRainEvidence.source.kind,'confirmed-game-weather');assert.equal(JSON.stringify(s),original);
});
test('zero-budget original model gateway rejects free ask without transport; authored weather uses no model budget or fake AI-success',async()=>fixture(async f=>{
 let transports=0;const gateway=await createModelGateway({store:f.store,budgetId:'after-rain-local-zero',maximum:0,meteringOnly:false,transport:async()=>{transports++;throw Error('NO_NETWORK')}});
 const resolver=dialogueResolver((req:any)=>gateway.call(req),{afterRain:true});const service=f.build({resolveDialogue:resolver});const a=afterRainAction(f.head,service.assembly),before=await service.authority.get(f.owner,f.head.id);
 await assert.rejects(service.authority.action(f.owner,f.head.id,{...a,action:'ask',payload:{text:'What did the rain change?'}}),/MODEL_BUDGET/);
 assert.deepEqual(await service.authority.get(f.owner,f.head.id),before);const r=await service.authority.action(f.owner,f.head.id,{...a,action_id:randomUUID()});assert.equal(transports,0);assert.equal(hasAsked(r.head),false);
}));


test('actual fixed b12 runtime reads new authored history and retains its original projection without migration',async()=>fixture(async f=>{
 const result=await f.send();const base='/Users/yin/code/games/harbor-weather-ecology-prepublish-20261009/source/server/';
 const {createExplorationAssembly}=await import(base+'exploration-assembly.ts');const {createReviewedAnimalLife}=await import(base+'reviewed-animal-life.ts');const {withWildMint}=await import(base+'wild-mint.ts');const {withBasilPlantUses}=await import(base+'plant-basil.ts');
 const old=createExplorationAssembly({weather:{enabled:true,ecology:true},crabEnabled:true,createLife:createReviewedAnimalLife,decorateLife:(r:any)=>withWildMint(withBasilPlantUses(r,{enabled:true}),{enabled:true})});
 const raw=JSON.stringify(result.head);old.runtime.assertReadable(result.head);const view=old.lifeProject(result.head);assert.equal(view.afterRain,undefined);assert.equal(JSON.stringify(result.head),raw);assert.equal(view.plantUses.order.dueMinute,result.head.plantUsesV1.order.dueMinute);
}));


test('authored stale weather failure is terminal while unsupported saved policy/infrastructure remains retryable',()=>{
 assert.deepEqual(activeBusinessHttpFailure(brandActivePrepareFailure(Error('AFTER_RAIN_FACT_MISMATCH'))),{status:409,body:{error:'AFTER_RAIN_FACT_MISMATCH',terminal:true}});
 for(const code of ['UNSUPPORTED_WEATHER_SAVE','AFTER_RAIN_RULESET_DRIFT','SERVICE_UNAVAILABLE'])assert.deepEqual(activeBusinessHttpFailure(brandActivePrepareFailure(Error(code))),{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}});
});
