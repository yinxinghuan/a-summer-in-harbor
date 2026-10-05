import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
// @ts-expect-error local candidate
import {createAccountJourneyService} from '../server/account-journeys.mjs';
// @ts-expect-error frozen library with isolated repository extension
import {openAsyncSqliteAuthorityStore,AsyncSessionAuthority} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {runtime} from '../server/runtime';import {entityAt} from '../src/world/data';
const gameId='e78df027-7ef4-4d49-82eb-ea91f03d9fb3',A='a'.repeat(64),B='b'.repeat(64),L='c'.repeat(64),M='d'.repeat(64);
function setup(){const dir=mkdtempSync(join(tmpdir(),'harbor-claim-'));const config={path:join(dir,'authority.sqlite'),worldId:'claim-world',gameId};let store=openAsyncSqliteAuthorityStore(config);const proofs=new Map<any,any>();
 const verifyActor=async(request:any)=>proofs.get(request);
 const credential=(kind='account',id=A,browserOwner:string|undefined=L)=>{const request={fixture:randomUUID()};proofs.set(request,{kind,owner:id,gameId,browserOwner,assertCurrent:async()=>{if(!proofs.has(request))throw Error('IDENTITY_EXPIRED')}});return request};
 const make=(extra:any={})=>createAccountJourneyService({enabled:true,store,runtime,verifyActor,...extra});
 return {config,credential,proofs,make,get store(){return store},async reopen(){await store.close();store=openAsyncSqliteAuthorityStore(config)},async close(){await store.close();rmSync(dir,{recursive:true,force:true})}}}
