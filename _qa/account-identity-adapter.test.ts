import {test} from 'node:test';import assert from 'node:assert/strict';
// @ts-expect-error isolated Worker candidate
import {createAccountIdentityAdapter} from '../worker/account-identity.js';
import {AccountJourneyLink} from '../src/account-link/core';
const gameId='e78df027-7ef4-4d49-82eb-ea91f03d9fb3';
test('account adapter is disabled by default and never calls trusted dependency',async()=>{let calls=0;const adapter=createAccountIdentityAdapter({gameId,readVerifiedContext:async()=>{calls++;return null}});await assert.rejects(adapter(new Request('https://fixture.invalid/api/sessions')),/ACCOUNT_ADAPTER_DISABLED/);assert.equal(calls,0)});
test('adapter requires trusted context each request; stable same account, scoped different account, no body identity fallback',async()=>{
 let trusted:any={gameId,namespace:'fixture-platform',subject:'A'},calls=0;
 const adapter=createAccountIdentityAdapter({enabled:true,gameId,readVerifiedContext:async()=>{calls++;return trusted}});
 const request=()=>new Request('https://fixture.invalid/api/sessions?user_id=B',{method:'POST',body:JSON.stringify({user_id:'B',owner:'fake'})});
 const a=await adapter(request()),a2=await adapter(request());assert.deepEqual(a,a2);
 trusted={...trusted,subject:'B'};assert.notEqual((await adapter(request())).owner,a.owner);
 trusted=null;await assert.rejects(adapter(request()),/PLATFORM_IDENTITY_REQUIRED/);
 trusted={gameId:'other',namespace:'fixture-platform',subject:'A'};await assert.rejects(adapter(request()),/PLATFORM_IDENTITY_REQUIRED/);
 await assert.rejects(createAccountIdentityAdapter({enabled:true,gameId})(request()),/PLATFORM_CONTEXT_UNAVAILABLE/);assert.equal(calls,5);
});
test('default client candidate goes directly to authority with cloud hint omitted',async()=>{
 let calls=0;const link=new AccountJourneyLink({gameId,identity:()=>({account:'fixture-A'}),storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},authority:{list:async()=>{calls++;return {journeys:[]}},claim:async()=>{throw Error('not used')}}});
 assert.equal((await link.connect()).phase,'choose');assert.equal(calls,1);
});
