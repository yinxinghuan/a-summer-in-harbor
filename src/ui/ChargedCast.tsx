import {useEffect,useRef,useState}from'react';
import {chargePower}from'../world/shore-cast-plan';
import {tx,type Locale,type Words}from'../world/data';
type Props={locale:Locale;disabled:boolean;onCast:(power?:number)=>void;onPreview?:(power:number|null)=>boolean|void;className?:string;label?:Words;detail?:string;direct?:boolean;limited?:boolean};
export function ChargedCast({locale,disabled,onCast,onPreview,className,label,detail,direct,limited}:Props){
 const [power,setPower]=useState<number|null>(null),active=useRef(false),start=useRef(0),frame=useRef(0),suppressClick=useRef(false),last=useRef(-1),owner=useRef<{kind:'pointer';id:number}|{kind:'key';key:string}|null>(null),callbacks=useRef({onCast,onPreview});callbacks.current={onCast,onPreview};
 const preview=(p:number|null)=>{setPower(p);return callbacks.current.onPreview?.(p)};
 const cancel=()=>{if(!active.current)return;if(owner.current?.kind==='key')suppressClick.current=false;active.current=false;owner.current=null;cancelAnimationFrame(frame.current);preview(null)};
 const begin=(who:NonNullable<typeof owner.current>)=>{if(disabled||active.current)return;active.current=true;owner.current=who;suppressClick.current=who.kind==='pointer';start.current=performance.now();last.current=-1;if(preview(0)===false){cancel();return}const tick=()=>{if(!active.current)return;const p=chargePower(performance.now()-start.current),step=Math.round(p*20);if(step!==last.current){last.current=step;if(preview(p)===false){cancel();return}}frame.current=requestAnimationFrame(tick)};frame.current=requestAnimationFrame(tick)};
 const release=()=>{if(!active.current)return;const p=chargePower(performance.now()-start.current);active.current=false;owner.current=null;cancelAnimationFrame(frame.current);setPower(null);callbacks.current.onCast(p);callbacks.current.onPreview?.(null)};
 useEffect(()=>{const pause=()=>cancel(),visibility=()=>{if(document.hidden)cancel()};window.addEventListener('blur',pause);window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',visibility);return()=>{cancel();window.removeEventListener('blur',pause);window.removeEventListener('pagehide',pause);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(disabled)cancel()},[disabled]);
 return <button className={className??'harbor-primary harbor-wide'} data-shore-cast={!direct||undefined} data-direct-shore-cast={direct||undefined} data-cast-power={power===null?'ready':power.toFixed(2)} disabled={disabled} style={{touchAction:'none',userSelect:'none'}}
  onPointerDown={e=>{if(disabled||e.button!==0||!e.isPrimary||active.current)return;e.currentTarget.setPointerCapture(e.pointerId);begin({kind:'pointer',id:e.pointerId})}}
  onPointerMove={e=>{if(!active.current||owner.current?.kind!=='pointer'||owner.current.id!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancel()}}
  onContextMenu={e=>e.preventDefault()} onPointerUp={e=>{if(owner.current?.kind==='pointer'&&owner.current.id===e.pointerId)release()}} onPointerCancel={e=>{if(owner.current?.kind==='pointer'&&owner.current.id===e.pointerId)cancel()}} onLostPointerCapture={e=>{if(owner.current?.kind==='pointer'&&owner.current.id===e.pointerId)cancel()}} onBlur={cancel}
  onKeyDown={e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(!e.repeat)begin({kind:'key',key:e.code==='Space'?'Space':'Enter'})}}} onKeyUp={e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();const key=e.code==='Space'?'Space':'Enter';if(owner.current?.kind==='key'&&owner.current.key===key)release()}}}
  onClick={e=>{if(active.current){e.preventDefault();return}if(suppressClick.current){suppressClick.current=false;return}if(!disabled)callbacks.current.onCast(.5)}}>
  <strong>{power===null?tx(label??['按住蓄力 · 松开抛竿','Hold to charge · release to cast'],locale):tx(['松开抛竿','Release to cast'],locale)+' '+Math.round(power*100)+'%'+(limited?tx([' · 距离受限',' · limited reach'],locale):'')}</strong>
  {power!==null?<span className="harbor-cast-power" role="meter" aria-label={tx(['抛竿力度','Casting power'],locale)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power*100)}><span style={{width:Math.round(power*100)+'%'}}/></span>:detail&&<small>{detail}</small>}
 </button>;
}
