/** Loopback-only, task-owned SQLite, fixed narrative, injectable committed clock. */
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';import {mkdirSync} from 'node:fs';
import {createApiHandler,json} from '../server/http';import {createRuntime} from '../server/runtime';import {initial,type Save} from '../src/story/state';import {rooms,entityAt} from '../src/world/data';
// @ts-expect-error frozen asynchronous authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
mkdirSync('.data',{recursive:true});const store=openAsyncSqliteAuthorityStore({path:'.data/relationship-growth-qa.sqlite',worldId:'relationship-growth-qa',gameId:'relationship-growth-qa'});
const base=createRuntime(async()=>({topic:null,reply:['本地固定回复，不改变共同经历。','A fixed local reply; shared experiences stay unchanged.']}),undefined,undefined,{relationshipClock:s=>s.townMinutes??540});
const runtime={...base,async prepare(s:Save,a:any,...args:any[]){if(a.action==='qa-authoritative-clock'){if(!Number.isSafeInteger(a.payload?.minute)||a.payload.minute<(s.townMinutes??540))throw Error('QA_CLOCK_INVALID');const head=structuredClone(s);head.townMinutes=a.payload.minute;head.version++;head.cursor++;return {head,text:['测试权威分钟推进','QA authoritative minute advanced'],kind:'action',accepted:true,actionId:a.action}}return (base.prepare as any)(s,a,...args)}};
const auth=new AsyncSessionAuthority(store,runtime);const api=createApiHandler({authority:auth,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}}),reserve:async()=>{},settle:async()=>{}},noteMedia:{}});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url!,'http://127.0.0.1'),owner=req.headers.cookie?.match(/harbor_relationship_qa=([a-f0-9-]{36})/)?.[1];
 if(url.pathname==='/qa/prepare'&&req.method==='POST'){
  const p=url.searchParams.get('person')??'mara';if(!['mara','avery','samira'].includes(p))throw Error('QA_PERSON_INVALID');const who=randomUUID();res.setHeader('Set-Cookie',`harbor_relationship_qa=${who}; HttpOnly; SameSite=Strict; Path=/`);
  const seeded={...runtime,initial:(locale:any,id:string)=>{const s=initial(locale,id);s.scene=p==='samira'?'market':'station';s.flags=['key','unpacked'];s.items={key:1};s.visited=Object.keys(rooms);s.position=entityAt(s.scene,p)!.approach;return s}};
  return json(res,200,await new AsyncSessionAuthority(store,seeded).create(who,randomUUID(),url.searchParams.get('locale')==='zh'?'zh':'en'));
 }
 if(!owner)return json(res,401,{error:'LOCAL_QA_ONLY'});
 if(url.pathname==='/api/bootstrap')return json(res,200,{mode:'local-synthetic-relationship-qa'});
 if(url.pathname==='/qa/advance'&&req.method==='POST'){
  const id=url.searchParams.get('id')!,s=await auth.get(owner,id),minute=Number(url.searchParams.get('minute'));return json(res,200,await auth.action(owner,id,{action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'clock',action:'qa-authoritative-clock',payload:{minute}}));
 }
 await api(req,res,owner);
 }catch(e:any){json(res,400,{error:e.code??e.message,terminal:true})}});
server.listen(5346,'127.0.0.1',()=>console.log('Relationship QA 5346: SQLite/fixed narrative, no model/media'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await store.close();process.exit(0)}));
