import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool} from 'pg';
import {makeDemoServer} from './temporary-account-server';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {withBasilPlantUses} from '../server/plant-basil';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';
import {activePlayActionId} from '../src/candidate/active-play-types';
import {createLifeProjection,lifeProjectionKey} from '../src/candidate/life-projection';
// @ts-expect-error frozen PG authority
import {initializeAsyncAuthoritySchema,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
// @ts-expect-error frozen PG adapter
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';

for(const backend of process.env.HARBOR_ACCOUNT_QA_PG_URL?['pg']:['sqlite'])test(`owner basil final assembly/${backend}: account HTTP, active settlement, boundaries, race/replay and closed reader restart`,async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-basil-owner-'));let now=100000,models=0,seed:any,starts=true;
 const theo=rooms.cafe.entities.find(e=>e.id==='theo')!;
 const factory=()=>createExplorationAssembly({now:()=>now,boot:'basil-owner-only',resolveDialogue:async()=>{models++;throw Error('MODEL_FORBIDDEN')},decorateLife:(r:any)=>withBasilPlantUses(r,{enabled:starts,newStarts:starts}),initial:(locale:any,id:string)=>({...initial(locale,id),scene:'cafe',position:theo.approach,known:['theo'],visited:Object.keys(rooms),flags:['key','unpacked'],items:{'crop-basil':3},...structuredClone(seed??{}),id,version:0,cursor:0,history:[],activePlayClock:undefined})});
 let pool:Pool|undefined,options:any,schema:string|undefined;
 if(backend==='pg'){
  const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL!,u=new URL(raw);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55439');assert.equal(u.pathname,'/harbor_account_qa_20261005');
  pool=new Pool({connectionString:raw,max:8});schema='kit_basil_owner_'+randomUUID().replaceAll('-','').slice(0,16);options={pool,schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
  const c=await pool.connect();try{await initializeCandidateSchema(c,options);await initializeAsyncAuthoritySchema(c,options);await registerCandidateWorld(c,options)}finally{c.release()}
 }
 const start=async()=>{const a=factory();return makeDemoServer({directory,providedStore:pool?await openPgAuthorityStore(options):undefined,providedRuntime:a.runtime,lifeProject:a.lifeProject,landProject:a.landProject,decorateAuthority:a.decorateAuthority})};
 let server=await start(),base=server.url+'/'+GAME_UUID+'/api',cookie='',s:any;const client=randomUUID(),cases:any[]=[];
 try{
  const bootstrap=async()=>{const r=await fetch(base+'/bootstrap',{method:'POST'});assert.equal(r.status,200);return r.headers.get('set-cookie')!.split(';')[0]};cookie=await bootstrap();
  const req=async(path:string,body?:any,cap=cookie)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cap,'Content-Type':'application/json','X-Harbor-Game':GAME_UUID},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()}};
  const get=async()=>{const r=await req('/sessions/'+s.id);assert.equal(r.status,200,JSON.stringify(r.body));s=r.body;return s};
  const create=async(value?:any)=>{seed=value;const r=await req('/sessions',{enrollment_id:randomUUID(),locale:'en'});assert.equal(r.status,200,JSON.stringify(r.body));s=r.body;return s};
  const action=(verb:string)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:verb==='close-basil'?'life-bag':'theo',action:'plant-use:'+verb,activePlay:s.activePlayClock?.lease?{client,lease:s.activePlayClock.lease.id,activeMs:Math.min(3000,now-s.activePlayClock.lease.lastAt)}:{}});
  const command=async(verb:string)=>{const a=action(verb),r=await req('/sessions/'+s.id+'/action',a);assert.equal(r.status,200,JSON.stringify(r.body));s=r.body.head;return {a,r}};
  const play=async(kind='candidate-active-tick',advance=0)=>{now+=advance;const last=s.activePlayClock?.transport?.last.ack,l=s.activePlayClock?.lease,ordinal=(last?.ordinal??0)+1,a={action_id:activePlayActionId(s.id,ordinal),expected_version:s.version,scene:s.scene,position:s.position,target:'',action:kind,payload:{client,ordinal,previous:last?.token??'',...(kind==='candidate-active-open'?{}:{lease:l?.id,sequence:(l?.sequence??0)+1,activeMs:Math.min(3000,now-(l?.lastAt??now))})}};const r=await req('/sessions/'+s.id+'/active-play',a);assert.equal(r.status,200,JSON.stringify(r.body));await get();return {a,r}};
  await create();await command('read-offer');await command('accept-basil');const accepted=structuredClone(s);
  const view=(await req('/sessions/'+s.id+'/life')).body;assert.equal(view.animals.schema,1);assert.equal(view.plants.newStarts,true);assert.equal(view.plantUses.mintEnabled,false);assert.equal(view.plantUses.order.reward,7);assert.deepEqual(await get(),accepted);
  await play('candidate-active-open');await play('candidate-active-tick',2000);now+=2000;
  const delivery=action('deliver-basil'),twin={...delivery,action_id:randomUUID()},race=await Promise.all([req('/sessions/'+s.id+'/action',delivery),req('/sessions/'+s.id+'/action',twin)]);assert.equal(race.filter(r=>r.status===200).length,1,JSON.stringify(race));const win=race[0].status===200?delivery:twin,winner=race.find(r=>r.status===200)!;await get();
  assert.equal(s.townMinutes,541);assert.equal(s.cash,32);assert.equal(s.items['crop-basil'],1);assert.equal(s.relations.theo,2);assert.equal(s.plantUsesV1.deliveries,1);assert.equal(s.activePlayClock.lease,undefined);const delivered=structuredClone(s);
  assert.deepEqual(await req('/sessions/'+s.id+'/action',win),winner);assert.deepEqual(await get(),delivered);cases.push('one CAS delivery; natural 1m; exact receipt replay');
  for(const verb of ['observe-mint','made-up']){const before=structuredClone(s),r=await req('/sessions/'+s.id+'/action',action(verb));assert.deepEqual(r,{status:409,body:{error:verb==='observe-mint'?'MINT_CONTENT_CLOSED':'INVALID_PLANT_USE_COMMAND',terminal:true}});assert.deepEqual(await get(),before)}cases.push('mint/invalid pre-validation is terminal; head unchanged');
  const other=await bootstrap();for(const path of ['/sessions/'+s.id,'/sessions/'+s.id+'/life'])assert.notEqual((await req(path,undefined,other)).status,200);assert.notEqual((await req('/sessions/'+s.id+'/action',action('recall-delivery'),other)).status,200);assert.deepEqual(await get(),delivered);cases.push('different normal browser cookie denied');
  for(const [name,patch,expected] of [['natural-close',{townMinutes:1019},'PERSON_AWAY'],['due-close',{townMinutes:3899},'PERSON_AWAY'],['full-purse',{cash:993},'PURSE_FULL']] as const){
   await create({...accepted,...patch});await play('candidate-active-open');await play('candidate-active-tick',2000);const before=structuredClone(s);now+=2000;const r=await req('/sessions/'+s.id+'/action',action('deliver-basil'));assert.deepEqual(r,{status:409,body:{error:expected,terminal:true}});assert.deepEqual(await get(),before);cases.push(name+' atomically preserves goods/cash/order/clock');
   if(name==='due-close'){await play('candidate-active-tick');assert.equal(s.townMinutes,3900);const old=s.cash;await command('close-basil');assert.equal(s.cash,old);assert.equal(s.items['crop-basil'],3);assert.equal(s.lifeV1.cooldownUntil,6780);assert.equal(s.plantUsesV1.order,undefined)}
  }
  await create(accepted);const pending=structuredClone(s);await server.close();starts=false;server=await start();base=server.url+'/'+GAME_UUID+'/api';assert.deepEqual(await get(),pending);const disabled=(await req('/sessions/'+s.id+'/life')).body;assert.equal(disabled.plantUses.basilEnabled,false);assert.equal(disabled.plantUses.mintEnabled,false);
  const stopped=await req('/sessions/'+s.id+'/action',action('read-offer'));assert.deepEqual(stopped,{status:409,body:{error:'PLANT_USES_CLOSED',terminal:true}});assert.deepEqual(await get(),pending);await command('deliver-basil');assert.equal(s.cash,32);assert.equal(s.items['crop-basil'],1);cases.push('restart closed starts keeps accepted order readable/deliverable');
  assert.equal(models,0);writeFileSync(`../evidence/owner-basil-${backend}.json`,JSON.stringify({backend,cases,models,finalCash:s.cash,schema,productionWrites:0},null,2)+'\n');
 }finally{await server.close();if(pool){await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end()}rmSync(directory,{recursive:true,force:true})}
});

