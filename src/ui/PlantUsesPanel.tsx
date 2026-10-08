import {tx,type Locale} from '../world/data';
import type {Save} from '../story/state';
import type {PlantUseVerb,PlantUsesView} from '../life/plant-uses';
import type {LifeView} from './LifeBag';
import {gameMinuteLabel} from './LifeBag';
export const useView=(view:LifeView|null)=>(view as (LifeView&{plantUses?:PlantUsesView&{basilEnabled:boolean;mintEnabled:boolean;mintNewStarts?:boolean;mintArtId?:string}})|null)?.plantUses;
export function PlantUsesPanel({save,view,person,locale,busy,current,onAction}:{save:Save;view:LifeView|null;person?:string;locale:Locale;busy:boolean;current?:boolean;onAction:(v:PlantUseVerb)=>void}){
 const p=useView(view);if(!p||!person||!save.known.includes(person))return null;const locked=busy||!(current??p.snapshotVersion===save.version)||!!save.activeChallenge;
 if(person!=='theo'||save.scene!=='cafe'||(!p.basilEnabled&&!p.order))return null;const now=save.townMinutes??540,open=now%1440>=360&&now%1440<1020,o=p.order;
 return <section data-plant-use-order className="harbor-item"><h3>{tx(['厨房的罗勒需求','Basil for the kitchen'],locale)}</h3><p>{tx(p.messages.offer,locale)}</p>
 {!p.offerRead&&!o&&<button disabled={locked||!open||!p.newStarts} onClick={()=>onAction('read-offer')}>{tx(['了解厨房需求','Read the kitchen request'],locale)}</button>}
 {o?<><p>{tx(['截止','Due'],locale)} {gameMinuteLabel(o.dueMinute,locale)}</p><p>{tx([`需要2份 · 行囊可用${p.availableBasil}份 · 交货+$7`,`Needs 2 portions · ${p.availableBasil} in your bag · delivery +$7`],locale)}</p>{now<o.dueMinute?<button disabled={locked||!open||p.availableBasil<2||save.cash+7>999} onClick={()=>onAction('deliver-basil')}>{tx(['交两份罗勒 · +$7','Deliver 2 basil portions · +$7'],locale)}</button>:<p>{tx(['已过期。行囊中可关闭，产物仍可卖或留种。','Expired. Close it in your bag; keep the produce to sell or save for seed.'],locale)}</p>}</>:p.offerRead&&<><button disabled={locked||!open||!p.newStarts||!!view?.order||now<p.cooldownUntil} onClick={()=>onAction('accept-basil')}>{tx(['接罗勒订单 · 2份换$7','Accept basil order · 2 portions for $7'],locale)}</button>{!!view?.order&&<p>{tx(['已有订单，先完成或处理它。','You already have an order. Finish or close it first.'],locale)}</p>}{now<p.cooldownUntil&&<p>{tx(['下一次需求','Next request'],locale)} {gameMinuteLabel(p.cooldownUntil,locale)}</p>}</>}
 {!open&&<p>{tx(['咖啡馆06:00–17:00收货。收成会保留。','The café takes deliveries 06:00–17:00. Your produce keeps.'],locale)}</p>}
 {!!p.deliveries&&<button disabled={locked} onClick={()=>onAction('recall-delivery')}>{tx(['聊聊上次的供货','Talk about the last delivery'],locale)}</button>}
 </section>;
}
export function PlantUsesBag({save,view,locale,busy,current,onAction}:{save:Save;view:LifeView|null;locale:Locale;busy:boolean;current?:boolean;onAction:(v:PlantUseVerb)=>void}){
 const p=useView(view);if(!p)return null;const locked=busy||!(current??p.snapshotVersion===save.version),now=save.townMinutes??540;
 return <section data-plant-use-bag>{p.order&&<article className="harbor-item"><h3>{tx(['罗勒订单','Basil order'],locale)}</h3><p>{tx(['两份换$7，去咖啡馆当面交货。截止','Two portions for $7. Deliver at the café. Due'],locale)} {gameMinuteLabel(p.order.dueMinute,locale)}</p>{now>=p.order.dueMinute&&<button disabled={locked} onClick={()=>onAction('close-basil')}>{tx(['关闭罗勒订单 · 保留产物','Close basil order · keep produce'],locale)}</button>}</article>}
 </section>;
}
