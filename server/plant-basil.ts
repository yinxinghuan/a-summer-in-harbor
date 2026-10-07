import type {createHarborLife} from './life-assembly';
import {createPlantsRegistry} from './life-plants-b2';
import {applyPlantUse,assertPlantUsesReadable} from './plant-uses-rules';
import {mintStatus,type PlantUseVerb,type PlantUsesSave,type PlantUsesView} from '../src/life/plant-uses';
import {rooms} from '../src/world/data';
import {residentHere,observedActor} from '../src/world/residents';
import {landWorld} from '../src/life/land';
import {dynamicWorld} from '../src/dynamic-assets/layout';
import {walkable} from '../src/engine/world';
import {compileSpatialBinding} from '../src/engine/spatial-binding';
import {GAME_UUID} from '../src/game-id';
import type {Action} from '../src/story/state';
import {brandActivePrepareFailure} from './active-business-failure';

export const basilVerbs=['read-offer','accept-basil','deliver-basil','close-basil','recall-delivery'] as const;
export type BasilVerb=typeof basilVerbs[number];
/** The original combined assembly is consumed once; no second plants/animal wrapper. */
export function withBasilPlantUses(assembly:ReturnType<typeof createHarborLife>,options:{enabled?:boolean;newStarts?:boolean}={}){
 const enabled=options.enabled!==false,starts=enabled&&options.newStarts!==false,registry=createPlantsRegistry();
 const parse=(a:Action):BasilVerb=>{const v=a.action.slice(10);if(v.endsWith('-mint'))throw Error('MINT_CONTENT_CLOSED');if(!a.action.startsWith('plant-use:')||!basilVerbs.includes(v as BasilVerb)||a.payload!==undefined)throw Error('INVALID_PLANT_USE_COMMAND');return v as BasilVerb};
 const runtime={...assembly.runtime,
  assertReadable(s:PlantUsesSave){assembly.runtime.assertReadable(s);assertPlantUsesReadable(s,registry)},
  validateAction(a:Action){assembly.runtime.validateAction(a);if(a.action.startsWith('plant-use:'))try{parse(a)}catch(error){throw a.activePlay?brandActivePrepareFailure(error):error}},
  async prepare(s:PlantUsesSave,a:Action,cancel?:unknown,context?:{owner:string}){
   this.assertReadable(s);
   if(!a.action.startsWith('plant-use:')){
    if(a.action==='life:accept-order'&&s.plantUsesV1?.order)throw Error('ORDER_ACTIVE');
    const r=await assembly.runtime.prepare(s,a,cancel,context);this.assertReadable(r.head);return r;
   }
   const v=parse(a);if(!enabled&&v!=='deliver-basil'&&v!=='close-basil')throw Error('PLANT_USES_CLOSED');
   if(a.expected_version!==s.version)throw Error('VERSION_CONFLICT');
   admitPlantUse(assembly,s,a,v);
   const r=applyPlantUse(s,v as PlantUseVerb,a.action_id,registry,starts);
   finishPlantUse(r,s,a,v==='close-basil'?undefined:'theo');this.assertReadable(r.head);
   return {...r,kind:a.action,accepted:true,actionId:a.action};
  },
 };
 const project=(s:PlantUsesSave):PlantUsesView&{basilEnabled:boolean;mintEnabled:boolean}=>{
  runtime.assertReadable(s);return {snapshotVersion:s.version,enabled:true,basilEnabled:enabled,mintEnabled:false,newStarts:starts,wildFixtureOnly:false,offerRead:s.plantUsesV1?.offerReadAt!==undefined,order:structuredClone(s.plantUsesV1?.order??null),availableBasil:s.items['crop-basil']??0,cooldownUntil:s.lifeV1?.cooldownUntil??0,deliveries:s.plantUsesV1?.deliveries??0,mint:mintStatus(s),messages:{offer:['厨房需要两份罗勒，付$7；也可每份$3卖给杂货铺。接受后截止后天17:00。','Two basil portions for $7, or sell at the grocer for $3 each. Accepting makes them due at 17:00 the day after tomorrow.'],recollection:['上次的罗勒已经用进厨房。','Your last basil delivery went into the kitchen.']}};
 };
 return {...assembly,runtime,lifeProject:(s:PlantUsesSave)=>({...assembly.lifeProject(s),plantUses:project(s)}),plantUsesProject:project};
}

