import {compileSpatialBinding,type SpatialSnapshot} from '../engine/spatial-binding';
import {rooms,world,people,type Entity} from '../world/data';
import {walkable} from '../engine/world';
import {topics,type Save,type Action} from './state';
import {GAME_UUID} from '../game-id';
const key=(scene:string,entity:string,verb:string)=>scene+'/'+entity+'/'+verb;
function verbs(e:Entity):string[]{
 if(e.kind==='portal')return ['travel'];
 if(e.person)return ['introduce','ask',...(e.person==='june'?['notes-generate']:[]),...(topics[e.person]??[]).map(t=>'talk:'+t.id),...(e.person==='idris'?['sparring','footwork','endurance']:e.person==='ruth'?['fishing']:[]).map(id=>'challenge-start:'+id)];
 return [...(e.actions??[]),...(e.id==='terrace'?['challenge-start:repair']:e.id==='old-map'?['challenge-start:map']:[])];
}
const entityDefs=Object.values(rooms).flatMap(r=>r.entities.map(e=>({
 id:r.id+'/'+e.id,scene:r.id,position:{x:e.at.x-8,y:e.at.y-6},approach:e.approach,states:['present'],
 actions:verbs(e).map(v=>key(r.id,e.id,v)),
})));
const rules=Object.values(rooms).flatMap(r=>r.entities.flatMap(e=>verbs(e).map(v=>({id:key(r.id,e.id,v),effects:e.destination?[{type:'map',nodeId:e.destination}]:[]}))));
const initialMap=Object.values(rooms).map(r=>({id:r.id,current:r.id==='station'}));
const characters=Object.keys(people).map(id=>({id}));
export const spatialBinding=compileSpatialBinding({id:GAME_UUID,initialMap,characters,domainRules:{rules}},{
 version:1,cartridgeId:GAME_UUID,mapVersion:'harbor-map-v1',actionScope:'scene',interactionDistance:75,
 scenes:Object.values(rooms).map(r=>({id:r.id,spawn:r.spawn})),entities:entityDefs,
 characters:characters.map(p=>({id:p.id,kind:'physical',entities:Object.values(rooms).flatMap(r=>r.entities.filter(e=>e.person===p.id).map(e=>r.id+'/'+e.id))})),
 portals:Object.values(rooms).flatMap(r=>r.entities.filter(e=>e.destination).map(e=>({
  actionId:key(r.id,e.id,'travel'),fromScene:r.id,scene:e.destination!,
  position:rooms[e.destination!].entities.find(back=>back.destination===r.id)?.approach??rooms[e.destination!].spawn,
 }))),
},(scene,p)=>walkable(world,scene,p));
export const spatialSnapshot=(s:Save):SpatialSnapshot=>({cartridgeId:GAME_UUID,map:initialMap.map(r=>({id:r.id,current:r.id===s.scene})),characters:s.known.map(id=>({id}))});
export function admitSpatialAction(s:Save,a:Action){
 if(['travel-map','challenge-finish'].includes(a.action))return null; // domain-specific gates remain authoritative
 const actionKey=key(s.scene,a.target,a.action);
 if(!spatialBinding.admits(actionKey,s.scene+'/'+a.target,s.scene,a.position))throw Error('SPATIAL_ACTION_NOT_ADMITTED');
 return actionKey;
}
