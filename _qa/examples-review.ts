import {initial,type Save} from '../src/story/state';
import {rooms,type Locale} from '../src/world/data';
if(!import.meta.env.DEV)throw Error('DEV_ONLY');
// Isolated synthetic presentation state, not a player journey or backend.
const params=new URLSearchParams(location.search),locale:Locale=params.get('locale')==='zh'?'zh':'en',person=params.get('person')??'mara';
const raw=window.sessionStorage,prefix='examples-review-only:'+person+':'+locale+':';
const adapter={getItem:(k:string)=>raw.getItem(prefix+k),setItem:(k:string,v:string)=>raw.setItem(prefix+k,v),removeItem:(k:string)=>raw.removeItem(prefix+k),clear(){for(const k of Object.keys(raw))if(k.startsWith(prefix))raw.removeItem(k)},key:(i:number)=>Object.keys(raw).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length)??null,get length(){return Object.keys(raw).filter(k=>k.startsWith(prefix)).length}};
window.alteruLocalStorage=adapter;window.alteruSessionStorage=adapter;
let s:Save=initial(locale,'examples-review-only');s.known=[person];
const room=Object.values(rooms).find(r=>r.entities.some(e=>e.person===person))!;
s.scene=room.id;s.position={...room.entities.find(e=>e.person===person)!.approach};s.visited=[s.scene];
if(params.get('stage')==='returned')s.flags=['key','unpacked','bag-returned','free-dialogue-experienced'];
adapter.setItem('harbor-journey',s.id);adapter.setItem('harbor-locale',locale);adapter.setItem('harbor-muted','1');adapter.setItem('harbor-opening:'+s.id,'3');
if(params.get('reading')==='1'){
 s.history=[{id:'qa-unread',kind:'talk',person,text:['这是一段用于检验阅读顺序的本地回复。'.repeat(9),'This local reply is only here to check the reading sequence. '.repeat(10)]}];
 adapter.setItem('harbor-reading-v1:'+s.id+':'+person,JSON.stringify({exchangeId:'qa-unread',page:0,locale,finished:false}));
}
const qa={snapshot:()=>structuredClone(s),setFlags:(flags:string[])=>{s={...s,flags,version:s.version+1}},asks:[] as string[],modelCalls:0,requests:[] as string[]};
(window as any).__qaExamples=qa;
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(!url.pathname.includes('/api/'))return realFetch(input,init);
 const path=url.pathname.split('/api')[1];qa.requests.push((init?.method??'GET')+' '+path);
 if(path.endsWith('/action')){
  const a=JSON.parse(String(init?.body));qa.asks.push(a.action);
  await new Promise(r=>setTimeout(r,850));
  return Response.json({error:'MODEL_CALL_FAILED',terminal:true},{status:400});
 }
 if(path==='/bootstrap')return Response.json({mode:'isolated-ui-fixture'});
 if(path==='/sessions')return Response.json([{id:s.id}]);
 if(path==='/sessions/'+s.id)return Response.json(s);
 if(path.endsWith('/checkpoint'))return Response.json({position:s.position});
 if(path==='/usage')return Response.json({resetAt:Date.now()+3600000,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}});
 return Response.json({error:'QA_ROUTE_NOT_IMPLEMENTED',terminal:true},{status:400});
};
await import('../src/main');
