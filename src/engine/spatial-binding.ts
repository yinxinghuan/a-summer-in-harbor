/** Portable authoring boundary. No game IDs, renderer, storage or network here. */
export type SpatialPoint={x:number;y:number}
export interface SpatialBindingDefinition {
 version:1;cartridgeId:string;mapVersion:string;
 actionScope?:'scene';
 scenes:Array<{id:string;storyLocationId?:string;spawn:SpatialPoint}>;
 entities:Array<{id:string;scene:string;position:SpatialPoint;approach:SpatialPoint;states:readonly string[];actions:readonly string[]}>;
 portals:Array<{actionId:string;fromScene?:string;scene:string;position:SpatialPoint}>;
 characters:Array<{id:string;kind:'physical'|'mediated';travels?:boolean;entities:readonly string[]}>;
 interactionDistance:number;
}
export interface SpatialStoryDefinition {
 id:string;
 initialMap:readonly {id:string;current?:boolean}[];
 characters:readonly {id:string}[];
 domainRules?:{rules:readonly {id:string;effects:readonly {type:string;nodeId?:string}[]}[]};
}
export type SpatialSnapshot={cartridgeId:string;map:readonly {id:string;current?:boolean}[];characters:readonly {id:string}[]}
export class SpatialBindingError extends Error{
 constructor(public code:string,public detail:string){super(code+': '+detail)}
}
const fail=(code:string,detail:string):never=>{throw new SpatialBindingError(code,detail)}
function unique<T extends {id:string}>(items:readonly T[],kind:string){
 const result=new Map<string,T>()
 for(const item of items){if(!item.id||result.has(item.id))fail('DUPLICATE_SPATIAL_ID',kind+'/'+item.id);result.set(item.id,item)}
 return result
}
/** Compile the actual authored world against the actual StoryCartridge, before
 * admitting actions. Validation does not manufacture rules, art or save data. */
