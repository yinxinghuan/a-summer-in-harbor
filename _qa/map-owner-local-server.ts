/** Loopback-only synthetic in-memory authority, not a production backend. */
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';
import {createApiHandler,json} from '../server/http';import {createExplorationAssembly} from '../server/exploration-assembly';
import {initial,type Save} from '../src/story/state';import {rooms} from '../src/world/data';
// @ts-expect-error frozen existing authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'map-local-only',environment:'test'});let seed:Partial<Save>={};
const assembly=createExplorationAssembly({resolveDialogue:async()=>{throw Error('QA_MODEL_DISABLED')},initial:(l:any,id:string)=>({...initial(l,id),flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms).filter(id=>!id.startsWith('workshop-annex-')),scene:'station',position:{x:733,y:557},...seed}),crabEnabled:true});
const authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store),api=createApiHandler({authority,lifeProject:assembly.lifeProject,landProject:assembly.landProject,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})}});
createServer(async(req,res)=>{try{const url=new URL(req.url!,'http://localhost'),who=String(req.headers['x-harbor-telegram-id']??url.searchParams.get('owner')??'');if(!/^99[0-9]{4}$/.test(who))return json(res,403,{error:'SYNTHETIC_ID_REQUIRED'});
if(url.pathname==='/qa/prepare'){const scene=url.searchParams.get('scene')??'station';seed={scene,position:scene==='market'?{x:597,y:180}:{...rooms[scene].spawn},...(url.searchParams.has('unvisited')?{visited:[scene]}:{}),...(url.searchParams.has('locked')?{flags:[],visited:['station','home','harbor']}:{})};return json(res,200,await authority.create(who,randomUUID(),'en'))}
if(url.pathname==='/api/bootstrap')return json(res,200,{mode:'temporary-unverified',synthetic:true});
await api(req,res,who)}catch(e:any){json(res,e.status??400,{error:e.message,terminal:true})}}).listen(5491,'127.0.0.1',()=>console.log('Local synthetic in-memory map QA :5491; model/media disabled'));
