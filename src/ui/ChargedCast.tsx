import {useEffect,useRef,useState}from'react';
import {chargePower}from'../world/shore-cast-plan';
import {tx,type Locale,type Words}from'../world/data';
type Props={locale:Locale;disabled:boolean;onCast:(power?:number)=>void;onPreview?:(power:number|null)=>void;className?:string;label?:Words;detail?:string;direct?:boolean;limited?:boolean};
export function ChargedCast({locale,disabled,onCast,onPreview,className,label,detail,direct,limited}:Props){
 const [power,setPower]=useState<number|null>(null),active=useRef(false),start=useRef(0),frame=useRef(0),suppressClick=useRef(false),last=useRef(-1),callbacks=useRef({onCast,onPreview});callbacks.current={onCast,onPreview};
 const preview=(p:number|null)=>{setPower(p);callbacks.current.onPreview?.(p)};
 const cancel=()=>{if(!active.current)return;active.current=false;cancelAnimationFrame(frame.current);preview(null)};
 const begin=()=>{if(disabled||active.current)return;active.current=true;suppressClick.current=true;start.current=performance.now();last.current=-1;preview(0);const tick=()=>{if(!active.current)return;const p=chargePower(performance.now()-start.current),step=Math.round(p*20);if(step!==last.current){last.current=step;preview(p)}frame.current=requestAnimationFrame(tick)};frame.current=requestAnimationFrame(tick)};
 const release=()=>{if(!active.current)return;const p=chargePower(performance.now()-start.current);active.current=false;cancelAnimationFrame(frame.current);setPower(null);callbacks.current.onCast(p);callbacks.current.onPreview?.(null)};
 useEffect(()=>{const pause=()=>cancel(),visibility=()=>{if(document.hidden)cancel()};window.addEventListener('blur',pause);window.addEventListener('pagehide',pause);document.addEventListener('visibilitychange',visibility);return()=>{cancel();window.removeEventListener('blur',pause);window.removeEventListener('pagehide',pause);document.removeEventListener('visibilitychange',visibility)}},[]);
 useEffect(()=>{if(disabled)cancel()},[disabled]);
 return <button className={className??'harbor-primary harbor-wide'} data-shore-cast={!direct||undefined} data-direct-shore-cast={direct||undefined} data-cast-power={power===null?'ready':power.toFixed(2)} disabled={disabled} style={{touchAction:'none',userSelect:'none'}}
  onPointerDown={e=>{if(e.button!==0||!e.isPrimary||active.current)return;e.currentTarget.setPointerCapture(e.pointerId);begin()}}
  onPointerMove={e=>{if(!active.current)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cancel()}}
  onContextMenu={e=>e.preventDefault()} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel}
  onKeyDown={e=>{if((e.code==='Space'||e.key==='Enter')&&!e.repeat){e.preventDefault();begin()}}} onKeyUp={e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();release()}}}
  onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}if(!disabled)callbacks.current.onCast(.5)}}>
  <strong>{power===null?tx(label??['按住蓄力 · 松开抛竿','Hold to charge · release to cast'],locale):tx(['松开抛竿','Release to cast'],locale)+' '+Math.round(power*100)+'%'+(limited?tx([' · 距离受限',' · limited reach'],locale):'')}</strong>
  {power!==null?<span className="harbor-cast-power" role="meter" aria-label={tx(['抛竿力度','Casting power'],locale)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power*100)}><span style={{width:Math.round(power*100)+'%'}}/></span>:detail&&<small>{detail}</small>}
 </button>;
}
