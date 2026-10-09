import type {Action,Save} from '../src/story/state';
import {rooms,type Words} from '../src/world/data';
import {presentEntity} from '../src/world/residents';
import {createPlantsRegistry} from './life-plants-b2';
import {afterRainFacts,admitAfterRainDraft,type AfterRainFacts} from './after-rain-evidence';

const perspectives:Record<string,Words>={
 mara:['“雨停了，可以慢慢再走一段；累了仍可以回家休息。”','“The rain has stopped. There is time for another stroll, or to head home and rest.”'],
 elena:['“先看看原来的活株，别急着多摘；留给它恢复的余地。”','“Look at the living clump first. Leave it room to recover before taking more.”'],
 arthur:['“记下已经看见的事，下一阵天气还得继续观察。”','“Note what you have seen. The next spell of weather still needs watching.”'],
 dani:['“这是你在镇上确认的天气经历，和有出处、有日期的新闻分开记。”','“This is weather you confirmed in town. Keep it separate from news with a source and date.”'],
 owen:['“原来的采集规则照旧，雨后也不用急着把株丛摘空。”','“The collection rules still apply. No need to strip a clump after the rain.”'],
 avery:['“走熟悉的路，再看一眼已经认识的地方就好。”','“Follow a familiar route and look again at a place you already know.”'],
};
export type AfterRainView={schema:1;enabled:true;modelCallsEnabled:false;facts:AfterRainFacts|null;speakers:string[]};
/** A bounded authored action through the original authority. No model route,
 * new save fields, reward, observation credit or alternate transaction writer. */
export function createAfterRainIntegration(){
 const registry=createPlantsRegistry();
 return {
  project(s:Save):AfterRainView{
   const facts=afterRainFacts(s,registry);
   const speakers=facts?rooms[s.scene].entities.filter(e=>e.person&&perspectives[e.person]&&s.known.includes(e.person)&&presentEntity(s,e)).map(e=>e.person!):[];
   return {schema:1,enabled:true,modelCallsEnabled:false,facts,speakers:[...new Set(speakers)]};
  },
  resolve(s:Save,a:Action,person:string):Words{
   if(!perspectives[person])throw Error('AFTER_RAIN_PERSON_UNAVAILABLE');
   const p=a.payload as Record<string,unknown>;
   if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join(',')!=='effects,factId,schema,tone,topic')throw Error('UNSUPPORTED_AFTER_RAIN_DRAFT');
   const admitted=admitAfterRainDraft(s,registry,{...p,expected_version:a.expected_version});
   return [admitted.text[0]+' '+perspectives[person][0],admitted.text[1]+' '+perspectives[person][1]];
  },
 };
}