export function compileSpatialBinding(story:SpatialStoryDefinition,input:SpatialBindingDefinition,isWalkable:(scene:string,p:SpatialPoint)=>boolean){
 const world=structuredClone(input),scenes=unique(world.scenes,'scene'),entities=unique(world.entities,'entity'),characters=unique(world.characters,'character'),rules=unique(story.domainRules?.rules??[],'rule')
 if(world.version!==1||!world.mapVersion||world.cartridgeId!==story.id)fail('SPATIAL_CARTRIDGE_MISMATCH',story.id)
 if(world.actionScope!==undefined&&world.actionScope!=='scene')fail('INVALID_ACTION_SCOPE',story.id)
 if(!Number.isFinite(world.interactionDistance)||world.interactionDistance<=0)fail('INVALID_INTERACTION_DISTANCE','distance')
 const checkPoint=(scene:string,p:SpatialPoint)=>scenes.has(scene)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&isWalkable(scene,{...p})
 const storyScenes=unique(story.initialMap,'story-scene'),storyPeople=unique(story.characters,'story-character')
 const locationOf=(id:string)=>{const s=scenes.get(id);return s?.storyLocationId??s?.id}
 const roomsFor=(location:string)=>world.scenes.filter(s=>locationOf(s.id)===location).map(s=>s.id)
 if(story.initialMap.filter(n=>n.current).length!==1)fail('INVALID_INITIAL_SCENE','current')
 for(const id of storyScenes.keys())if(!roomsFor(id).length)fail('UNBOUND_STORY_SCENE',id)
 for(const [id,s] of scenes){if(!storyScenes.has(locationOf(id)!))fail('UNKNOWN_STORY_SCENE',id);if(!checkPoint(id,s.spawn))fail('INVALID_SPATIAL_SPAWN',id)}
 const actions=new Map<string,string[]>(),portals=new Map<string,SpatialBindingDefinition['portals'][number]>()
 const portalKey=(id:string,scene:string)=>JSON.stringify([id,scene])
 for(const [id,e] of entities){
  if(!scenes.has(e.scene)||!Number.isFinite(e.position.x)||!Number.isFinite(e.position.y))fail('INVALID_ENTITY_SCENE',id)
  if(!checkPoint(e.scene,e.approach)||Math.hypot(e.approach.x-e.position.x,e.approach.y-e.position.y)>=world.interactionDistance)fail('INVALID_ENTITY_APPROACH',id)
  if(!e.states.length||new Set(e.states).size!==e.states.length||e.states.some(s=>!s))fail('INVALID_ENTITY_STATES',id)
  for(const action of e.actions){const prior=actions.get(action)??[];if(prior.length&&(world.actionScope!=='scene'||prior.some(p=>entities.get(p)!.scene===e.scene)))fail('DUPLICATE_ACTION_BINDING',action);if(!rules.has(action))fail('MISSING_STORY_RULE',action);actions.set(action,[...prior,id])}
 }
 for(const p of world.portals){
  const sources=actions.get(p.actionId)??[],source=p.fromScene??(sources.length===1?entities.get(sources[0])!.scene:undefined)
  if(!source||!sources.some(id=>entities.get(id)!.scene===source)||!checkPoint(p.scene,p.position))fail('INVALID_PORTAL_BINDING',p.actionId)
  const key=portalKey(p.actionId,source!)
  if(portals.has(key))fail('DUPLICATE_PORTAL_BINDING',p.actionId)
  portals.set(key,p)
 }
 for(const [id,rule] of rules){
  if(!actions.has(id))fail('UNBOUND_STORY_ACTION',id)
  for(const target of actions.get(id)!){
   const from=entities.get(target)!.scene,maps=rule.effects.filter(e=>e.type==='map'),portal=portals.get(portalKey(id,from))
   const sourceLocation=locationOf(from),destination=portal?locationOf(portal.scene):sourceLocation
   if(maps.length>1||(maps.length>0&&!portal)||(portal&&maps.length===0&&sourceLocation!==destination)||(maps.length===1&&maps[0].nodeId!==destination))fail('PORTAL_RULE_MISMATCH',id)
  }
 }
 for(const [id,c] of characters){
  if(!storyPeople.has(id))fail('UNKNOWN_STORY_CHARACTER',id)
  if(!['physical','mediated'].includes(c.kind)||!c.entities.length||new Set(c.entities).size!==c.entities.length||c.entities.some(e=>!entities.has(e)))fail('INVALID_CHARACTER_BINDING',id)
  if(c.kind==='physical'&&(c.travels?new Set(c.entities.map(e=>entities.get(e)!.scene)).size!==c.entities.length:c.entities.length!==1))fail('AMBIGUOUS_PHYSICAL_CHARACTER',id)
 }
 for(const id of storyPeople.keys())if(!characters.has(id))fail('UNBOUND_STORY_CHARACTER',id)
 const current=(snapshot:SpatialSnapshot)=>{
  if(snapshot.cartridgeId!==world.cartridgeId)fail('SPATIAL_SAVE_MISMATCH',snapshot.cartridgeId)
  unique(snapshot.map,'saved-scene');unique(snapshot.characters,'saved-character')
  if(snapshot.map.some(n=>!storyScenes.has(n.id)))fail('UNREPRESENTABLE_SCENE','unknown saved location')
  const active=snapshot.map.filter(n=>n.current)
  if(active.length!==1)fail('UNREPRESENTABLE_SCENE','current scene')
  for(const c of snapshot.characters)if(!characters.has(c.id))fail('UNREPRESENTABLE_CHARACTER',c.id)
  return active[0].id
 }
 const locate=(snapshot:SpatialSnapshot,explicitScene?:string)=>{
  const location=current(snapshot),rooms=roomsFor(location)
  if(explicitScene){if(locationOf(explicitScene)!==location)fail('SPATIAL_LOCATION_MISMATCH',explicitScene);return explicitScene}
  if(rooms.length!==1)fail('AMBIGUOUS_SPATIAL_SCENE',location)
  return rooms[0]
 }
 return {
  cartridgeId:world.cartridgeId,mapVersion:world.mapVersion,
  actionIds:()=>[...actions.keys()],
  storyLocationIds:()=>[...storyScenes.keys()],
  characterIds:()=>[...characters.keys()],
  roomsFor,
  locate,
  validPosition:checkPoint,
  targetFor:(id:string,scene?:string)=>{const matches=(actions.get(id)??[]).filter(e=>!scene||entities.get(e)!.scene===scene);if(matches.length>1)fail('AMBIGUOUS_ACTION_TARGET',id);return matches[0]},
  characterEntities:(id:string,scene:string)=>characters.get(id)?.entities.filter(e=>entities.get(e)!.scene===scene)??[],
  canInteract:(target:string,scene:string,p:SpatialPoint)=>entities.get(target)?.scene===scene&&checkPoint(scene,p)&&Math.hypot(p.x-entities.get(target)!.position.x,p.y-entities.get(target)!.position.y)<world.interactionDistance,
  admits:(actionId:string,target:string,scene:string,p:SpatialPoint)=>(actions.get(actionId)??[]).includes(target)&&entities.get(target)?.scene===scene&&checkPoint(scene,p)&&Math.hypot(p.x-entities.get(target)!.position.x,p.y-entities.get(target)!.position.y)<world.interactionDistance,
  assertTransition:(before:SpatialSnapshot,after:SpatialSnapshot,actionId:string|null,currentSceneId?:string)=>{
   const from=locate(before,currentSceneId),portal=actionId?portals.get(portalKey(actionId,from)):undefined
   const to=portal?portal.scene:from,afterLocation=current(after)
   if(actionId&&!(actions.get(actionId)??[]).some(id=>entities.get(id)!.scene===from))fail('PORTAL_SOURCE_MISMATCH',actionId)
   if(locationOf(to)!==afterLocation)fail(portal?'PORTAL_STORY_MISMATCH':'UNADMITTED_STORY_TRANSITION',from+' -> '+afterLocation)
   return portal?{scene:portal.scene,position:{...portal.position}}:undefined
  },
 }
}
