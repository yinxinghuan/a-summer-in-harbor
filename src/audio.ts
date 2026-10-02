/** One bounded mixer. Platform music/SFX plus original local soft footsteps; no provider URLs. */
export class SummerAudio{
 private context?:AudioContext;
 private master?:GainNode;
 private buffers=new Map<string,AudioBuffer>();
 private active=new Set<{source:AudioBufferSourceNode;gain:GainNode}>();
 private current='';
 private effects=0;
 private effectLoads=new Map<string,Promise<AudioBuffer>>();
 private effectTimes=new Map<string,number>();
 private desired='town-a';
 private muted=false;
 private timer=0;
 private generation=0;
 private next=0;
 private stepIndex=0;
 private stepVoice?:{source:AudioBufferSourceNode;gain:GainNode};
 constructor(){
  document.addEventListener('visibilitychange',()=>{if(!this.context)return;if(document.hidden){this.stopSteps();void this.context.suspend()}else if(!this.muted)void this.context.resume().catch(()=>{})});
 }
 unlock(){
  if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.22;this.master.connect(this.context.destination)}
  if(!this.muted)void this.context.resume().then(()=>this.change()).catch(()=>{});
  this.prepareSteps();
 }
 setMuted(muted:boolean){this.muted=muted;if(muted)this.stopSteps();if(this.master&&this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(muted?0:.22,this.context.currentTime,.08)}if(!muted)this.unlock()}
 /** Decode ahead of time; an unloaded step is skipped, never played later. */
 private prepareSteps(){
  const context=this.context;if(!context)return;
  for(const key of ['step-soft-a','step-soft-b']){
   if(this.effectLoads.has(key))continue;
   const load=fetch('./audio/'+key+'.wav').then(r=>{if(!r.ok)throw Error('STEP_LOAD');return r.arrayBuffer()}).then(b=>context.decodeAudioData(b));
   this.effectLoads.set(key,load);void load.then(b=>this.buffers.set(key,b)).catch(()=>this.effectLoads.delete(key));
  }
 }
 stopSteps(){
  const voice=this.stepVoice,context=this.context;if(!voice||!context)return;this.stepVoice=undefined;
  voice.gain.gain.setTargetAtTime(0,context.currentTime,.008);voice.source.stop(context.currentTime+.025);
 }
 private step(){
  const context=this.context;
  if(!context||context.state!=='running'||this.muted||document.hidden||this.effects>=4||this.stepVoice)return;
  const now=performance.now();if(now-(this.effectTimes.get('step')??-1000)<180)return;
  const buffer=this.buffers.get(this.stepIndex%2?'step-soft-b':'step-soft-a');if(!buffer)return;
  this.effectTimes.set('step',now);this.stepIndex++;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.28;
  source.connect(gain);gain.connect(this.master!);const voice={source,gain};this.stepVoice=voice;this.effects++;
  source.onended=()=>{this.effects--;if(this.stepVoice===voice)this.stepVoice=undefined;source.disconnect();gain.disconnect()};source.start();
 }
 setArea(area:string){this.desired=area==='practice'?'practice':area==='coast'||area==='harbor'?'coast':area==='hill'?'hill':'town-a';if(this.context)void this.change()}
 effect(key:'step'|'door'|'hit'|'progress'){
  if(key==='step'){this.step();return}
  const context=this.context;if(!context||this.muted||document.hidden||this.effects>=4)return;
  const now=performance.now();if(now-(this.effectTimes.get(key)??-1000)<90)return;this.effectTimes.set(key,now);
  let load=this.effectLoads.get(key);if(!load){load=fetch('./audio/'+key+'.mp3').then(r=>{if(!r.ok)throw Error('SFX_LOAD');return r.arrayBuffer()}).then(b=>context.decodeAudioData(b));this.effectLoads.set(key,load)}
  void load.then(buffer=>{if(this.effects>=4||this.muted||document.hidden)return;const voice=context.createBufferSource(),gain=context.createGain();voice.buffer=buffer;gain.gain.value=key==='hit'?.45:.7;voice.connect(gain);gain.connect(this.master!);this.effects++;voice.onended=()=>{this.effects--;voice.disconnect();gain.disconnect()};voice.start()}).catch(()=>this.effectLoads.delete(key));
 }
 private async change(){
  const context=this.context!;if(!context||this.current===this.desired)return;
  const key=this.desired,token=++this.generation;this.current=key;
  try{
   let buffer=this.buffers.get(key);
   if(!buffer){const response=await fetch('./audio/'+key+'.mp3');if(!response.ok)throw Error('AUDIO_LOAD');buffer=await context.decodeAudioData(await response.arrayBuffer());this.buffers.set(key,buffer)}
   if(token!==this.generation)return;
   clearTimeout(this.timer);
   for(const voice of this.active){voice.gain.gain.cancelScheduledValues(context.currentTime);voice.gain.gain.setTargetAtTime(0,context.currentTime,.2);voice.source.stop(context.currentTime+.8)}
   this.next=context.currentTime+.02;
   const schedule=()=>{
    if(token!==this.generation)return;
    if(this.next-context.currentTime<3){
     const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer!;source.connect(gain);gain.connect(this.master!);
     const start=Math.max(context.currentTime,this.next),duration=buffer!.duration,overlap=Math.min(2,duration/5);
     gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+overlap);
     gain.gain.setValueAtTime(1,start+duration-overlap);gain.gain.linearRampToValueAtTime(0,start+duration);
     const voice={source,gain};this.active.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();this.active.delete(voice)};
     source.start(start);this.next=start+duration-overlap;
    }
    this.timer=window.setTimeout(schedule,1000);
   };schedule();
  }catch{if(token===this.generation)this.current=''}
 }
}
export const summerAudio=new SummerAudio();
