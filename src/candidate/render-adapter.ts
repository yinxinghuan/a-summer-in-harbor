import {Assets} from 'pixi.js';
import type {Space,SpaceOptions} from '../engine/rpg-space';
import type {Point} from '../engine/world';
import {walkable,findPath} from '../engine/world';
import {appendMotionTrace} from './motion-trace';
import {predictionHorizon,maximumQueuedPoints,traceLength} from './motion-outbox';
import {CLUSTER,COASTAL,clusters,clusterFor,clusterWorld,clusterWalkable,globalPoint,localPoint,renderScene,isCluster,pointZone,sameCluster,continuousPath,traceZone} from './continuity';
export const motionProjection:{scene:string;position:Point;points:Point[];lastSample:number;traceStart:Point;networkBlocked:boolean;block?:(value:boolean)=>void;sample?:()=>void;moving?:()=>boolean;restore?:(scene:string,p:Point)=>Promise<void>}={scene:'station',position:{x:0,y:0},points:[],lastSample:0,traceStart:{x:0,y:0},networkBlocked:true};
export function adaptContinuousSpace(original:SpaceOptions,create:(o:SpaceOptions)=>Space):Space{
 let raw:Space,logical=original.scene,predictedZone=logical,previousGlobal=globalPoint(logical,original.position);
 const desiredGraphics=new Map<string,string[]>(),debug=new URLSearchParams(location.search).has('debug');
 const zone=()=>{if(!raw||!clusters[raw.scene()])return logical;const p=raw.position();predictedZone=traceZone(predictedZone,previousGlobal,[p]);previousGlobal={...p};return predictedZone;};
 const projected=(p:Point)=>raw&&clusters[raw.scene()]?localPoint(zone(),p):p;
 const reset=(id:string,p:Point)=>{logical=predictedZone=id;previousGlobal=globalPoint(id,p);motionProjection.scene=id;motionProjection.position={...p};motionProjection.points=[];motionProjection.traceStart=globalPoint(id,p);motionProjection.lastSample=0};reset(logical,original.position);
 const facade:Space={
  installSpritesheets:s=>raw.installSpritesheets(s),position:()=>projected(raw.position()),scene:zone,renderedScene:()=>raw.renderedScene()&&clusters[raw.renderedScene()!]?zone():raw.renderedScene(),move:(x,y)=>raw.move(x,y),
  walkTo:(p,arrive)=>raw.walkTo(globalPoint(logical,p),arrive),pause:p=>raw.pause(p),
  restore:async(id,p)=>{const dest=globalPoint(id,p),crossing=id!==logical&&zone()===id,same=sameCluster(id,logical)&&raw.scene()===renderScene(id);logical=id;
   // A crossing acknowledgement retains current prediction; explicit distant arrivals still snap.
   if(crossing&&same&&(motionProjection.points.length>0||Math.hypot(raw.position().x-dest.x,raw.position().y-dest.y)<90))return;
   reset(id,p);await raw.restore(renderScene(id),dest);
  },project:p=>raw.project(globalPoint(logical,p)),toWorld:p=>localPoint(logical,raw.toWorld(p)),face:p=>raw.face(globalPoint(logical,p))
 };
 const wrappedEvent=(id:string,e:any)=>{
  const init=e.event.onInit;return {...e,id:id+'--'+e.id,...globalPoint(id,e),event:{...e.event,onInit(this:any){
   const actor=this;const proxy=new Proxy(actor,{get(target,key){if(key==='teleport')return(p:Point)=>target.teleport(globalPoint(id,p));if(key==='setGraphic')return(g:string|string[])=>{desiredGraphics.set(id+'--'+e.id,Array.isArray(g)?[...g]:[g]);target.setGraphic(g)};const value=Reflect.get(target,key,target);return typeof value==='function'&&!('set' in value)?value.bind(target):value}});init.call(proxy);
  }}};
 };
 const base=clusterWorld(original.world),ground={id:'base-'+CLUSTER,image:'./map/'+CLUSTER+'-base.png',width:1440,height:1632,framesWidth:1,framesHeight:1,textures:{stand:{animations:()=>[[{frameX:0,frameY:0,time:0,anchor:[0,0],scale:[1,1]}]]}}};
 // Register only the combined renderer map. Registering the two source maps as
 // well lets their onInit closures overwrite the actor handles for this map.
 const renderWorld={...base,scenes:Object.fromEntries(Object.entries(base.scenes).filter(([id])=>!isCluster(id)))};
 raw=create({...original,world:renderWorld,scene:renderScene(logical),position:globalPoint(logical,original.position),spritesheets:[...original.spritesheets,ground],
  mapEvents:id=>!clusters[id]?original.mapEvents(id):[
   ...(id===CLUSTER?[{id:'base-'+CLUSTER,x:0,y:0,event:{onInit(this:any){this.setHitbox(1,1);this.through=true;this.animationFixed=true;this.setGraphic(ground.id);this.animationName.set('stand');this.syncChanges()}}}]:[]),
   ...clusters[id].zones.flatMap(zone=>original.mapEvents(zone).filter(e=>!e.id.startsWith('base-')).map(e=>wrappedEvent(zone,e)))],
  cameraBounds:id=>clusters[id]?.canvas??original.cameraBounds?.(id)??clusters[CLUSTER].canvas,
  cameraWalkBounds:id=>clusters[id]?base.scenes[id].interior:original.cameraWalkBounds?.(id)??original.world.scenes[id].interior,
  cameraSafeArea:original.cameraSafeArea,
  floorLayers:id=>id===COASTAL?[
   {texture:Assets.get('./map/coast-base.png'),at:{x:0,y:0},clip:{x:0,y:0,w:1280,h:805}},
   {texture:Assets.get('./map/beach-base.png'),at:globalPoint('beach',{x:0,y:0}),clip:{x:70,y:805,w:1210,h:933}},
   {texture:Assets.get('./map/path-base.png'),at:globalPoint('path',{x:0,y:0}),clip:{x:1235,y:140,w:1365,h:1088},polygon:[{x:1280,y:140},{x:2600,y:140},{x:2600,y:1228},{x:1235,y:1228},{x:1235,y:1100},{x:1244,y:1100},{x:1244,y:1052},{x:1256,y:1052},{x:1256,y:1004},{x:1268,y:1004},{x:1268,y:956},{x:1280,y:956},{x:1280,y:908},{x:1272,y:908},{x:1272,y:860},{x:1260,y:860},{x:1260,y:812},{x:1244,y:812},{x:1244,y:760},{x:1235,y:760},{x:1235,y:708},{x:1248,y:708},{x:1248,y:660},{x:1260,y:660},{x:1260,y:620},{x:1272,y:620},{x:1272,y:580},{x:1280,y:580}]},
   // Reuse undistorted source pixels: unify the beach entry's legacy grass rectangles.
   {texture:Assets.get('./map/beach-base.png'),crop:{x:80,y:400,w:800,h:90},at:{x:150,y:805},clip:{x:150,y:805,w:800,h:90}},
   // Existing stone pixels taper 120px coast road to the 100px path road.
   {texture:Assets.get('./map/coast-base.png'),crop:{x:100,y:415,w:180,h:120},at:{x:1210,y:415},clip:{x:1210,y:415,w:180,h:120},polygon:[{x:1210,y:415},{x:1240,y:415},{x:1240,y:419},{x:1260,y:419},{x:1260,y:423},{x:1280,y:423},{x:1280,y:425},{x:1390,y:425},{x:1390,y:525},{x:1280,y:525},{x:1280,y:527},{x:1260,y:527},{x:1260,y:531},{x:1240,y:531},{x:1240,y:535},{x:1210,y:535}]}
  ]:original.floorLayers?.(id)??[],
  cameraBackdrop:original.cameraBackdrop?(id=>original.cameraBackdrop!(clusters[id]?zone():id)):undefined,
  foregroundReveal:original.foregroundReveal?.map(reveal=>({...reveal,active:(p,id)=>reveal.active?.(clusters[id]?localPoint(zone(),p):p,clusters[id]?zone():id)??true,textureForScene:id=>reveal.textureForScene(clusters[id]?zone():id),originForScene:reveal.originForScene?(id)=>reveal.originForScene!(clusters[id]?zone():id):undefined})),
  prepareScene:async id=>{if(clusters[id]){await Promise.all(clusters[id].zones.map(zone=>original.prepareScene?.(zone)));if(id===CLUSTER)await Assets.load(ground.image)}else await original.prepareScene?.(id)},
  walkable:(p,id)=>{if(!clusters[id])return original.walkable?.(p,id)??walkable(original.world,id,p);let z=zone();const start=raw.position();let previous=start;const steps=Math.max(1,Math.ceil(Math.hypot(p.x-start.x,p.y-start.y)));for(let i=1;i<=steps;i++){const q={x:start.x+(p.x-start.x)*i/steps,y:start.y+(p.y-start.y)*i/steps};if(!clusterWalkable(original.world,q,z,previous))return false;z=pointZone(q,z,previous);if(original.walkable&&!original.walkable(localPoint(z,q),z))return false;previous=q;}return true},
  // Arrival validates the preserved logical map, whose overlap can differ from
  // the combined renderer's static obstacle union. Prediction still uses its
  // swept dynamic collision checks and the authored narrow seam.
  arrivalWalkable:(p,id)=>clusters[id]?walkable(original.world,logical,localPoint(logical,p)):(original.arrivalWalkable?.(p,id)??walkable(original.world,id,p)),
  findPath:(a,b,id)=>{
   if(!clusters[id])return original.findPath?.(a,b,id)??findPath(original.world,id,a,b);
   const from=pointZone(a,predictedZone),to=pointZone(b,from);
   return continuousPath(original.world,from,a,to,b,(zone,x,y)=>original.findPath?.(x,y,zone)??findPath(original.world,zone,x,y));
  },
  worldPaused:original.worldPaused??original.controlsBlocked,
  controlsBlocked:()=>original.controlsBlocked()||motionProjection.networkBlocked||motionProjection.points.length>=maximumQueuedPoints||traceLength(motionProjection.traceStart,motionProjection.points)>=predictionHorizon,
  onMotionPoint:p=>appendMotionTrace(motionProjection.points,motionProjection.traceStart,p),
  onPosition:p=>{const z=zone(),local=projected(p);motionProjection.scene=z;motionProjection.position={...local};original.onPosition(local)},
  onFrame:(dt,p,_id,paused)=>{if(debug){const host=document.querySelector<HTMLElement>('#rpg');if(host){host.dataset.motionPoints=String(motionProjection.points.length);host.dataset.motionDistance=String(traceLength(motionProjection.traceStart,motionProjection.points));host.dataset.motionBlock=motionProjection.networkBlocked?'network':motionProjection.points.length>=maximumQueuedPoints?'corners':traceLength(motionProjection.traceStart,motionProjection.points)>=predictionHorizon?'distance':'none'}}original.onFrame?.(dt,projected(p),zone(),paused);for(const [id,graphic] of desiredGraphics){const [source,eventId]=id.split('--');raw.projectEventGraphic?.(id,original.eventGraphics?.(source,eventId)??graphic)}},
  onReady:()=>original.onReady(facade),
 });motionProjection.sample=raw.sampleMovement;motionProjection.moving=raw.movementPending;motionProjection.block=value=>{motionProjection.networkBlocked=value;raw.suspendPrediction?.(value)};motionProjection.restore=facade.restore;return facade;
}
