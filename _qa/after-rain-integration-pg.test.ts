import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {afterRainSeed,afterRainAssembly,afterRainAction} from './after-rain-integration-fixture';
import {activePlayActionId,applyActivePlayAck} from '../src/candidate/active-play-types';
// @ts-expect-error fixed authority
import {AsyncSessionAuthority,initializeAsyncAuthoritySchema,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
// @ts-expect-error fixed PG adapter
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
async function fixture(run:(f:any)=>Promise<void>){
 const raw=process.env.HARBOR_AFTER_RAIN_QA_PG_URL;if(!raw)throw Error('ISOLATED_AFTER_RAIN_PG_REQUIRED');const url=new URL(raw);
 assert.equal(url.hostname,'127.0.0.1');assert.match(url.pathname,/^\/harbor_account_qa_after_rain_[a-f0-9]{8}$/);assert.equal(url.username,'harbor_after_rain_qa');assert.equal(url.password,'');
 const pool=new Pool({connectionString:raw,max:6}),schema='kit_after_rain_qa_'+randomUUID().replaceAll('-','').slice(0,16),opts={pool,schema,worldId:randomUUID(),gameId:'after-rain-local-only',environment:'test'};
 const client=await pool.connect();try{await initializeCandidateSchema(client,opts);await initializeAsyncAuthoritySchema(client,opts);await registerCandidateWorld(client,opts)}finally{client.release()}
 let now=100000,models=0;const stores:any[]=[];
 const build=async(options:any={})=>{const store=await openPgAuthorityStore(opts);stores.push(store);const assembly=afterRainAssembly(afterRainSeed(),{now:()=>now,boot:'pg-after-rain',resolveDialogue:async()=>{models++;throw Error('MODELS_CLOSED')},...options});return {store,assembly,authority:assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store)}};
 const fingerprint=async()=>{const rows=(await pool.query('select table_name from information_schema.tables where table_schema=$1 order by table_name',[schema])).rows;return Promise.all(rows.map(async({table_name:t})=>{assert.match(t,/^[a-z_]+$/);return {table:t,...(await pool.query(`select count(*)::int as count,md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) as digest from "${schema}"."${t}" t`)).rows[0]}}))};
 try{await run({build,fingerprint,advance:(ms:number)=>now+=ms});assert.equal(models,0)}finally{for(const s of stores)await s.close();await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end()}
}
test('actual isolated PG full assembly: reads pure; two writers race one CAS; exact replay/reopen/closed compatibility preserve original saves',async()=>fixture(async f=>{
 const on=await f.build(),two=await f.build(),owner=randomUUID(),head=await on.authority.create(owner,randomUUID(),'en');const before=await f.fingerprint();on.assembly.lifeProject(head);assert.deepEqual(await on.authority.get(owner,head.id),head);assert.deepEqual(await f.fingerprint(),before);
 const a=afterRainAction(head,on.assembly),b=afterRainAction(head,on.assembly),race=await Promise.allSettled([on.authority.action(owner,head.id,a),two.authority.action(owner,head.id,b)]);
 assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&/VERSION_CONFLICT/.test(String(r.reason))).length,1);
 const winner=race[0].status==='fulfilled'?a:b,result=(race.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value,n=result.head;
 for(const key of ['plantUsesV1','landV1','lifeV1','items','cash','energy','flags','relations','newsEdition'])assert.deepEqual(n[key],head[key],key);
 assert.equal(n.history.length,1);const committed=await f.fingerprint();assert.deepEqual(await two.authority.action(owner,head.id,winner),result);
 const reopened=await f.build({boot:'pg-reopened'}),closed=await f.build({afterRain:false});assert.deepEqual(await reopened.authority.get(owner,head.id),n);assert.deepEqual(await closed.authority.get(owner,head.id),n);assert.deepEqual(await f.fingerprint(),committed);
 await assert.rejects(two.authority.get('foreign-owner',head.id),/SESSION_NOT_FOUND/);assert.deepEqual(await f.fingerprint(),committed);
}));
test('actual isolated PG original prepared channel fences natural-time writer and commits fixed captured rain talk once after restart',async()=>fixture(async f=>{
 let service=await f.build();const owner=randomUUID(),client=randomUUID();let head=await service.authority.create(owner,randomUUID(),'en');
 const a=afterRainAction(head,service.assembly),p=await service.authority.prepareAction(owner,head.id,a);assert.equal(p.result.head.townMinutes,740);assert.deepEqual(await service.authority.get(owner,head.id),head);
 const open={action_id:activePlayActionId(head.id,1),expected_version:head.version,scene:head.scene,position:head.position,target:'',action:'candidate-active-open',payload:{ordinal:1,previous:'',client}};
 await assert.rejects(service.authority.activePlay(owner,head.id,open),/MOTION_BUSINESS_PREPARED/);f.advance(3600000);service=await f.build({boot:'pg-pending-restart'});
 const r=await service.authority.commitPreparedAction(owner,head.id,a);head=r.head;assert.equal(head.townMinutes,740);assert.equal(head.history.length,1);assert.deepEqual(await service.authority.action(owner,head.id,a),r);
 const ack=await service.authority.activePlay(owner,head.id,{...open,expected_version:head.version});head=applyActivePlayAck(head,ack);assert.equal(head.townMinutes,740);assert.equal(head.history.length,1);
}));
