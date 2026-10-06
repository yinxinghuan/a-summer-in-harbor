import {techNomads,techNomad,techNomadAdmitted,nomadSchedule,nomadActivity,nomadDeferral,nomadNextConversation} from '../world/tech-nomads';
import {residentHere,townMinutes,type TownState} from '../world/residents';
import {people,rooms,type Words} from '../world/data';
import type {LifeTopic} from './resident-life';
import type {StoryLead} from './relationships';

export type NomadMemory={schema:1;stories:Record<string,{choice:string;completedAt:number;recalledAt?:number}>};
type State=TownState&{techNomadsV1?:NomadMemory};
const seen=(s:State,p:string,id:string)=>s.flags.includes(`talk:${p}:${id}`);
const started=(s:State,p:string)=>seen(s,p,'nomads-v1-start');
const consulted=(s:State,p:string)=>{const n=techNomad(p)!;return seen(s,n.story.partner,`nomads-v1-${p}-consult`);};
const memory=(s:State,p:string)=>s.techNomadsV1?.stories[p];
const topic=(id:string,label:Words,reply:Words,once=true):LifeTopic=>({id,label,reply,once});
const mark=(s:State,f:string)=>{if(!s.flags.includes(f))s.flags.push(f);};
function request(s:State,p:string):Words{
 const n=techNomad(p)!,known=s.known.includes(n.story.partner);
 if(p==='harper')return known?['“我差点把新叶排成每日进度表。想先听听埃琳娜为什么喜欢看新叶，再问她愿不愿意被记录。去跟她聊聊花草好吗？”','“I nearly turned new leaves into a daily progress chart. I want to hear why Elena enjoys them, then ask whether a record is welcome. Could you talk with her about the garden?”']:['“我差点把新叶排成每日进度表。想先听听照顾花草的人怎样等待。先认识花园里的邻居，听听对方喜欢什么，再问记录的事好吗？”','“I nearly turned new leaves into a daily progress chart. I want to hear how someone who cares for plants waits. Could you first meet a garden neighbor and hear what they enjoy, before asking about a record?”'];
 if(p==='tess')return known&&s.flags.includes('talk:nell:life')?['“内尔留着一张空白明信片。我也一直没写开头。能问问她，卡片能不能不要求回信？写或不写、寄或不寄，我想自己慢慢决定。”','“Nell keeps a blank postcard. Mine has no first line either. Could you ask her whether a card can require no reply? Writing or keeping it, sending it or not: I want to decide slowly.”']:['“这张卡片一直没开头。我想先听旧物店经营者愿意留下什么，再问一张卡片能不能不要求回信。先认识对方，听那段生活故事，好吗？”','“This card still has no first line. I want to hear what the keeper of Second Chances wants to preserve, then ask whether a card can require no reply. Could you meet them and listen to that everyday story first?”'];
 return known?['“格兰特说退休后在学着不算每件事的回报。我想先问，他今天愿不愿意谈过去，还是只坐一会儿。别把聊天变成访谈，好吗？”','“Grant said retirement is teaching him to leave returns uncalculated. I want to ask whether he would like to talk about the past today, or just sit. Let’s keep company from becoming an interview.”']:['“我想和庭院里的邻居坐一会儿，但先要认识对方，问今天愿不愿意说话。不是找研究对象，也不记录个人资料。”','“I would like company in the courtyard, but first I need to meet someone and ask whether conversation is welcome today. No research participant or personal record.”'];
}
export function nomadChoiceHere(s:State,p:string){if(p==='harper')return s.scene==='garden'&&townMinutes(s)%1440>=840&&residentHere(s,'elena','garden');if(p==='noor')return s.scene==='courtyard'&&residentHere(s,'grant','courtyard');return true;}
export function nomadTopics(s:State,person:string):LifeTopic[]{
 if(!s.known.includes(person)||!residentHere(s,person,s.scene)||!techNomadAdmitted(person))return [];
 const n=techNomad(person),options:LifeTopic[]=[];
 if(n){
  const defer=nomadDeferral(person,s);if(defer)return [topic('nomads-v1-defer',['现在方便说话吗？','Is this a good time to talk?'],defer,false)];
  if(!started(s,person))options.push(topic('nomads-v1-start',n.story.question,request(s,person)));
  else if(!memory(s,person)&&consulted(s,person)&&nomadChoiceHere(s,person))options.push(...n.story.choices.map(c=>topic('nomads-v1-'+c.id,c.label,c.reply)));
  const done=memory(s,person);if(done&&done.recalledAt===undefined&&townMinutes(s)>=done.completedAt+n.story.cooldownMinutes)options.push(topic('nomads-v1-recall',['后来，你还记得那次选择吗？','Has that choice stayed with you?'],n.story.choices.find(c=>c.id===done.choice)!.recall));
  options.push(topic('nomads-v1-life',['为什么选择在海湾短住？','Why spend some time in the bay?'],[n.personalLife.reasonForStay[0]+' '+n.personalLife.interest[0],n.personalLife.reasonForStay[1]+' '+n.personalLife.interest[1]]));
  if(!['life-only-by-default','consent-first'].includes(nomadSchedule(person,s)!.talk))options.push(...n.professionalTopics.map(t=>topic('nomads-v1-'+t.id,t.label,t.reply)));
  options.push(topic('routine',['平时在哪里、几点方便找你？','Where and when can I find you?'],nomadRoutine(person)!));
 }
 for(const p of techNomads.filter(p=>p.story.partner===person&&techNomadAdmitted(p.id)&&started(s,p.id)&&!memory(s,p.id)&&(!p.story.partnerPrerequisite||s.flags.includes(p.story.partnerPrerequisite))))options.push(topic(`nomads-v1-${p.id}-consult`,p.story.consultPrompt,p.story.partnerReply));
 return options.filter(t=>!t.once||!seen(s,person,t.id));
}
export function nomadTopicIds(person:string){const n=techNomad(person);return [...(n?['nomads-v1-start','nomads-v1-defer','nomads-v1-life','routine','nomads-v1-recall',...n.professionalTopics.map(t=>'nomads-v1-'+t.id),...n.story.choices.map(c=>'nomads-v1-'+c.id)]:[]),...techNomads.filter(p=>p.story.partner===person).map(p=>`nomads-v1-${p.id}-consult`)];}
export function applyNomadTopic(s:State,person:string,id:string){
 const n=techNomad(person);if(!n)return;
 if(id==='nomads-v1-recall'){const m=memory(s,person);if(!m||m.recalledAt!==undefined||townMinutes(s)<m.completedAt+n.story.cooldownMinutes)throw Error('NOMAD_RECALL_NOT_READY');m.recalledAt=townMinutes(s);return;}
 const choice=n.story.choices.find(c=>id==='nomads-v1-'+c.id);if(!choice)return;
 if(memory(s,person)||!started(s,person)||!consulted(s,person)||!s.known.includes(n.story.partner)||!nomadChoiceHere(s,person))throw Error('NOMAD_STORY_NOT_READY');
 s.techNomadsV1??={schema:1,stories:{}};s.techNomadsV1.stories[person]={choice:choice.id,completedAt:townMinutes(s)};mark(s,`${n.story.id}:done`);
 for(const who of [person,n.story.partner])s.relations[who]=Math.min(100,(s.relations[who]??0)+1);
}
/** Missing fields preserve old saves, while malformed future records fail closed. */
export function validNomadMemory(s:State){const m=s.techNomadsV1;if(m===undefined)return true;if(!m||m.schema!==1||!m.stories||typeof m.stories!=='object'||Array.isArray(m.stories))return false;
 return Object.entries(m.stories).every(([id,v])=>{const n=techNomad(id);return !!n&&!!v&&typeof v==='object'&&n.story.choices.some(c=>c.id===v.choice)&&Number.isSafeInteger(v.completedAt)&&v.completedAt>=0&&v.completedAt<=townMinutes(s)&&started(s,id)&&consulted(s,id)&&s.known.includes(id)&&s.known.includes(n.story.partner)&&s.flags.includes(`${n.story.id}:done`)&&seen(s,id,'nomads-v1-'+v.choice)&&(v.recalledAt===undefined||Number.isSafeInteger(v.recalledAt)&&v.recalledAt>=v.completedAt+n.story.cooldownMinutes&&v.recalledAt<=townMinutes(s)&&seen(s,id,'nomads-v1-recall'));});
}
export function nomadRoutine(person:string):Words|undefined{if(!techNomad(person))return;
 const labels:Record<string,Words>={harper:['“06:00–12:00在咖啡馆，08:00–11:00专注；12:00–17:00去花园，14:00后适合一起看新叶；17:00–21:00在海岸。夜间休息。咖啡馆座位还要先问店主，不是办公设施的承诺。”','“The café 06:00–12:00, focusing 08:00–11:00; the garden 12:00–17:00, with room to look at leaves after 14:00; the coast 17:00–21:00. I rest at night. I still ask the café keeper about seating; no work facilities are promised.”'],tess:['“06:00–12:00旧街，12:00–17:00咖啡馆，13:00–16:00专注；17:00–21:00去码头，之后休息。我会先问店主短时安静整理是否合适，不默认提供WiFi或电源。”','“Market Lane 06:00–12:00; the café 12:00–17:00, focusing 13:00–16:00; the pier 17:00–21:00, then rest. I ask the keeper about a quiet visit first, without assuming Wi-Fi or power.”'],noor:['“06:00–12:00海岸，12:00–17:00旧物店，13:00–15:00专注；17:00–21:00庭院，先问是否愿意一起坐。夜间不外出，阅读也要先问店主是否妨碍营业。”','“The coast 06:00–12:00; Second Chances 12:00–17:00, focusing 13:00–15:00; the courtyard 17:00–21:00, asking whether company is welcome. I stay in at night and ask the shopkeeper whether reading fits the business.”']};return labels[person];
}
const atTime=(minute:number):Words=>{const d=Math.floor(minute/1440)+1,t=String(Math.floor(minute%1440/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');return [`第${d}天 ${t}`,`Day ${d}, ${t}`];};
export function nomadStoryLeads(s:State):StoryLead[]{return techNomads.filter(p=>techNomadAdmitted(p.id)&&started(s,p.id)).map(p=>{
 const m=memory(s,p.id),ask=!consulted(s,p.id),partnerKnown=s.known.includes(p.story.partner),who=ask?p.story.partner:p.id;
 let place=Object.keys(rooms).find(id=>residentHere(s,who,id)),next:Words|undefined,summary:Words=m?p.story.choices.find(c=>c.id===m.choice)!.reply:ask?request(s,p.id):p.story.partnerReply;
 if(!m){
  if(ask){const name=partnerKnown?people[who].name:['那位邻居','the neighbor'] as Words;const prerequisite=p.story.partnerPrerequisite&&!s.flags.includes(p.story.partnerPrerequisite);if(!place){place=who==='elena'?'courtyard':who==='nell'?'secondhand':'dock';next=[`夜间先歇一会儿。明早06:00后去${rooms[place].title[0]}认识或找${name[0]}，${prerequisite?'先听生活故事，再问想法':'先问是否愿意谈'}；不必赶。`,`Rest tonight. After 06:00, meet ${name[1]} at ${rooms[place].title[1]}; ${prerequisite?'hear their everyday story before asking':'ask whether conversation is welcome'}. No rush.`];}else next=[`去${rooms[place].title[0]}，${partnerKnown?'找':'先认识'}${name[0]}，${prerequisite?'先听生活故事，再问想法':'问问是否愿意谈'}。`,`At ${rooms[place].title[1]}, ${partnerKnown?'find':'first meet'} ${name[1]} and ${prerequisite?'hear their everyday story, then ask what they think':'ask whether conversation is welcome'}.`];}
  else{const window=p.id==='harper'?{scene:'garden',minute:840}:p.id==='noor'?{scene:'courtyard',minute:1020}:null;const current=nomadNextConversation(p.id,s)!;place=window?.scene??current.scene;const clock=window?`${window.minute/60}:00–${p.id==='harper'?'17':'21'}:00`:atTime(current.minute)[1];next=[`回${rooms[place].title[0]}找${p.name[0]}，${window?clock+'之间':atTime(current.minute)[0]+'以后'}一起做决定。另一天也可以。`,`Return to ${p.name[1]} at ${rooms[place].title[1]} ${window?'between '+clock:'from '+clock} to decide together. Another day is fine.`];}
 }else if(m.recalledAt===undefined){const opportunity=nomadNextConversation(p.id,{townMinutes:Math.max(townMinutes(s),m.completedAt+p.story.cooldownMinutes)})!;place=opportunity.scene;const clock=atTime(opportunity.minute);next=[`选择已保留。${clock[0]}以后可去${rooms[place].title[0]}回访，不会再得关系奖励。`,`Your choice is saved. Revisit at ${rooms[place].title[1]} from ${clock[1]}; there is no repeat relationship reward.`];}else place=undefined;
 return {id:p.story.id,title:p.story.title,people:[p.id,...(partnerKnown?[p.story.partner]:[])],state:m?'done':'active',summary,...(place?{place}:{}),...(next?{next}:{})};
});}
export function nomadExamples(s:State,p:string):Words[]|undefined{const n=techNomad(p);if(!n||!s.known.includes(p))return;const defer=nomadDeferral(p,s);return defer?[['等你收好工作本，什么时候再来合适？','When would it suit you to talk after putting work away?'],['可以先留点安静，过会儿再聊吗？','Shall I leave you some quiet and return later?']]:[...(memory(s,p)?[['那次选择以后，有什么让你慢下来了一点？','Has anything helped you slow down since that choice?'] as Words]:[['来海湾以后，有什么想慢慢做的事？','Is there something you want to take your time over in the bay?'] as Words]),['下班以后，你喜欢留意什么小事？','What small things do you enjoy noticing off duty?']];}
export function nomadContext(s:State,p:string){const n=techNomad(p);if(!n)return;const m=memory(s,p);return {version:'nomads-v1',age:n.age,pronouns:'they/them',occupation:n.role,workContext:n.workContext,activity:{...nomadSchedule(p,s),activity:nomadActivity(p,s)},started:started(s,p),consulted:consulted(s,p),choice:m?.choice??null,completedAt:m?.completedAt,recallAvailable:!!m&&m.recalledAt===undefined&&townMinutes(s)>=m.completedAt+n.story.cooldownMinutes,knownPartner:s.known.includes(n.story.partner)?people[n.story.partner].name:null,notDoneByConversation:n.story.notDoneByConversation,news:{sourceRequirement:n.newsStory.sourceRequirement,template:n.newsStory.proposedTemplate,status:'NO_ADMITTED_TECH_ARTICLE',rule:'No live/current news claim. Personal work opinions and fictional background only.'},rule:'Committed personal choice, not a performed crop operation, sent message, shipped app, research study, income or collectible. Scene permission remains proposed. Do not invent consent or additional encounters.'};}
