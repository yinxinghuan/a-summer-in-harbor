import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {makeDemoServer} from './temporary-account-server';import {GAME_UUID} from '../src/game-id';import {entityAt} from '../src/world/data';
async function fixture(extra:any={}){const directory=mkdtempSync(join(tmpdir(),'harbor-demo-http-'));const server=await makeDemoServer({directory,...extra});return {...server,directory,async done(){await server.close();rmSync(directory,{recursive:true,force:true})}}}
function device(url:string,id?:string){let cookie='';return {setId:(v?:string)=>id=v,async call(path:string,body?:unknown,extra:any={}){
 const r=await fetch(url+'/api'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'X-Harbor-Game':GAME_UUID,...(id===undefined?{}:{'X-Harbor-Telegram-Id':id,'X-Harbor-Identity-Mode':'temporary-unverified'}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:extra.signal});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data}}}}
const enroll=()=>({enrollment_id:randomUUID(),locale:'en'});
const claim=(journey:string)=>({journey,requestId:randomUUID(),confirmed:true});
const intro=(s:any)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,'mara')!.approach,target:'mara',action:'introduce'});
test('real HTTP two independent cookies same account continue same DB head; other account isolated; explicit spoof succeeds as documented risk',async()=>{
 const c=await fixture();try{const a=device(c.url,'100001'),a2=device(c.url,'100001'),b=device(c.url,'100002');for(const d of [a,a2,b])assert.equal((await d.call('/bootstrap',{})).data.mode,'temporary-unverified');
 const s=(await a.call('/sessions',enroll())).data;const result=await a.call('/sessions/'+s.id+'/action',intro(s));assert.equal(result.status,200);assert.equal(result.data.head.version,1);
 assert.equal((await a2.call('/sessions')).data[0].id,s.id);assert.equal((await a2.call('/sessions/'+s.id)).data.version,1);
 assert.deepEqual((await b.call('/sessions')).data,[]);for(const path of ['', '/events','/media/workshop-annex-1/status','/media/workshop-annex-1'])assert.equal((await b.call('/sessions/'+s.id+path)).status,404);
 b.setId('100001');assert.equal((await b.call('/sessions/'+s.id)).status,200,'demonstrate ID impersonation; this is not verified login');
 b.setId(undefined);assert.equal((await b.call('/sessions/'+s.id)).status,404);
 }finally{await c.done()}
});
test('HTTP explicit old-journey claim is atomic and idempotent; no automatic migration, no overwrite, browser and other account lose claimed access',async()=>{
 const c=await fixture();try{const d=device(c.url);await d.call('/bootstrap',{});const old=(await d.call('/sessions',enroll())).data,other=(await d.call('/sessions',enroll())).data;
 d.setId('200001');assert.deepEqual((await d.call('/sessions')).data,[]);assert.equal((await d.call('/account/legacy')).data.length,2);
 const fresh=(await d.call('/sessions',enroll())).data,body=claim(old.id);assert.equal((await d.call('/account/claim',{...body,confirmed:false})).status,400);assert.equal((await d.call('/account/legacy')).data.length,2);
 const replies=await Promise.all([d.call('/account/claim',body),d.call('/account/claim',body)]);assert.equal(replies[0].status,200);assert.deepEqual(replies[0].data,replies[1].data);assert.deepEqual((await d.call('/sessions')).data.map((x:any)=>x.id).sort(),[old.id,fresh.id].sort());assert.equal((await d.call('/sessions/'+old.id)).data.version,0);
 d.setId(undefined);assert.equal((await d.call('/sessions/'+old.id)).status,404);assert.equal((await d.call('/sessions/'+other.id)).status,200);assert.equal((await d.call('/sessions/'+old.id+'/media/workshop-annex-1')).status,404);
 d.setId('200002');assert.equal((await d.call('/account/claim',{...body,requestId:randomUUID()})).status,409);assert.equal((await d.call('/sessions/'+old.id)).status,404);
 }finally{await c.done()}
});
test('HTTP ID syntax, mode and game tenant checks; body cannot override request account',async()=>{
 const c=await fixture();try{const d=device(c.url);await d.call('/bootstrap',{});for(const id of ['0','__alteru_guest__','abc','1'.repeat(21)]){d.setId(id);assert.equal((await d.call('/sessions')).status,400)}
 d.setId('300001');assert.equal((await d.call('/sessions',undefined,{headers:{'X-Harbor-Game':randomUUID()}})).status,403);assert.equal((await d.call('/sessions',undefined,{headers:{'X-Harbor-Identity-Mode':'verified'}})).status,400);
 const s=(await d.call('/sessions',{...enroll(),owner:'400001'})).data;d.setId('400001');assert.equal((await d.call('/sessions/'+s.id)).status,404);
 }finally{await c.done()}
});
test('HTTP aborted pending dialogue does not commit a late result after request cancellation',async()=>{
 let release!:()=>void,entered!:()=>void;const wait=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);const c=await fixture({delayDialogue:async()=>{entered();await wait}});
 try{const a=device(c.url,'500001');await a.call('/bootstrap',{});let s=(await a.call('/sessions',enroll())).data;s=(await a.call('/sessions/'+s.id+'/action',intro(s))).data.head;
 const control=new AbortController();const p=a.call('/sessions/'+s.id+'/action',{...intro(s),action:'ask',payload:{text:'How is your day?',locale:'en'}},{signal:control.signal}).catch(e=>e);await started;control.abort();await p;await new Promise(r=>setTimeout(r,30));release();await new Promise(r=>setTimeout(r,30));assert.equal((await a.call('/sessions/'+s.id)).data.version,s.version);
 }finally{release?.();await c.done()}
});
test('HTTP same identity survives server/DB reopen without platform cloud save',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-demo-reopen-'));let c=await makeDemoServer({directory:dir});try{const a=device(c.url,'600001');await a.call('/bootstrap',{});const s=(await a.call('/sessions',enroll())).data;await c.close();c=await makeDemoServer({directory:dir});const fresh=device(c.url,'600001');await fresh.call('/bootstrap',{});assert.equal((await fresh.call('/sessions')).data[0].id,s.id)}finally{await c.close();rmSync(dir,{recursive:true,force:true})}
});
