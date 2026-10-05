import {nextResidents} from '../world/next-residents';import {residentHere,townPeriod,type TownState} from '../world/residents';import {rooms,type Words} from '../world/data';import {routineReply} from './resident-guide';import type {LifeTopic} from './resident-life';import type {StoryLead} from './relationships';
const seen=(s:TownState,p:string,id:string)=>s.flags.includes(`talk:${p}:${id}`);
const heard=(s:TownState,id:string)=>seen(s,id,'n2-start');
const consulted=(s:TownState,id:string)=>{const p=nextResidents.find(p=>p.id===id)!;return seen(s,p.partner,`n2-${id}-consult`)};
const done=(s:TownState,id:string)=>s.flags.includes(`neighbors2:${id}:done`);
const t=(id:string,label:Words,reply:Words):LifeTopic=>({id,label,reply,once:true});
export function nextTopics(s:TownState,person:string):LifeTopic[]{
 if(!s.known.includes(person)||!residentHere(s,person,s.scene))return [];
 const options:LifeTopic[]=[],p=nextResidents.find(p=>p.id===person);
 if(p){
  if(!heard(s,p.id))options.push(t('n2-start',p.question,p.request));
  else if(!done(s,p.id)&&consulted(s,p.id))options.push(...p.choices.map(c=>t('n2-'+c.id,c.label,c.reply)));
  else if(done(s,p.id))options.push(t('n2-recall',['后来，你还记得这件事吗？','Has that little plan stayed with you?'],p.recall));
  options.push(t('routine',['平时在哪儿能找到你？','Where can I usually find you?'],routineReply(p.id)));
 }
 for(const n of nextResidents.filter(n=>n.partner===person&&heard(s,n.id)&&!done(s,n.id)))options.push(t(`n2-${n.id}-consult`,n.partnerQuestion,n.partnerReply));
 return options.filter(x=>!seen(s,person,x.id));
}
export function applyNextTopic(s:TownState,person:string,id:string){
 const p=nextResidents.find(p=>p.id===person);if(!p||!['n2-choice-a','n2-choice-b'].includes(id)||done(s,person))return;
 s.flags.push(`neighbors2:${person}:done`);for(const who of [person,p.partner])if(s.known.includes(who))s.relations[who]=Math.min(100,(s.relations[who]??0)+1);
}
export function nextStoryLeads(s:TownState):StoryLead[]{return nextResidents.filter(p=>heard(s,p.id)).map(p=>{
 const finished=done(s,p.id),ask=!consulted(s,p.id),who=ask?p.partner:p.id,period=['morning','afternoon','evening'].indexOf(townPeriod(s));
 // Query the existing per-person route through the exact schedule helper.
 const place=Object.keys(rooms).find(scene=>residentHere(s,who,scene));
 const phase=finished?(seen(s,p.id,'n2-choice-a')?p.choices[0].reply:p.choices[1].reply):ask?p.request:p.partnerReply;
 return {id:'neighbors2-'+p.id,title:p.title,people:[p.id,p.partner],state:finished?'done':'active',summary:phase,...(finished?{}:{next:period<0?['夜间大家已经休息。明早六点以后继续，不会错过。','Everyone is resting. Continue after 06:00; this will keep.'] as Words:ask?[`去${rooms[place!].title[0]}找${p.partnerName[0]}，问清楚对方的想法。`,`Find ${p.partnerName[1]} at ${rooms[place!].title[1]} and ask what they think.`] as Words:[`回${rooms[place!].title[0]}找${p.name[0]}，一起做决定。`,`Return to ${p.name[1]} at ${rooms[place!].title[1]} and decide together.`] as Words,...(place?{place}:{})})};
 })}
export function nextExamples(s:TownState,person:string):Words[]|undefined{const p=nextResidents.find(p=>p.id===person);if(!p)return;const focused:Words[]=done(s,person)?[['这次一起做决定，哪一点让你印象最深？','What stayed with you from deciding this together?']]:heard(s,person)?[['你最想听清楚对方哪一点想法？','What do you most want to understand about their view?']]:[['你最近在忙什么，有什么想慢慢做好的事？','What have you been doing lately? Anything you want to take your time over?']];return [...focused,['你喜欢海湾里什么样的小事？','What small things do you enjoy around the bay?']]} 
export function nextContext(s:TownState,person:string){const p=nextResidents.find(p=>p.id===person);return p?{occupation:p.role,personalDetail:p.intro,started:heard(s,person),consulted:consulted(s,person),completed:done(s,person),chosen:seen(s,person,'n2-choice-a')?'a':seen(s,person,'n2-choice-b')?'b':null,rule:'Use only committed progress. No medical diagnosis, investment advice, automatic purchases, collected personal data, or completed repairs. Optional offline neighbor story; never requires live news.'}:undefined}

export function nextTopicIds(person:string){return [...(nextResidents.some(p=>p.id===person)?['n2-start','n2-choice-a','n2-choice-b','n2-recall','routine']:[]),...nextResidents.filter(p=>p.partner===person).map(p=>'n2-'+p.id+'-consult')]}
