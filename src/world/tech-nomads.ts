import source from './tech-nomads.json';
import type {Words} from './data';
import type {Point} from '../engine/world';

export type NomadSchedule={start:number;end:number;scene:string|null;state:string;activity:Words;talk:string;permission?:string};
export type TechNomad={id:string;name:Words;role:Words;unknown:Words;intro:Words;age:number;art:string;mapArt:string;avatarArt:string;workContext:Words;personalLife:{reasonForStay:Words;interest:Words;boundaries:Words};schedule:NomadSchedule[];routes:{scene:string;at:Point}[];professionalTopics:{id:string;label:Words;reply:Words}[];story:{id:string;title:Words;partner:string;partnerPrerequisite:string|null;question:Words;consultPrompt:Words;partnerReply:Words;choices:{id:string;label:Words;reply:Words;recall:Words}[];notDoneByConversation:string[];cooldownMinutes:number};newsStory:{status:string;sourceRequirement:string;proposedTemplate:string};artAdmission:{status:string;atlas:{path:string;sha256:string|null};avatar:{path:string;sha256:string|null};portrait:{path:string;sha256:string|null};rendererEvidence:string|null;missing:string[]}};
export const techNomads=source as unknown as TechNomad[];
export const techNomad=(id:string)=>techNomads.find(p=>p.id===id);
export const techRoutes=Object.fromEntries(techNomads.map(p=>[p.id,p.routes]));
export const techPeople=Object.fromEntries(techNomads.map(p=>[p.id,{name:p.name,unknown:p.unknown,intro:p.intro,art:p.art,mapArt:p.mapArt,avatarArt:p.avatarArt,portraitShape:'square' as const}]));
export const techRoles=Object.fromEntries(techNomads.map(p=>[p.id,p.role]));
/** Pending metadata is never a character. Owner supplies admitted bytes and real renderer evidence. */
export function techNomadAdmitted(id:string){const p=techNomad(id);return !p||p.artAdmission.status==='accepted'&&p.artAdmission.missing.length===0&&!!p.artAdmission.rendererEvidence&&[p.artAdmission.atlas,p.artAdmission.avatar,p.artAdmission.portrait].every(a=>!!a.sha256&&/^[a-f0-9]{64}$/.test(a.sha256));}
export function nomadSchedule(id:string,s:{townMinutes?:number}){const p=techNomad(id),m=(s.townMinutes??540)%1440;return p?.schedule.find(t=>m>=t.start&&m<t.end);}
/** A scene description must not introduce a neighbor's name before the player meets them. */
export function nomadActivity(id:string,s:{townMinutes?:number;known?:string[]}):Words|undefined{const activity=nomadSchedule(id,s)?.activity;if(!activity||!s.known)return activity;const aliases:Record<string,Words>={theo:['Theo','Theo'],nell:['Nell','Nell'],elena:['Elena','Elena'],samira:['Samira','Samira']};return activity.map((line,locale)=>Object.entries(aliases).reduce((text,[person,names])=>s.known!.includes(person)?text:text.replaceAll(names[locale],locale===0?'那位邻居':'a neighbor'),line)) as Words;}
export function nomadDeferral(id:string,s:{townMinutes?:number}):Words|undefined{const t=nomadSchedule(id,s);if(!t?.talk.startsWith('defer-until-'))return;const time=String(t.end/60).padStart(2,'0')+':00';return [`“我在安静整理已准备的材料。${time} 后再聊，好吗？不需要替我完成工作，也不用赶。”`, `“I am quietly organizing prepared material. Can we talk after ${time}? You need not do my work or hurry.”`];}
/** Finite authored next opportunity, including next morning; independent of a real calendar. */
export function nomadNextConversation(id:string,s:{townMinutes?:number}){const p=techNomad(id);if(!p)return;const now=s.townMinutes??540;for(let delta=0;delta<=1440;delta++){const at=now+delta,t=nomadSchedule(id,{townMinutes:at});if(t?.scene&&!t.talk.startsWith('defer-until-'))return {scene:t.scene,minute:at,activity:t.activity};}}