test('owner basil semantic projection holds original DTO while new order read is delayed, then resumes only current actions',async()=>{
 const assembly=createExplorationAssembly({decorateLife:(r:any)=>withBasilPlantUses(r)}),s:any={...initial('en',randomUUID()),scene:'cafe',position:rooms.cafe.entities.find(e=>e.id==='theo')!.approach,known:['theo'],visited:Object.keys(rooms),flags:['key','unpacked'],items:{'crop-basil':3}};
 let release!:()=>void,reads=0,delay=false;const c=createLifeProjection(async(h:any)=>{reads++;if(delay)await new Promise<void>(r=>release=r);return assembly.lifeProject(h)});
 c.update(s,'normal-browser','basil-owner');await c.settled();const original=c.present().view!;
 const harmless={...s,version:1,cursor:1};c.update(harmless,'normal-browser','basil-owner');assert.equal(c.present().current,true);assert.equal(c.present().view,original);assert.equal(original.snapshotVersion,0);
 const changed=(await assembly.runtime.prepare(harmless,{action_id:randomUUID(),expected_version:1,scene:s.scene,position:s.position,target:'theo',action:'plant-use:read-offer'})).head;assert.notEqual(lifeProjectionKey(changed),lifeProjectionKey(harmless));
 delay=true;c.update(changed,'normal-browser','basil-owner');assert.equal(c.present().current,false);assert.equal(c.present().view,original);assert.equal(original.snapshotVersion,0);await Promise.resolve();release();await c.settled();assert.equal(c.present().current,true);assert.equal(c.present().view!.snapshotVersion,changed.version);assert.equal(reads,2);c.dispose();
});
