import type {Save} from '../src/story/state';
import type {PlantUsesSave} from '../src/life/plant-uses';
import {mintDefinitionHash} from './plant-uses-rules';
import {weatherAt} from '../src/weather/state';
import {createWeatherEcology,mintRainCap,validWeatherEcology} from '../src/weather/ecology';
export function initializeWeatherEcology(s:Save,enabled:boolean){if(enabled&&s.weatherV1&&!s.weatherEcologyV1)s.weatherEcologyV1=createWeatherEcology(s.townMinutes??540)}
/** Only an already recovering, unchanged native mint can use the interval.
 * Natural elapsed time plus at most one extra recovery minute per rain minute;
 * the ceil bound stops assistance at the actual accelerated recovery instant. */
export function settleWeatherEcology(before:Save,next:Save){
 const e=next.weatherEcologyV1;if(!e)return;
 const to=next.townMinutes??540,from=e.settledThrough;
 if(!validWeatherEcology(e,from,next.weatherV1))throw Error('UNSUPPORTED_WEATHER_ECOLOGY_SAVE');
 if(!Number.isSafeInteger(to)||to<from)throw Error('WEATHER_ECOLOGY_TIME_REVERSED');
 const old=(before as PlantUsesSave).plantUsesV1?.mint,m=(next as PlantUsesSave).plantUsesV1?.mint;
 const recovering=m?.definitionHash===mintDefinitionHash&&m.stock===1&&m.recoverAt!==null&&old?.recoverAt===m.recoverAt&&old.definitionHash===m.definitionHash;
 if(recovering){let at=from;
  while(at<to&&m!.recoverAt!>at&&m!.recoverAt!>720){
   const day=Math.floor(at/1440);if(e.rainDay!==day){e.rainDay=day;e.mintRainUsed=0}
   const parameters=next.weatherV1!.parameters,slotEnd=540+(Math.floor((at-540)/parameters.slotMinutes)+1)*parameters.slotMinutes,end=Math.min(to,(day+1)*1440,slotEnd,m!.recoverAt!);
   if(weatherAt(at,parameters)==='light-rain'){
    const grant=Math.min(end-at,mintRainCap-e.mintRainUsed,Math.ceil((m!.recoverAt!-at)/2),m!.recoverAt!-720);
    m!.recoverAt!-=grant;e.mintRainUsed+=grant;
   }
   at=end;
  }
 }
 const day=Math.floor(to/1440);if(e.rainDay!==day){e.rainDay=day;e.mintRainUsed=0}e.settledThrough=to;
}
