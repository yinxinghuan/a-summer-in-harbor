import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {runtime} from '../server/runtime';
// @ts-expect-error existing authority extension
import {createAccountJourneyService} from '../server/account-journeys.mjs';
// @ts-expect-error fixed library
import {openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {GAME_UUID} from '../src/game-id';
test('normal browser/account directory creates separately, uncertain enrollment retries once, switches and fences identity/pending',async()=>{
 const d=mkdtempSync(join(tmpdir(),'harbor-ui-journeys-')),store=openAsyncSqliteAuthorityStore({path:join(d,'test.sqlite'),gameId:GAME_UUID,worldId:'ui-journeys-test'}),proofs=new Map<any,any>();
 const actors=new Map<string,any>();const actor=(id:string)=>{if(!actors.has(id)){const r={id};proofs.set(r,{kind:id==='browser'?'browser':'account',owner:(id==='browser'?'b':id==='1001'?'a':'c').repeat(64),gameId:GAME_UUID,browserOwner:'b'.repeat(64),assertCurrent:async()=>{}});actors.set(id,r)}return actors.get(id)};
 const service=createAccountJourneyService({enabled:true,store,runtime,verifyActor:async(r:any)=>proofs.get(r)});
 const saved={window:(globalThis as any).window,fetch:globalThis.fetch,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')},values=new Map<string,string>();
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}};
 (globalThis as any).window={alteruLocalStorage:storage,location:{search:'',origin:'http://localhost'},Aigram:{isInAigram:false,telegramId:null}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_k:string,fn:any)=>fn()}}});
 let loseCreate=false,changeList=false;const attempts:any[]=[];
 globalThis.fetch=(async(input:any,init:any={})=>{const path=String(input).split('/api')[1],body=init.body?JSON.parse(init.body):undefined,headers=new Headers(init.headers),owner=actor(headers.get('X-Harbor-Telegram-Id')??'browser');
  if(path==='/bootstrap')return new Response(JSON.stringify({mode:'temporary-unverified'}));
  let data:any;if(path==='/sessions'&&body){attempts.push(body);data=await service.create(owner,body.enrollment_id,body.locale);if(loseCreate){loseCreate=false;throw TypeError('REPLY_LOST')}}
  else if(path==='/sessions'){data=await service.directory(owner);if(changeList){changeList=false;(globalThis as any).window.Aigram.telegramId='1002'}}
  else if(path==='/account/legacy')data=await service.legacyDirectory(owner);
  else data=await service.get(owner,path.split('/')[2]);return new Response(JSON.stringify(data));
 }) as any;
 try{
  const client=await import('../src/story/client');
  for(const account of [null,'1001']){
   (globalThis as any).window.Aigram={isInAigram:!!account,telegramId:account};
   const connectOrNew=async()=>{try{return await client.connect('en')}catch(e:any){if(e.message!=='JOURNEY_SELECTION_REQUIRED')throw e;return client.chooseJourney('en',{kind:'new'})}};
   const before=await connectOrNew(),old=structuredClone(before),who=actor(account??'browser');
   assert.equal((await client.readJourneyDirectory(before)).journeys.length,1);
   loseCreate=true;await assert.rejects(client.chooseJourney('en',{kind:'new'}),/REPLY_LOST/);
   assert.equal((await service.directory(who)).length,2);assert.deepEqual(await service.get(who,before.id),old);
   const next=await client.chooseJourney('en',{kind:'new'});assert.notEqual(next.id,before.id);assert.equal(next.version,0);
   assert.deepEqual(attempts.at(-1),attempts.at(-2));assert.equal((await service.directory(who)).length,2);assert.deepEqual(await service.get(who,before.id),old);
   await client.readJourneyDirectory(next);const restored=await client.chooseJourney('en',{kind:'existing',id:before.id});assert.deepEqual(restored,old);
   const key=[...values.keys()].find(k=>k.endsWith('harbor-journey')&&values.get(k)===before.id)!;
   const pendingKey=key.replace(/harbor-journey$/,'harbor-pending-v2:'+before.id);values.set(pendingKey,'fixture-pending');await assert.rejects(client.readJourneyDirectory(restored),/PENDING_ACTION/);values.delete(pendingKey);
  }
  const accountHead=await client.connect('en');changeList=true;await assert.rejects(client.readJourneyDirectory(accountHead),/IDENTITY_CHANGED/);
  let other;try{other=await client.connect('en')}catch(e:any){if(e.message!=='JOURNEY_SELECTION_REQUIRED')throw e;other=await client.chooseJourney('en',{kind:'new'})}assert.notEqual(other.id,accountHead.id);assert.deepEqual((await service.directory(actor('1002'))).map((j:any)=>j.id),[other.id]);
 }finally{(globalThis as any).window=saved.window;globalThis.fetch=saved.fetch;if(saved.navigator)Object.defineProperty(globalThis,'navigator',saved.navigator);else delete (globalThis as any).navigator;await store.close();rmSync(d,{recursive:true,force:true})}
});
