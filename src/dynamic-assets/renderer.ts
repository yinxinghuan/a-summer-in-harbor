export type RenderAsset={propId:string;bytes:Uint8Array;mime:string;sourceWidth:number;sourceHeight:number;width:number;geometry?:{anchor:[number,number];scale:number;offset:{x:number;y:number}}};
import {Assets,type Texture} from 'pixi.js';
/** Only fully verified bytes enter this adapter. Never use source/model URLs. */
export async function prepareRenderAssets(assets:RenderAsset[],scene:string){
 // Validate the whole group before allocating any texture or Blob URL.
 const geometries=assets.map(a=>{
  const g=a.geometry??{anchor:[.5,1] as [number,number],scale:a.width/a.sourceWidth,offset:{x:0,y:0}};
  if(!Number.isFinite(g.scale)||g.scale<=0||!Array.isArray(g.anchor)||g.anchor.length!==2||!g.anchor.every(Number.isFinite)||!Number.isFinite(g.offset.x)||!Number.isFinite(g.offset.y))throw Error('ASSET_GEOMETRY_INVALID');
  return g;
 });
 const urls:string[]=[],sheets:any[]=[];
 for(const [index,a] of assets.entries()){
  const g=geometries[index];
  const url=URL.createObjectURL(new Blob([new Uint8Array(a.bytes).buffer],{type:a.mime}));urls.push(url);
  // Blob URLs have no file extension. Default Pixi parser inference returns null.
  try{
   const texture=await Assets.load<Texture>({src:url,parser:'texture'});
   if(texture.width!==a.sourceWidth||texture.height!==a.sourceHeight)throw Error('ASSET_DECODED_SIZE_MISMATCH');
  }catch(error){for(const u of urls){void Assets.unload(u).catch(()=>{});URL.revokeObjectURL(u)}throw error}
  sheets.push({id:`prop-${scene}-${a.propId}`,image:url,width:a.sourceWidth,height:a.sourceHeight,framesWidth:1,framesHeight:1,textures:{stand:{animations:()=>[[{frameX:0,frameY:0,time:0,anchor:g.anchor,scale:[g.scale,g.scale],x:g.offset.x,y:g.offset.y}]]}}});
 }
 return {sheets,dispose:()=>urls.forEach(url=>{void Assets.unload(url).catch(()=>{});URL.revokeObjectURL(url)})};
}

/** Decode failure is also a whole-room fallback; no partial furniture swap. */
export async function prepareRoomVisual<V extends {hash:string},R extends {assets:RenderAsset[];mode:string}>(slice:{template:{roomId:string};resolve:(visual:V)=>Promise<R>;resolveFallback:(hash:string)=>Promise<R>},visual:V){
 let result=await slice.resolve(visual);
 try{return {result,prepared:await prepareRenderAssets(result.assets,slice.template.roomId)}}
 catch(error){
  if(result.mode==='offline-template')throw error;
  result=await slice.resolveFallback(visual.hash);
  return {result,prepared:await prepareRenderAssets(result.assets,slice.template.roomId)};
 }
}
