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
const json=(res:any,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url!,'http://localhost').pathname;const method=req.method;
  if(path==='/api/health')return json(res,200,{ok:true,gameId:GAME_UUID,mode:'local-authoring-test',platformIdentityVerified:false});
  // Host loopback plus same-origin checks; no cross-origin state writes.
  const origin=req.headers.origin;if(origin&&!/^http:\/\/(127\.0\.0\.1|localhost):(5234|5235|5236)$/.test(origin))return json(res,403,{error:'ORIGIN_REJECTED'});
  let who=owner(req.headers.cookie??'');
  if(path==='/api/bootstrap'&&method==='POST'){if(!who){const cap=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`harbor_preview=${cap}; HttpOnly; SameSite=Strict; Path=/`);who=createHash('sha256').update(cap).digest('hex')}return json(res,200,{mode:'local-authoring-test'})}
  if(!who)return json(res,401,{error:'PREVIEW_SESSION_REQUIRED'});
  let body:any={};if(method==='POST'){let size=0,parts:Buffer[]=[];for await(const c of req){size+=c.length;if(size>1500000)return json(res,413,{error:'REQUEST_TOO_LARGE'});parts.push(c)}body=JSON.parse(Buffer.concat(parts).toString()||'{}')}
  if(path==='/api/usage'&&method==='GET')return json(res,200,await usage.status(who));
  if(path==='/api/sessions'&&method==='GET')return json(res,200,await authority.directory(who));
  if(path==='/api/sessions'&&method==='POST')return json(res,200,await authority.create(who,body.enrollment_id,body.locale));
  const mediaMatch=path.match(/^\/api\/sessions\/([a-f0-9-]{36})\/media\/(workshop-annex-[12])(?:\/(status|prepare))?$/);
  if(mediaMatch){const [,id,room,op]=mediaMatch;if(op==='status'&&method==='GET')return json(res,200,await noteMedia.status(who,id,room));if(op==='prepare'&&method==='POST')return json(res,200,await noteMedia.ensure(who,id,room));if(!op&&method==='GET'){const {bytes,type}=await noteMedia.image(who,id,room);res.writeHead(200,{'Content-Type':type,'Cache-Control':'private,max-age=86400','X-Content-Type-Options':'nosniff'});return res.end(bytes)}return json(res,405,{error:'METHOD_NOT_ALLOWED'})}
  const match=path.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/(action|checkpoint|events))?$/);
  if(!match)return json(res,404,{error:'NOT_FOUND'});const [,id,operation]=match;
  if(!operation&&method==='GET')return json(res,200,await authority.get(who,id));
  if(operation==='action'&&method==='POST'){
   if(!['ask','notes-generate'].includes(body.action))return json(res,200,await authority.action(who,id,body));
   const allowance=body.action==='ask'?'dialogue':'room';await usage.reserve(who,allowance,body.action_id,{session:id,body});
   try{const result=await authority.action(who,id,body);await usage.settle(who,allowance,body.action_id,true);return json(res,200,result)}catch(e:any){if(e.code!=='MODEL_CALL_PENDING_OR_INTERRUPTED')await usage.settle(who,allowance,body.action_id,false);throw e}
  }
  if(operation==='checkpoint'&&method==='POST')return json(res,200,await authority.checkpoint(who,id,body));
  if(operation==='events'&&method==='GET')return json(res,200,await authority.events(who,id,Number(new URL(req.url!,'http://localhost').searchParams.get('after')??0)));
  return json(res,405,{error:'METHOD_NOT_ALLOWED'});
 }catch(e:any){json(res,e.status??400,{error:e.code??e.message??'REQUEST_FAILED',terminal:!(e.code==='MODEL_CALL_PENDING_OR_INTERRUPTED')})}
}).listen(5236,'127.0.0.1',()=>console.log('Harbor authoring authority at 127.0.0.1:5236'));
