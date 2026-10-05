/** Loopback-only QA: synthetic players, real SQLite/session reducer, no model or media calls. */
import {readFileSync} from 'node:fs';
import {withNewsRuntime,projectNews} from '../server/news/runtime';
import {residentRoutes} from '../src/world/residents';
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createApiHandler,json} from '../server/http';import {createRuntime} from '../server/runtime';import {initial,type Save} from '../src/story/state';import {rooms,entityAt} from '../src/world/data';import {dialogueContext} from '../server/dialogue-context';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
mkdirSync('.data',{recursive:true});const store=openAsyncSqliteAuthorityStore({path:'.data/next-batch-qa.sqlite',worldId:'residents-qa',gameId:'residents-qa'});
const contexts:any[]=[];const runtime=createRuntime(async(s,a)=>{contexts.push(dialogueContext(s,entityAt(s.scene,a.target)!.person!));return {topic:null,reply:['这是本地测试回复，已收到当前小镇生活记录。','This local test reply received the current town-life context.']}});
const catalogPath=process.env.HARBOR_LOCAL_NEWS_CATALOG;const catalog=()=>catalogPath?JSON.parse(readFileSync(catalogPath,'utf8')):{schema:1,records:[]};const newsRuntime=withNewsRuntime(runtime,catalog);
const auth=new AsyncSessionAuthority(store,catalogPath?newsRuntime:runtime);const api=createApiHandler({authority:auth,newsProject:(s:Save)=>projectNews(s,catalog()),usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}}),reserve:async()=>{},settle:async()=>{}},noteMedia:{}});
const cases:Record<string,Partial<Save>>={
 'turn-training':{scene:'gym',position:entityAt('gym','idris')!.approach,known:['idris'],flags:['key','unpacked','market-known','battle:class:accepted'],items:{key:1,'packed-snack':2}},
 'six-residents':{scene:'market',position:entityAt('market','rowan')!.approach,known:['rowan'],flags:['key','unpacked','bag-returned']},

 'night-door':{scene:'station',townMinutes:1300,position:rooms.station.entities.find(e=>e.destination==='cafe')!.approach,flags:['key','unpacked','bag-returned']},
 'news':{scene:'garden',townMinutes:540,position:entityAt('garden','dani')!.approach,known:['dani']},
 'art-young':{scene:'garden',townMinutes:540,position:{x:692,y:658},flags:['key','unpacked','crop-starter'],plots:Object.fromEntries(['radish','basil','tomato'].map((crop,i)=>['crop-bed-'+(i+1),{crop,grown:0,updatedAt:540,wetUntil:1260}])) as any},
 'art-growing':{scene:'garden',townMinutes:540,position:{x:692,y:658},flags:['key','unpacked','crop-starter'],plots:Object.fromEntries(['radish','basil','tomato'].map((crop,i)=>['crop-bed-'+(i+1),{crop,grown:[180,360,800][i],updatedAt:540,wetUntil:1260}])) as any},
 'art-ready':{scene:'garden',townMinutes:540,position:{x:692,y:658},flags:['key','unpacked','crop-starter'],plots:Object.fromEntries(['radish','basil','tomato'].map((crop,i)=>['crop-bed-'+(i+1),{crop,grown:[360,720,1440][i],updatedAt:540,wetUntil:1260}])) as any},
 'art-dry':{scene:'garden',townMinutes:540,position:{x:692,y:658},flags:['key','unpacked','crop-starter'],plots:Object.fromEntries(['radish','basil','tomato'].map((crop,i)=>['crop-bed-'+(i+1),{crop,grown:[180,360,800][i],updatedAt:540,wetUntil:540}])) as any},
 'art-bag':{scene:'garden',townMinutes:540,position:{x:692,y:658},items:{key:1,'crop-radish':2,'crop-basil':3,'crop-tomato':4}},
 'farming':{scene:'garden',townMinutes:540,position:entityAt('garden','crop-bed-1')!.approach},
 'harvest':{scene:'garden',townMinutes:900,position:entityAt('garden','crop-bed-1')!.approach,flags:['key','unpacked','crop-starter'],plots:{'crop-bed-1':{crop:'radish',grown:0,updatedAt:540,wetUntil:1260}}},
 'selling':{scene:'grocery',townMinutes:540,position:entityAt('grocery','crop-counter')!.approach,items:{key:1,'crop-radish':2}},
 'closed-shop':{scene:'grocery',townMinutes:1300,position:entityAt('grocery','crop-counter')!.approach,items:{key:1,'crop-radish':2}},
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
for(const [person,routes] of Object.entries(residentRoutes))for(const [i,route] of routes.entries())cases[`art-${person}-${i}`]={scene:route.scene,townMinutes:[540,780,1080][i],position:{x:route.at.x-8,y:route.at.y+42}};
for(const [person,routes] of Object.entries(residentRoutes)){const room=rooms[routes[0].scene];cases['patrol-'+person]={scene:room.id,townMinutes:540,position:room.spawn,flags:['key','unpacked','bag-returned']}};
for(const [stage,minutes] of Object.entries({young:540,unfurling:920,grown:1980}))cases['art-fern-'+stage]={scene:'garden',townMinutes:minutes,fernStartedAt:540,position:{x:210,y:404}};
createServer(async(req,res)=>{try{
 const origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5330|5331)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
 const path=new URL(req.url!,'http://localhost');
 if(path.pathname==='/qa/start'&&req.method==='GET'&&!path.searchParams.has('case')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>Local QA: synthetic journeys</h1>'+Object.keys(cases).filter(k=>['turn-training','six-residents','news','harvest'].includes(k)).map(k=>'<p><a href="/qa/start?case='+k+'&locale=en">'+k+' English</a> · <a href="/qa/start?case='+k+'&locale=zh">'+k+' 中文</a></p>').join(''))}
 if((path.pathname==='/qa/prepare'&&req.method==='POST')||(path.pathname==='/qa/start'&&req.method==='GET')){ 
  const name=path.searchParams.get('case')??'opening';if(!cases[name])return json(res,404,{error:'CASE_UNKNOWN'});
  const owner=randomUUID();res.setHeader('Set-Cookie',`harbor_life_qa=${owner}; HttpOnly; SameSite=Strict; Path=/`);
  const chosen=catalogPath?newsRuntime:runtime;const fixture={...chosen,initial:(locale:any,id:string)=>({...chosen.initial(locale,id),flags:name==='opening'?[]:['key','unpacked'],items:name==='opening'?{}:{key:1},visited:name==='opening'?['station']:Object.keys(rooms),...cases[name]})};
  const head=await new AsyncSessionAuthority(store,fixture).create(owner,randomUUID(),path.searchParams.get('locale')==='zh'?'zh':'en');
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<script src="/alteru-storage-scope.js"></script><script>window.alteruLocalStorage.setItem("harbor-locale",'+JSON.stringify(head.locale)+');window.alteruLocalStorage.removeItem("harbor-journey");location.replace("/")</script>')}
  return json(res,200,head);
 }
 if(path.pathname==='/qa/contexts')return json(res,200,contexts);
 let owner=req.headers.cookie?.match(/harbor_life_qa=([a-f0-9-]{36})/)?.[1];
 if(path.pathname==='/api/bootstrap'){if(!owner){owner=randomUUID();res.setHeader('Set-Cookie',`harbor_life_qa=${owner}; HttpOnly; SameSite=Strict; Path=/`)}return json(res,200,{mode:'local-synthetic-residents-qa'})}
 if(!owner)return json(res,401,{error:'LOCAL_QA_ONLY'});await api(req,res,owner);
 }catch(e:any){json(res,400,{error:e.code??e.message,terminal:true})}
}).listen(5331,'127.0.0.1',()=>console.log('Residents QA SQLite authority 127.0.0.1:5331; synthetic players, no external model/media'));
