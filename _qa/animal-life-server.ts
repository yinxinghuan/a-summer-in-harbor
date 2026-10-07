/** Transient loopback fixture, real Main/account/SQLite authority. Synthetic
 * journeys only; never a normal MiniApp/identity proof. No model/media clients. */
import {createServer} from 'node:http';import {createHash,randomBytes} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createTemporaryAccountTransport} from '../server/account-transport';import {json} from '../server/http';import {runtime} from '../server/runtime';import {createPlantsRegistry} from '../server/life-plants-b2';import {createHarborLife} from '../server/life-assembly';import {ContentRegistry,snapPeaDefinition} from '../src/life/registry';import {pinLegacy,addLot} from '../src/life/save';import {initial,type Save} from '../src/story/state';import {rooms,people} from '../src/world/data';import {GAME_UUID} from '../src/game-id';
import {localDynamicFixture} from './life-b2-dynamic-fixture';
import {residentRoutes,residentHere} from '../src/world/residents';import {animals} from '../src/animals/config';
import {AnimalContentRegistry} from '../server/animal-content';
// @ts-expect-error frozen authority
import {openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
let fixture='animal-cat-sun';const directory=process.env.HARBOR_ANIMAL_QA_DIRECTORY;if(!directory)throw Error('ANIMAL_QA_DIRECTORY_REQUIRED');mkdirSync(directory,{recursive:true});
const store=openAsyncSqliteAuthorityStore({path:directory+'/animals-browser.sqlite',worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'});
const registry=createPlantsRegistry(),dynamicIds=new Set<string>();
const fixtureInitial=(locale:any,id:string)=>{
 const scene=fixture.startsWith('plants-hill-')?'hill':fixture.startsWith('dynamic-')?fixture.slice(8):fixture==='garden'?'garden':fixture==='courtyard'||fixture.startsWith('plants-')?'courtyard':fixture==='night'?'courtyard':fixture==='gulls'?'coast':'hill';
 let s:any={...initial(locale,id),scene,position:rooms[scene].spawn,visited:Object.keys(rooms),known:Object.keys(people),flags:['key','unpacked','bag-returned','garden-agreed','alternative-route','route-open','market-open'],items:{key:1,'crop-basil':3,'seed-basil':2,'seed-tomato':2,'packed-snack':2},plots:{'crop-bed-2':{crop:'basil',grown:200,updatedAt:500,wetUntil:1220}}};
 if(fixture==='night'){s.townMinutes=1300;s.position={x:470,y:600}}
 if(fixture==='gulls')s.position={x:598,y:794};
 if(fixture.startsWith('roster-')){const id=fixture.slice(7),route=residentRoutes[id]?.[0],room=route?.scene??Object.keys(rooms).find(scene=>rooms[scene].entities.some(e=>e.person===id&&residentHere(s,id,scene)));if(!room)throw Error('QA_RESIDENT_ROOM_MISSING');s.scene=room;s.position=rooms[room].spawn;}
 if(fixture.startsWith('animal-harbor-')){const id=fixture.slice(7),animal=animals.find(a=>a.id===id)!;const [period,slot]=Object.entries(animal.schedule)[0];s.scene=slot.scene;s.position=rooms[slot.scene].spawn;s.townMinutes=({morning:540,afternoon:780,evening:1080,night:1300} as any)[period];}
 if(fixture==='records'||fixture==='expired'||fixture==='batches'){
  s=pinLegacy(s,registry);const ref=registry.ref('crop:snap-pea');addLot(s,registry,ref,'produce',2,'synthetic-harvest');
  s.lifeV1.collections['seed:crop:basil']={id:'seed:crop:basil',minute:540,ref:registry.ref('crop:basil'),sourceAction:'synthetic-consumed-seed'};
  // Quantity for this record is really zero. No inventory is created by the UI.
  s.items['seed-basil']=0;s.lifeV1.lots=s.lifeV1.lots.filter((l:any)=>!(l.ref.id==='crop:basil'&&l.kind==='seed'));
  s.lifeV1.firstRewards.push('theo-order-first');s.items['life-gift:theo-menu']=1;s.lifeV1.collections['gift:life-gift:theo-menu']={id:'gift:life-gift:theo-menu',sourceAction:'synthetic-old-gift',minute:540};
  s.lifeV1.order={id:'synthetic-old-order',definition:'theo-peas-v1',crop:ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};if(fixture==='expired')s.townMinutes=3900;
  if(fixture==='batches'){addLot(s,registry,registry.ref('crop:snap-pea',2),'produce',1,'synthetic-v2-old-harvest');addLot(s,registry,ref,'seed',2,'synthetic-v1-old-seed');}
 }
 if(fixture.startsWith('plants-')&&fixture!=='plants-flow'){
  const region=fixture.startsWith('plants-hill-')?'hill-edge':'courtyard-common',at=region==='hill-edge'?{x:500,y:800}:{x:288,y:604};
  s.landV1={schema:1,permissions:{[region]:{revision:1,sourceAction:'synthetic-permit',minute:540}},plots:[{id:'land-bed-1',region,geometryRevision:1,at,minute:540,sourceAction:'synthetic-bed'}]};
  s.position={x:at.x-8,y:at.y+38};s=pinLegacy(s,registry);const ref=registry.ref('crop:snap-pea',fixture==='plants-old'?1:2);
  const grown=fixture.endsWith('-growing')?360:fixture.endsWith('-ready')||fixture==='plants-old'?720:0;
  s.lifeV1.plots['life-bed-1']={ref,grown,updatedAt:540,wetUntil:fixture.endsWith('-young')?540:1260};
  addLot(s,registry,ref,'seed',1,'synthetic-seed');addLot(s,registry,ref,'produce',3,'synthetic-harvest');
 }
 if(fixture.startsWith('dynamic-')){dynamicIds.add(id);s.dynamicAssetRooms=['home','cafe','garden'];}
 if(fixture==='animal-cat-sun'){s.scene='station';s.townMinutes=540;s.position={x:750,y:680};}
 if(fixture==='animal-cat-night'){s.scene='courtyard';s.townMinutes=1300;s.position={x:570,y:530};}
 if(fixture==='animal-gull-space'){s.scene='coast';s.townMinutes=540;s.position={x:600,y:680};}
 if(fixture.startsWith('animal-commission')){s.scene='station';s.townMinutes=540;s.position=rooms.station.entities.find(e=>e.person==='mara')!.approach;}
 if(fixture==='animal-commission-ready'){
  // Explicit synthetic prior discoveries. This case proves UI settlement only;
  // normal sample/record and full travel sequences have separate evidence.
  s=pinLegacy(s,registry);const ref=new AnimalContentRegistry().ref('animals:station-cat');
  for(const behavior of ['sun-rest','sleep']){const id='observe:harbor-cat-1:'+behavior;s.lifeV1.collections[id]={id,minute:540,sourceAction:'synthetic-old-observation',source:{kind:'animal-schedule',id:'harbor-cat-1',visualVersion:animals.find(a=>a.id==='harbor-cat-1')!.visualVersion}}}
  s.animalNotebookV1={schema:1,briefs:[ref],active:{ref,minute:540,sourceAction:'synthetic-old-plan'},pages:[]};
 }
 return s;
};
const b2=createHarborLife({...runtime,initial:fixtureInitial}),usage={status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,pending:0,retryAt:null}}),reserve:async()=>{throw Error('QA_MODEL_DISABLED')},settle:async()=>{}};
const dynamicAssets=localDynamicFixture(store,b2.runtime,dynamicIds);
const api=createTemporaryAccountTransport({mode:'temporary-unverified',gameId:GAME_UUID,store,runtime:b2.runtime,usage,lifeProject:b2.lifeProject,landProject:b2.landProject,noteMedia:{},dynamicAssets});
const server=createServer(async(req,res)=>{try{
 req.url=req.url?.replace('/'+GAME_UUID,'');const url=new URL(req.url!,'http://localhost'),origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5510|5511)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
 let cap=req.headers.cookie?.match(/(?:^|;\s*)harbor_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(url.pathname==='/qa/prepare'&&req.method==='POST'){
  const next=url.searchParams.get('case')??'hill';if(!['animal-cat-sun','animal-cat-night','animal-gull-space','animal-commission','animal-commission-ready','plants-hill-young','plants-hill-growing','plants-hill-ready','plants-flow','plants-young','plants-growing','plants-ready','plants-old','hill','courtyard','records','expired','batches','night','gulls','garden','dynamic-home','dynamic-cafe','dynamic-garden',...Object.keys(people).map(p=>'roster-'+p),...animals.map(a=>'animal-'+a.id)].includes(next))return json(res,400,{error:'CASE_UNKNOWN'});if(next.startsWith('dynamic-')&&!dynamicAssets)return json(res,409,{error:'QA_LOCAL_EXPORT_REQUIRED'});fixture=next;cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_demo=${cap}; HttpOnly; SameSite=Strict; Path=/`);return json(res,200,{fixture,syntheticOnly:true});
 }
 if(req.url==='/api/bootstrap'&&req.method==='POST'&&!cap){cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_demo=${cap}; HttpOnly; SameSite=Strict; Path=/`)}
 if(!cap)return json(res,401,{error:'BROWSER_POSSESSION_REQUIRED'});req.headers['x-harbor-game']??=GAME_UUID;return await api(req,res,createHash('sha256').update(cap).digest('hex'));
 }catch(e:any){if(!res.headersSent)json(res,e.status??400,{error:e.code??e.message,terminal:true})}});
server.listen(5511,'127.0.0.1',()=>console.log('Animal transient SQLite QA 127.0.0.1:5511; model/media disabled'));
const close=()=>server.close(async()=>{await store.close();process.exit(0)});process.on('SIGINT',close);process.on('SIGTERM',close);
