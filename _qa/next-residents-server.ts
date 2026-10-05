import {nextResidents} from '../src/world/next-residents';
/** Loopback-only QA: synthetic players, real SQLite/session reducer, no model or media calls. */
import {residentRoutes} from '../src/world/residents';
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createApiHandler,json} from '../server/http';import {createRuntime} from '../server/runtime';import {initial,type Save} from '../src/story/state';import {rooms,entityAt} from '../src/world/data';import {dialogueContext} from '../server/dialogue-context';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
mkdirSync('.data',{recursive:true});const store=openAsyncSqliteAuthorityStore({path:'.data/next-six-qa.sqlite',worldId:'residents-qa',gameId:'residents-qa'});
const contexts:any[]=[];const runtime=createRuntime(async(s,a)=>{contexts.push(dialogueContext(s,entityAt(s.scene,a.target)!.person!));return {topic:null,reply:['这是本地测试回复，已收到当前小镇生活记录。','This local test reply received the current town-life context.']}});
const auth=new AsyncSessionAuthority(store,runtime);const api=createApiHandler({authority:auth,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}}),reserve:async()=>{},settle:async()=>{}},noteMedia:{}});
const cases:Record<string,Partial<Save>>={
 'night-door':{scene:'station',townMinutes:1300,position:rooms.station.entities.find(e=>e.destination==='cafe')!.approach,flags:['key','unpacked','bag-returned']},
 'tired':{scene:'home',townMinutes:1380,position:entityAt('home','bed')!.approach,awakeMinutes:1200,energy:0},
 'night-street':{scene:'station',townMinutes:1300,position:{x:510,y:650},flags:['key','unpacked','bag-returned']},
 'day-street':{scene:'station',townMinutes:540,position:{x:510,y:650},flags:['key','unpacked','bag-returned']},
 'evening-street':{scene:'station',townMinutes:1080,position:{x:510,y:650},flags:['key','unpacked','bag-returned']},

 'schedule-learning':{scene:'market',townMinutes:710,position:entityAt('market','samira')!.approach,known:['avery','samira'],flags:['key','unpacked','talk:samira:humming','talk:avery:company']},
 'schedule-known':{scene:'station',townMinutes:710,known:['avery','samira'],flags:['key','unpacked','talk:samira:routine','residents:invited'],visited:['station','home','market','harbor']},
 'schedule-hidden':{scene:'station',townMinutes:710,known:['samira'],flags:['key','unpacked']},
 'mara-life':{scene:'station',townMinutes:540,position:entityAt('station','mara')!.approach,known:['mara']},
 'legacy-overlap':{scene:'market',townMinutes:undefined,position:{x:542,y:424}},
 owen:{scene:'harbor',townMinutes:540,position:{x:672,y:582}},
 dani:{scene:'garden',townMinutes:540,position:{x:422,y:552}},
 morning:{scene:'market',townMinutes:560,position:{x:500,y:590}},
 afternoon:{scene:'market',townMinutes:780,position:{x:540,y:680}},
 evening:{scene:'dock',townMinutes:1080,position:{x:497,y:492},known:['avery','samira'],flags:['key','unpacked','residents:invited','talk:avery:sketch','talk:avery:company','talk:samira:humming','talk:samira:invite'],relations:{avery:1,samira:1}},
 night:{scene:'market',townMinutes:1300,position:{x:500,y:590}},
 fern:{scene:'garden',townMinutes:540,position:{x:210,y:404}},
 nap:{scene:'home',townMinutes:900,position:entityAt('home','bed')!.approach,fernStartedAt:540},
 opening:{},
};
for(const p of nextResidents)cases['story-'+p.id]={scene:p.routes[0].scene,townMinutes:540,position:entityAt(p.routes[0].scene,p.id)!.approach,flags:['key','unpacked','bag-returned']};
for(const [person,routes] of Object.entries(residentRoutes))for(const [i,route] of routes.entries())cases[`art-${person}-${i}`]={scene:route.scene,townMinutes:[540,780,1080][i],position:{x:route.at.x-8,y:route.at.y+42}};
for(const [person,routes] of Object.entries(residentRoutes)){const room=rooms[routes[0].scene];cases['patrol-'+person]={scene:room.id,townMinutes:540,position:room.spawn,flags:['key','unpacked','bag-returned']}};
for(const [stage,minutes] of Object.entries({young:540,unfurling:920,grown:1980}))cases['art-fern-'+stage]={scene:'garden',townMinutes:minutes,fernStartedAt:540,position:{x:210,y:404}};
createServer(async(req,res)=>{try{
 const origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5314|5315)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
 const path=new URL(req.url!,'http://localhost');
 if(path.pathname==='/qa/prepare'&&req.method==='POST'){
  const name=path.searchParams.get('case')??'opening';if(!cases[name])return json(res,404,{error:'CASE_UNKNOWN'});
  const owner=randomUUID();res.setHeader('Set-Cookie',`harbor_life_qa=${owner}; HttpOnly; SameSite=Strict; Path=/`);
  const fixture={...runtime,initial:(locale:any,id:string)=>({...initial(locale,id),flags:name==='opening'?[]:['key','unpacked'],items:name==='opening'?{}:{key:1},visited:name==='opening'?['station']:Object.keys(rooms),...cases[name]})};
  return json(res,200,await new AsyncSessionAuthority(store,fixture).create(owner,randomUUID(),path.searchParams.get('locale')==='zh'?'zh':'en'));
 }
 if(path.pathname==='/qa/contexts')return json(res,200,contexts);
 let owner=req.headers.cookie?.match(/harbor_life_qa=([a-f0-9-]{36})/)?.[1];
 if(path.pathname==='/api/bootstrap'){if(!owner){owner=randomUUID();res.setHeader('Set-Cookie',`harbor_life_qa=${owner}; HttpOnly; SameSite=Strict; Path=/`)}return json(res,200,{mode:'local-synthetic-residents-qa'})}
 if(!owner)return json(res,401,{error:'LOCAL_QA_ONLY'});await api(req,res,owner);
 }catch(e:any){json(res,400,{error:e.code??e.message,terminal:true})}
}).listen(5315,'127.0.0.1',()=>console.log('Residents QA SQLite authority 127.0.0.1:5315; synthetic players, no external model/media'));
