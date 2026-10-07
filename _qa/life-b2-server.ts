/** Transient loopback fixture, real Main/account/SQLite authority. Synthetic
 * journeys only; never a normal MiniApp/identity proof. No model/media clients. */
import {createServer} from 'node:http';import {createHash,randomBytes} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createTemporaryAccountTransport} from '../server/account-transport';import {json} from '../server/http';import {runtime} from '../server/runtime';import {createLifeB2} from '../server/life-b2';import {ContentRegistry,snapPeaDefinition} from '../src/life/registry';import {pinLegacy,addLot} from '../src/life/save';import {initial,type Save} from '../src/story/state';import {rooms,people} from '../src/world/data';import {GAME_UUID} from '../src/game-id';
import {localDynamicFixture} from './life-b2-dynamic-fixture';
import {residentRoutes,residentHere} from '../src/world/residents';import {animals} from '../src/animals/config';
// @ts-expect-error frozen authority
import {openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
let fixture='hill';const directory=process.env.HARBOR_B2_QA_DIRECTORY;if(!directory)throw Error('B2_QA_DIRECTORY_REQUIRED');mkdirSync(directory,{recursive:true});
const store=openAsyncSqliteAuthorityStore({path:directory+'/browser.sqlite',worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'});
const qaRevision={...snapPeaDefinition,revision:2,name:['仅用于长标签验收的旧批次脆荚，不能在世界中购买或种植','Archived snap pea batch with deliberately long name for QA only'] as [string,string],growMinutes:1080,seedCost:7};
const registry=new ContentRegistry([snapPeaDefinition,qaRevision]),dynamicIds=new Set<string>();
const fixtureInitial=(locale:any,id:string)=>{
 const scene=fixture.startsWith('dynamic-')?fixture.slice(8):fixture==='garden'?'garden':fixture==='courtyard'?'courtyard':fixture==='night'?'courtyard':fixture==='gulls'?'coast':'hill';
 let s:any={...initial(locale,id),scene,position:rooms[scene].spawn,visited:Object.keys(rooms),known:Object.keys(people),flags:['key','unpacked','bag-returned','garden-agreed','alternative-route','route-open','market-open'],items:{key:1,'crop-basil':3,'seed-basil':2,'seed-tomato':2,'packed-snack':2},plots:{'crop-bed-2':{crop:'basil',grown:200,updatedAt:500,wetUntil:1220}}};
 if(fixture==='night'){s.townMinutes=1300;s.position={x:470,y:600}}
 if(fixture==='gulls')s.position={x:598,y:794};
 if(fixture.startsWith('roster-')){const id=fixture.slice(7),route=residentRoutes[id]?.[0],room=route?.scene??Object.keys(rooms).find(scene=>rooms[scene].entities.some(e=>e.person===id&&residentHere(s,id,scene)));if(!room)throw Error('QA_RESIDENT_ROOM_MISSING');s.scene=room;s.position=rooms[room].spawn;}
 if(fixture.startsWith('animal-')){const id=fixture.slice(7),animal=animals.find(a=>a.id===id)!;const [period,slot]=Object.entries(animal.schedule)[0];s.scene=slot.scene;s.position=rooms[slot.scene].spawn;s.townMinutes=({morning:540,afternoon:780,evening:1080,night:1300} as any)[period];}
 if(fixture==='records'||fixture==='expired'||fixture==='batches'){
  s=pinLegacy(s,registry);const ref=registry.ref('crop:snap-pea');addLot(s,registry,ref,'produce',2,'synthetic-harvest');
  s.lifeV1.collections['seed:crop:basil']={id:'seed:crop:basil',minute:540,ref:registry.ref('crop:basil'),sourceAction:'synthetic-consumed-seed'};
  // Quantity for this record is really zero. No inventory is created by the UI.
  s.items['seed-basil']=0;s.lifeV1.lots=s.lifeV1.lots.filter((l:any)=>!(l.ref.id==='crop:basil'&&l.kind==='seed'));
  s.lifeV1.firstRewards.push('theo-order-first');s.items['life-gift:theo-menu']=1;s.lifeV1.collections['gift:life-gift:theo-menu']={id:'gift:life-gift:theo-menu',sourceAction:'synthetic-old-gift',minute:540};
  s.lifeV1.order={id:'synthetic-old-order',definition:'theo-peas-v1',crop:ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};if(fixture==='expired')s.townMinutes=3900;
  if(fixture==='batches'){addLot(s,registry,registry.ref('crop:snap-pea',2),'produce',1,'synthetic-v2-old-harvest');addLot(s,registry,ref,'seed',2,'synthetic-v1-old-seed');}
 }
 if(fixture.startsWith('dynamic-')){dynamicIds.add(id);s.dynamicAssetRooms=['home','cafe','garden'];}
 return s;
};
const b2=createLifeB2({...runtime,initial:fixtureInitial},registry),usage={status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,pending:0,retryAt:null}}),reserve:async()=>{throw Error('QA_MODEL_DISABLED')},settle:async()=>{}};
const dynamicAssets=localDynamicFixture(store,b2.runtime,dynamicIds);
const api=createTemporaryAccountTransport({mode:'temporary-unverified',gameId:GAME_UUID,store,runtime:b2.runtime,usage,lifeProject:b2.lifeProject,landProject:b2.landProject,noteMedia:{},dynamicAssets});
const server=createServer(async(req,res)=>{try{
 req.url=req.url?.replace('/'+GAME_UUID,'');const url=new URL(req.url!,'http://localhost'),origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5440|5441)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
 let cap=req.headers.cookie?.match(/(?:^|;\s*)harbor_demo=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(url.pathname==='/qa/prepare'&&req.method==='POST'){
  const next=url.searchParams.get('case')??'hill';if(!['hill','courtyard','records','expired','batches','night','gulls','garden','dynamic-home','dynamic-cafe','dynamic-garden',...Object.keys(people).map(p=>'roster-'+p),...animals.map(a=>'animal-'+a.id)].includes(next))return json(res,400,{error:'CASE_UNKNOWN'});if(next.startsWith('dynamic-')&&!dynamicAssets)return json(res,409,{error:'QA_LOCAL_EXPORT_REQUIRED'});fixture=next;cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_demo=${cap}; HttpOnly; SameSite=Strict; Path=/`);return json(res,200,{fixture,syntheticOnly:true});
 }
 if(req.url==='/api/bootstrap'&&req.method==='POST'&&!cap){cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_demo=${cap}; HttpOnly; SameSite=Strict; Path=/`)}
 if(!cap)return json(res,401,{error:'BROWSER_POSSESSION_REQUIRED'});req.headers['x-harbor-game']??=GAME_UUID;return await api(req,res,createHash('sha256').update(cap).digest('hex'));
 }catch(e:any){if(!res.headersSent)json(res,e.status??400,{error:e.code??e.message,terminal:true})}});
server.listen(5441,'127.0.0.1',()=>console.log('B2 transient SQLite QA 127.0.0.1:5441; model/media disabled'));
const close=()=>server.close(async()=>{await store.close();process.exit(0)});process.on('SIGINT',close);process.on('SIGTERM',close);
