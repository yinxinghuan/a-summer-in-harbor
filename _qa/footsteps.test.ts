import test from 'node:test';import assert from 'node:assert/strict';
import {FootstepCadence} from '../src/footsteps';
test('contacts require actual distance; wall, pause, teleport and new room reset partial stride',()=>{
 const c=new FootstepCadence();assert.equal(c.update({x:0,y:0},'a',false),false);
 let contacts=0;for(let x=2;x<=96;x+=2)contacts+=Number(c.update({x,y:0},'a',false));assert.equal(contacts,4);
 for(let n=0;n<100;n++)assert.equal(c.update({x:96,y:0},'a',false),false);
 c.update({x:100,y:0},'a',false);c.update({x:104,y:0},'a',true);
 assert.equal(c.update({x:108,y:0},'a',false),false);
 assert.equal(c.update({x:500,y:500},'a',false),false);
 assert.equal(c.update({x:502,y:500},'b',false),false);
 assert.equal(c.update({x:506,y:500},'b',false),false);
});
test('slow audio decode never backfills a footstep; one short step voice; mute/hidden/stop cancel it',async()=>{
 const doc={hidden:false,addEventListener:()=>{}};Object.assign(globalThis,{document:doc});
 const {SummerAudio}=await import('../src/audio');let release:(v:ArrayBuffer)=>void=()=>{};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,arrayBuffer:()=>new Promise<ArrayBuffer>(r=>{release=r})}) as Response;
 const voices:any[]=[];const param={value:0,setTargetAtTime(){},cancelScheduledValues(){}};
 const ctx={state:'running',currentTime:0,createGain:()=>({gain:{...param},connect(){},disconnect(){}}),createBufferSource:()=>{const v={buffer:null,connect(){},disconnect(){},start(){voices.push(v)},stop(){this.onended?.()},onended:null as any};return v},decodeAudioData:async()=>({duration:.14})};
 const a=new SummerAudio() as any;a.context=ctx;a.master={gain:{...param}};
 // Separate delayed request for each of the two samples.
 a.prepareSteps();await new Promise(r=>setImmediate(r));a.effect('step');assert.equal(voices.length,0);
 release(new ArrayBuffer(8));await new Promise(r=>setImmediate(r));assert.equal(voices.length,0);
 a.buffers.set('step-soft-a',{duration:.14});a.buffers.set('step-soft-b',{duration:.14});
 a.effect('step');assert.equal(voices.length,1);a.effectTimes.clear();a.effect('step');assert.equal(voices.length,1);
 a.stopSteps();assert.equal(a.effects,0);a.effectTimes.clear();a.effect('step');assert.equal(voices.length,2);
 a.setMuted(true);assert.equal(a.effects,0);a.effectTimes.clear();a.effect('step');assert.equal(voices.length,2);
 a.muted=false;doc.hidden=true;a.effect('step');assert.equal(voices.length,2);
 globalThis.fetch=oldFetch;
});
