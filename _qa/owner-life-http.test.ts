import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeDemoServer} from './temporary-account-server';
import {createHarborLife} from '../server/life-assembly';
import {createRuntime} from '../server/runtime';
import {sampleAnimal} from '../server/animal-life';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';

test('combined account HTTP/SQLite: persisted checkpoint expires sample; pure projections, re-sample/record/replay and second-browser isolation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'harbor-owner-life-http-'));
 let modelCalls=0;
 const a=createHarborLife({...createRuntime(async()=>{modelCalls++;throw Error('MODEL_FORBIDDEN')}),initial:(l:any,id:string)=>({...initial(l,id),scene:'station',townMinutes:540,position:{x:750,y:680},visited:Object.keys(rooms),known:['mara'],flags:['key','unpacked','route-open'],items:{key:1}})});
 const server=await makeDemoServer({directory,providedRuntime:a.runtime,lifeProject:a.lifeProject,landProject:a.landProject}),base=server.url+'/'+GAME_UUID+'/api';
 try{
  const boot=await fetch(base+'/bootstrap',{method:'POST'}),cookie=boot.headers.get('set-cookie')!.split(';')[0];
  const req=(path:string,body?:unknown,c=cookie)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:c,'X-Harbor-Game':GAME_UUID,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let s=await(await req('/sessions',{enrollment_id:randomUUID(),locale:'en'})).json(),p;
  for(let y=680;y<=840&&!p;y+=4)for(let x=720;x<=840;x+=4)try{a.runtime.position(s,{x,y});sampleAnimal(s,'harbor-cat-1',{x,y});p={x,y};break}catch{}
  assert.ok(p);
  const action=(verb:string,position=p)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position,target:'harbor-cat-1',action:'animal-life:'+verb,payload:{command:{verb}}});
  const first=action('sample');assert.equal((await req('/sessions/'+s.id+'/action',first)).status,200);s=await(await req('/sessions/'+s.id)).json();
  const q=structuredClone(s.animalNotebookV1.sample),moved={x:p.x+8,y:p.y};
  assert.equal((await req('/sessions/'+s.id+'/checkpoint',{sceneId:s.scene,expected_version:s.version,position:moved})).status,200);
  const persisted=await(await req('/sessions/'+s.id)).json();assert.equal(persisted.version,s.version);assert.deepEqual(persisted.animalNotebookV1.sample,q);
  const beforeEvents=await(await req('/sessions/'+s.id+'/events?after=0')).json();
  for(let i=0;i<3;i++){const v=await(await req('/sessions/'+s.id+'/life')).json();assert.equal(v.animals.sample,null);assert.equal(v.snapshotVersion,s.version)}
  assert.deepEqual(await(await req('/sessions/'+s.id)).json(),persisted);assert.deepEqual(await(await req('/sessions/'+s.id+'/events?after=0')).json(),beforeEvents);
  assert.equal((await(await req('/sessions/'+s.id+'/action',action('record',moved))).json()).error,'OBSERVATION_STALE');
  assert.deepEqual(await(await req('/sessions/'+s.id)).json(),persisted);
  const again=action('sample');assert.equal((await req('/sessions/'+s.id+'/action',again)).status,200);s=await(await req('/sessions/'+s.id)).json();assert.notEqual(s.animalNotebookV1.sample.sourceAction,q.sourceAction);
  const record=action('record');assert.equal((await req('/sessions/'+s.id+'/action',record)).status,200);const saved=await(await req('/sessions/'+s.id)).json();
  assert.equal(saved.animalNotebookV1.sample,undefined);assert.equal(Object.keys(saved.lifeV1.collections).length,1);assert.deepEqual(saved.items,persisted.items);assert.equal(saved.cash,persisted.cash);
  assert.equal((await req('/sessions/'+s.id+'/action',record)).status,200);assert.deepEqual(await(await req('/sessions/'+s.id)).json(),saved);
  const other=await fetch(base+'/bootstrap',{method:'POST'}),otherCookie=other.headers.get('set-cookie')!.split(';')[0];
  for(const path of ['/sessions/'+s.id,'/sessions/'+s.id+'/life'])assert.notEqual((await req(path,undefined,otherCookie)).status,200);
  assert.equal(modelCalls,0);
 }finally{await server.close();rmSync(directory,{recursive:true,force:true})}
});
