// Pure deterministic projection of TRUSTED spatial configuration and admitted
// content. No renderer, model, state writes, rule effects or route authority.
const fail=()=>{throw Error('SPATIAL_SLOTS_INVALID');};
const exact=(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail();};
const text=v=>{if(typeof v!=='string'||!v.trim())fail();};
const pair=v=>{if(!Array.isArray(v)||v.length!==2)fail();v.forEach(text);};
const point=v=>{exact(v,['x','y']);if(!Number.isFinite(v.x)||!Number.isFinite(v.y))fail();};
const rect=v=>{exact(v,['x','y','w','h']);if(![v.x,v.y,v.w,v.h].every(Number.isFinite)||v.w<=0||v.h<=0)fail();};
const anchor=v=>{exact(v,['at','approach']);point(v.at);point(v.approach);};
const label=v=>{exact(v,['zh','en']);text(v.zh);text(v.en);};

export function createSlotSpace(input){
 const c=structuredClone(input);
 exact(c,['sceneId','parentId','subtitle','floor','floorAsset','props','interior','spawn','obstacles','entrance','exit','slots','exitLabel','enterPrefix']);
 text(c.sceneId);text(c.parentId);if(c.sceneId===c.parentId)fail();
 pair(c.subtitle);pair(c.exitLabel);pair(c.enterPrefix);text(c.floorAsset);
 if(!Number.isSafeInteger(c.floor)||!Array.isArray(c.props)||!Array.isArray(c.obstacles)||!Array.isArray(c.slots)||!c.slots.length)fail();
 rect(c.interior);point(c.spawn);anchor(c.entrance);anchor(c.exit);c.obstacles.forEach(rect);c.slots.forEach(anchor);
 for(const p of c.props){exact(p,['asset','x','y','width','obstacles']);text(p.asset);if(![p.x,p.y,p.width].every(Number.isFinite)||p.width<=0||!Array.isArray(p.obstacles))fail();p.obstacles.forEach(rect);}
 return (location,actions)=>{
  if(location?.id!==c.sceneId||location.parent_id!==c.parentId||!Array.isArray(actions)||actions.length!==c.slots.length)fail();
  label(location.label);text(location.enter_action_id);text(location.escape_action_id);
  for(const a of actions){text(a?.id);label(a.label);}
  if(new Set([location.enter_action_id,location.escape_action_id,...actions.map(a=>a.id)]).size!==actions.length+2)fail();
  const entity=(id,names,position)=>({id,kind:'dynamic',rule:id,label:names,...structuredClone(position)});
  return {
   room:{id:location.id,title:[location.label.zh,location.label.en],subtitle:[...c.subtitle],floor:c.floor,floorAsset:c.floorAsset,props:structuredClone(c.props),entities:[entity(location.escape_action_id,[...c.exitLabel],c.exit),...actions.map((a,i)=>entity(a.id,[a.label.zh,a.label.en],c.slots[i]))]},
   scene:{interior:structuredClone(c.interior),spawn:{...c.spawn},obstacles:structuredClone([...c.props.flatMap(p=>p.obstacles),...c.obstacles])},
   entrance:entity(location.enter_action_id,[c.enterPrefix[0]+location.label.zh,c.enterPrefix[1]+location.label.en],c.entrance),
  };
 };
}

// Integration supplies its OWN actor footprint, walkability and pathfinder.
// This is mechanical admission evidence, not artifact approval or adoption.
export function assertSlotSpaceReachable(space,{world,parentId,walkable,findPath,reach}){
 const id=space.room.id,parent=world.scenes[parentId];
 if(!parent||Object.hasOwn(world.scenes,id)||!Number.isFinite(reach)||reach<=0)throw Error('SPATIAL_ROUTE_INVALID');
 const combined={...world,scenes:{...world.scenes,[id]:space.scene}};
 const near=(p,e)=>Math.hypot(p.x+world.actor.w/2-e.at.x,p.y+world.actor.h/2-e.at.y)<reach;
 const route=(scene,from,to)=>{
  if(!walkable(combined,scene,from)||!walkable(combined,scene,to))throw Error('SPATIAL_ROUTE_BLOCKED');
  if(from.x!==to.x||from.y!==to.y){const path=findPath(combined,scene,from,to);if(!Array.isArray(path)||!path.length||path.some(p=>!walkable(combined,scene,p))||path.at(-1).x!==to.x||path.at(-1).y!==to.y)throw Error('SPATIAL_ROUTE_BLOCKED');}
 };
 if(!near(space.entrance.approach,space.entrance))throw Error('SPATIAL_TARGET_OUT_OF_REACH');
 route(parentId,parent.spawn,space.entrance.approach);
 for(const e of space.room.entities){if(!near(e.approach,e))throw Error('SPATIAL_TARGET_OUT_OF_REACH');route(id,space.scene.spawn,e.approach);route(id,e.approach,space.scene.spawn);}
 return true;
}
