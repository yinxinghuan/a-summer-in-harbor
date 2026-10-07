import type {createAnimalLife} from '../../server/animal-life';
import {tx,type Locale,type Entity} from '../world/data';
import type {Save} from '../story/state';
import type {AnimalCommand} from '../animal-life/types';
import {behaviorLabels as names,observationLabel} from '../animal-life/labels';
import {gameMinuteLabel} from './LifeBag';
import {currentAnimalSample} from '../animal-life/presentation';
import type {Point} from '../engine/world';
export type AnimalView=ReturnType<ReturnType<typeof createAnimalLife>['animalProject']>;
export function AnimalInteraction({save,view,target,locale,busy,ready,playerPosition,onCommand}:{save:Save;view?:AnimalView;target:Entity;locale:Locale;busy:boolean;ready:boolean;playerPosition?:Point;onCommand:(c:AnimalCommand)=>void}){
 if(!view||view.snapshotVersion!==save.version||target.person&&!ready)return null;
 const rows=view.commissions.filter(e=>save.known.includes(e.definition.resident)&&e.definition.resident===target.person),sample=view.sample&&view.sample.frame.id===target.animalId?currentAnimalSample(save,view.sample,playerPosition):undefined;
 return <section className="harbor-animal-notebook" aria-label={tx(['动物日常','Animal routines'],locale)}>
 {target.animalId&&<>
  <p>{tx(target.animalId.startsWith('harbor-gull-')?['留出一点距离，不追赶也不投喂。观察失败不会损失任何物品。','Leave a little room. No chasing or feeding. An unavailable observation costs nothing.']:['晒太阳或睡眠时，可以安静观察；不需要叫醒它。','Watch quietly when it is sunning or sleeping. There is no need to wake it.'],locale)}</p>
  {sample?<><p role="status">{tx(['这一刻：','This moment: '],locale)}{tx(names[sample.behavior],locale)}</p><button disabled={busy||!ready} onClick={()=>onCommand({verb:'record'})}>{tx(['记下这次观察','Record this observation'],locale)}</button></>:<button disabled={busy||!ready} onClick={()=>onCommand({verb:'sample'})}>{tx(['静静看一会儿','Watch quietly'],locale)}</button>}
 </>}
 {rows.map(e=><article className="harbor-item" key={e.ref.id} data-animal-commission={e.ref.id}><strong>{tx(e.definition.title,locale)}</strong>
  {e.completed?<p>{tx(['已经一起分享过，可以在行囊回看册页。','Already shared. Your notebook page is in the bag.'],locale)}</p>:e.active?<><p>{tx(['没有期限，还需要：','No deadline. Still to observe: '],locale)}{e.missing.length?e.missing.map(r=>tx(observationLabel(r.animal,r.behavior),locale)).join(' / '):tx(['都已记下，可以分享了。','All recorded. Ready to share.'],locale)}</p><button disabled={busy||!ready||!!e.missing.length} onClick={()=>onCommand({verb:'share',ref:e.ref})}>{tx(['分享观察 · 关系+1一次','Share observations · +1 relationship once'],locale)}</button></>:e.briefed?<><p>{tx(['约定内容：','Observation plan: '],locale)}{e.definition.requirements.map(r=>tx(observationLabel(r.animal,r.behavior),locale)).join(' / ')}</p><button disabled={busy||!ready||!e.enabled} onClick={()=>onCommand({verb:'accept',ref:e.ref})}>{tx(['读过了，接下这份观察约定','I have read it: accept this observation plan'],locale)}</button></>:<button disabled={busy||!ready||!e.enabled} onClick={()=>onCommand({verb:'brief',ref:e.ref})}>{tx(['聊聊动物日常','Ask about animal routines'],locale)}</button>}
 </article>)}
 </section>;
}
export function AnimalPages({save,view,locale,busy,onCommand}:{save:Save;view?:AnimalView;locale:Locale;busy:boolean;onCommand:(c:AnimalCommand)=>void}){
 if(!view||view.snapshotVersion!==save.version)return null;const active=view.commissions.find(e=>e.active&&save.known.includes(e.definition.resident));
 return <section className="harbor-animal-notebook" aria-label={tx(['观察册页','Observation pages'],locale)}><h3>{tx(['观察册页','Observation pages'],locale)}</h3>
 {active&&<article className="harbor-item"><strong>{tx(active.definition.title,locale)}</strong><p>{tx(['没有期限；发现不会随取消消失。','No deadline; setting this aside keeps your discoveries.'],locale)}</p><button disabled={busy||view.snapshotVersion!==save.version} onClick={()=>onCommand({verb:'cancel',ref:active.ref})}>{tx(['收起这份约定','Set this plan aside'],locale)}</button></article>}
 {!view.pages.length&&<p>{tx(['与街坊分享观察后，会留下册页。册页是知识，不是实物奖励。','Sharing observations with a neighbor adds a page. Pages are knowledge, not physical rewards.'],locale)}</p>}
 {view.pages.map(p=><article className="harbor-item" key={p.ref.id} data-animal-page={p.ref.id}><strong>{tx(p.title,locale)}</strong><p>{tx(p.text,locale)}</p><small>{gameMinuteLabel(p.minute,locale)}</small></article>)}
 </section>;
}

export const animalErrors:Record<string,[string,string]>={OBSERVATION_NOT_AVAILABLE:['现在不是休息时刻。可以等它晒太阳或睡觉时再来。','This is not a resting moment. Return when it is sunning or sleeping.'],LEAVE_GULL_SPACE:['再退开一点，给海鸥留点空间。','Step back a little to leave room for the gull.'],OBSERVATION_STALE:['这一刻已经变了。静静看一会儿，再登记新的观察。','That moment has changed. Watch quietly again to record a new observation.'],OBSERVATIONS_MISSING:['还缺少约定中的观察，已发现的记录仍保留。','Some observations are still missing. Your discoveries are kept.'],ANIMAL_AWAY:['它现在不在这里。换个地点或时段再看看。','It is elsewhere now. Try another place or time.'],ANIMAL_CONTENT_CLOSED:['暂时不接新约定，已经接下的仍可完成。','New plans are closed for now. Accepted plans can still be completed.'],COMMISSION_UNAVAILABLE:['已有观察约定，或这页已经分享过了。','You already have a plan, or this page has already been shared.']};
