import {admitPlantUse,finishPlantUse,type withBasilPlantUses} from './plant-basil';
import {applyPlantUse} from './plant-uses-rules';
import {createPlantsRegistry} from './life-plants-b2';
import {mintNode,type PlantUsesSave,type PlantUseVerb} from '../src/life/plant-uses';
import {mintArtAccepted,wildMintAssets,type MintAssets} from '../src/world/wild-mint-art';
import {brandActivePrepareFailure} from './active-business-failure';
import type {Action} from '../src/story/state';
const verbs=['observe-mint','collect-mint','archive-mint','share-mint'] as const;
/** Consume the final basil/life assembly once. Absent art leaves exactly the old assembly. */
export function withWildMint(assembly:ReturnType<typeof withBasilPlantUses>,options:{enabled?:boolean;newStarts?:boolean;assets?:MintAssets|null}={}){
 if(options.enabled!==true)return assembly;
 const assets=options.assets===undefined?wildMintAssets:options.assets;if(!mintArtAccepted(assets))throw Error('MINT_ART_NOT_ADMITTED');
 const starts=options.newStarts!==false,registry=createPlantsRegistry();
 const isMint=(a:Action)=>a?.action?.startsWith('plant-use:')&&verbs.includes(a.action.slice(10) as any);
 const parse=(a:Action)=>{if(!a||typeof a.target!=='string'||a.target.length>160||!a.position||!Number.isFinite(a.position.x)||!Number.isFinite(a.position.y)||a.payload!==undefined)throw Error('INVALID_PLANT_USE_COMMAND');return a.action.slice(10) as PlantUseVerb};
 const runtime={...assembly.runtime,
  validateAction(a:Action){if(!isMint(a))return assembly.runtime.validateAction(a);try{parse(a)}catch(e){throw a.activePlay?brandActivePrepareFailure(e):e}},
  async prepare(s:PlantUsesSave,a:Action,cancel?:unknown,context?:{owner:string}){
   if(!isMint(a))return assembly.runtime.prepare(s,a,cancel,context);
   assembly.runtime.assertReadable(s);const v=parse(a);if(a.expected_version!==s.version)throw Error('VERSION_CONFLICT');
   admitPlantUse(assembly,s,a,v,mintNode);const r=applyPlantUse(s,v,a.action_id,registry,starts);
   finishPlantUse(r,s,a,v==='share-mint'?'dani':undefined);assembly.runtime.assertReadable(r.head);
   return {...r,kind:a.action,accepted:true,actionId:a.action};
  },
 };
 const project=(s:PlantUsesSave)=>({...assembly.plantUsesProject(s),mintEnabled:true,mintNewStarts:starts,wildFixtureOnly:false,mintArtId:assets.id});
 return {...assembly,runtime,plantUsesProject:project,lifeProject:(s:PlantUsesSave)=>({...assembly.lifeProject(s),plantUses:project(s)})};
}
