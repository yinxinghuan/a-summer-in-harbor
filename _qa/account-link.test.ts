import {test} from 'node:test';import assert from 'node:assert/strict';
import {AccountJourneyLink,readRecentHint,publicHint,type Journey} from '../src/account-link/core';
const game='e78df027-7ef4-4d49-82eb-ea91f03d9fb3',one:Journey={id:'00000000-0000-4000-8000-000000000001',title:'A summer',version:12},old:Journey={id:'00000000-0000-4000-8000-000000000002',title:'This browser',version:7};
const storage=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)},map}};
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve}};
test('public cloud rows never serve as authentication, empty-account proof or recovery-secret storage',()=>{
 assert.deepEqual(readRecentHint([{user_id:'B',resource_data:JSON.stringify(publicHint(game,one.id))}],'A',game),{kind:'not-in-recent-window'});
 assert.deepEqual(readRecentHint([{user_id:'A',resource_data:JSON.stringify(publicHint(game,one.id))}],'A',game),{kind:'found',journey:one.id});
 assert.equal(readRecentHint([{user_id:'A',resource_data:JSON.stringify({harborJourneyLinkV1:{...publicHint(game,one.id).harborJourneyLinkV1,capability:'forbidden'}})}],'A',game).kind,'invalid');
 assert.equal(readRecentHint([{user_id:'A',resource_data:'broken'}],'A',game).kind,'invalid');
});
test('same mock authenticated account on fresh devices restores only an authority-listed journey',async()=>{
 const make=()=>new AccountJourneyLink({gameId:game,identity:()=>({account:'A'}),storage:storage(),readHint:async()=>({kind:'found',journey:one.id}),authority:{list:async()=>({journeys:[one]}),claim:async()=>{throw Error('NO')}}});
 const a=make(),b=make();assert.equal((await a.connect()).selected?.id,one.id);assert.equal((await b.connect()).selected?.id,one.id);
 const unverified=new AccountJourneyLink({gameId:game,identity:()=>({account:'A'}),storage:storage(),readHint:async()=>({kind:'found',journey:one.id})});assert.equal((await unverified.connect()).phase,'connection-needed');assert.equal(unverified.choose(one.id),false);
});
test('account switch clears visible state, isolates selection cache, and rejects foreign cloud hint',async()=>{
 let account='A';const s=storage(),m=new AccountJourneyLink({gameId:game,identity:()=>({account}),storage:s,readHint:async()=>({kind:'found',journey:one.id}),authority:{list:async()=>({journeys:account==='A'?[one]:[]}),claim:async()=>{throw Error('NO')}}});
 await m.connect();m.choose(one.id);account='B';assert.equal(m.choose(one.id),false);assert.equal(m.view.selected,undefined);await m.connect();assert.deepEqual(m.view.journeys,[]);assert.equal(m.view.selected,undefined);assert.ok([...s.map.keys()].every(k=>k.includes(':A:')));
 account='A';assert.equal((await m.connect()).selected?.id,one.id);
});
test('not-ready/guest does not query; cancelled and late account responses never restore stale UI',async()=>{
 let account:string|undefined;let calls=0;const wait=deferred<any>();const m=new AccountJourneyLink({gameId:game,identity:()=>account?{account}:null,storage:storage(),readHint:async()=>{calls++;return {kind:'unavailable'}},authority:{list:()=>wait.promise,claim:async()=>{throw Error('NO')}}});
 assert.equal((await m.connect()).phase,'waiting');assert.equal(calls,0);account='__alteru_guest__';await m.connect();assert.equal(calls,0);account='A';const work=m.connect();await Promise.resolve();account='B';wait.resolve({journeys:[one]});await work;assert.equal(m.view.phase,'waiting');assert.equal(m.view.selected,undefined);
 const pending=deferred<any>();const n=new AccountJourneyLink({gameId:game,identity:()=>({account:'A'}),storage:storage(),readHint:()=>pending.promise});const r=n.connect();n.cancel();pending.resolve({kind:'found',journey:one.id});await r;assert.equal(n.view.phase,'waiting');
});
test('old browser journey requires explicit confirmation, preserves both journeys, idempotent retry after lost response',async()=>{
 const owned=[one],receipts=new Map<string,any>(),requests:string[]=[];let claimed=false,lose=true;
 const m=new AccountJourneyLink({gameId:game,identity:()=>({account:'A'}),storage:storage(),readHint:async()=>({kind:'unavailable'}),authority:{list:async()=>({journeys:[...owned],...(!claimed?{legacy:old}:{})}),claim:async(id,request)=>{requests.push(request);if(receipts.has(request))return receipts.get(request);assert.equal(id,old.id);owned.push(old);claimed=true;const result={journeys:[...owned]};receipts.set(request,result);if(lose){lose=false;throw Error('REPLY_LOST')}return result}}});
 await m.connect();await m.claimLegacy(false);assert.equal(requests.length,0);await m.claimLegacy(true);assert.equal(m.view.legacy?.id,old.id);await m.claimLegacy(true);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);assert.equal(owned.length,2);assert.equal(m.view.selected,undefined);assert.equal(m.choose(old.id),true);assert.equal((m.view.selected as Journey|undefined)?.version,7);assert.equal(owned[0].version,12);
});
test('late claim after switching account cannot write selection or display another account journey',async()=>{
 let account='A';const wait=deferred<any>(),s=storage();const m=new AccountJourneyLink({gameId:game,identity:()=>({account}),storage:s,readHint:async()=>({kind:'unavailable'}),authority:{list:async()=>({journeys:[],legacy:old}),claim:()=>wait.promise}});
 await m.connect();const claim=m.claimLegacy(true);account='B';wait.resolve({journeys:[old]});await claim;assert.equal(m.view.phase,'waiting');assert.equal(m.view.selected,undefined);assert.ok(![...s.map.keys()].some(k=>k.endsWith(':selection')));
});

test('optional cloud hint failure does not block the existing authoritative directory',async()=>{const m=new AccountJourneyLink({gameId:game,identity:()=>({account:'A'}),storage:storage(),readHint:async()=>{throw Error('BRIDGE_OFFLINE')},authority:{list:async()=>({journeys:[one]}),claim:async()=>{throw Error('NO')}}});const view=await m.connect();assert.equal(view.phase,'choose');assert.equal(view.hint?.kind,'unavailable');assert.equal(m.choose(one.id),true)});
