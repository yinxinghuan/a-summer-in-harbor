import {useEffect,useState,type CSSProperties} from 'react';
import type {WeatherKind} from './state';
export type WeatherQuality='full'|'low';
/** Screen-space decoration only. One shade and at most twelve CSS streaks;
 * no renderer, camera, collision, world time or per-frame React updates. */
export function WeatherLayer({kind,outdoor,paused,quality}:{kind:WeatherKind;outdoor:boolean;paused:boolean;quality:WeatherQuality}){
 const [hidden,setHidden]=useState(()=>document.hidden);
 useEffect(()=>{const changed=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',changed);return()=>document.removeEventListener('visibilitychange',changed)},[]);
 if(!outdoor)return null;
 const count=kind==='light-rain'?(quality==='low'?4:12):0;
 return <div className="harbor-weather" data-weather={kind} data-weather-quality={quality} data-weather-paused={paused||hidden} aria-hidden="true">
  <div className="harbor-weather__shade"/>
  {count>0&&<div className="harbor-weather__rain">{Array.from({length:count},(_,i)=><i key={i} style={{'--rain-x':`${(i*37+11)%100}%`,'--rain-delay':`${-(i%7)*.13}s`,'--rain-duration':`${.9+(i%3)*.12}s`} as CSSProperties}/>)}</div>}
 </div>
}
