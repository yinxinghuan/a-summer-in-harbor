import {startBout,resolveTurn,validBout,type Bout,type Config,type Move} from '../turn-combat/core';
import type {Save,Action} from './state';import type {Words} from '../world/data';
import {entityAt} from '../world/data';import {presentEntity,observedActor,advanceTown} from '../world/residents';import {advanceAwake} from './fatigue';
const common={version:1 as const,playerMax:10,strike:3,counter:2,recover:2,supply:4,maxRounds:12};
export const boutConfigs:Record<'training'|'open-class',Config>={training:{...common,id:'training',opponentMax:8,intents:[{id:'heavy',damage:5},{id:'rest',damage:0},{id:'light',damage:2}]},'open-class':{...common,id:'open-class',opponentMax:18,intents:[{id:'light',damage:2},{id:'heavy',damage:5},{id:'rest',damage:0}]}};
export type TurnBattle={id:string;encounter:'training'|'open-class';scene:'gym';opponent:'idris';phase:'active'|'paused'|'result';paid:boolean;bout:Bout};
const need=(v:unknown,c:string)=>{if(!v)throw Error(c)};
const flag=(s:Save,k:string)=>{if(!s.flags.includes(k))s.flags.push(k)};
const relation=(s:Save,n:number)=>s.relations.idris=Math.min(100,(s.relations.idris??0)+n);
export function validTurnBattle(s:Save){const b=s.turnBattle;if(!b)return true;return !s.activeChallenge&&typeof b.id==='string'&&/^[a-f0-9-]{36}$/.test(b.id)&&['training','open-class'].includes(b.encounter)&&b.scene==='gym'&&b.opponent==='idris'&&['active','paused','result'].includes(b.phase)&&typeof b.paid==='boolean'&&validBout(boutConfigs[b.encounter],b.bout)&&(b.phase==='result'?b.bout.outcome!=='playing':b.bout.outcome==='playing')&&(b.encounter==='training'?!b.paid:b.paid===(b.bout.round>0))}
export const battleLocksWorld=(s:Save)=>!!s.turnBattle&&s.turnBattle.phase!=='paused';
export const battleItems={ 'packed-snack':{name:['打包点心','Packed snack'] as Words,description:['场外恢复30体力；对练中恢复4本场状态，每场至多一份。','Restores 30 energy outside a bout, or 4 bout condition once per bout.'] as Words,kind:'objects' as const}};
export function battleTopics(s:Save,p:string):import('./resident-life').LifeTopic[]{if(p!=='idris'||!s.known.includes(p)||s.scene!=='gym')return [];const f=(k:string)=>s.flags.includes(k);
 return f('battle:class:done')?[]:f('market-known')&&!f('battle:class:accepted')?[{id:'class-invite',label:['体验课还需要人帮忙吗？','Could I help with the open class?'],reply:['“愿意陪我彩排一场吗？不必赢。先确认规则，练完告诉我节奏感受，我付你6元谢礼。不急，随时能暂停去忙自己的事。”','“Would you rehearse a bout with me? You needn’t win. Read the rules first, then tell me how the pace felt. I’ll pay $6 for your time. No rush; you can pause for your own errands.”'] as Words,once:true}]:[];
}
export function applyBattleTopic(s:Save,p:string,id:string){if(p==='idris'&&id==='class-invite')flag(s,'battle:class:accepted')}
function atCoach(s:Save,a:Action){const e=entityAt(s.scene,'idris');need(s.scene==='gym'&&s.known.includes('idris')&&s.flags.includes('unpacked'),'BATTLE_LOCATION');need(e&&presentEntity(s,e),'PERSON_AWAY');const p=observedActor(e!,a.actorPosition);need(Math.hypot(a.position.x+8-p.x,a.position.y+6-p.y)<=75,'TOO_FAR')}
export function applyBattle(s:Save,a:Action):Words{
 need(!s.activeChallenge,'CHALLENGE_ACTIVE');
 if(a.action==='snack-eat'){need(!battleLocksWorld(s),'BATTLE_ACTIVE');need((s.items['packed-snack']??0)>0,'MISSING_ITEM');need(s.energy<100,'ENERGY_FULL');s.items['packed-snack']--;if(!s.items['packed-snack'])delete s.items['packed-snack'];s.energy=Math.min(100,s.energy+30);return ['你吃完点心，体力恢复了。','You eat the snack and recover energy.']}
 if(a.action==='battle-claim'){need(s.flags.includes('battle:class:pay-pending')&&!s.flags.includes('battle:class:paid'),'REWARD_UNAVAILABLE');need(s.cash<=993,'PURSE_FULL');s.cash+=6;flag(s,'battle:class:paid');return ['彩排谢礼6元已收好。','You collect the $6 rehearsal payment.']}
 if(a.action==='battle-start'){
  need(!s.turnBattle,'BATTLE_EXISTS');atCoach(s,a);const encounter=(a.payload as any)?.encounter;need(encounter==='training'||encounter==='open-class','INVALID_BATTLE');if(encounter==='open-class'){need(s.flags.includes('battle:class:accepted'),'BATTLE_NOT_ACCEPTED');need(!s.flags.includes('battle:class:awaiting-feedback'),'BATTLE_FEEDBACK_FIRST');need(s.energy>=10,'REST_NEEDED')}
  s.turnBattle={id:a.action_id,encounter,scene:'gym',opponent:'idris',phase:'active',paid:false,bout:startBout(boutConfigs[encounter as 'training'|'open-class'])};return ['看清教练的预告，再选择应对。','Read the coach’s intent, then choose your response.'];
 }
 const b=s.turnBattle;need(b&&b.id===a.target,'BATTLE_MISMATCH');need(validTurnBattle(s),'UNSUPPORTED_BATTLE');const t=b!;
 if(a.action==='battle-pause'){need(t.phase==='active','BATTLE_NOT_ACTIVE');t.phase='paused';return ['对练已暂停。可以去收菜或见邻居，回来后继续。','Bout paused. Tend your crops or visit a neighbor, then return.']}
 if(a.action==='battle-resume'){need(t.phase==='paused','BATTLE_NOT_PAUSED');atCoach(s,a);t.phase='active';return ['从上次那一轮继续。','Continue from the saved round.']}
 if(a.action==='battle-end'){need(t.phase!=='result','BATTLE_FEEDBACK_FIRST');delete s.turnBattle;return ['这场练习结束了。已经用掉的时间和点心不退回，可以重新准备。','This bout is over. Time and snacks already used remain spent. Try again when ready.']}
 if(a.action==='battle-close'){need(t.phase==='result'&&(t.encounter==='training'||s.flags.includes('battle:class:done')),'BATTLE_FEEDBACK_FIRST');delete s.turnBattle;return ['练习记录已留下。','Your practice is recorded.']}
 if(a.action==='battle-feedback'){
  need(t.phase==='result'&&t.encounter==='open-class'&&['clear','slower'].includes((a.payload as any)?.feedback),'INVALID_FEEDBACK');
  if(!s.flags.includes('battle:class:done')){flag(s,'battle:class:done');flag(s,'battle:class:feedback:'+((a.payload as any).feedback));relation(s,1);flag(s,'battle:class:pay-pending');if(s.cash<=993){s.cash+=6;flag(s,'battle:class:paid')}}
  s.flags=s.flags.filter(f=>f!=='battle:class:awaiting-feedback');delete s.turnBattle;return s.flags.includes('battle:class:paid')?['伊德里斯记下你的感受，把6元谢礼交给你。你们可以按这个节奏准备体验课。','Idris notes your feedback and pays $6 for your time. It helps him prepare the open class.']:['伊德里斯记下感受。6元谢礼为你留着，钱包腾出空间后可在手记领取。','Idris notes your feedback. Your $6 payment is reserved; collect it in the journal when your purse has room.'];
 }
 need(a.action==='battle-move'&&t.phase==='active','BATTLE_NOT_ACTIVE');const p=a.payload as any;need(p&&p.round===t.bout.round,'BATTLE_ROUND_CONFLICT');const move=p.move as Move;
 if(move==='supply'){need(t.encounter!=='training','TRAINING_NO_SUPPLY');need((s.items['packed-snack']??0)>0,'MISSING_ITEM')}
 if(t.encounter==='open-class'&&!t.paid){need(s.energy>=10,'REST_NEEDED');s.energy-=2;t.paid=true}
 t.bout=resolveTurn(boutConfigs[t.encounter],t.bout,move);
 if(move==='supply'){s.items['packed-snack']--;if(!s.items['packed-snack'])delete s.items['packed-snack']}
 if(t.encounter==='open-class'){advanceAwake(s,2);advanceTown(s,2)}
 if(t.bout.outcome!=='playing'){t.phase='result';if(t.encounter==='training'&&t.bout.outcome==='won'){flag(s,'battle:training:done');if(!s.flags.includes('challenge:sparring')){flag(s,'challenge:sparring');s.standing+=2;relation(s,2)}}if(t.encounter==='open-class'&&!s.flags.includes('battle:class:done'))flag(s,'battle:class:awaiting-feedback')}
 const last=t.bout.log.at(-1)!;return [`第${t.bout.round}轮：对方−${last.dealt}，你−${last.taken}，恢复${last.healed}。`,`Round ${t.bout.round}: opponent −${last.dealt}, you −${last.taken}, recovered ${last.healed}.`];
}
