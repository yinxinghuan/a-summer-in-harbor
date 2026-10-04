import {rooms,type Words} from '../world/data';
import {residentRoutes,townMinutes,townPeriod,residentPeople,type TownState} from '../world/residents';
type GuideState=TownState&{visited:string[]};
export function routineReply(person:string):Words{const r=residentRoutes[person];return [`“上午常在${rooms[r[0].scene].title[0]}，十二点后去${rooms[r[1].scene].title[0]}，十七点到二十一点通常在${rooms[r[2].scene].title[0]}。只是平日的习惯，不用特意赶。”`, `“Mornings usually find me at ${rooms[r[0].scene].title[1]}, after noon at ${rooms[r[1].scene].title[1]}, and from 17:00 to 21:00 at ${rooms[r[2].scene].title[1]}. Just my usual routine. No need to rush.”`]}
export function learnedRoutine(s:TownState,person:string){return !!residentPeople[person]&&s.known.includes(person)&&s.flags.includes(`talk:${person}:routine`)}
export function residentGuide(s:TownState,person:string){
 if(!learnedRoutine(s,person))return null;
 const r=residentRoutes[person],period=townPeriod(s),index=['morning','afternoon','evening'].indexOf(period),m=townMinutes(s)%1440;
 const current=index<0?null:r[index].scene,next=index===0?r[1].scene:index===1?r[2].scene:index===2?null:r[0].scene;
 const at=index===0?'12:00':index===1?'17:00':index===2?'21:00':m<360?'06:00':'06:00';
 const now:Words=current?[`这个时段常在：${rooms[current].title[0]}`,`Usually now: ${rooms[current].title[1]}`]:['夜间通常不外出。','Usually away for the night.'];
 const then:Words=next?[`${index<0&&m>=1260?'明天 ':''}${at} 后常去：${rooms[next].title[0]}`,`${index<0&&m>=1260?'Tomorrow ':''}${at}: usually ${rooms[next].title[1]}`]:['21:00 后通常不外出。','Usually away after 21:00.'];
 return {current,next,at,now,then,mapScene:current??next};
}
/** This estimate describes the existing single quick-travel action only.
 * Unvisited places stay locked; no graph route or movement is manufactured. */
export function arrivalWarnings(s:GuideState,destination:string):Words[]{
 if(destination===s.scene||!s.visited.includes(destination))return [];
 const after={...s,townMinutes:townMinutes(s)+20};const warnings:Words[]=[];
 for(const p of s.known){const before=residentGuide(s,p),next=residentGuide(after,p);if(!before||!next||before.current!==destination||next.current===destination)continue;
  const name=residentPeople[p].name;warnings.push(next.current?[`这次路上约二十分钟。抵达时，${name[0]}通常已去${rooms[next.current].title[0]}。`, `This trip takes twenty minutes. By arrival, ${name[1]} usually moves on to ${rooms[next.current].title[1]}.`]:[`这次路上约二十分钟。抵达时，${name[0]}通常已结束今天的外出。`,`This trip takes twenty minutes. By arrival, ${name[1]} is usually away for the night.`]);
 }return warnings;
}
