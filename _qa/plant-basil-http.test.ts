import {test} from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {makeDemoServer} from './temporary-account-server';import {createRuntime} from '../server/runtime';import {createHarborLife} from '../server/life-assembly';import {withBasilPlantUses} from '../server/plant-basil';import {initial} from '../src/story/state';import {rooms} from '../src/world/data';import {GAME_UUID} from '../src/game-id';
test('basil through actual combined account HTTP/SQLite: original plants/animals DTO, delivery replay, second browser denied',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'basil-owner-http-'));let modelCalls=0;
 const life=withBasilPlantUses(createHarborLife({...createRuntime(async()=>{modelCalls++;throw Error('MODEL_FORBIDDEN')}),initial:(l:any,id:string)=>({...initial(l,id),scene:'cafe',position:rooms.cafe.spawn,known:['theo'],visited:Object.keys(rooms),flags:['key','unpacked'],items:{'crop-basil':3}})}));
 const server=await makeDemoServer({directory:dir,providedRuntime:life.runtime,lifeProject:life.lifeProject,landProject:life.landProject}),base=server.url+'/'+GAME_UUID+'/api';
 try{
  const boot=await fetch(base+'/bootstrap',{method:'POST'}),cookie=boot.headers.get('set-cookie')!.split(';')[0];
  const req=(path:string,body?:unknown,c=cookie)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:c,'X-Harbor-Game':GAME_UUID,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let s=await(await req('/sessions',{enrollment_id:randomUUID(),locale:'en'})).json();const e=rooms.cafe.entities.find(e=>e.id==='theo')!;
  const action=(verb:string)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:e.approach,target:e.id,action:'plant-use:'+verb});
  for(const v of ['read-offer','accept-basil']){const r=await req('/sessions/'+s.id+'/action',action(v));assert.equal(r.status,200);s=(await r.json()).head}
  const before=structuredClone(s),view=await(await req('/sessions/'+s.id+'/life')).json();assert.equal(view.animals.schema,1);assert.equal(view.plants.newStarts,true);assert.equal(view.plantUses.mintEnabled,false);assert.equal(view.plantUses.order.reward,7);assert.deepEqual(await(await req('/sessions/'+s.id)).json(),before);
  const deliver=action('deliver-basil');const first=await req('/sessions/'+s.id+'/action',deliver);assert.equal(first.status,200);s=(await first.json()).head;assert.equal(s.cash,32);assert.equal(s.items['crop-basil'],1);
  assert.equal((await req('/sessions/'+s.id+'/action',deliver)).status,200);assert.deepEqual(await(await req('/sessions/'+s.id)).json(),s);
  const mint={...action('observe-mint'),expected_version:s.version};assert.equal((await(await req('/sessions/'+s.id+'/action',mint)).json()).error,'MINT_CONTENT_CLOSED');assert.deepEqual(await(await req('/sessions/'+s.id)).json(),s);
  const other=await fetch(base+'/bootstrap',{method:'POST'}),otherCookie=other.headers.get('set-cookie')!.split(';')[0];assert.notEqual((await req('/sessions/'+s.id,undefined,otherCookie)).status,200);assert.equal(modelCalls,0);
 }finally{await server.close();rmSync(dir,{recursive:true,force:true})}
});
