import {admitPlantUse,finishPlantUse,type withBasilPlantUses} from '../server/plant-basil';
import {applyPlantUse} from '../server/plant-uses-rules';
import {createPlantsRegistry} from '../server/life-plants-b2';
import {mintNode,type PlantUsesSave,type PlantUseVerb} from '../src/life/plant-uses';
import type {Action} from '../src/story/state';
const verbs=['observe-mint','collect-mint','archive-mint','share-mint'] as const;
/** B is an explicit local-only fixture, default closed. No asset admission flag or production mount. */
export function withWildMintFixture(assembly:ReturnType<typeof withBasilPlantUses>,options:{enabled?:boolean;newStarts?:boolean}={}){
 if(options.enabled!==true)return assembly;
 const starts=options.newStarts!==false,registry=createPlantsRegistry();
 const parse=(a:Action)=>{if(!a||typeof a.action!=='string'||a.action.length>160||typeof a.target!=='string'||a.target.length>160||!a.position||!Number.isFinite(a.position.x)||!Number.isFinite(a.position.y))throw Error('INVALID_ACTION');const v=a.action.slice(10) as PlantUseVerb;if(!a.action.startsWith('plant-use:')||!verbs.includes(v as any)||a.payload!==undefined)throw Error('INVALID_PLANT_USE_COMMAND');return v};
 const mintAction=(a:Action)=>a?.action?.startsWith('plant-use:')&&verbs.includes(a.action.slice(10) as any);
 const runtime={...assembly.runtime,
  validateAction(a:Action){if(mintAction(a))parse(a);else assembly.runtime.validateAction(a)},
  async prepare(s:PlantUsesSave,a:Action,cancel?:unknown,context?:{owner:string}){
   if(!mintAction(a))return assembly.runtime.prepare(s,a,cancel,context);
   assembly.runtime.assertReadable(s);const v=parse(a);if(a.expected_version!==s.version)throw Error('VERSION_CONFLICT');
   admitPlantUse(assembly,s,a,v,mintNode);const r=applyPlantUse(s,v,a.action_id,registry,starts);
   finishPlantUse(r,s,a,v==='share-mint'?'dani':undefined);assembly.runtime.assertReadable(r.head);
   return {...r,kind:a.action,accepted:true,actionId:a.action};
  },
 };
 const project=(s:PlantUsesSave)=>({...assembly.plantUsesProject(s),mintEnabled:true,mintNewStarts:starts,wildFixtureOnly:true});
 return {...assembly,runtime,plantUsesProject:project,lifeProject:(s:PlantUsesSave)=>({...assembly.lifeProject(s),plantUses:project(s)})};
}
