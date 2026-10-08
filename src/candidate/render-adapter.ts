import type {Space,SpaceOptions} from '../engine/rpg-space';
import type {Point} from '../engine/world';
import {walkable,findPath} from '../engine/world';
import {appendMotionTrace} from './motion-trace';
import {predictionHorizon,maximumQueuedPoints,traceLength} from './motion-outbox';
import {CLUSTER,clusterCanvas,clusterWorld,clusterWalkable,globalPoint,localPoint,renderScene,isCluster,pointZone,sameCluster} from './continuity';
export const motionProjection:{scene:string;position:Point;points:Point[];lastSample:number;traceStart:Point;networkBlocked:boolean;block?:(value:boolean)=>void;sample?:()=>void;moving?:()=>boolean;restore?:(scene:string,p:Point)=>Promise<void>}={scene:'station',position:{x:0,y:0},points:[],lastSample:0,traceStart:{x:0,y:0},networkBlocked:true};
export function adaptContinuousSpace(original:SpaceOptions,create:(o:SpaceOptions)=>Space):Space{
 let raw:Space,logical=original.scene,predictedZone=logical;
 const desiredGraphics=new Map<string,string[]>(),debug=new URLSearchParams(location.search).has('debug');
 const zone=()=>raw&&raw.scene()===CLUSTER?(predictedZone=pointZone(raw.position(),predictedZone)):logical;
 const projected=(p:Point)=>raw?.scene()===CLUSTER?localPoint(zone(),p):p;
 const reset=(id:string,p:Point)=>{logical=predictedZone=id;motionProjection.scene=id;motionProjection.position={...p};motionProjection.points=[];motionProjection.traceStart=globalPoint(id,p);motionProjection.lastSample=0};reset(logical,original.position);
 const facade:Space={
  installSpritesheets:s=>raw.installSpritesheets(s),position:()=>projected(raw.position()),scene:zone,renderedScene:()=>raw.renderedScene()===CLUSTER?zone():raw.renderedScene(),move:(x,y)=>raw.move(x,y),
  walkTo:(p,arrive)=>raw.walkTo(globalPoint(logical,p),arrive),pause:p=>raw.pause(p),
  restore:async(id,p)=>{const dest=globalPoint(id,p),crossing=id!==logical&&zone()===id,same=sameCluster(id,logical)&&raw.scene()===CLUSTER;logical=id;
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
  mapEvents:id=>id!==CLUSTER?original.mapEvents(id):[
   {id:'base-'+CLUSTER,x:0,y:0,event:{onInit(this:any){this.setHitbox(1,1);this.through=true;this.animationFixed=true;this.setGraphic(ground.id);this.animationName.set('stand');this.syncChanges()}}},
   ...['market','bazaar'].flatMap(id=>original.mapEvents(id).filter(e=>!e.id.startsWith('base-')).map(e=>wrappedEvent(id,e)))],
  cameraBounds:id=>id===CLUSTER?clusterCanvas:original.cameraBounds?.(id)??clusterCanvas,
  cameraWalkBounds:id=>id===CLUSTER?base.scenes[CLUSTER].interior:original.cameraWalkBounds?.(id)??original.world.scenes[id].interior,
  cameraSafeArea:original.cameraSafeArea,
  cameraBackdrop:original.cameraBackdrop?(id=>original.cameraBackdrop!(id===CLUSTER?zone():id)):undefined,
  foregroundReveal:original.foregroundReveal?.map(reveal=>({...reveal,active:(p,id)=>reveal.active?.(id===CLUSTER?localPoint(zone(),p):p,id===CLUSTER?zone():id)??true,textureForScene:id=>reveal.textureForScene(id===CLUSTER?zone():id),originForScene:reveal.originForScene?(id)=>reveal.originForScene!(id===CLUSTER?zone():id):undefined})),
  prepareScene:async id=>{if(id===CLUSTER){await Promise.all(['market','bazaar'].map(id=>original.prepareScene?.(id)));const {Assets}=await import('pixi.js');await Assets.load(ground.image)}else await original.prepareScene?.(id)},
  walkable:(p,id)=>{if(id!==CLUSTER)return original.walkable?.(p,id)??walkable(original.world,id,p);const current=zone();if(!clusterWalkable(original.world,p,current))return false;const z=pointZone(p,current);return original.walkable?.(localPoint(z,p),z)??true},
  // Arrival validates the preserved logical map, whose overlap can differ from
  // the combined renderer's static obstacle union. Prediction still uses its
  // swept dynamic collision checks and the authored narrow seam.
  arrivalWalkable:(p,id)=>id===CLUSTER?walkable(original.world,logical,localPoint(logical,p)):(original.arrivalWalkable?.(p,id)??walkable(original.world,id,p)),
  findPath:(a,b,id)=>{
   if(id!==CLUSTER)return original.findPath?.(a,b,id)??findPath(original.world,id,a,b);
   const from=pointZone(a,logical),to=pointZone(b,from);
   const route=(zone:string,start:Point,end:Point)=>(original.findPath?.(localPoint(zone,start),localPoint(zone,end),zone)??findPath(original.world,zone,localPoint(zone,start),localPoint(zone,end))).map(p=>globalPoint(zone,p));
   if(from===to)return route(from,a,b);
   const gates={market:{x:597,y:720},bazaar:{x:597,y:580}},first=route(from,a,gates[from as keyof typeof gates]),last=route(to,gates[to as keyof typeof gates],b);
   return first.length&&last.length?[...first,{x:597,y:650},...last]:[];
  },
  worldPaused:original.worldPaused??original.controlsBlocked,
  controlsBlocked:()=>original.controlsBlocked()||motionProjection.networkBlocked||motionProjection.points.length>=maximumQueuedPoints||traceLength(motionProjection.traceStart,motionProjection.points)>=predictionHorizon,
  onMotionPoint:p=>appendMotionTrace(motionProjection.points,motionProjection.traceStart,p),
  onPosition:p=>{const z=zone(),local=projected(p);motionProjection.scene=z;motionProjection.position={...local};original.onPosition(local)},
  onFrame:(dt,p,_id,paused)=>{if(debug){const host=document.querySelector<HTMLElement>('#rpg');if(host){host.dataset.motionPoints=String(motionProjection.points.length);host.dataset.motionDistance=String(traceLength(motionProjection.traceStart,motionProjection.points));host.dataset.motionBlock=motionProjection.networkBlocked?'network':motionProjection.points.length>=maximumQueuedPoints?'corners':traceLength(motionProjection.traceStart,motionProjection.points)>=predictionHorizon?'distance':'none'}}original.onFrame?.(dt,projected(p),zone(),paused);for(const [id,graphic] of desiredGraphics){const [source,eventId]=id.split('--');raw.projectEventGraphic?.(id,original.eventGraphics?.(source,eventId)??graphic)}},
  onReady:()=>original.onReady(facade),
 });motionProjection.sample=raw.sampleMovement;motionProjection.moving=raw.movementPending;motionProjection.block=value=>{motionProjection.networkBlocked=value;raw.suspendPrediction?.(value)};motionProjection.restore=facade.restore;return facade;
}
