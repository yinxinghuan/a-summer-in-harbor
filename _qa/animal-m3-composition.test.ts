import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {makeAssembly,createReadyJourney,owner,worldId,AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from './animal-m3-context';
import {createAnimalProposalPipeline} from '../server/animal-proposals';import {playStory} from './animal-m3-playthrough';
// @ts-expect-error pinned gateway, pure fixture only
import {createModelGateway} from '../vendor/dynamic-runtime/packages/dynamic-pipeline/model-gateway.mjs';
test('four authored periods with original compact motion, foreground, native crab, basil and pinned AI adoption complete without a live transport',async()=>{
 const choice={schema:1 as const,id:'animals:m3-four-free-observations',revision:1,resident:'dani' as const,theme:'compare-routines' as const,observations:[{animal:'harbor-cat-2',behavior:'sun-rest' as const,period:'morning' as const,scene:'courtyard'},{animal:'harbor-cat-3',behavior:'sun-rest' as const,period:'afternoon' as const,scene:'courtyard'},{animal:'harbor-cat-2',behavior:'sleep' as const,period:'night' as const,scene:'courtyard'},{animal:'harbor-cat-3',behavior:'sleep' as const,period:'night' as const,scene:'courtyard'}]};
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId,gameId:worldId,environment:'test'});let calls=0;const time={value:100000};
 try{const gateway=await createModelGateway({store,budgetId:'m3-free-four-periods',maximum:2,ownerLimits:{[owner]:2},transport:async()=>++calls===1?JSON.stringify(choice):JSON.stringify({format:'harbor-animal-review-v2',passed:true,findings:[]})}),pipeline=createAnimalProposalPipeline(store,gateway,worldId),assembly=makeAssembly(pipeline,{now:()=>time.value}),authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store),{head}=await createReadyJourney(authority,randomUUID()),artifact=await pipeline.propose(owner,head,randomUUID());
 const adopted=(await authority.action(owner,head.id,{action_id:randomUUID(),expected_version:head.version,scene:head.scene,position:head.position,target:'animal-notebook',action:'animal-life:adopt',payload:{artifactHash:artifact.prepared.artifact_hash}})).head;
 const result=await playStory(authority,assembly,owner,adopted,choice,time);assert.equal(result.report.counts.observations,4);assert.ok(result.report.counts.motion>0);assert.ok(result.report.counts.active>0);assert.equal(calls,2);
 }finally{store.close()}
});
