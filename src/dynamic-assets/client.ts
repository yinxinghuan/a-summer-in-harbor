import {getGameApiBase} from '../game-id';
import type {Save} from '../story/state';
import {prepareRenderAssets,type RenderAsset} from './renderer';
// @ts-expect-error pinned verified reader
import {createHarborDynamicReader} from './browser-reader.mjs';
export async function prepareDynamicRoom(save:Save){
 if(!save.dynamicAssetRooms?.includes(save.scene))return {scene:save.scene,sheets:[],dispose:()=>{}};
 const path=getGameApiBase()+'/api/sessions/'+save.id+'/assets/'+save.scene+'/';
 const response=await fetch(path+'prepare',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Harbor-Dynamic-Assets':'1'},body:'{}',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('ROOM_ASSET_LOAD_FAILED');
 const {attachment,package:wire}=await response.json();
 const reader=await createHarborDynamicReader({attachment,wire,baseUrl:()=>path,baseURI:document.baseURI});
 const resolved=await reader.resolve();
 const prepared=await prepareRenderAssets(resolved.assets as RenderAsset[],save.scene);
 return {...prepared,scene:save.scene};
}
