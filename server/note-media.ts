/** Durable illustration sidecars. They never write the story head or collision. */
import {createHash,randomUUID} from 'node:crypto';import {mkdir,writeFile,readFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {generateImageMedia} from '../src/engine/media';import {GAME_UUID} from '../src/game-id';import type {Save} from '../src/story/state';
const run=promisify(execFile),directory='.data/note-media';
export function createNoteMedia(store:any){
 const inFlight=new Map<string,Promise<any>>();
 const access=async(owner:string,id:string,room:string)=>store.transaction(async(tx:any)=>{const row=await tx.session(owner,id);if(!row)throw Error('SESSION_NOT_FOUND');const head:Save=JSON.parse(row.data),place=head.fieldNotes?.rooms.find(r=>r.id===room);if(!place||!head.visited.includes(room))throw Error('NOTES_LOCKED');return {head,place,stored:(await tx.media(id)).find((r:any)=>r.slot==='note-image:'+room)}});
 const persist=async(owner:string,id:string,room:string,data:any)=>store.transaction(async(tx:any)=>{if(!await tx.session(owner,id))throw Error('SESSION_NOT_FOUND');await tx.putMedia(id,'note-image:'+room,data)});
 const publicState=(job:any)=>({status:job.status,room:job.room,...(job.status==='ready'?{url:'./media/'+job.room,width:job.width,height:job.height}:{}),retryable:job.status==='interrupted'});
 async function status(owner:string,id:string,room:string){const {stored}=await access(owner,id,room);return stored?publicState(JSON.parse(stored.data)):{status:'not-started',room}}
 async function ensure(owner:string,id:string,room:string){
  const key=owner+':'+id+':'+room;if(inFlight.has(key))return inFlight.get(key);
  const work=(async()=>{const {place,stored}=await access(owner,id,room);let job=stored?JSON.parse(stored.data):null;
   if(job?.status==='ready'||job?.status==='failed')return publicState(job);
   if(!job){job={requestId:randomUUID(),room,status:'preparing',prompt:'Polished restrained 16-bit pixel art close-up for a modern North American coastal town game. Warm daylight, honey oak and muted sea green. Show a small still-life on a workshop table. No characters, no text, no symbols, no labels, no rewards. This is an illustrative observation, not a map. Keep it grounded in this description: '+place.detail[1]+' '+place.observations[0].text[1],mode:'text',references:[]};await persist(owner,id,room,job)}
   try{const result=await generateImageMedia({sessionId:GAME_UUID,requestId:job.requestId,model:'gpt-image-2.5-sunburst',mode:'text',referenceUrls:[],prompt:job.prompt,size:{width:1024,height:1024},quality:'high',background:'opaque'},{signal:AbortSignal.timeout(240000)});
    job={...job,taskId:result.task_id,status:'downloading',media:result.media};await persist(owner,id,room,job);
    const url=new URL(result.media.url);if(url.protocol!=='https:')throw Error('MEDIA_URL_INVALID');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok||Number(response.headers.get('content-length'))>12582912)throw Error('MEDIA_DOWNLOAD_FAILED');
    const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>12582912){await reader.cancel();throw Error('MEDIA_TOO_LARGE')}chunks.push(value)}
    const bytes=Buffer.concat(chunks),sha=createHash('sha256').update(bytes).digest('hex');await mkdir(directory,{recursive:true});const file=directory+'/'+sha+'.image';await writeFile(file,bytes,{mode:0o600});
    const check=await run(process.env.HARBOR_PYTHON??'python3',['-c','from PIL import Image;import sys,json; im=Image.open(sys.argv[1]);im.verify();im=Image.open(sys.argv[1]); print(json.dumps({"width":im.width,"height":im.height,"format":im.format}))',file]);const dim=JSON.parse(check.stdout);
    if(dim.width<256||dim.height<256||dim.width>2048||dim.height>2048||!['PNG','WEBP','JPEG'].includes(dim.format))throw Error('MEDIA_DIMENSIONS_INVALID');
    job={...job,...dim,sha,status:'ready'};await persist(owner,id,room,job);return publicState(job);
   }catch(error:any){job={...job,status:error.retryable===false?'failed':'interrupted',error:error.code??error.name};await persist(owner,id,room,job);return publicState(job)}
  })();inFlight.set(key,work);try{return await work}finally{inFlight.delete(key)}
 }
 async function image(owner:string,id:string,room:string){const {stored}=await access(owner,id,room);if(!stored)throw Error('MEDIA_NOT_READY');const job=JSON.parse(stored.data);if(job.status!=='ready'||!/^[a-f0-9]{64}$/.test(job.sha))throw Error('MEDIA_NOT_READY');const bytes=await readFile(directory+'/'+job.sha+'.image');if(createHash('sha256').update(bytes).digest('hex')!==job.sha)throw Error('MEDIA_HASH_MISMATCH');return {bytes,type:job.format==='PNG'?'image/png':job.format==='WEBP'?'image/webp':'image/jpeg'}}
 return {status,ensure,image};
}
