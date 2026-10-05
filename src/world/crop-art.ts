import manifest from './crop-art.json';
import {cropArtStage} from '../story/crop-art-stage';
import type {GardenState} from '../story/crops';
export const cropArt=manifest;
export const cropGraphic=(s:GardenState,id:string)=>{const v=cropArtStage(s,id);return v?'prop-garden-'+v.key:''};
export const cropImage=(itemId:string)=>manifest.find(v=>v.stage==='harvest'&&'crop-'+v.crop===itemId)?.image;
export const isCropKeyColor=(r:number,g:number,b:number)=>r>110&&b>100&&r-g>60&&b-g>60;
const prepared=new Map<string,Promise<string>>();
/** Decode/key once. Preserve source files and RGB; only reviewed magenta gets alpha=0. */
export function prepareCropImage(image:string):Promise<string>{
 const old=prepared.get(image);if(old)return old;
 const task=(async()=>{
  const source=new Image();source.src=image;await source.decode();
  const canvas=document.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(source,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<pixels.data.length;i+=4)if(isCropKeyColor(pixels.data[i],pixels.data[i+1],pixels.data[i+2]))pixels.data[i+3]=0;
  context.putImageData(pixels,0,0);return canvas.toDataURL('image/png');
 })();prepared.set(image,task);task.catch(()=>prepared.delete(image));return task;
}
export const soilTextureId='harbor-crop-soil-marker';
let soilURL='';
export async function prepareCropWorld(){
 // Existing CSS gameplay bed marker moved into depth-sorted RPGJS; no new illustration.
 if(!soilURL){const c=document.createElement('canvas');c.width=64;c.height=32;const x=c.getContext('2d')!;
  x.fillStyle='#ad8661';x.fillRect(0,0,64,32);x.fillStyle='#5d402f';x.fillRect(2,2,60,28);
  x.fillStyle='#75543b';for(let y=5;y<28;y+=7)x.fillRect(4,y,56,4);soilURL=c.toDataURL('image/png');}
 return new Map([[soilTextureId,soilURL],...await Promise.all(manifest.filter(a=>a.stage!=='harvest').map(async a=>[a.image,await prepareCropImage(a.image)] as [string,string]))]);
}
