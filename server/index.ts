import {createApiHandler,json} from './http';
/** Local authoring preview. Uses the exported authority with its explicit test environment.
 * Never exposed as a platform-authenticated production server. */
import {createServer} from 'node:http';import {mkdirSync} from 'node:fs';import {randomBytes,createHash} from 'node:crypto';
// @ts-expect-error pinned skill library, runtime interfaces verified by integration tests
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {createNoteMedia} from './note-media';
import {createFieldNotes} from './fieldnotes';
import {createRuntime} from './runtime';// @ts-expect-error pinned skill export
import {createPlayerUsage} from '../vendor/dynamic-runtime/packages/dynamic-pipeline/player-usage.mjs';
import {createDialogueResolver} from './dialogue';import {GAME_UUID} from '../src/game-id';
mkdirSync('.data',{recursive:true});const store=openAsyncSqliteAuthorityStore({path:'.data/preview.sqlite',worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'});const authority=new AsyncSessionAuthority(store,createRuntime(await createDialogueResolver(store),await createFieldNotes(store)));
const usage=createPlayerUsage({store});const noteMedia=createNoteMedia(store);
const owner=(cookie:string)=>{const cap=cookie.match(/(?:^|; )harbor_preview=([a-f0-9]{64})(?:;|$)/)?.[1];return cap?createHash('sha256').update(cap).digest('hex'):null};
const api=createApiHandler({authority,usage,noteMedia});
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url!,'http://localhost').pathname;const method=req.method;
  if(path==='/api/health')return json(res,200,{ok:true,gameId:GAME_UUID,mode:'local-authoring-test',platformIdentityVerified:false});
  // Host loopback plus same-origin checks; no cross-origin state writes.
  const origin=req.headers.origin;if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):(5234|5235|5236)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
  let who=owner(req.headers.cookie??'');
  if(path==='/api/bootstrap'&&method==='POST'){if(!who){const cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_preview=${cap}; HttpOnly; SameSite=Strict; Path=/`);who=createHash('sha256').update(cap).digest('hex')}return json(res,200,{mode:'local-authoring-test'})}
  if(!who)return json(res,401,{error:'PREVIEW_SESSION_REQUIRED'});
  return await api(req,res,who);
 }catch(e:any){json(res,e.status??400,{error:e.code??e.message??'REQUEST_FAILED',terminal:!(e.code==='MODEL_CALL_PENDING_OR_INTERRUPTED')})}
}).listen(5236,'127.0.0.1',()=>console.log('Harbor authoring authority at 127.0.0.1:5236'));
