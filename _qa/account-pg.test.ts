/** Prepared actual-PG matrix. Refuses absent/non-loopback/non-QA database URLs.
 * Never substitutes SQLite/PGlite and never reads production config. */
import {test} from 'node:test';import assert from 'node:assert/strict';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
// @ts-expect-error local candidate
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
// @ts-expect-error local candidate
import {initializeAsyncAuthoritySchema,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
// @ts-expect-error local candidate
import {createAccountJourneyService} from '../server/account-journeys.mjs';
import {runtime} from '../server/runtime';import {makeDemoServer} from './temporary-account-server';import {GAME_UUID} from '../src/game-id';
const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL;
if(!raw)throw Error('ACTUAL_PG_QA_URL_REQUIRED: unrun, not a passing or skipped test');const url=new URL(raw);
if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/harbor_account_qa_[a-z0-9_]+$/.test(url.pathname))throw Error('DEDICATED_LOOPBACK_QA_DATABASE_REQUIRED');
async function fixture(){
 const pool=new Pool({connectionString:raw,max:8}),schema='kit_account_qa_'+randomUUID().replaceAll('-','').slice(0,16),options={pool,schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
 const admin=await pool.connect();try{await initializeCandidateSchema(admin,options);await initializeAsyncAuthoritySchema(admin,options);await registerCandidateWorld(admin,options)}finally{admin.release()}
 const a=await openPgAuthorityStore(options),b=await openPgAuthorityStore(options);const resolveActor=async(actor:any)=>actor;
 const browser={kind:'browser',owner:'c'.repeat(64),gameId:GAME_UUID,assertCurrent:async()=>{}};const account=(id:string)=>({kind:'account',owner:id.repeat(64),browserOwner:browser.owner,gameId:GAME_UUID,assertCurrent:async()=>{}});
 const make=(store:any)=>createAccountJourneyService({enabled:true,store,runtime,resolveActor});
 return{pool,schema,options,a,b,browser,account,make,async done(){await a.close();await b.close();await pool.query(`DROP SCHEMA "${schema}" CASCADE`);await pool.end()}};
}
const claim=(journey:string)=>({journey,requestId:randomUUID(),confirmed:true});
test('actual PG: two-table migration preserves legacy head; idempotent DDL and reopen',async()=>{const f=await fixture();try{
 const s=await f.make(f.a).create(f.browser,randomUUID(),'en');await f.pool.query(`DROP TABLE "${f.schema}".async_account_claims, "${f.schema}".async_account_bindings`);
 const admin=await f.pool.connect();try{await initializeAsyncAuthoritySchema(admin,f.options);await initializeAsyncAuthoritySchema(admin,f.options)}finally{admin.release()}
 assert.deepEqual(await f.make(f.b).get(f.browser,s.id),s);const cols=await f.pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name IN ($2,$3)',[f.schema,'async_account_claims','async_account_bindings']);assert.equal(cols.rowCount,2);
 const cmd=claim(s.id),r=await f.make(f.a).claim(f.account('a'),cmd);const reopened=await openPgAuthorityStore(f.options);try{assert.deepEqual(await f.make(reopened).claim(f.account('a'),cmd),r);assert.deepEqual(await f.make(reopened).get(f.account('a'),s.id),s)}finally{await reopened.close()}
 }finally{await f.done()}});
test('actual PG: competing independent handles yield one claim winner, repeated receipt is stable',async()=>{const f=await fixture();try{
 const sa=f.make(f.a),sb=f.make(f.b),s=await sa.create(f.browser,randomUUID(),'en');const cmds=[claim(s.id),claim(s.id)];const results=await Promise.allSettled([sa.claim(f.account('a'),cmds[0]),sb.claim(f.account('b'),cmds[1])]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&/CLAIM_CONFLICT/.test(String(x.reason))).length,1);
 const winner=results[0].status==='fulfilled'?0:1,who=f.account(winner?'b':'a');const repeats=await Promise.all([sa.claim(who,cmds[winner]),sb.claim(who,cmds[winner])]);assert.deepEqual(repeats[0],repeats[1]);await assert.rejects(sa.get(f.browser,s.id),/SESSION_NOT_FOUND/);
 }finally{await f.done()}});
test('actual PG: binding and receipt failure roll back atomically',async()=>{const f=await fixture();try{
 const normal=f.make(f.a),s=await normal.create(f.browser,randomUUID(),'en'),cmd=claim(s.id);const broken={...f.a,transaction:(work:any)=>f.a.transaction((r:any)=>work({...r,addAccountClaim:async()=>{throw Error('INJECTED_RECEIPT_FAILURE')}}))};
 await assert.rejects(f.make(broken).claim(f.account('a'),cmd),/INJECTED_RECEIPT_FAILURE/);assert.equal(await f.b.transaction((r:any)=>r.accountBinding(s.id)),undefined);assert.equal(await f.b.transaction((r:any)=>r.accountClaim(f.account('a').owner,cmd.requestId)),undefined);assert.deepEqual(await normal.get(f.browser,s.id),s);
 }finally{await f.done()}});
function device(base:string,id?:string){let cookie='';return{setId:(v?:string)=>id=v,async call(path:string,body?:unknown){const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'X-Harbor-Game':GAME_UUID,...(id?{'X-Harbor-Telegram-Id':id,'X-Harbor-Identity-Mode':'temporary-unverified'}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return{status:r.status,data:await r.json()}}}}
test('actual HTTP/PG: same-ID two cookies, different-ID isolation, claim and sidecar revocation',async()=>{const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'harbor-account-pg-'));let server:any;try{
 server=await makeDemoServer({directory:dir,providedStore:f.a});const a=device(server.url,'100001'),a2=device(server.url,'100001'),b=device(server.url,'100002'),old=device(server.url);for(const d of[a,a2,b,old])await d.call('/bootstrap',{});
 const s=(await a.call('/sessions',{enrollment_id:randomUUID(),locale:'en'})).data;assert.equal((await a2.call('/sessions/'+s.id)).status,200);assert.equal((await b.call('/sessions/'+s.id)).status,404);assert.equal((await b.call('/sessions/'+s.id+'/media/workshop-annex-1')).status,404);
 const legacy=(await old.call('/sessions',{enrollment_id:randomUUID(),locale:'en'})).data;old.setId('100001');assert.deepEqual((await old.call('/sessions')).data.map((x:any)=>x.id),[s.id]);assert.equal((await old.call('/account/claim',claim(legacy.id))).status,200);assert.equal((await a2.call('/sessions/'+legacy.id)).status,200);old.setId(undefined);assert.equal((await old.call('/sessions/'+legacy.id)).status,404);assert.equal((await old.call('/sessions/'+legacy.id+'/media/workshop-annex-1')).status,404);assert.equal((await b.call('/sessions/'+legacy.id)).status,404);
 }finally{await server?.close();await f.done();rmSync(dir,{recursive:true,force:true})}});
