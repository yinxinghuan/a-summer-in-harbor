import {tx,type Locale} from '../world/data';
import {gameMinuteLabel,type LifeView} from './LifeBag';
import {Icon} from './icons';
type View=NonNullable<LifeView['afterRain']>;
export function AfterRain({view,current,locale,person,busy=false,onAction}:{view:View|undefined;current:boolean;locale:Locale;person?:string;busy?:boolean;onAction?:(payload:unknown)=>void}){
 if(!view?.enabled)return null;
 const facts=view.facts;
 if(!facts||person&&!view.speakers.includes(person))return null;
 return <section className="harbor-item" data-after-rain={person?'resident':'notes'}>
  <h3>{tx(['雨后再看一眼','After the rain'],locale)}</h3>
  <p>{tx(['刚过的小雨已在游戏中确认，现在是阴天。','The recent light rain is confirmed in your game. It is cloudy now.'],locale)} {gameMinuteLabel(facts.rain.endedAt,locale)}</p>
  {!!facts.clues.length&&<p data-after-rain-clue>{tx(['你记下过的山坡野薄荷已可再访。可沿原路线过去看看；采叶仍要亲自选择。','The hillside mint you recorded is ready to revisit. Follow your usual route to look; collecting leaves is still your choice.'],locale)}</p>}
  {!person&&<p>{tx(['这条再访信息不会增加叶片或替你采集。先前的经历保存在下方。','This revisit information gives no leaves and does not collect for you. Your earlier experiences stay below.'],locale)}</p>}
  {!current&&<p role="status">{tx(['正在核对当前进度…','Checking your current progress…'],locale)}</p>}
  {person&&onAction&&<><p>{tx(['以下为规则编写的天气回应。自由对话仍可用自己的话提问。','This weather reply is written by the game rules. You can still ask your own question in free conversation.'],locale)}</p><button disabled={!current||busy} onClick={()=>onAction({schema:1,factId:facts.factId,topic:facts.clues.length?'known-mint-ready':'rain-ended',tone:'practical',effects:[]})}>{tx(['聊聊刚过的小雨','Talk about the recent rain'],locale)}<Icon name="chat"/></button></>}
 </section>;
}
