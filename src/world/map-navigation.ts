import {rooms,type Entity,type Words} from './data';
import type {Save} from '../story/state';
import {findPath,type Point} from '../engine/world';
import {worldWithFlags} from './data';
import {globalPoint,localPoint,sameCluster} from '../candidate/continuity';
export const mapAreas=['station','harbor','market','coast','hill'];
export type RouteFailure='UNKNOWN_TARGET'|'CURRENT_LOCATION'|'KEY_NEEDED'|'SETTLE_FIRST'|'NOTES_LOCKED'|'LOCATION_UNKNOWN'|'TRAVEL_ROUTE_UNAVAILABLE'|'CHALLENGE_ACTIVE';
export const routeMessages:Record<RouteFailure,Words>={UNKNOWN_TARGET:['这里暂未开放。','This place is not available.'],CURRENT_LOCATION:['你正在这里。','You are here.'],KEY_NEEDED:['先向玛拉取得租屋钥匙。','Get your room key from Mara first.'],SETTLE_FIRST:['先回租屋放下行李。','Put your bag down in your room first.'],NOTES_LOCKED:['先发现修理铺里的这条线索。','Discover this lead at the workshop first.'],LOCATION_UNKNOWN:['首次到访请步行，熟悉整条路线后可快捷返回。','Walk on your first visit. Quick return needs a familiar route.'],TRAVEL_ROUTE_UNAVAILABLE:['目前没有可通行的路线。','There is no open route right now.'],CHALLENGE_ACTIVE:['先结束当前活动再出发。','Finish the current activity before leaving.']};
export type NavigationSave=Pick<Save,'scene'|'flags'|'visited'|'fieldNotes'|'activeChallenge'|'position'>;
/** Same entrance conditions as ordinary authoritative travel. No UI-only unlocks. */
export function entranceFailure(s:NavigationSave,dest:string):RouteFailure|undefined{
 if(!rooms[dest])return 'UNKNOWN_TARGET';
 if(dest.startsWith('workshop-annex-')&&!s.fieldNotes?.rooms.some(r=>r.id===dest))return 'NOTES_LOCKED';
 if(dest==='home'&&!s.flags.includes('key'))return 'KEY_NEEDED';
 if(!s.flags.includes('unpacked')&&!['station','home','cafe','grocery'].includes(dest))return 'SETTLE_FIRST';
}
export function visiblePlaces(s:NavigationSave){return Object.keys(rooms).filter(id=>!id.startsWith('workshop-annex-')||s.fieldNotes?.rooms.some(r=>r.id===id));}
export type MapRoute={places:string[];portals:Entity[];failure?:RouteFailure};
export function mapRoute(s:NavigationSave,target:string,quick=false):MapRoute{
 if(!visiblePlaces(s).includes(target))return {places:[],portals:[],failure:'UNKNOWN_TARGET'};
 if(target===s.scene)return {places:[s.scene],portals:[],failure:'CURRENT_LOCATION'};
 if(s.activeChallenge)return {places:[],portals:[],failure:'CHALLENGE_ACTIVE'};
 const denied=entranceFailure(s,target);if(denied)return {places:[],portals:[],failure:denied};
 if(quick&&!s.visited.includes(target))return {places:[],portals:[],failure:'LOCATION_UNKNOWN'};
 const queue=[s.scene],came=new Map<string,{from:string;portal:Entity}>(),seen=new Set(queue);
 for(const id of queue){for(const portal of rooms[id]?.entities??[]){const next=portal.destination;if(portal.kind!=='portal'||!next||seen.has(next)||entranceFailure(s,next)||(quick&&!s.visited.includes(next)))continue;seen.add(next);came.set(next,{from:id,portal});queue.push(next)}}
 if(!came.has(target))return {places:[],portals:[],failure:quick?'LOCATION_UNKNOWN':'TRAVEL_ROUTE_UNAVAILABLE'};
 const places=[target],portals:Entity[]=[];let id=target;
 while(id!==s.scene){const p=came.get(id)!;portals.unshift(p.portal);id=p.from;places.unshift(id)}
 return {places,portals};
}
/** Only queues the next actual entrance. Entering remains an explicit authoritative action. */
export function walkingEntrance(s:NavigationSave,target:string):Entity|undefined{
 const r=mapRoute(s,target);if(r.failure)return;
 const first=r.portals[0];
 if(sameCluster(s.scene,target)){
  const at=rooms[target].spawn;
  return {...first,id:'map-walk--'+target,at:localPoint(s.scene,globalPoint(target,at)),approach:localPoint(s.scene,globalPoint(target,at))};
 }
 return first;
}
export function entranceReachable(s:NavigationSave,target:string){
 const e=walkingEntrance(s,target);if(!e)return false;
 if(sameCluster(s.scene,target)){const w=worldWithFlags(s.flags),gates={market:{x:597,y:180},bazaar:{x:472,y:580}};return findPath(w,s.scene,s.position,gates[s.scene as keyof typeof gates]).length>0&&findPath(w,target,gates[target as keyof typeof gates],localPoint(target,globalPoint(s.scene,e.approach))).length>0;}
 return findPath(worldWithFlags(s.flags),s.scene,s.position,e.approach).length>0;
}
export function mapPosition(scene:string,p:Point,area:string):Point|undefined{
 if(rooms[scene]?.area!==area)return;
 if(scene===area)return p;
 return rooms[area].entities.find(e=>e.kind==='portal'&&e.destination===scene)?.at;
}
export function placeTitle(s:NavigationSave,id:string):Words{return s.fieldNotes?.rooms.find(r=>r.id===id)?.title??rooms[id]?.title??['未开放','Unavailable'];}
