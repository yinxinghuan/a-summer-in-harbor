import {createForegroundReveal} from './foreground-reveal';
import type {Viewport} from 'pixi-viewport';
import type {Container} from 'pixi.js';
import {Direction} from '@rpgjs/common';
import {startGame,provideClientGlobalConfig,provideClientModules,provideRpg,type RpgClientEngine} from '@rpgjs/client';
import {createServer,provideServerModules,type RpgPlayer} from '@rpgjs/server';
import {provideTiledMap as tiledClient} from '@rpgjs/tiledmap/client';
import {provideTiledMap as tiledServer} from '@rpgjs/tiledmap/server';
import {advanceRoute,moveWithCollision} from './distance-motion';
import {findPath,walkable,type Point,type World} from './world';

export type Space={
 position:()=>Point;scene:()=>string;renderedScene:()=>string|null;
 move:(x:number,y:number)=>void;walkTo:(target:Point,arrive?:()=>void)=>boolean;
 pause:(value:boolean)=>void;restore:(scene:string,position:Point)=>Promise<void>;
 project:(point:Point)=>Point;toWorld:(point:Point)=>Point;face:(target:Point)=>void;
};
export type SpaceOptions={
 world:World;host:HTMLElement;scene:string;position:Point;speed:number;stride:number;
 sheet:any;spritesheets:any[];mapEvents:(scene:string)=>any[];
 walkable?:(point:Point,scene:string)=>boolean;findPath?:(from:Point,to:Point,scene:string)=>Point[];
 prepareScene?:(scene:string)=>Promise<void>;
 controlsBlocked:()=>boolean;onPosition:(point:Point)=>void;onDestination:(point:Point|null)=>void;
 onFrame?:(dt:number,position:Point,scene:string,paused:boolean)=>void;
 cameraBounds?:(scene:string)=>{x:number;y:number;w:number;h:number};
 foregroundReveal?:Parameters<typeof createForegroundReveal>[0][];
 onReady:(space:Space)=>void;onError:(error:unknown)=>void;
};

