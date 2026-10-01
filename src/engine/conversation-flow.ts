/** Storage-independent topic lifecycle. Call only with committed, paired exchanges. */
export type FlowTopic={key:string;after?:string;utility?:boolean;aliases?:{question:string;reply:string}[]}
export type FlowExchange={topicKey?:string;question:string;reply:string}
export function completedTopics(topics:FlowTopic[],history:FlowExchange[],saved:readonly string[]=[]):Set<string>{
 const done=new Set(saved)
 for(const exchange of history){
  if(!exchange.question.trim()||!exchange.reply.trim())continue
  if(exchange.topicKey){done.add(exchange.topicKey);continue}
  // Legacy migration is exact and bilingual. Ambiguous or unknown pairs stay readable, not consumed.
  const matches=topics.filter(t=>t.aliases?.some(a=>a.question===exchange.question&&a.reply===exchange.reply))
  if(matches.length===1)done.add(matches[0].key)
 }
 return done
}
export function availableTopics<T extends FlowTopic>(topics:T[],history:FlowExchange[],saved:readonly string[]=[]):T[]{
 const done=completedTopics(topics,history,saved)
 return topics.filter(t=>(t.utility||!done.has(t.key))&&(!t.after||done.has(t.after)))
  .sort((a,b)=>Number(Boolean(b.after))-Number(Boolean(a.after)))
}
