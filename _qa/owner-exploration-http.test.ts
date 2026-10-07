import test from 'node:test';
import assert from 'node:assert/strict';
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

test('owner final factory/account HTTP: B2 time/action atomicity, pure projections, compact replay and browser isolation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-exploration-owner-'));let now=100000,models=0;
 const registry=createPlantsRegistry();
 const assembly=createExplorationAssembly({now:()=>now,boot:'owner-local-only',resolveDialogue:async()=>{models++;throw Error('MODEL_FORBIDDEN')},initial:(locale:any,id:string)=>{
  const s=pinLegacy({...initial(locale,id),scene:'courtyard',position:{x:280,y:622},known:['mara'],flags:['key','unpacked','garden-agreed','alternative-route'],visited:Object.keys(rooms),landV1:{schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'fixture-permission',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},minute:540,sourceAction:'fixture-bed'}]}},registry);
  addLot(s,registry,snapPeaV2Ref,'seed',1,'fixture-seed');return s;
 }});
 const server=await makeDemoServer({directory,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
 const base=server.url+'/'+GAME_UUID+'/api';
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
  assert.equal(models,0);
 }finally{await server.close();rmSync(directory,{recursive:true,force:true})}
});
