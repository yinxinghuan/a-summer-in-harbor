import {AuthorityError} from '../authority-session/error.mjs';
/** Bounded in-process FIFO for the single model service. No automatic retries. */
export function createModelQueue({concurrency=4,capacity=16,waitMs=10000}={}){
 if(![concurrency,capacity,waitMs].every(Number.isSafeInteger)||concurrency<1||capacity<0||waitMs<1)throw Error('MODEL_QUEUE_CONFIG');
 let active=0;const waiting=[];
 const run=task=>{active++;clearTimeout(task.timer);Promise.resolve().then(task.work).then(task.resolve,task.reject).finally(()=>{active--;const next=waiting.shift();if(next)run(next);});};
 return Object.freeze({
  position:key=>{const n=waiting.findIndex(t=>t.key===key);return n<0?0:n+1;},
  execute(key,work){return new Promise((resolve,reject)=>{
   const task={key,work,resolve,reject};
   if(active<concurrency){run(task);return;}
   if(waiting.length>=capacity){reject(new AuthorityError('AI_QUEUE_FULL',429));return;}
   task.timer=setTimeout(()=>{const i=waiting.indexOf(task);if(i>=0){waiting.splice(i,1);reject(new AuthorityError('AI_QUEUE_TIMEOUT',503));}},waitMs);
   waiting.push(task);
  });},
 });
}
