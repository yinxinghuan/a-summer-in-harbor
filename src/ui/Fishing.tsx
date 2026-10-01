import {useEffect,useRef,useState} from 'react';
import {fishingInitial,fishingPull,fishingStep,recordFishing,type FishingRun} from '../challenges/fishing';
import {tx,type Locale} from '../world/data';
export function Fishing({locale,onFinish,onLeave}:{locale:Locale;onFinish:(runs:FishingRun[])=>void;onLeave:()=>void}){
 const [started,setStarted]=useState(false),[display,setDisplay]=useState(fishingInitial);
 const state=useRef(fishingInitial()),held=useRef(false),runs=useRef<FishingRun[]>([]);
 useEffect(()=>{
  if(!started)return;let id=0,last=0,acc=0;
  const clear=()=>{held.current=false;last=0;acc=0};
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'){e.preventDefault();held.current=e.type==='keydown'}};
  const visibility=()=>{if(document.hidden)clear()};
  const frame=(now:number)=>{
   if(!document.hidden){
    if(last)acc+=Math.min(.1,(now-last)/1000);
    while(acc>=1/30&&state.current.result==='playing'){acc-=1/30;recordFishing(runs.current,held.current);state.current=fishingStep(state.current,held.current)}
    setDisplay({...state.current});
   }
   last=now;if(state.current.result==='playing')id=requestAnimationFrame(frame);
  };
  window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);id=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(id);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility)};
 },[started]);
 const pull=fishingPull(display.tick),finished=display.result!=='playing';
 return <section className="harbor-panel harbor-fishing">
  <header><div><small>{tx(['钓鱼码头','FISHING PIER'],locale)}</small><h2>{tx(['慢慢收，别着急','Easy does it'],locale)}</h2></div><button onClick={onLeave}>{tx(['收竿','Leave'],locale)}</button></header>
  <div className="harbor-panel__body">
   <div className="harbor-fishing__water">
    <div className="harbor-fishing__float" style={{left:(25+display.progress*50)+'%',transform:'translateY('+(Math.sin(display.tick/8)*(4+pull*8))+'px)'}}><i/></div>
    <div className="harbor-fishing__caption">{!started?tx(['露丝把鱼竿递给你。','Ruth offers you the rod.'],locale):finished?tx(display.result==='caught'?['鱼靠岸了！','You brought it in!']:['鱼游走了，下次再试。','It slipped away. Another time.'],locale):tx(pull>.65?['鱼正在用力——松手放线','It’s pulling—let the line out']:['鱼安静些了——按住收线','It’s calmer—hold to reel'],locale)}</div>
   </div>
   {!started?<><p>{tx(['按住按钮收线，鱼用力时松开。线绷到红色时，先放松一点。没钓到也不会损失东西。','Hold to reel. Release when the fish pulls. If the line reaches the red zone, ease off. You won’t lose anything if it gets away.'],locale)}</p><button className="harbor-primary harbor-wide" onClick={()=>setStarted(true)}>{tx(['抛下鱼钩','Cast the line'],locale)}</button></>:<>
    <label className="harbor-fishing__meter">{tx(['鱼离岸边','Bringing it ashore'],locale)}<progress max={1} value={display.progress}/></label>
    <label className={'harbor-fishing__meter '+(display.tension>.78?'is-danger':'')}>{tx(['鱼线张力','Line tension'],locale)}<progress max={1} value={display.tension}/></label>
    {finished?<button className="harbor-primary harbor-wide" onClick={()=>onFinish(runs.current)}>{tx(['收好鱼竿','Put the rod away'],locale)}</button>:<button className="harbor-primary harbor-fishing__reel" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);held.current=true}} onPointerUp={()=>held.current=false} onPointerCancel={()=>held.current=false} onLostPointerCapture={()=>held.current=false}>{tx(['按住收线 · 松开放线','Hold to reel · release to ease'],locale)}</button>}
   </>}
  </div>
 </section>;
}