const intent=(s:any)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,'mara')!.approach,target:'mara',action:'introduce'});
const claim=(journey:string,requestId=randomUUID())=>({journey,requestId,confirmed:true});
test('real SQLite claim preserves head/events/media, keeps multiple journeys, revokes only claimed browser access, survives restart',async()=>{
 const c=setup();try{const service=c.make(),browser=c.credential('browser',L),a=c.credential(),b=c.credential('account',B,M);
 const raw=new AsyncSessionAuthority(c.store,runtime),enrollment=randomUUID();let s=await service.create(browser,enrollment,'en');const other=await service.create(browser,randomUUID(),'en'),existing=await service.create(a,randomUUID(),'en');
 const action=intent(s),done=await service.action(browser,s.id,action);s=done.head;const events=await service.events(browser,s.id,0);
 await c.store.transaction((r:any)=>r.putMedia(s.id,'fixture',{status:'ready',synthetic:true}));
 assert.equal((await service.legacyDirectory(a)).length,2);
 const cmd=claim(s.id),receipt=await service.claim(a,cmd);assert.deepEqual((await service.legacyDirectory(a)).map((x:any)=>x.id),[other.id]);assert.equal(receipt.policy,'revoke-claimed-browser-v1');assert.deepEqual(await service.get(a,s.id),s);assert.deepEqual(await service.events(a,s.id,0),events);assert.deepEqual(await service.action(a,s.id,action),done);
 assert.deepEqual((await service.directory(a)).map((x:any)=>x.id).sort(),[s.id,existing.id].sort());assert.deepEqual((await service.directory(browser)).map((x:any)=>x.id),[other.id]);
 await assert.rejects(service.get(browser,s.id),/SESSION_NOT_FOUND/);await assert.rejects(service.checkpoint(browser,s.id,{sceneId:s.scene,expected_version:s.version,position:s.position}),/SESSION_NOT_FOUND/);await assert.rejects(service.action(browser,s.id,action),/SESSION_NOT_FOUND/);await assert.rejects(service.events(browser,s.id,0),/SESSION_NOT_FOUND/);await assert.rejects(service.create(browser,enrollment,'en'),/ENROLLMENT_ALREADY_CLAIMED/);await assert.rejects(service.get(b,s.id),/SESSION_NOT_FOUND/);
 assert.deepEqual(JSON.parse(JSON.stringify(await c.store.transaction((r:any)=>r.media(s.id)))),[{slot:'fixture',data:JSON.stringify({status:'ready',synthetic:true})}]);assert.deepEqual(await raw.get(L,s.id),s,'storage row not copied or reowned');
 await c.reopen();const reopened=c.make();assert.deepEqual(await reopened.claim(a,cmd),receipt);assert.deepEqual(await reopened.get(a,s.id),s);assert.equal((await reopened.directory(a)).length,2);
 }finally{await c.close()}
});
test('concurrent same request is idempotent; competing account claim has one winner; changed request payload conflicts',async()=>{
 const c=setup();try{const svc=c.make(),browser=c.credential('browser',L),a=c.credential(),b=c.credential('account',B,L),s=await svc.create(browser,randomUUID(),'en'),cmd=claim(s.id);
 const repeats=await Promise.all(Array.from({length:8},()=>svc.claim(a,cmd)));for(const x of repeats)assert.deepEqual(x,repeats[0]);
 const other=await svc.create(browser,randomUUID(),'en');await assert.rejects(svc.claim(a,{...cmd,journey:other.id}),/CLAIM_ID_CONFLICT/);
 const races=await Promise.allSettled([svc.claim(a,claim(other.id)),svc.claim(b,claim(other.id))]);assert.equal(races.filter(x=>x.status==='fulfilled').length,1);assert.equal(races.filter(x=>x.status==='rejected'&&/CLAIM_CONFLICT/.test(String(x.reason))).length,1);
 assert.equal((await svc.directory(a)).length+(await svc.directory(b)).length,2);
 }finally{await c.close()}
});
test('dual proof/confirmation required, untrusted request fields grant nothing; wrong browser cannot claim',async()=>{
 const c=setup();try{const svc=c.make(),browser=c.credential('browser',L),s=await svc.create(browser,randomUUID(),'en');await assert.rejects(svc.claim({owner:A,browserOwner:L,kind:'account'},claim(s.id)),/VERIFIED_ACTOR_REQUIRED/);
 await assert.rejects(svc.claim(c.credential('account',A,M),claim(s.id)),/LEGACY_SESSION_NOT_FOUND/);await assert.rejects(svc.claim(browser,claim(s.id)),/DUAL_PROOF_REQUIRED/);
 await assert.rejects(svc.claim(c.credential(),{...claim(s.id),confirmed:false}),/INVALID_CLAIM/);await assert.rejects(svc.claim(c.credential(),{...claim(s.id),owner:B}),/INVALID_CLAIM/);assert.deepEqual(await c.store.transaction((r:any)=>r.accountBindings(A)),[]);
 }finally{await c.close()}
});
test('failure after binding write rolls back binding and receipt atomically',async()=>{
 const c=setup();try{const normal=c.make(),browser=c.credential('browser',L),a=c.credential(),s=await normal.create(browser,randomUUID(),'en'),cmd=claim(s.id);
 const fault={...c.store,transaction:(work:any)=>c.store.transaction((repo:any)=>work({...repo,addAccountClaim:async()=>{throw Error('INJECTED_RECEIPT_FAILURE')}}))};
 await assert.rejects(c.make({store:fault}).claim(a,cmd),/INJECTED_RECEIPT_FAILURE/);assert.equal(await c.store.transaction((r:any)=>r.accountBinding(s.id)),undefined);assert.equal(await c.store.transaction((r:any)=>r.accountClaim(A,cmd.requestId)),undefined);assert.deepEqual(await normal.get(browser,s.id),s);await normal.claim(a,cmd);
 }finally{await c.close()}
});
test('identity invalidation during claim rolls back; late model action after claim cannot write using old cookie',async()=>{
 const c=setup();try{const svc=c.make(),browser=c.credential('browser',L),a=c.credential(),s=await svc.create(browser,randomUUID(),'en');let checks=0;const invalid=c.credential();c.proofs.get(invalid).assertCurrent=async()=>{if(++checks===3)throw Error('IDENTITY_EXPIRED')};
 const cmd=claim(s.id);await assert.rejects(svc.claim(invalid,cmd),/IDENTITY_EXPIRED/);assert.equal(await c.store.transaction((r:any)=>r.accountBinding(s.id)),undefined);
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const delayed=c.make({runtime:{...runtime,prepare:async(...args:any[])=>{entered();await gate;return (runtime.prepare as any)(...args)}}});
 const pending=delayed.action(browser,s.id,intent(s));await started;await svc.claim(a,cmd);release();await assert.rejects(pending,/SESSION_NOT_FOUND/);assert.deepEqual(await svc.get(a,s.id),s);assert.deepEqual(await svc.events(a,s.id,0),[]);
 }finally{await c.close()}
});
test('account switch while action awaits rejects stale verified actor and leaves head unchanged',async()=>{
 const c=setup();try{const svc=c.make(),a=c.credential(),s=await svc.create(a,randomUUID(),'en');let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const delayed=c.make({runtime:{...runtime,prepare:async(...args:any[])=>{entered();await gate;return (runtime.prepare as any)(...args)}}});const pending=delayed.action(a,s.id,intent(s));await started;c.proofs.delete(a);release();await assert.rejects(pending,/IDENTITY_EXPIRED/);const fresh=c.credential();assert.deepEqual(await svc.get(fresh,s.id),s);assert.equal((await svc.directory(c.credential('account',B))).length,0);
 }finally{await c.close()}
});

