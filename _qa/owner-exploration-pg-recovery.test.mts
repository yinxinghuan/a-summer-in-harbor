import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
// @ts-expect-error frozen PG authority
import {initializeAsyncAuthoritySchema,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
// @ts-expect-error frozen PG adapter
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeDemoServer} from './temporary-account-server';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';
import {pinLegacy,addLot} from '../src/life/save';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {activePlayActionId} from '../src/candidate/active-play-types';

test('owner PG16.15 recovery: default autovacuum reuse, concurrent replay, retired receipt and restart without catchup',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-exploration-owner-'));let now=100000,models=0;
 const registry=createPlantsRegistry();
 const assembly=createExplorationAssembly({now:()=>now,boot:'owner-local-only',resolveDialogue:async()=>{models++;throw Error('MODEL_FORBIDDEN')},initial:(locale:any,id:string)=>{
  const s=pinLegacy({...initial(locale,id),scene:'courtyard',position:{x:280,y:622},known:['mara'],flags:['key','unpacked','garden-agreed','alternative-route'],visited:Object.keys(rooms),landV1:{schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'fixture-permission',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},minute:540,sourceAction:'fixture-bed'}]}},registry);
  addLot(s,registry,snapPeaV2Ref,'seed',1,'fixture-seed');return s;
 }});
 const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL!;const url=new URL(raw);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55439');assert.equal(url.pathname,'/harbor_account_qa_20261005');
 const pool=new Pool({connectionString:raw,max:8}),schema='kit_active_owner_'+randomUUID().replaceAll('-','').slice(0,16),options={pool,schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
 const conn=await pool.connect();try{await initializeCandidateSchema(conn,options);await initializeAsyncAuthoritySchema(conn,options);await registerCandidateWorld(conn,options)}finally{conn.release()}
 const pgStore=await openPgAuthorityStore(options);
 let server=await makeDemoServer({directory,providedStore:pgStore,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
 let base=server.url+'/'+GAME_UUID+'/api';
 try{
  const bootstrap=async()=>{const r=await fetch(base+'/bootstrap',{method:'POST'});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]};
  const cookie=await bootstrap(),client=randomUUID();
  const req=async(path:string,body?:any,cap=cookie)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cap,'Content-Type':'application/json','X-Harbor-Game':GAME_UUID},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()}};
  let head=(await req('/sessions',{enrollment_id:randomUUID(),locale:'en'})).body;
  const get=async()=>{head=(await req('/sessions/'+head.id)).body;return head};
  const active=(action='candidate-active-tick')=>{const clock=head.activePlayClock,last=clock?.transport?.last.ack;return {action_id:activePlayActionId(head.id,(last?.ordinal??0)+1),expected_version:head.version,scene:head.scene,position:head.position,target:'',action,payload:{ordinal:(last?.ordinal??0)+1,previous:last?.token??'',client,...(action==='candidate-active-open'?{}:{lease:clock?.lease?.id,sequence:(clock?.lease?.sequence??0)+1,activeMs:Math.min(3000,now-(clock?.lease?.lastAt??now))})}}};
  const play=async(a=active())=>{const r=await req('/sessions/'+head.id+'/active-play',a);assert.equal(r.status,200,JSON.stringify(r.body));await get();return r.body};
  const eventsBefore=(await req('/sessions/'+head.id+'/events?after=0')).body;
  await play(active('candidate-active-open'));now+=2000;const tick=active(),ack=await play(tick);
  assert.equal(head.activePlayClock.remainderMs,2000);assert.equal(head.townMinutes,540);
  assert.deepEqual((await req('/sessions/'+head.id+'/active-play',tick)).body,ack);
  assert.deepEqual((await req('/sessions/'+head.id+'/events?after=0')).body,eventsBefore);
  assert.deepEqual((await req('/sessions/'+head.id+'/life')).body.plants.plots[0].at,{x:288,y:604});
  const before=structuredClone(head);for(let i=0;i<3;i++){assert.equal((await req('/sessions/'+head.id+'/life')).status,200);assert.equal((await req('/sessions/'+head.id+'/land-preview?region=courtyard-common&x=288&y=604')).status,200)}assert.deepEqual(await get(),before);
  const other=await bootstrap();for(const path of ['/sessions/'+head.id,'/sessions/'+head.id+'/life','/sessions/'+head.id+'/land-preview?region=courtyard-common'])assert.notEqual((await req(path,undefined,other)).status,200);
  assert.notEqual((await req('/sessions/'+head.id+'/active-play',active(),other)).status,200);assert.deepEqual(await get(),before);
  now+=2000;
  const plant={action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target:'land-bed-1',action:'life:plant',payload:{command:{verb:'plant',ref:snapPeaV2Ref,plot:'life-bed-1'}},activePlay:{client,lease:head.activePlayClock.lease.id,activeMs:2000}};
  const result=await req('/sessions/'+head.id+'/action',plant);assert.equal(result.status,200,JSON.stringify(result.body));await get();
  assert.equal(head.townMinutes,551);assert.equal(head.energy,98);assert.equal(head.items['life-seed:snap-pea'],0);assert.deepEqual(head.lifeV1.plots['life-bed-1'].ref,snapPeaV2Ref);
  assert.equal(head.activePlayClock.lease,undefined);assert.equal(head.activePlayClock.remainderMs,0);
  assert.deepEqual((await req('/sessions/'+head.id+'/action',plant)).body,result.body);const after=structuredClone(head);assert.deepEqual(await get(),after);
  const view=(await req('/sessions/'+head.id+'/life')).body;assert.equal(view.snapshotVersion,head.version);assert.equal(view.plants.plots[0].status.ref.revision,2);
  await play(active('candidate-active-open'));now+=1000;const rejected={...plant,action_id:randomUUID(),expected_version:head.version,action:'life:harvest',payload:{command:{verb:'harvest',plot:'life-bed-1'}},activePlay:{client,lease:head.activePlayClock.lease.id,activeMs:1000}};
  const rejectedBefore=structuredClone(head),failure=await req('/sessions/'+head.id+'/action',rejected);assert.equal(failure.body.error,'CROP_NOT_READY');assert.equal(failure.body.terminal,true);assert.deepEqual(await get(),rejectedBefore);
  const tables=async()=>{const rows=(await pool.query('select table_name from information_schema.tables where table_schema=$1 order by table_name',[schema])).rows;const out:any={};for(const {table_name:name} of rows){assert.match(name,/^[a-z_]+$/);out[name]=(await pool.query(`select count(*)::int as count,pg_total_relation_size('"${schema}"."${name}"')::int as bytes from "${schema}"."${name}"`)).rows[0]}return out};
  const stats=async()=>(await pool.query(`select c.relname,pg_total_relation_size(c.oid)::int as bytes,s.n_dead_tup::int,s.autovacuum_count::int,s.last_autovacuum::text from pg_class c join pg_namespace n on c.relnamespace=n.oid left join pg_stat_all_tables s on s.relid=c.oid where n.nspname=$1 and c.relname='async_journeys'`,[schema])).rows[0];
  const beforeLoad=await tables(),phases:any[]=[],ackSizes:number[]=[];
  let retired:any,lastRequest:any,lastAck:any;
  const batch=async(count:number)=>{const start=performance.now();for(let i=0;i<count;i++){now+=800;lastRequest=active();const r=await req('/sessions/'+head.id+'/active-play',lastRequest);assert.equal(r.status,200,JSON.stringify(r.body));lastAck=r.body;await get();ackSizes.push(Buffer.byteLength(JSON.stringify(r.body)));if(i===0&&!retired)retired=lastRequest}return {ticks:count,totalMs:performance.now()-start,table:await stats(),tables:await tables()}};
  phases.push(await batch(600));console.log('LOAD600',JSON.stringify(phases.at(-1)));
  const waitStart=Date.now();let recovered=await stats();
  while(recovered.autovacuum_count<1&&Date.now()-waitStart<125000){await new Promise(r=>setTimeout(r,2000));recovered=await stats();if((Date.now()-waitStart)%20000<2500)console.log('AUTOVACUUM_WAIT',JSON.stringify(recovered))}
  assert.ok(recovered.autovacuum_count>=1,'default autovacuum must actually reclaim update tuples');
  console.log('AUTOVACUUM_RECOVERED',JSON.stringify(recovered));
  phases.push(await batch(600));console.log('REUSE600',JSON.stringify(phases.at(-1)));
  assert.ok(phases[1].table.bytes<=phases[0].table.bytes+262144,'second batch must reuse reclaimed storage');
  for(const phase of phases)for(const name of Object.keys(beforeLoad))assert.equal(phase.tables[name].count,beforeLoad[name].count,'compact channel must not append '+name);
  assert.ok(Math.max(...ackSizes)<1024);const frozen=structuredClone(head);
  const twins=await Promise.all([req('/sessions/'+head.id+'/active-play',lastRequest),req('/sessions/'+head.id+'/active-play',lastRequest)]);assert.deepEqual(twins.map(r=>r.status),[200,200]);assert.deepEqual(twins[0].body,lastAck);assert.deepEqual(twins[1].body,lastAck);assert.deepEqual(await get(),frozen);
  assert.equal((await req('/sessions/'+head.id+'/active-play',{...lastRequest,payload:{...lastRequest.payload,activeMs:799}})).body.error,'ACTION_ID_CONFLICT');
  assert.equal((await req('/sessions/'+head.id+'/active-play',retired)).body.error,'ACTIVE_RECEIPT_RETIRED');assert.deepEqual(await get(),frozen);
  await server.close();now+=86400000;
  const restart=createExplorationAssembly({now:()=>now,boot:'owner-restart-only',resolveDialogue:async()=>{models++;throw Error('MODEL_FORBIDDEN')}});
  const restartedStore=await openPgAuthorityStore(options);server=await makeDemoServer({directory,providedStore:restartedStore,providedRuntime:restart.runtime,lifeProject:restart.lifeProject,landProject:restart.landProject,decorateAuthority:restart.decorateAuthority});base=server.url+'/'+GAME_UUID+'/api';
  assert.deepEqual(await get(),frozen,'restart GET must preserve head');assert.deepEqual((await req('/sessions/'+head.id+'/active-play',lastRequest)).body,lastAck,'last receipt survives restart');
  assert.equal((await req('/sessions/'+head.id+'/active-play',active())).body.error,'ACTIVE_LEASE_EXPIRED');await play(active('candidate-active-open'));assert.equal(head.townMinutes,frozen.townMinutes,'no restart/offline catchup');
  assert.notEqual((await req('/sessions/'+head.id+'/active-play',lastRequest,other)).status,200);
  const summary={scope:'local isolated official PG16.15; default autovacuum, 1200 logical ticks, no manual VACUUM/production writes',schema,beforeLoad,phases,recovered,autovacuumWaitMs:Date.now()-waitStart,maxAckBytes:Math.max(...ackSizes),raceReplay:true,retiredRejects:true,restartExactReceipt:true,noOfflineCatchup:true,models};
  writeFileSync('../evidence/owner-active-pg-recovery.json',JSON.stringify(summary,null,2)+'\n');console.log('PASS_RECOVERY',JSON.stringify(summary));
  assert.equal(models,0);
 }finally{await server.close();await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();rmSync(directory,{recursive:true,force:true})}
});
