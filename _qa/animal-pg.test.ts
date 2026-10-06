import test from 'node:test';import assert from 'node:assert/strict';import {Pool} from 'pg';import {randomUUID} from 'node:crypto';
import {runtime} from '../server/runtime';import {initial,type Save} from '../src/story/state';import {GAME_UUID} from '../src/game-id';import {acceptedAnimals} from '../src/animals/art';import {createAnimalRuntime} from '../src/animals/behavior';import {gameAnimalContext} from '../src/animals/game';
// @ts-expect-error frozen runtime
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
// @ts-expect-error frozen runtime
import {initializeAsyncAuthoritySchema,openPgAuthorityStore,AsyncSessionAuthority} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL;if(!raw)throw Error('ACTUAL_PG_QA_URL_REQUIRED');const url=new URL(raw);if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/harbor_account_qa_[a-z0-9_]+$/.test(url.pathname))throw Error('LOCAL_QA_ONLY');
test('actual PG animal action: two connections CAS, same receipt replay, reopen, separate owner and unchanged prior story',async()=>{
 const pool=new Pool({connectionString:raw}),schema='kit_animals_qa_'+randomUUID().replaceAll('-','').slice(0,16),options={pool,schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};let a:any,b:any;
 try{const client=await pool.connect();try{await initializeCandidateSchema(client,options);await initializeAsyncAuthoritySchema(client,options);await registerCandidateWorld(client,options)}finally{client.release()}
 a=await openPgAuthorityStore(options);b=await openPgAuthorityStore(options);
 const seeded={...runtime,initial:(l:any,id:string)=>({...initial(l,id),townMinutes:780,position:{x:748,y:670},flags:['key','unpacked','neighbors2:mira:done'],relations:{mira:1},items:{'crop-radish':2,key:1}})};let aa=new AsyncSessionAuthority(a,seeded),bb=new AsyncSessionAuthority(b,runtime),s:Save=await aa.create('synthetic-A',randomUUID(),'en');
 const foot=createAnimalRuntime(acceptedAnimals).tick(0,gameAnimalContext(s,s.position)).find(a=>a.id==='harbor-cat-1')!.foot;
 const cmd={action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:{x:foot.x-8,y:foot.y+34},target:'harbor-cat-1',action:'animal-pet',actorPosition:foot},other={...cmd,action_id:randomUUID()};
 const concurrent=await Promise.allSettled([aa.action('synthetic-A',s.id,cmd),bb.action('synthetic-A',s.id,other)]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);const winner=concurrent[0].status==='fulfilled'?cmd:other;
 await aa.action('synthetic-A',s.id,winner);s=await bb.get('synthetic-A',s.id);assert.equal(s.version,1);assert.equal(s.history.length,1);assert.equal(s.animalsV1!.individuals['harbor-cat-1'].familiarity,1);assert.equal(s.items['crop-radish'],2);assert.equal(s.relations.mira,1);assert.equal(s.townMinutes,780);
 await a.close();a=await openPgAuthorityStore(options);aa=new AsyncSessionAuthority(a,runtime);assert.deepEqual(await aa.get('synthetic-A',s.id),s);await assert.rejects(bb.get('synthetic-B',s.id),/SESSION_NOT_FOUND/);
 }finally{await a?.close();await b?.close();await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end()}
});
