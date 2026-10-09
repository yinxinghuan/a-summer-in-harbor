import type {Save} from '../src/story/state';
import {rooms} from '../src/world/data';
import {crops,plotIds} from '../src/story/crops';
import {landRegion} from '../src/life/land';
import type {LifeSave} from '../src/life/types';
import {createPlantsRegistry} from './life-plants-b2';
import {assertWeatherReadable,createWeatherState,weatherAt,defaultWeatherParameters,validWeatherParameters,type WeatherParameters} from '../src/weather/state';
export type WeatherOptions={enabled?:boolean;newStarts?:boolean;parameters?:WeatherParameters};
/** Bounded rain, one wet-growth minute per actual raining town minute. Already
 * wet time is not counted twice; per fixed bed/day caps survive harvest/replant. */
export function createWeatherSettlement(options:WeatherOptions={}){
 const enabled=options.enabled===true,newStarts=options.newStarts!==false,parameters=options.parameters??defaultWeatherParameters,registry=createPlantsRegistry();
 if(!validWeatherParameters(parameters))throw Error('INVALID_WEATHER_INPUT');
 const initialize=(s:Save)=>{if(enabled&&newStarts&&!s.weatherV1)s.weatherV1=createWeatherState(s.townMinutes??540,parameters);return s};
 const settle=(before:Save,next:Save)=>{
  if(!next.weatherV1){if(!enabled||!newStarts)return;next.weatherV1=createWeatherState(before.townMinutes??540,parameters)}
  const w=next.weatherV1,from=w.settledThrough,to=next.townMinutes??540;
  if(to<from)throw Error('WEATHER_TIME_REVERSED');if(to===from){assertWeatherReadable(next);return}
  const plots:{key:string;p:{grown:number;updatedAt:number;wetUntil:number};maximum:number;start:number}[]=[];
  if(rooms.garden.outdoor)for(const id of plotIds){const p=next.plots?.[id];if(p)plots.push({key:'garden:'+id,p,maximum:crops[p.crop].minutes,start:Math.max(from,p.updatedAt)})}
  const s=next as LifeSave;
  for(const [id,p] of Object.entries(s.lifeV1?.plots??{})){
   const bed=s.landV1?.plots.find(b=>b.id===id.replace('life-','land-')),region=bed&&landRegion(bed.region);
   if(region&&rooms[region.scene]?.outdoor)plots.push({key:'land:'+id,p,maximum:registry.get(p.ref).growMinutes,start:Math.max(from,p.updatedAt)});
  }
  // Fold previously lazy manual watering through the activation/current minute.
  // New action-created beds start only at their actual updatedAt, never earlier.
  for(const q of plots){q.p.grown=Math.min(q.maximum,q.p.grown+Math.max(0,Math.min(q.start,q.p.wetUntil)-q.p.updatedAt));q.p.updatedAt=q.start}
  const active=plots.filter(q=>q.p.grown<q.maximum),cap=w.parameters.rainMinutesPerDay;
  let at=from;
  while(cap>0&&at<to&&active.some(q=>q.p.grown<q.maximum)){
   const day=Math.floor(at/1440);if(w.rainDay!==day){w.rainDay=day;w.water={}}
   const slotEnd=540+(Math.floor((at-540)/w.parameters.slotMinutes)+1)*w.parameters.slotMinutes,end=Math.min(to,(day+1)*1440,slotEnd);
   const rain=weatherAt(at,w.parameters)==='light-rain';
   for(const q of active){const begin=Math.max(at,q.start),p=q.p;if(begin>=end||p.grown>=q.maximum)continue;
    const wet=Math.max(0,Math.min(end,p.wetUntil)-begin);p.grown=Math.min(q.maximum,p.grown+wet);
    const dry=Math.max(begin,p.wetUntil),grant=rain?Math.min(Math.max(0,end-dry),Math.max(0,cap-(w.water[q.key]??0)),q.maximum-p.grown):0;
    if(grant>0){p.grown+=grant;p.wetUntil=Math.max(p.wetUntil,dry+grant);w.water[q.key]=(w.water[q.key]??0)+grant}
   }
   at=end;
  }
  // If no rain budget/remaining crop, manual water still settles without an
  // unbounded per-minute loop. No weather history or reward receipts appended.
  for(const q of plots){if(at<to&&q.p.grown<q.maximum)q.p.grown=Math.min(q.maximum,q.p.grown+Math.max(0,Math.min(to,q.p.wetUntil)-Math.max(at,q.start)));q.p.updatedAt=to;q.p.wetUntil=Math.max(q.p.wetUntil,to)}
  const day=Math.floor(to/1440);if(w.rainDay!==day){w.rainDay=day;w.water={}}
  w.settledThrough=to;w.kind=weatherAt(to,w.parameters);assertWeatherReadable(next);
 };
 return {initialize,settle};
}
/** Reads never migrate; time/business changes settle in the same original CAS.
 * Keeping the wrapper while closing starts preserves previously pinned readers. */
export function withWeatherRuntime<T extends {initial:(...a:any[])=>Save;prepare:(...a:any[])=>any;assertReadable:(s:Save)=>void;finalizeMotion?:(before:Save,next:Save)=>void}>(base:T,weather:ReturnType<typeof createWeatherSettlement>){
 return {...base,
  initial(...args:any[]){return weather.initialize(base.initial(...args))},
  assertReadable(s:Save){base.assertReadable(s);assertWeatherReadable(s)},
  finalizeMotion(before:Save,next:Save){base.finalizeMotion?.(before,next);weather.settle(before,next)},
  async prepare(s:Save,a:any,...args:any[]){const before=weather.initialize(structuredClone(s));const result=await base.prepare(before,a,...args);weather.settle(before,result.head);this.assertReadable(result.head);return result},
 };
}
