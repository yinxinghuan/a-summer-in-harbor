import manifest from './wild-mint-manifest.json';
import {mintNode} from '../life/plant-uses';
import type {Entity} from './data';
export type MintAsset={image:string;sha256:string;sourceSHA256:string;requestId:string;taskId:string;width:256;height:256};
export type MintAssets={id:'harbor-mint-art-v1';bush:MintAsset;leaf:MintAsset;root:[number,number];scale:number;review:{singleImage:'accepted';family:'accepted';targetScene:'accepted';technical:'accepted';rights:'project-reuse-confirmed'}};
// Fixed native source pair; final release still requires actual Main/Bag gate.
export const wildMintAssets:MintAssets|null=manifest as MintAssets;
export const mintConsumerContract=Object.freeze({node:mintNode,canvas:[256,256],maximumWidth:48,maximumHeight:36,root:[128.75,205.5],itemSlot:[64,64],collision:'none',partialHarvest:'same retained clump',geometryStatus:'native alpha bounds168x157; scale36/157; root native515,822'});
export function mintArtAccepted(a:MintAssets|null|undefined):a is MintAssets{
 if(!a||a.id!=='harbor-mint-art-v1'||!a.review||Object.keys(a.review).length!==5||!['singleImage','family','targetScene','technical'].every(k=>(a.review as any)[k]==='accepted')||a.review.rights!=='project-reuse-confirmed')return false;
 return [a.bush,a.leaf].every(f=>f&&/^\.\/art\/[a-z0-9/-]+\.png$/.test(f.image)&&[f.sha256,f.sourceSHA256].every(h=>/^[a-f0-9]{64}$/.test(h))&&!!f.requestId&&!!f.taskId&&f.width===256&&f.height===256)&&Array.isArray(a.root)&&a.root.length===2&&a.root.every(n=>Number.isFinite(n)&&n>=0&&n<=256)&&Number.isFinite(a.scale)&&a.scale>0&&a.scale<=1;
}
export function mintEntities(scene:string,a=wildMintAssets):Entity[]{return mintArtAccepted(a)&&scene===mintNode.scene?[{id:mintNode.id,kind:'object',label:['野薄荷','Wild mint'],at:{...mintNode.at},approach:{x:mintNode.approach.x-48,y:mintNode.approach.y},actions:[]}]:[]}
export function mintSheets(a=wildMintAssets){return mintArtAccepted(a)?[{id:'prop-wild-mint',image:a.bush.image,width:256,height:256,framesWidth:1,framesHeight:1,textures:{stand:{animations:()=>[[{frameX:0,frameY:0,time:0,anchor:a.root.map(n=>n/256),scale:[a.scale,a.scale],x:0,y:0}]]}}}]:[]}
