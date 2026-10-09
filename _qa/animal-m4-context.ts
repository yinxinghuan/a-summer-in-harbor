import {readFileSync,writeFileSync,openSync,fsyncSync,closeSync,renameSync,existsSync,statfsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {withNativeCrabLife} from '../server/native-crab-life';
import {withBasilPlantUses} from '../server/plant-basil';
import {configuredNews} from '../server/news/configured';
import {createAnimalProposalRuntime,type AnimalProposalPipeline} from '../server/animal-proposals';
// @ts-expect-error pinned existing authority; test store only
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
export {AsyncSessionAuthority,openAsyncSqliteAuthorityStore};
export const root=resolve(import.meta.dirname,'../..'),batch=join(root,'live-batch');
export const owner='animal-ai-m4-v5-isolated',worldId='animal-ai-m4-v5-20261008-isolated';
export const baselineCommit='b24ff51149a2b8c34782991765aa90f557c0994e';
export const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
export const digest=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export const fileHash=(path:string)=>digest(readFileSync(path));
export function save(path:string,value:unknown){
 const temporary=path+'.'+randomUUID()+'.tmp',fd=openSync(temporary,'wx');
 try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}
 renameSync(temporary,path);
}
export function approval(){
 const a=read(join(root,'AUTHORIZATION.json'));
 assert.equal(a.batch,'AI-M4-v5');assert.equal(a.maximumCalls,2);
 assert.equal(a.defaultModel,true);assert.equal(a.underlyingModelUnknownAccepted,true);assert.equal(a.feesUnknownAccepted,true);
 assert.equal(a.failuresAndUnknownCount,true);assert.equal(a.automaticRetry,false);assert.equal(a.quotaTransfer,false);
 assert.deepEqual(a.purposes,['generation','semantic-review']);assert.equal(a.endpoint,'https://chat.aiwaves.tech/aigram/api/game-chat');
 assert.equal(digest(a.userInstruction),a.instructionSHA256);
 assert.equal(a.messageId,'Sentinel_8400744edfe08191b8722cff7836eec9');assert.equal(a.sourceThread,'01a118a8-0785-70a0-ba66-07959703b0ca');
 assert.equal(a.mediaCallsMaximum,0);assert.ok(!a.productionWrites&&!a.realPlayerWrites&&!a.securitySettingWrites&&!a.libraryWrites);
 assert.equal(read(join(root,'INPUT.json')).commit,'14aa82b7cba554a77f5008ec5274fa312aabf9e1');
 const l=read(join(batch,'CALL_LEDGER.json'));assert.equal(l.approvalSHA256,fileHash(join(root,'AUTHORIZATION.json')));
 assert.equal(l.batch,a.batch);assert.equal(l.maximum,2);assert.equal(l.actualPosts,l.attempts.length);
 const b=read(join(root,'BASELINE.json')),p=read(join(root,'evidence/current-production-pin.json'));
 assert.equal(b.commit,baselineCommit);assert.equal(p.passed,true);assert.equal(p.commit,b.commit);
 assert.equal(fileHash(join(root,'evidence/production-main.js')),b.mainBundleSHA256);
 const disk=statfsSync(root);assert.ok(disk.bavail*disk.bsize>15*1024**3+20*1024**2,'DISK_FLOOR_15GIB');
 return {a,l};
}
export function plan(){
 const p=join(batch,'plan.json');
 if(!existsSync(p))save(p,{schema:1,owner,worldId,budgetId:'animal-ai-m4-v5-approved-20261008',maximum:2,session:randomUUID(),requestId:randomUUID(),baselineCommit});
 const v=read(p);assert.equal(v.owner,owner);assert.equal(v.worldId,worldId);assert.equal(v.maximum,2);assert.equal(v.baselineCommit,baselineCommit);return v;
}
export function testInitial(locale:any,id:string){return {...initial(locale,id),scene:'coast',position:{...rooms.coast.spawn},visited:Object.keys(rooms),known:['mara','ruth','owen','dani'],flags:['key','unpacked','route-open','market-open'],items:{key:1}}}
/** The published news wrapper pins legacy context on the first ordinary action.
 * Complete that real action before binding the proposal, never loosen its hash. */
export async function createReadyJourney(authority:any,session:string){
 const born=await authority.create(owner,session,'en');
 const action={action_id:randomUUID(),expected_version:born.version,scene:born.scene,position:born.position,target:'home',action:'travel-map'};
 return {born,action,head:(await authority.action(owner,born.id,action)).head};
}
export function makeAssembly(pipeline:AnimalProposalPipeline,options:{now?:()=>number;initial?:typeof testInitial;newStarts?:boolean}={}){
 return createExplorationAssembly({now:options.now??(()=>100000),boot:'animal-m4-v5-local-boot',crabEnabled:true,initial:options.initial??testInitial,
  createLife:(base:any,plants:boolean,native:any)=>withNativeCrabLife(createAnimalProposalRuntime(base,pipeline,options.newStarts!==false,plants),native),
  decorateLife:(life:any)=>withBasilPlantUses(life,{enabled:true,newStarts:true}),
  decorateRuntime:(runtime:any)=>configuredNews(runtime,resolve(import.meta.dirname,'../server/news/frozen-catalog-20261006.json'))});
}
export const storeConfig=()=>({path:join(batch,'isolated-authority.sqlite'),worldId,gameId:worldId,environment:'test'});
export function sourcePins(){return Object.fromEntries(['server/animal-grounding.ts','server/animal-proposals.ts','server/exploration-assembly.ts','server/life-assembly.ts','server/native-crab-life.ts','server/plant-basil.ts','server/animal-contract-schema.ts','server/animal-grounded-review.ts','vendor/dynamic-runtime/packages/dynamic-pipeline/model-gateway.mjs','vendor/dynamic-runtime/packages/dynamic-pipeline/proposal-builder.mjs','_qa/animal-m4-context.ts','_qa/animal-m4-live.ts','_qa/animal-m4-play.ts'].map(p=>[p,fileHash(resolve(import.meta.dirname,'..',p))]))}
