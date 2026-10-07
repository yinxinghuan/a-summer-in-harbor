import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {rooms} from '../src/world/data';
test('retained 7019629 reader and authored action preserve optional new clock heads without database rollback',async()=>{
 const root=process.env.HARBOR_LEGACY_QA_ROOT;if(!root)throw Error('EXPLICIT_LEGACY_QA_ROOT_REQUIRED');
 const {createRuntime:legacyRuntime}=await import(root+'/server/runtime.ts'),{createHarborLife:legacyLife}=await import(root+'/server/life-assembly.ts');
 const assembly=createExplorationAssembly({now:()=>100000,boot:'rollback-fixture'}),old=legacyLife(legacyRuntime()).runtime;
 let s=assembly.runtime.initial('en',randomUUID());const mara=rooms.station.entities.find(e=>e.person==='mara')!;s.position={...mara.approach};
 const intent=(action:string,payload:any)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:s.position,target:'',action,payload});
 s=assembly.motion(s,intent('candidate-clock-enable',{millisecondsPerMinute:4000})).head;
 s=assembly.play.apply(s,intent('candidate-active-open',{client:randomUUID()}));
 old.assertReadable(s);assert.deepEqual(old.upgrade(structuredClone(s)),s);assert.deepEqual(old.position(s,s.position),s.position);
 const result=await old.prepare(s,{...intent('introduce',{}),target:mara.id});
 assert.deepEqual(result.head.movingClock,s.movingClock);assert.deepEqual(result.head.activePlayClock,s.activePlayClock);old.assertReadable(result.head);assembly.runtime.assertReadable(result.head);
});
