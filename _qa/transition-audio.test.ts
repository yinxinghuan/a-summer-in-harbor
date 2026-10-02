import test from 'node:test';import assert from 'node:assert/strict';
test('scene cue skips slow decode, replaces prior cue, cancels steps, mute and hidden tails; no replay on restore',async()=>{
 const listeners:Array<()=>void>=[],doc={hidden:false,addEventListener:(_name:string,fn:()=>void)=>listeners.push(fn)};Object.assign(globalThis,{document:doc});const {SummerAudio}=await import('../src/audio');
 const oldFetch=globalThis.fetch;let release!:(value:ArrayBuffer)=>void;globalThis.fetch=async()=>({ok:true,arrayBuffer:()=>new Promise<ArrayBuffer>(r=>{release=r})}) as Response;
 const voices:any[]=[];const param={value:0,setTargetAtTime(){},cancelScheduledValues(){}};
 const ctx={state:'running',currentTime:0,resume:async()=>{ctx.state='running'},suspend:async()=>{ctx.state='suspended'},createGain:()=>({gain:{...param},connect(){},disconnect(){}}),createBufferSource:()=>{const v={buffer:null,stoppedAt:null as number|null,connect(){},disconnect(){},start(){voices.push(v)},stop(at:number){v.stoppedAt=at;v.onended?.()},onended:null as any};return v},decodeAudioData:async()=>({duration:.3})};
 try{const a=new SummerAudio() as any;a.context=ctx;a.master={gain:{...param}};a.current='town-a';a.prepareTransition();await new Promise(r=>setImmediate(r));
 a.effect('door');assert.equal(voices.length,0);release(new ArrayBuffer(4));await new Promise(r=>setImmediate(r));assert.equal(voices.length,0,'late decode must not trigger old scene');
 a.effect('door');assert.equal(voices.length,1);a.effect('door');assert.equal(a.effects,0,'rapid transition fades old cue and does not stack');assert.equal(voices.length,1);
 a.buffers.set('step-soft-a',{duration:.14});a.effect('step');assert.equal(a.effects,1);a.effectTimes.clear();a.effect('door');assert.equal(a.effects,1,'scene cue cancels existing footstep');assert.equal(a.stepVoice,undefined);
 a.setMuted(true);assert.equal(a.effects,0);a.effectTimes.clear();a.effect('door');assert.equal(a.effects,0);
 a.setMuted(false);await new Promise(r=>setImmediate(r));assert.equal(a.effects,0,'unmute must not replay old transition');a.effect('door');assert.equal(a.effects,1);
 doc.hidden=true;for(const fn of listeners)fn();assert.equal(a.effects,0);assert.equal(voices.at(-1).stoppedAt,ctx.currentTime,'hidden cue is stopped before suspend, not left for resume');doc.hidden=false;for(const fn of listeners)fn();assert.equal(a.effects,0,'foreground must not replay old transition');
 ctx.state='suspended';a.effectTimes.clear();a.effect('door');assert.equal(a.effects,0);
 }finally{globalThis.fetch=oldFetch}
});
