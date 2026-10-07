import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {initial,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';
import {runtime} from '../server/runtime';
import {createLifeRuntime} from '../server/life-runtime';
import {ContentRegistry,snapPeaDefinition} from '../src/life/registry';
import {addLot,pinLegacy} from '../src/life/save';
import type {Command,LifeSave} from '../src/life/types';
// @ts-expect-error pinned runtime has no declaration
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
// @ts-expect-error pinned runtime has no declaration
import {initializeAsyncAuthoritySchema,openPgAuthorityStore,AsyncSessionAuthority} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

// Missing infrastructure is explicitly unrun, never silently PASS or skipped.
const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL;
if(!raw)throw Error('ACTUAL_PG_QA_URL_REQUIRED: B1 PG unrun, not passed');
const url=new URL(raw);
if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/harbor_account_qa_[a-z0-9_]+$/.test(url.pathname))throw Error('LOCAL_QA_ONLY');

test('B1 actual PG: two-connection CAS, same receipt replay, reopen, owner/tenant and rejected-action zero writes',async()=>{
 const pool=new Pool({connectionString:raw}),schema='kit_life_qa_'+randomUUID().replaceAll('-','').slice(0,16),options={pool,schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
 const registry=new ContentRegistry([snapPeaDefinition],new Set(['crop:snap-pea@1'])),ref=registry.ref('crop:snap-pea');let first:any,second:any;
 const rt=createLifeRuntime({...runtime,initial:(locale:any,id:string)=>{const s=pinLegacy({...initial(locale,id),scene:'cafe',position:rooms.cafe.spawn,known:['theo'],flags:['key','unpacked']},registry);addLot(s,registry,ref,'produce',3,'qa-pg-harvest');return s}},registry,{admit:(s,a)=>({scene:s.scene,target:a.target,resident:'theo',premiseRead:true})});
 const action=(s:LifeSave,command:Command):Action=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'qa-theo',action:'life:'+command.verb,payload:{command}});
 try{
  const client=await pool.connect();try{await initializeCandidateSchema(client,options);await initializeAsyncAuthoritySchema(client,options);await registerCandidateWorld(client,options)}finally{client.release()}
  first=await openPgAuthorityStore(options);second=await openPgAuthorityStore(options);let aa=new AsyncSessionAuthority(first,rt),bb=new AsyncSessionAuthority(second,rt),s:LifeSave=await aa.create('synthetic-life-pg-A',randomUUID(),'en');
  await aa.action('synthetic-life-pg-A',s.id,action(s,{verb:'accept-order',ref}));s=await aa.get('synthetic-life-pg-A',s.id);const one=action(s,{verb:'deliver-order'}),two={...one,action_id:randomUUID()};const results=await Promise.allSettled([aa.action('synthetic-life-pg-A',s.id,one),bb.action('synthetic-life-pg-A',s.id,two)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const loser=results.find(r=>r.status==='rejected');assert.ok(loser?.status==='rejected');assert.match(String(loser.reason),/VERSION_CONFLICT/);const winner=results[0].status==='fulfilled'?one:two;
  const committed:LifeSave=await aa.get('synthetic-life-pg-A',s.id);assert.deepEqual([committed.version,committed.cursor,committed.cash,committed.items['life-produce:snap-pea'],committed.relations.theo,committed.items['life-gift:theo-menu'],committed.lifeV1!.events.length],[2,2,35,1,2,1,2]);
  await bb.action('synthetic-life-pg-A',s.id,winner);assert.deepEqual(await aa.get('synthetic-life-pg-A',s.id),committed);await assert.rejects(aa.action('synthetic-life-pg-A',s.id,{...winner,action:'life:close-order',payload:{command:{verb:'close-order'}}}),/ACTION_ID_CONFLICT/);
  const bad=action(committed,{verb:'deliver-order'});await assert.rejects(bb.action('synthetic-life-pg-A',s.id,bad),/ORDER_MISSING/);assert.deepEqual(await aa.get('synthetic-life-pg-A',s.id),committed);await assert.rejects(bb.get('synthetic-life-pg-B',s.id),/SESSION_NOT_FOUND/);
  await second.transaction(async(repo:any)=>{assert.equal((await repo.events(s.id,-1)).length,2);assert.ok(!(await repo.receipt('synthetic-life-pg-A',bad.action_id)))});
  await first.close();first=await openPgAuthorityStore(options);aa=new AsyncSessionAuthority(first,rt);assert.deepEqual(await aa.get('synthetic-life-pg-A',s.id),committed);await aa.action('synthetic-life-pg-A',s.id,winner);assert.deepEqual(await aa.get('synthetic-life-pg-A',s.id),committed);
  await assert.rejects(openPgAuthorityStore({...options,gameId:'wrong-tenant'}),/PG_WORLD_SCOPE_MISMATCH/);
 }finally{await first?.close();await second?.close();await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end()}
});
