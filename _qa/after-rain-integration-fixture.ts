import {afterRainFacts} from '../server/after-rain-evidence';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {initial,type Save,type Action} from '../src/story/state';
import {rooms} from '../src/world/data';
import {presentEntity} from '../src/world/residents';
import {createWeatherState} from '../src/weather/state';
import {createWeatherEcology} from '../src/weather/ecology';
import {mintNode,dueMinute} from '../src/life/plant-uses';
import {pinLegacy} from '../src/life/save';
import {mintDefinitionHash,basilTemplateHash} from '../server/plant-uses-rules';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {createReviewedAnimalLife} from '../server/reviewed-animal-life';
import {withWildMint} from '../server/wild-mint';
import {withBasilPlantUses} from '../server/plant-basil';
import {configuredNews} from '../server/news/configured';
export const catalogPath=new URL('../server/news/frozen-catalog-20261006.json',import.meta.url);
export function afterRainSeed(id=randomUUID(),minute=740,person='dani'):Save{
 const s:any=initial('en',id);s.townMinutes=minute;s.known=[person];s.flags=['key','unpacked','bag-returned','alternative-route','news:heard'];s.visited=Object.keys(rooms);
 s.weatherV1=createWeatherState(minute,{slotMinutes:60,rainMinutesPerDay:60});s.weatherV1.activatedAt=540;
 s.weatherEcologyV1=createWeatherEcology(minute);s.weatherEcologyV1.activatedAt=540;
 const spot=Object.values(rooms).flatMap(room=>room.outdoor?room.entities.filter(e=>e.person===person).map(e=>({room,e})):[]).find(({room,e})=>presentEntity({...s,scene:room.id},e));
 if(!spot)throw Error('NO_ORIGINAL_VISIBLE_OUTDOOR_PERSON');s.scene=spot.room.id;s.position={...spot.e.approach};
 const edition=JSON.parse(readFileSync(catalogPath,'utf8')).records.find((r:any)=>r.status==='admitted');
 if(edition){s.newsMode='live';s.newsEdition=edition}
 s.plantUsesV1={schema:1,deliveries:0,offerReadAt:700,offerReadSource:'own-qa-offer',order:{id:'own-qa-basil-order',template:'theo-basil-v1',templateHash:basilTemplateHash,crop:createPlantsRegistry().ref('crop:basil'),quantity:2,reward:7,acceptedMinute:700,dueMinute:dueMinute(700)},mint:{node:mintNode.id,definitionHash:mintDefinitionHash,stock:2,recoverAt:null,leaves:0,observedAt:700,observationSource:'own-qa-observation'}};
 const pinned:any=pinLegacy(s,createPlantsRegistry());pinned.lifeV1.cooldownUntil=800;
 pinned.landV1={schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'own-qa-permission',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},sourceAction:'own-qa-land',minute:540}]};
 pinned.lifeV1.plots['life-bed-1']={ref:snapPeaV2Ref,grown:60,updatedAt:minute,wetUntil:minute};
 return pinned;
}
export function afterRainAssembly(seed:Save,options:any={}){
 return createExplorationAssembly({defaultRate:4000,afterRain:true,weather:{enabled:true,ecology:true},crabEnabled:true,createLife:createReviewedAnimalLife,decorateLife:(r:any)=>withWildMint(withBasilPlantUses(r,{enabled:true,newStarts:true}),{enabled:true,newStarts:true}),decorateRuntime:(r:any)=>configuredNews(r,catalogPath.pathname,()=>Date.parse('2026-10-09T22:00:00Z')),initial:(locale:any,id:string)=>({...structuredClone(seed),id,locale}),...options});
}
export function afterRainAction(head:Save,assembly:any,topic?:string):Action{
 const f=afterRainFacts(head,createPlantsRegistry())!;
 const e=rooms[head.scene].entities.find(e=>e.person===head.known[0])!;
 return {action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:{...head.position},target:e.id,action:'weather-after-rain',payload:{schema:1,factId:f.factId,topic:topic??(f.clues.length?'known-mint-ready':'rain-ended'),tone:'practical',effects:[]}};
}
