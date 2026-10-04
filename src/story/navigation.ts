import {presentEntity} from '../world/residents';
import {rooms,type Entity} from '../world/data';
import {has,hasCoastRoute,type Save} from './state';
export function objectivePlace(s:Save):{scene:string;entity:string}|null{
 if(has(s,'market-open'))return null;
 if(!has(s,'key'))return {scene:'station',entity:'mara'};
 if(!has(s,'unpacked'))return {scene:'home',entity:'bed'};
 if(!has(s,'talk:mara:settle')&&!s.items.toolbag&&!has(s,'bag-returned'))return {scene:'station',entity:'mara'};
 if(!has(s,'bag-returned'))return s.items.toolbag?{scene:'station',entity:'mara'}:{scene:'cafe',entity:'theo'};
 if(!has(s,'market-known'))return {scene:'bazaar',entity:'notice'};
 if(!has(s,'bridge-seen')&&!hasCoastRoute(s))return {scene:'path',entity:'bridge'};
 if(!hasCoastRoute(s)){
  if(!s.items.toolkit)return {scene:'workshop',entity:'june'};
  if((s.items.wood??0)<2)return {scene:'beach',entity:'driftwood'};
  return {scene:'path',entity:'bridge'};
 }
 if(!has(s,'route-open'))return {scene:'lighthouse',entity:'gate'};
 if(!has(s,'market-open'))return {scene:'bazaar',entity:'notice'};
 return null;
}
/** A walking hint to the next real entrance, never a teleport to an unseen room. */
export function nextObjectiveEntrance(s:Save):Entity|undefined{
 const goal=objectivePlace(s);if(!goal)return;
 if(s.scene===goal.scene)return rooms[s.scene].entities.find(e=>e.id===goal.entity&&presentEntity(s,e));
 const queue=[s.scene],came=new Map<string,string>();came.set(s.scene,'');
 for(let i=0;i<queue.length;i++){
  const id=queue[i];if(id===goal.scene)break;
  for(const next of rooms[id].neighbors)if(!came.has(next)){came.set(next,id);queue.push(next)}
 }
 if(!came.has(goal.scene))return;
 let next=goal.scene;while(came.get(next)!==s.scene){const parent=came.get(next);if(!parent)return;next=parent}
 return rooms[s.scene].entities.find(e=>e.destination===next);
}
