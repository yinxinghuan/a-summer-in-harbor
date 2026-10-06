import {nextResidents} from '../src/world/next-residents';
/** Loopback-only QA: synthetic players, real SQLite/session reducer, no model or media calls. */
import {residentRoutes} from '../src/world/residents';
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createApiHandler,json} from '../server/http';import {createRuntime} from '../server/runtime';import {initial,type Save} from '../src/story/state';import {rooms,entityAt} from '../src/world/data';import {dialogueContext} from '../server/dialogue-context';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
mkdirSync('.data',{recursive:true});const store=openAsyncSqliteAuthorityStore({path:'.data/animals-owner-qa.sqlite',worldId:'residents-qa',gameId:'residents-qa'});
const contexts:any[]=[];const runtime=createRuntime(async(s,a)=>{contexts.push(dialogueContext(s,entityAt(s.scene,a.target)!.person!));return {topic:null,reply:['这是本地测试回复，已收到当前小镇生活记录。','This local test reply received the current town-life context.']}});
const auth=new AsyncSessionAuthority(store,runtime);const api=createApiHandler({authority:auth,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}}),reserve:async()=>{},settle:async()=>{}},noteMedia:{}});
const cases:Record<string,Partial<Save>>={
 'cat-rest':{scene:'station',townMinutes:540,position:{x:724,y:666}},
 'cat-walk':{scene:'station',townMinutes:780,position:{x:724,y:666}},
 'cat-mira':{scene:'market',townMinutes:540,position:{x:754,y:756}},
 'cat-sleep':{scene:'courtyard',townMinutes:1300,position:{x:538,y:521}},
 'gull':{scene:'dock',townMinutes:780,position:{x:460,y:555}},
 'overlap':{scene:'station',townMinutes:780,position:{x:748,y:630}},
 'home-nap':{scene:'home',townMinutes:900,position:entityAt('home','bed')!.approach},
};
createServer(async(req,res)=>{try{
 const origin=req.headers.origin;if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5424|5425|5426)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
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
}).listen(5425,'127.0.0.1',()=>console.log('Residents QA SQLite authority 127.0.0.1:5425; synthetic players, no external model/media'));
