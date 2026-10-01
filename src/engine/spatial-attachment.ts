import type {compileSpatialBinding,SpatialPoint,SpatialSnapshot} from './spatial-binding'
type Binding=ReturnType<typeof compileSpatialBinding>
export interface SpatialAttachmentPlan {
 version:1;cartridgeId:string;sourceSaveVersion:number;mapVersion:string;
 resume:{sceneId:string;position:SpatialPoint};
}
/** Read-only planning. This does not upgrade a story engine, change IDs, enroll a
 * new session, import a save, or claim that missing visuals have been created. */
export function dryRunSpatialAttachment<S extends SpatialSnapshot & {version:number}>(save:S,binding:Binding,options:{supportedSaveVersion:number;resume?:{sceneId:string;position:SpatialPoint};readySceneIds:readonly string[];readyCharacterIds:readonly string[]}){
 const issues:Array<{code:string;id:string}>=[]
 if(save.cartridgeId!==binding.cartridgeId)issues.push({code:'CARTRIDGE_ID_MISMATCH',id:save.cartridgeId})
 if(save.version!==options.supportedSaveVersion)issues.push({code:'STORY_SCHEMA_REQUIRES_ADAPTER',id:String(save.version)})
 for(const n of save.map)if(!binding.storyLocationIds().includes(n.id))issues.push({code:'LOCATION_MAPPING_MISSING',id:n.id})
 for(const c of save.characters)if(!binding.characterIds().includes(c.id))issues.push({code:'CHARACTER_MAPPING_MISSING',id:c.id})
 let sceneId:string|undefined
 if(!issues.length){try{sceneId=binding.locate(save,options.resume?.sceneId)}catch(e){issues.push({code:e instanceof Error?e.message.split(':')[0]:'INVALID_SPATIAL_SNAPSHOT',id:'current-location'})}}
 if(sceneId){
  if(!options.resume)issues.push({code:'EXPLICIT_ARRIVAL_REQUIRED',id:sceneId})
  else if(!binding.validPosition(sceneId,options.resume.position))issues.push({code:'INVALID_MIGRATION_POSITION',id:sceneId})
  if(!options.readySceneIds.includes(sceneId))issues.push({code:'SCENE_ASSETS_NOT_ADMITTED',id:sceneId})
  for(const c of save.characters)if(!options.readyCharacterIds.includes(c.id))issues.push({code:'CHARACTER_PRESENTATION_NOT_ADMITTED',id:c.id})
 }
 if(issues.length)return {status:'not-ready' as const,issues,candidate:null}
 const plan:SpatialAttachmentPlan={version:1,cartridgeId:save.cartridgeId,sourceSaveVersion:save.version,mapVersion:binding.mapVersion,resume:structuredClone(options.resume!)}
 // Preserve every original field, including engine-specific finale/jobs/history.
 return {status:'dry-run-ready' as const,issues,candidate:{story:structuredClone(save),spatial:plan}}
}