test('existing frontend selection and explicit claim flow uses real SQLite service, not a mock directory',async()=>{
 const {AccountJourneyLink}=await import('../src/account-link/core');const c=setup();try{const svc=c.make(),browser=c.credential('browser',L),a=c.credential();const legacy=await svc.create(browser,randomUUID(),'en'),own=await svc.create(a,randomUUID(),'en');const cache=new Map<string,string>();
 const list=async()=>({journeys:(await svc.directory(a)).map((j:any)=>({...j,title:j.scene})),legacy:(await svc.legacyDirectory(a)).map((j:any)=>({...j,title:j.scene}))[0]});
 const flow=new AccountJourneyLink({gameId,identity:()=>({account:'fixture-A'}),storage:{getItem:k=>cache.get(k)??null,setItem:(k,v)=>{cache.set(k,v)},removeItem:k=>{cache.delete(k)}},authority:{list,claim:async(journey,requestId)=>{await svc.claim(a,{journey,requestId,confirmed:true});return list()}}});
 await flow.connect();assert.equal(flow.view.legacy?.id,legacy.id);await flow.claimLegacy(false);assert.equal((await svc.directory(a)).length,1);await flow.claimLegacy(true);assert.deepEqual(flow.view.journeys.map(j=>j.id).sort(),[legacy.id,own.id].sort());assert.equal(flow.view.legacy,undefined);assert.ok(flow.choose(legacy.id));await flow.connect();assert.equal(flow.view.selected?.id,legacy.id);
 }finally{await c.close()}
});

test('two independent processes/connections serialize competing claims and replay the same receipt',async()=>{
 const {fork}=await import('node:child_process');const c=setup();const children:any[]=[];
 async function race(journey:string,accounts:string[],ids:string[]){
  const runs=accounts.map((account,i)=>{const child=fork(new URL('./account-claim-racer.ts',import.meta.url),[c.config.path,journey,account,ids[i]],{execArgv:['--import','tsx'],stdio:['ignore','ignore','pipe','ipc']});children.push(child);let ready!:()=>void,finish!:(x:any)=>void,reject!:(e:any)=>void,result:any,stderr='';const started=new Promise<void>(r=>ready=r);const done=new Promise<any>((r,j)=>{finish=r;reject=j});child.stderr!.on('data',(x:any)=>stderr+=x);child.on('message',(m:any)=>{if(m.ready)ready();else result=m});child.on('error',reject);child.on('exit',(code:number)=>code===0&&result?finish(result):reject(Error(stderr||'child failed')));return {child,started,done}});
  await Promise.all(runs.map(x=>x.started));runs.forEach(x=>x.child.send('claim'));return Promise.all(runs.map(x=>x.done));
 }
 try{const svc=c.make(),browser=c.credential('browser',L),s=await svc.create(browser,randomUUID(),'en');const results=await race(s.id,['a','b'],[randomUUID(),randomUUID()]);assert.equal(results.filter(x=>x.result).length,1);assert.equal(results.filter(x=>x.error==='CLAIM_CONFLICT').length,1);
 const next=await svc.create(browser,randomUUID(),'en'),id=randomUUID(),replays=await race(next.id,['a','a'],[id,id]);assert.deepEqual(replays[0],replays[1]);assert.ok(replays[0].result);
 }finally{children.forEach(ch=>{if(ch.exitCode===null)ch.kill()});await c.close()}
});

test('account adapter retains existing authority in-flight dedupe for concurrent identical actions',async()=>{
 const c=setup();try{let calls=0,entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);const svc=c.make({runtime:{...runtime,prepare:async(...args:any[])=>{calls++;entered();await gate;return (runtime.prepare as any)(...args)}}}),a=c.credential(),s=await svc.create(a,randomUUID(),'en'),cmd=intent(s);
 const pending=Array.from({length:8},()=>svc.action(a,s.id,cmd));await started;await new Promise(r=>setTimeout(r,10));release();const results=await Promise.all(pending);assert.equal(calls,1);for(const result of results)assert.deepEqual(result,results[0]);assert.equal((await svc.events(a,s.id,0)).length,1);
 }finally{await c.close()}
});
