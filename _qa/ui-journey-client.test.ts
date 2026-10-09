import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {runtime} from '../server/runtime';
// @ts-expect-error existing authority extension
import {createAccountJourneyService} from '../server/account-journeys.mjs';
// @ts-expect-error fixed library
import {openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {GAME_UUID} from '../src/game-id';
test('account-only client lifecycle against isolated SQLite; all identities are synthetic local fixtures',async t=>{
 const d=mkdtempSync(join(tmpdir(),'harbor-ui-journeys-')),store=openAsyncSqliteAuthorityStore({path:join(d,'test.sqlite'),gameId:GAME_UUID,worldId:'ui-journeys-test'}),proofs=new Map<any,any>();
 const actors=new Map<string,any>();const actor=(id:string)=>{if(!actors.has(id)){const r={id};proofs.set(r,{kind:id==='browser'?'browser':'account',owner:(id==='browser'?'b':id==='1001'?'a':'c').repeat(64),gameId:GAME_UUID,browserOwner:'b'.repeat(64),assertCurrent:async()=>{}});actors.set(id,r)}return actors.get(id)};
 const service=createAccountJourneyService({enabled:true,store,runtime,verifyActor:async(r:any)=>proofs.get(r)});
 const saved={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')},values=new Map<string,string>();
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}};
 const shell=(account:string|null)=>{(globalThis as any).window.Aigram={isInAigram:!!account,telegramId:account,callAigramAPI:()=>{throw Error('LOCAL_FIXTURE_NOT_USED')}}};
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'?telegram_id=1001&is_in_aigram=1',origin:'http://localhost'},Aigram:{isInAigram:false,telegramId:null}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:any)=>fn()}}});
 let loseCreate=false,changeList=false,requests=0;const attempts:any[]=[],paths:string[]=[];
 globalThis.fetch=(async(input:any,init:any={})=>{requests++;const path=String(input).split('/api')[1],body=init.body?JSON.parse(init.body):undefined,headers=new Headers(init.headers),owner=actor(headers.get('X-Harbor-Telegram-Id')??'browser');paths.push(path);
  if(path==='/bootstrap')return new Response(JSON.stringify({mode:'temporary-unverified'}));
  try{let data:any;if(path==='/sessions'&&body){attempts.push(body);data=await service.create(owner,body.enrollment_id,body.locale);if(loseCreate){loseCreate=false;throw TypeError('REPLY_LOST')}}
  else if(path==='/sessions'){data=await service.directory(owner);if(changeList){changeList=false;shell('1002')}}
  else if(path.endsWith('/checkpoint'))data=await service.checkpoint(owner,path.split('/')[2],body);
  else data=await service.get(owner,path.split('/')[2]);return new Response(JSON.stringify(data));
  }catch(e:any){if(e.message==='REPLY_LOST')throw e;return new Response(JSON.stringify({error:e.message}),{status:e.status??400})}
 }) as any;
 try{
  const client=await import('../src/story/client');let first:any,second:any;
  await t.test('missing live ID and query-only ID never fetch, create or claim',async()=>{
   await assert.rejects(client.readEntryDirectory(),/PLATFORM_LOGIN_REQUIRED/);await assert.rejects(client.connect('en'),/PLATFORM_LOGIN_REQUIRED/);await assert.rejects(client.chooseJourney('en',{kind:'new'}),/PLATFORM_LOGIN_REQUIRED/);assert.equal(requests,0);assert.equal((await service.directory(actor('browser'))).length,0);
  });
  await t.test('an empty account is read-only until an explicit New game',async()=>{
   shell('1001');assert.equal((await client.readEntryDirectory()).journeys.length,0);await assert.rejects(client.connect('en'),/JOURNEY_EMPTY/);assert.equal(attempts.length,0);first=await client.chooseJourney('en',{kind:'new'});assert.equal((await service.directory(actor('1001'))).length,1);assert.equal(first.version,0);
  });
  await t.test('uncertain New retries one enrollment and preserves old head byte-for-byte',async()=>{
   await client.readJourneyDirectory(first);loseCreate=true;await assert.rejects(client.chooseJourney('en',{kind:'new'}),/REPLY_LOST/);assert.equal((await service.directory(actor('1001'))).length,2);second=await client.chooseJourney('en',{kind:'new'});assert.notEqual(second.id,first.id);assert.deepEqual(attempts.at(-1),attempts.at(-2));assert.equal((await service.directory(actor('1001'))).length,2);assert.deepEqual(await service.get(actor('1001'),first.id),first);
  });
  await t.test('Continue uses actual latest activity, while System selection and reload keep chosen save',async()=>{
   await new Promise(r=>setTimeout(r,5));await service.checkpoint(actor('1001'),first.id,{expected_version:first.version,sceneId:first.scene,position:first.position});
   values.set('harbor-account:temporary-unverified%3A1001:harbor-journey',second.id);assert.equal((await client.connect('en')).id,first.id);
   const latest=await client.connect('en');await client.readJourneyDirectory(latest);assert.equal((await client.chooseJourney('en',{kind:'existing',id:second.id})).id,second.id);assert.equal((await client.connect('en',second.id)).id,second.id);
  });
  await t.test('pending actions fence switching; all browser claim routes stay unused',async()=>{
   const head=await client.connect('en',second.id),pending='harbor-account:temporary-unverified%3A1001:harbor-pending-v2:'+head.id;values.set(pending,'fixture-pending');await assert.rejects(client.readJourneyDirectory(head),/PENDING_ACTION/);values.delete(pending);await client.readJourneyDirectory(head);await assert.rejects(client.chooseJourney('en',{kind:'claim',id:randomUUID(),confirmed:true}),/LEGACY_CLAIM_CLOSED/);assert.ok(!paths.some(x=>x.includes('/account/')));
  });
  await t.test('late identity response, logout and second account cannot restore or read prior saves',async()=>{
   const head=await client.connect('en');changeList=true;await assert.rejects(client.readJourneyDirectory(head),/IDENTITY_CHANGED/);assert.equal((await client.readEntryDirectory()).journeys.length,0);await assert.rejects(client.connect('en',head.id),/JOURNEY_NOT_FOUND/);const other=await client.chooseJourney('en',{kind:'new'});assert.notEqual(other.id,head.id);assert.equal((await service.directory(actor('1002'))).length,1);await assert.rejects(service.get(actor('1002'),head.id),/SESSION_NOT_FOUND/);shell(null);const before=requests;await assert.rejects(client.connect('en'),/PLATFORM_LOGIN_REQUIRED/);assert.equal(requests,before);shell('1001');assert.equal((await client.connect('en')).id,first.id);
  });
  await t.test('100-slot cap preserves every old save and refuses a new enrollment',async()=>{
   for(let i=2;i<100;i++)await service.create(actor('1001'),randomUUID(),'en');const before=await service.get(actor('1001'),first.id);assert.equal((await client.readEntryDirectory()).journeys.length,100);const n=attempts.length;await assert.rejects(client.chooseJourney('en',{kind:'new'}),/SESSION_LIMIT/);assert.equal(attempts.length,n);await assert.rejects(service.create(actor('1001'),randomUUID(),'en'),/SESSION_LIMIT/);assert.equal((await service.directory(actor('1001'))).length,100);assert.deepEqual(await service.get(actor('1001'),first.id),before);
  });
 }finally{(globalThis as any).window=saved.window;globalThis.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete (globalThis as any).navigator;await store.close();rmSync(d,{recursive:true,force:true})}
});
