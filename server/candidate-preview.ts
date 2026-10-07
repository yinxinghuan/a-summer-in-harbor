/** Loopback-only synthetic candidate. Never install this entry point in production. */
import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createApiHandler,json} from './http';
import {createRuntime} from './runtime';
import {createMovingClock} from './candidate-clock';
import {createActivePlayClock,withActivePlayRuntime} from './active-play-clock';
import {withActivePlayAuthority} from './active-play-authority';
import {withCompactMotion} from './candidate-motion-authority';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
// @ts-expect-error frozen local authority export
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
mkdirSync('.data',{recursive:true});
const store=openAsyncSqliteAuthorityStore({path:'.data/outdoor-moving-candidate.sqlite',worldId:'outdoor-local-candidate',gameId:'outdoor-local-candidate',environment:'test'});
const motion=createMovingClock(),play=createActivePlayClock({defaultRate:process.env.HARBOR_LOCAL_PLAY_RATE==='2000'?2000:4000}),base=withActivePlayRuntime(createRuntime(async()=>{throw Error('LOCAL_MODEL_CLOSED')},undefined,motion),play);
const runtime={...base,initial:(locale:any,id:string)=>({...initial(locale,id),scene:'market',position:{x:597,y:190},flags:['key','unpacked','bag-returned'],items:{key:1},visited:Object.keys(rooms)})};
const authority=withActivePlayAuthority(withCompactMotion(new AsyncSessionAuthority(store,runtime),store,runtime,motion),store,runtime,play);
const api=createApiHandler({authority,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})},noteMedia:{}});
createServer(async(req,res)=>{try{
 const path=new URL(req.url!,'http://localhost').pathname,origin=req.headers.origin;
 if(origin&&!/^http:\/\/(localhost|127\.0\.0\.1):(5234|5235)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
 let cap=(req.headers.cookie??'').match(/(?:^|; )harbor_candidate=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(path==='/api/bootstrap'&&req.method==='POST'){if(!cap){cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_candidate=${cap}; HttpOnly; SameSite=Strict; Path=/`)}return json(res,200,{mode:'local-authoring-test',candidate:true})}
 if(!cap)return json(res,401,{error:'CANDIDATE_SESSION_REQUIRED'});
 await api(req,res,createHash('sha256').update(cap).digest('hex'));
 }catch(e:any){const domain=e.terminal===true||(typeof e.code==='string'&&e.status>=400&&e.status<500)||/^(INVALID_|UNVERIFIED_|UNSUPPORTED_|CLOCK_|MOTION_|CANDIDATE_|CHALLENGE_ACTIVE$|SETTLE_FIRST$|VERSION_CONFLICT$)/.test(e.message??'');json(res,e.status??(domain?400:503),{error:e.code??e.message,terminal:domain&&e.code!=='MODEL_CALL_PENDING_OR_INTERRUPTED'})}
}).listen(5236,'127.0.0.1',()=>console.log('Synthetic outdoor candidate authority on 127.0.0.1:5236; no model/media calls'));