export function createRpgSpace(options:SpaceOptions){
 if(options.host.id!=='rpg')throw new Error('RPG_MOUNT_ID_REQUIRED');
 const {world,host}=options,ids=Object.keys(world.scenes);
 const reveals=(options.foregroundReveal??[]).map(createForegroundReveal);
 const debug=new URLSearchParams(location.search).has('debug');
 let scene=options.scene,pos={...options.position},client:RpgClientEngine|undefined,player:RpgPlayer|undefined;
 let loaded:string|null=null,joined:string|null=null,paused=true,changing=false,last=0,stride=0,stick={x:0,y:0},route:Point[]=[];
 let arrive:(()=>void)|undefined,engineWidth=360,engineHeight=520,scale=1,leftInset=0;
 const checks=new Set<()=>void>(),keys=new Set<string>();
 const wait=(id:string)=>new Promise<void>((resolve,reject)=>{const check=()=>{if(loaded===id&&joined===id){clearTimeout(timer);checks.delete(check);resolve()}};const timer=setTimeout(()=>{checks.delete(check);reject(new Error('MAP_LOAD_TIMEOUT'))},12000);checks.add(check);check()});
 const cancel=()=>{route=[];arrive=undefined;options.onDestination(null)};
 const projectPlayer=()=>{const sprite=client?.getCurrentPlayer();if(!sprite||!player)return;sprite.animationFixed=true;if(sprite.x()!==pos.x)sprite.x.set(pos.x);if(sprite.y()!==pos.y)sprite.y.set(pos.y);if(sprite.direction()!==player.direction())sprite.direction.set(player.direction());if(sprite.animationName()!==player.animationName())sprite.animationName.set(player.animationName())};
 const stand=()=>{stride=0;if(player&&player.animationName()!=='stand')player.animationName.set('stand');projectPlayer()};
 const stage=()=>(client as unknown as {canvasApp?:{stage:Container}})?.canvasApp?.stage;
 const viewport=():Viewport|undefined=>{const visit=(node:Container|undefined):Viewport|undefined=>{if(!node)return;if('toWorld' in node&&'clamp' in node)return node as Viewport;for(const child of node.children??[]){const found=visit(child);if(found)return found}};return visit(stage())};
 let cameraSignature='';
 const configureCamera=()=>{const view=viewport();if(!view)return;const bounds=options.cameraBounds?.(scene)??{x:0,y:0,w:world.width,h:world.height};const signature=[scene,engineWidth,engineHeight].join(':');if(signature===cameraSignature)return;view.resize(engineWidth,engineHeight,world.width,world.height);const extraX=Math.max(0,engineWidth/view.scale.x-bounds.w)/2,extraY=Math.max(0,engineHeight/view.scale.y-bounds.h)/2;view.clamp({left:bounds.x-extraX,top:bounds.y-extraY,right:bounds.x+bounds.w+extraX,bottom:bounds.y+bounds.h+extraY,underflow:'none'});cameraSignature=signature;view.moveCenter(pos.x+8,pos.y+6)};
 const screen=(point:Point)=>{const q=viewport()?.toScreen(point.x,point.y)??point;return {x:leftInset+q.x*scale,y:q.y*scale}};
 const unproject=(point:Point)=>{const q={x:(point.x-leftInset)/scale,y:point.y/scale};const p=viewport()?.toWorld(q.x,q.y)??q;return {x:p.x,y:p.y}};
 const resize=()=>{
  const box=host.parentElement!,width=box.clientWidth,height=box.clientHeight;
  engineHeight=Math.min(520,Math.max(220,height/1.3));
  engineWidth=width/Math.max(1,height)*engineHeight;
  scale=height/engineHeight;leftInset=(width-engineWidth*scale)/2;
  host.style.width=`${engineWidth}px`;host.style.height=`${engineHeight}px`;host.style.left='50%';host.style.top='0';host.style.transformOrigin='top center';host.style.transform=`translateX(-50%) scale(${scale})`;
  const resolution=Math.min(3,Math.max(1,Math.ceil(scale*(devicePixelRatio||1)*4)/4));
  if(client?.renderer){client.renderer.resize(engineWidth,engineHeight,resolution);client.width.set(String(engineWidth));client.height.set(String(engineHeight));configureCamera()}
 };
 const observer=new ResizeObserver(resize);observer.observe(host.parentElement!);resize();
 const runtime:Space={position:()=>({...pos}),scene:()=>scene,renderedScene:()=>loaded,
  move:(x,y)=>{stick={x,y};if(x||y)cancel()},
  walkTo:(target,callback)=>{if(paused||changing)return false;const next=options.findPath?.(pos,target,scene)??findPath(world,scene,pos,target);if(!next.length)return false;route=next;arrive=callback;options.onDestination(target);return true},
  pause:value=>{paused=value;stick={x:0,y:0};keys.clear();if(value){cancel();stand()}},
  restore:async(next,p)=>{if(!walkable(world,next,p))throw new Error('INVALID_ARRIVAL');changing=true;cancel();stick={x:0,y:0};stand();try{if(next!==scene){await options.prepareScene?.(next);loaded=null;joined=null;const changed=await player!.changeMap(next,p);if(!changed)throw new Error('MAP_CHANGE_REJECTED');await wait(next)}else await player!.teleport(p);scene=next;pos={...p};cameraSignature='';configureCamera();player!.syncChanges();projectPlayer();options.onPosition(pos)}finally{changing=false}},
  project:screen,toWorld:unproject,
  face:target=>{if(!player)return;const dx=target.x-pos.x,dy=target.y-pos.y;player.direction.set(Math.abs(dx)>Math.abs(dy)?(dx>0?Direction.Right:Direction.Left):(dy>0?Direction.Down:Direction.Up));stand();player.syncChanges()},
 };
 const down=(event:KeyboardEvent)=>{if(paused||changing||options.controlsBlocked()||(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement))return;const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();keys.add(key);cancel()}};
 const up=(event:KeyboardEvent)=>keys.delete(event.key.toLowerCase());
 const clearInput=()=>{keys.clear();stick={x:0,y:0};cancel();stand()};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>document.hidden&&clearInput());
 // Each authored map is a bounded cached scene. Large visual layer events have
 // an origin far from the player; point-based MMORPG chunk streaming would
 // remove their entire floor texture even while that texture fills the screen.
 const server=createServer({providers:[tiledServer({basePath:'./map',streaming:false}),provideServerModules([{player:{
  onJoinMap(instance,map){player=instance;instance.setGraphic(options.sheet.id);instance.setHitbox(world.actor.w,world.actor.h);instance.animationFixed=true;instance.animationName.set('stand');joined=map.id.replace(/^map-/,'');checks.forEach(fn=>fn())},
  async onConnected(instance){player=instance;try{instance.setGraphic(options.sheet.id);instance.setHitbox(world.actor.w,world.actor.h);instance.animationFixed=true;instance.animationName.set('stand');await options.prepareScene?.(scene);await instance.changeMap(scene,pos);void wait(scene).then(()=>{projectPlayer();options.onReady(runtime)}).catch(options.onError)}catch(error){options.onError(error)}}
 },maps:ids.map(id=>({id,events:options.mapEvents(id)}))}]) ]});
 startGame({providers:[
  provideClientGlobalConfig({prediction:{enabled:false},bootstrapCanvasOptions:{antialias:false,backgroundAlpha:0,autoDensity:true,resolution:1}}),
  tiledClient({basePath:'./map'}),
  provideClientModules([{spritesheets:[options.sheet,...options.spritesheets],sceneMap:{onAfterLoading(){cameraSignature='';loaded=client?.activeRoom()?.name?.replace(/^map-/,'')??null;checks.forEach(fn=>fn())}},engine:{onStart(engine){client=engine;if(debug)(host as HTMLElement&{__rpgClient?:RpgClientEngine}).__rpgClient=engine;engine.stopProcessingInput=true;engine.renderer.background.alpha=0;resize()}}}]),provideRpg(server)
 ]});
 const tick=(time:number)=>{
  const dt=last?Math.min(Math.max(0,(time-last)/1000),.04):0;last=time;
  const blocked=paused||changing||options.controlsBlocked()||document.hidden;
  if(player&&!blocked){
   let x=stick.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
   let y=stick.y+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
   let distance=0,finished=false;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length}
   const clear=(point:Point)=>options.walkable?.(point,scene)??walkable(world,scene,point);
   if(!x&&!y&&route.length){const result=advanceRoute(pos,route,options.speed*dt,clear);pos=result.position;distance=result.distance;x=result.direction.x;y=result.direction.y;route.splice(0,result.consumed);finished=result.arrived;if(result.blocked)cancel()}
   else if(x||y){const result=moveWithCollision(pos,{x:x*options.speed*dt,y:y*options.speed*dt},clear);x=result.position.x-pos.x;y=result.position.y-pos.y;pos=result.position;distance=result.distance}
   if(distance>1e-7){stride=(stride+distance)%options.stride;const phase=Math.floor(stride/options.stride*4);const pose=['stride-0','stride-1','stride-2','stride-1'][phase];if(player.animationName()!==pose)player.animationName.set(pose);player.direction.set(Math.abs(x)>Math.abs(y)?(x>0?Direction.Right:Direction.Left):(y>0?Direction.Down:Direction.Up));void player.teleport(pos);player.syncChanges();options.onPosition(pos)}else stand();
   if(finished){const callback=arrive;arrive=undefined;options.onDestination(null);stand();callback?.()}
  }
  configureCamera();for(const reveal of reveals)reveal(stage(),scene,pos);
  options.onFrame?.(dt,{...pos},scene,blocked);projectPlayer();requestAnimationFrame(tick);
  if(debug){const sprite=client?.getCurrentPlayer();host.dataset.playerGraphics=String(sprite?.graphics().length??-1);host.dataset.playerSheets=String(sprite?.graphicsSignals().length??-1);host.dataset.roomEvents=String(Object.keys((client?.activeRoom() as unknown as {events?:()=>Record<string,unknown>})?.events?.()??{}).length)}
 };
 requestAnimationFrame(tick);
 return runtime;
}