export function admitPlantUse(assembly:ReturnType<typeof createHarborLife>,s:PlantUsesSave,a:Action,v:PlantUseVerb,wild?:{id:string;scene:string;at:{x:number;y:number};approach:{x:number;y:number}}){
 if(a.scene!==s.scene||!s.visited.includes(s.scene))throw Error('SCENE_MISMATCH');assembly.runtime.position(s,a.position);
 // New actions must not bypass the movement confirmation retained by 7f9.
 if((s as PlantUsesSave&{movingClock?:unknown}).movingClock&&Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)>4)throw Error('UNVERIFIED_POSITION');
 if(v==='close-basil'||v==='archive-mint'){if(a.target!=='life-bag')throw Error('PLANT_USE_TARGET');return}
 let e;
 if(v==='observe-mint'||v==='collect-mint'){if(!wild)throw Error('MINT_CONTENT_CLOSED');if(s.scene!==wild.scene||a.target!==wild.id)throw Error('PLANT_USE_TARGET');e=wild}
 else {const who=v==='share-mint'?'dani':'theo';if(!s.known.includes(who))throw Error('INTRODUCE_FIRST');if(!residentHere(s,who,s.scene))throw Error('PERSON_AWAY');if(who==='theo'&&s.scene!=='cafe')throw Error('PLANT_USE_TARGET');e=rooms[s.scene].entities.find(e=>e.person===who);if(!e||a.target!==e.id)throw Error('PLANT_USE_TARGET');if(['read-offer','accept-basil','deliver-basil'].includes(v)){const m=(s.townMinutes??540)%1440;if(m<360||m>=1020)throw Error('SHOP_CLOSED')}}
 const at='person' in e?observedActor(e,a.actorPosition):e.at,offset={x:at.x-e.at.x,y:at.y-e.at.y},w=landWorld(dynamicWorld(s.flags,true),s.landV1),rule=s.scene+'/'+e.id+'/'+a.action;
 const binding=compileSpatialBinding({id:GAME_UUID,initialMap:[{id:s.scene,current:true}],characters:[],domainRules:{rules:[{id:rule,effects:[]}]}},{version:1,cartridgeId:GAME_UUID,mapVersion:'harbor-plant-use-local-v2',actionScope:'scene',interactionDistance:75,scenes:[{id:s.scene,spawn:rooms[s.scene].spawn}],entities:[{id:e.id,scene:s.scene,position:{x:e.at.x-8,y:e.at.y-6},approach:e.approach,states:['present'],actions:[rule]}],characters:[],portals:[]},(scene,p)=>walkable(w,scene,p));
 if(!binding.admits(rule,e.id,s.scene,{x:a.position.x-offset.x,y:a.position.y-offset.y}))throw Error('TOO_FAR');
 binding.assertTransition({cartridgeId:GAME_UUID,map:[{id:s.scene,current:true}],characters:[]},{cartridgeId:GAME_UUID,map:[{id:s.scene,current:true}],characters:[]},rule,s.scene);
}
export function finishPlantUse(r:{head:PlantUsesSave;text:[string,string]},previous:PlantUsesSave,a:Action,person?:string){
 r.head.position={...a.position};r.head.version=previous.version+1;r.head.cursor=previous.cursor+1;
 const n=(r.head as PlantUsesSave&{animalNotebookV1?:{sample?:unknown}}).animalNotebookV1;if(n?.sample)delete n.sample;
 r.head.history.push({id:a.action_id,kind:person?'talk':'action',...(person?{person}:{}),text:r.text});r.head.history=r.head.history.slice(-500);
}
