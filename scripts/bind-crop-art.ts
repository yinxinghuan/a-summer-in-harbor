/** Read-only library contract reuse. Emits only this game's local consumer evidence. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';
import art from '../src/world/crop-art.json';import{rooms}from'../src/world/data';
const library=process.env.HARBOR_ASSET_LIBRARY??'/Users/yin/code/games/rpg-asset-library';
const {prepareConsumerBinding,selectConsumerBinding,resolveConsumerBinding}=await import(pathToFileURL(library+'/runtime/consumer-binding.mjs').href);
const {styleProfile}=await import(pathToFileURL(library+'/runtime/core.mjs').href);
const out='doc/qa/crops-integrated-20261005';await mkdir(out+'/bindings',{recursive:true});await mkdir(out+'/sources',{recursive:true});
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');const pins=JSON.parse(await readFile(out+'/source-pins.json','utf8'));const evidence=hash(await readFile(out+'/README.md'));const processing=hash(await readFile('src/world/crop-art.ts'));
const results=[];
for(const a of art){
 const bytes=await readFile('public/'+a.image.slice(2));if(hash(bytes)!==a.sha256)throw Error('SOURCE_CHANGED');
 const source={format:'rpg-local-reviewed-source-v1',assetId:'harbor__'+a.key,publishedRevision:null,sourceVersion:a.taskId,semanticItemId:a.key,category:a.stage==='harvest'?'item':'plant',orientation:'front',files:{consumer:{path:a.image,sha256:a.sha256,bytes:bytes.length,width:256,height:256,mime:'image/png'}},license:pins.license,rights:{documented:true,application:{sha256:pins.rightsApplicationSHA256},sourceTaskId:a.taskId,scope:{copy:true,transform:true,'internal-agent-use':true,'cross-alteru-game-use':true,'source-and-build-distribution':true}},visualReview:{judgment:'pass',authority:'AI consumer review; no new human opinion',consumerSha256:a.sha256,evidenceSha256:evidence,reason:'Usable in this game only with required runtime alpha-key adapter and target geometry; raw source has enclosed magenta and is not a ready universal cutout.'},requiredRenderer:{id:'harbor-crop-key-v1',codeSHA256:processing},sourceProfile:null,sourceCameraCalibration:'unmeasured',inventoryRegistered:false,productionGranted:false,generationAuthorized:false,retainedLibraryStatus:'HOLD; not mutated'};
 const sourceBytes=Buffer.from(JSON.stringify(source,null,2));await writeFile(out+'/sources/'+a.key+'.json',sourceBytes);
 const targets=a.stage==='harvest'?['bag-'+a.crop]:['crop-bed-1','crop-bed-2','crop-bed-3'];
 for(const slotId of targets){const icon=a.stage==='harvest',roomId=icon?'inventory':'garden',scale=icon?.25:a.scale,at=icon?{x:0,y:0}:rooms.garden.entities.find(e=>e.id===slotId)!.at,anchor=icon?[0,0]:a.anchor,projection=icon?'harbor-inventory-closeup':'harbor-orthogonal-runtime-v1';
 const profile=await styleProfile({styleFamilyId:'harbor-platform-pixel',profileId:a.key,version:1,compatProfile:{paletteId:'harbor-crop-'+a.crop,projection,lighting:'baked-daylight',density:{unit:'source-px/world-unit',value:1/scale},pixelScale:{unit:'source-px/game-px',value:1/scale}}});
 const geometry={roomId,slotId,orientation:'front',projection,depth:icon?0:at.y-10,image:{width:256,height:256,scale,anchor:{x:anchor[0],y:anchor[1]},draw:{x:at.x-anchor[0]*scale,y:at.y-(icon?0:10)-anchor[1]*scale,w:256*scale,h:256*scale}},footprint:[],requiredRenderer:{codeSHA256:processing,alpha:'r>110,b>100,r-g>60,b-g>60 only; original RGB preserved'},approach:icon?null:rooms.garden.entities.find(e=>e.id===slotId)!.approach};
 const binding=await prepareConsumerBinding({bindingId:'harbor-'+slotId+'-'+a.key,version:1,sourceManifestBytes:sourceBytes,target:{gameId:'a-summer-in-harbor',roomId,slotId,purpose:icon?'bag-produce':'crop-growth',orientation:'front',geometry,profile,validation:{status:'owner-validated',owner:'harbor-consumer-ai',at:new Date().toISOString(),records:[{id:'crop-visual-review',sha256:evidence}]}}});
 const request={gameId:'a-summer-in-harbor',roomId,slotId,geometryHash:binding.target.geometryHash,profileHash:profile.hash,itemId:a.key,orientation:'front',purpose:icon?'bag-produce':'crop-growth'};
 const selection=await selectConsumerBinding({binding,sourceManifestBytes:sourceBytes,request,mode:'local-authoring'});await resolveConsumerBinding({binding,sourceManifestBytes:sourceBytes,selection,readonlyLoad:async()=>new Uint8Array(bytes)});
 await writeFile(out+'/bindings/'+binding.bindingId+'.json',JSON.stringify(binding,null,2));results.push({id:binding.bindingId,hash:binding.hash,selected:true,byteVerified:true,productionGranted:false});
 }
}
await writeFile(out+'/bindings-report.json',JSON.stringify({count:results.length,bindings:results},null,2));console.log('Verified '+results.length+' local consumer bindings; no library mutation, production grants or uploads.');
