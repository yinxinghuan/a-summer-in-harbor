/** Input timestamps and rAF timestamps share performance.now's clock. No offline catch-up. */
export function createElapsedMotion<T>(at:number,input:T,maxGapMs=1250,maxStepMs=40){
 let last=at,current=input,events:{at:number;input:T}[]=[];
 return {
  input(at:number,value:T){if(!Number.isFinite(at))return;events.push({at:Math.max(last,at),input:value});if(events.length>64){last=at;current=value;events=[]}},
  reset(at:number,value:T){last=at;current=value;events=[]},
  consume(at:number,blocked=false){
   const result:{ms:number;input:T}[]=[],gap=at-last;
   if(!Number.isFinite(gap)||gap<0)return result;
   if(gap>maxGapMs||blocked){for(const event of events)if(event.at<=at)current=event.input;events=events.filter(e=>e.at>at);last=at;return result}
   const emit=(ms:number)=>{while(ms>1e-7){const step=Math.min(ms,maxStepMs);result.push({ms:step,input:current});ms-=step}};
   for(const event of events){if(event.at>at)break;emit(Math.max(0,event.at-last));last=event.at;current=event.input}
   events=events.filter(e=>e.at>at);emit(at-last);last=at;return result;
  }
 };
}
