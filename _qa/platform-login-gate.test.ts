import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createRuntime} from '../server/runtime';import {initial} from '../src/story/state';import {entityAt} from '../src/world/data';
import {makeDemoServer} from './temporary-account-server';import {GAME_UUID} from '../src/game-id';
test('formal account-only HTTP gate rejects browser writes, closes claims and preserves existing legacy bindings',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-login-gate-'));let s:any;
 try{
  s=await makeDemoServer({directory});let api=s.url+'/'+GAME_UUID+'/api';
  const bootstrap=await fetch(api+'/bootstrap',{method:'POST'}),cookie=bootstrap.headers.get('set-cookie')!.split(';')[0];
  const q=async(path:string,body?:any,account?:string)=>fetch(api+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json',...(account?{'X-Harbor-Telegram-Id':account,'X-Harbor-Identity-Mode':'temporary-unverified'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const created=await q('/sessions',{enrollment_id:randomUUID(),locale:'en'}),old=await created.json();assert.equal(created.status,200);
  const claimed=await q('/account/claim',{journey:old.id,requestId:randomUUID(),confirmed:true},'710001');assert.equal(claimed.status,200);await s.close();s=undefined;
  s=await makeDemoServer({directory,accountOnly:true});api=s.url+'/'+GAME_UUID+'/api';
  for(const [path,body] of [['/bootstrap',{}],['/sessions',undefined],['/sessions',{enrollment_id:randomUUID(),locale:'en'}],['/sessions/'+old.id,undefined],['/sessions/'+old.id+'/checkpoint',{}],['/sessions/'+old.id+'/action',{}],['/account/legacy',undefined]] as const){const r=await q(path,body);assert.equal(r.status,401,path);assert.equal((await r.json()).error,'PLATFORM_LOGIN_REQUIRED')}
  for(const [path,body] of [['/account/legacy',undefined],['/account/claim',{journey:old.id,requestId:randomUUID(),confirmed:true}]] as const){const r=await q(path,body,'710001');assert.equal(r.status,410);assert.equal((await r.json()).error,'LEGACY_CLAIM_CLOSED')}
  const dir=await q('/sessions',undefined,'710001');assert.deepEqual((await dir.json()).map((j:any)=>j.id),[old.id]);assert.deepEqual(await(await q('/sessions/'+old.id,undefined,'710001')).json(),old);
  assert.equal((await q('/sessions/'+old.id,undefined,'710002')).status,404);assert.deepEqual(await(await q('/sessions',undefined,'710002')).json(),[]);
 }finally{await s?.close();rmSync(directory,{recursive:true,force:true})}
});
test('existing platform transport open/cancel and success consume only live IDs, with one concurrent login request',async()=>{
 const saved=(globalThis as any).window;let calls=0,resolve:any,reject:any;
 (globalThis as any).window={location:{search:''},Aigram:{isInAigram:true,telegramId:'__alteru_guest__',callAigramAPI:(path:string,method:string,data:any)=>{calls++;assert.match(path,/\/get\/play\/stats\?session_id=.+&event=play$/);assert.equal(method,'GET');assert.equal(data,null);return new Promise((r,j)=>{resolve=r;reject=j})}}};
 try{
  const {signInToPlatform}=await import('../src/account-link/platform-login');const p=signInToPlatform();assert.equal(signInToPlatform(),p);assert.equal(calls,1);reject(Error('login_required'));await assert.rejects(p,/login_required/);assert.equal((globalThis as any).window.Aigram.telegramId,'__alteru_guest__');
  const success=signInToPlatform();(globalThis as any).window.Aigram.telegramId='710001';resolve({errcode:0});assert.equal(await success,'710001');assert.equal(calls,2);assert.equal(await signInToPlatform(),'710001');assert.equal(calls,2);
  (globalThis as any).window.Aigram.telegramId=null;const noId=signInToPlatform();resolve({retcode:0});await assert.rejects(noId,/PLATFORM_ID_UNAVAILABLE/);
  // Live shell identity completes entry even when the unrelated statistics read never finishes.
  const pending=signInToPlatform();(globalThis as any).window.Aigram.telegramId='710001';assert.equal(await pending,'710001');(globalThis as any).window=saved;resolve({retcode:0});await new Promise<void>(r=>queueMicrotask(r));
 }finally{(globalThis as any).window=saved}
});


test('committed account-A action reply after logout/switch cannot bind B; returning A retries its identical pending once',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-login-late-action-'));
 const base=createRuntime(),providedRuntime={...base,initial:(locale:any,id:string)=>({...initial(locale,id),scene:'home',position:entityAt('home','bed')!.approach})};
 const server=await makeDemoServer({directory,providedRuntime,accountOnly:true});
 const previous={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)};
 const shell=(id:string|null)=>{(globalThis as any).window.Aigram={isInAigram:!!id,telegramId:id,callAigramAPI:()=>Promise.resolve({retcode:0})}};
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'',origin:server.url}};shell('730101');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:any)=>fn()}}});
 let cookie='',hold=false,release!:()=>void,started!:()=>void;const began=new Promise<void>(r=>started=r),attempts:any[]=[];
 globalThis.fetch=(async(input:any,init:any={})=>{
  const path=String(input).split('/api')[1],headers=new Headers(init.headers);if(cookie)headers.set('Cookie',cookie);
  const r=await previous.fetch(server.url+'/'+GAME_UUID+'/api'+path,{...init,headers});const next=r.headers.get('set-cookie');if(next)cookie=next.split(';')[0];
  if(path.endsWith('/action')){attempts.push(JSON.parse(init.body));if(hold){hold=false;started();await new Promise<void>(r=>release=r)}}return r;
 }) as any;
 try{
  const c=await import('../src/story/client');await c.readEntryDirectory();const a=await c.chooseJourney('en',{kind:'new'});
  const action={action_id:randomUUID(),expected_version:a.version,scene:a.scene,position:a.position,target:'bed',action:'rest'};
  hold=true;const late=c.send(a,action);const rejected=assert.rejects(late,/IDENTITY_CHANGED/);await began;
  shell(null);await assert.rejects(c.connect('en'),/PLATFORM_LOGIN_REQUIRED/);shell('730102');await c.readEntryDirectory();const b=await c.chooseJourney('en',{kind:'new'});
  release();await rejected;assert.equal(c.hasPendingAction(),false);assert.deepEqual(await c.connect('en',b.id),b);
  await assert.rejects(c.connect('en',a.id),/JOURNEY_NOT_FOUND/);
  shell('730101');const recovered=await c.connect('en',a.id);assert.equal(recovered.version,a.version+1);assert.equal(recovered.townMinutes,720);assert.equal(recovered.history.length,1);assert.equal(recovered.history[0].id,action.action_id);assert.equal(c.hasPendingAction(),false);assert.deepEqual(attempts,[action,action]);
 }finally{release?.();(globalThis as any).window=previous.window;globalThis.fetch=previous.fetch;if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete (globalThis as any).navigator;await server.close();rmSync(directory,{recursive:true,force:true})}
});
