import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {acceptedAnimals} from '../src/animals/art';
import {compileAnimalStoryChoice,parseAnimalSemanticReview} from '../server/animal-grounding';
import {createAnimalProposalPipeline} from '../server/animal-proposals';
import {makeAssembly,createReadyJourney,owner,worldId,AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from './animal-m3-context';
// @ts-expect-error unchanged gateway; memory-only recorded transport
import {createModelGateway} from '../vendor/dynamic-runtime/packages/dynamic-pipeline/model-gateway.mjs';

// Historical original bytes are sealed in the consumer's fixed evidence folder.
const load=(kind:string)=>readFileSync(join(import.meta.dirname,`fixtures/animal-ai-history-v5/m3-call-${kind==='generation'?1:2}-response.json`));
const sha=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
test('actual M3 extra statement fields reject before a review or artifact; cached retry stays offline and the published-composition head stays unchanged',async()=>{
 const bytes=load('generation');assert.equal(sha(bytes),'24b8e5338a21f10e97b35e0d5d2b46df75842ae418d3f0b3598ebb6f49f67dc7');
 const raw=JSON.parse(bytes.toString()).choices[0].message.content,choice=JSON.parse(raw);
 for(const observation of choice.observations){
  const animal=acceptedAnimals.find(a=>a.id===observation.animal)!;
  const schedule=animal.schedule[observation.period as keyof typeof animal.schedule];
  assert.ok(schedule);
  assert.equal(schedule.scene,observation.scene);assert.equal(schedule.activity,observation.behavior);
  assert.ok(Object.hasOwn(observation,'statement'));
 }
 assert.throws(()=>compileAnimalStoryChoice(choice,['mara']),/ANIMAL_GROUNDED_OBSERVATIONS/);
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId,gameId:worldId,environment:'test'});let calls=0;
 try{
  const gateway=await createModelGateway({store,budgetId:'free-m3-recorded-failure',maximum:2,ownerLimits:{[owner]:2},transport:async(payload:any)=>{
   calls++;assert.equal(calls,1,'INVALID_DRAFT_MUST_NOT_REACH_REVIEW');
   const context=JSON.parse(payload.messages[1].content);
   for(const fact of context.observationFacts)assert.deepEqual(Object.keys(fact).sort(),['id','schedule','species']);
   return raw;
  }}),pipeline=createAnimalProposalPipeline(store,gateway,worldId),assembly=makeAssembly(pipeline);
  const authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,assembly.runtime),store);
  const {head}=await createReadyJourney(authority,randomUUID()),request=randomUUID();
  await assert.rejects(pipeline.propose(owner,head,request),/MODEL_DRAFT_INVALID/);
  await assert.rejects(pipeline.propose(owner,head,request),/MODEL_DRAFT_INVALID/);
  assert.equal(calls,1);assert.deepEqual(await gateway.usage(),{maximum:2,used:1});
  assert.deepEqual(await authority.get(owner,head.id),head);
  await assert.rejects(pipeline.load(owner,'0'.repeat(64)),/ANIMAL_ARTIFACT_UNAVAILABLE/);
  assert.equal(JSON.stringify(JSON.parse(raw)),JSON.stringify(choice));
  assert.equal(sha(load('generation')),sha(bytes));
 }finally{await store.close()}
});

test('actual independent M3 rejection has valid bounded protocol, retains all original findings and cannot turn into an approval',()=>{
 const bytes=load('review');assert.equal(sha(bytes),'7493a0e9e46f4dd1cb44e6d8e25c7adfcc894c802b385982225b0aeb048ad9ea');
 const raw=JSON.parse(bytes.toString()).choices[0].message.content,review=parseAnimalSemanticReview(raw);
 assert.equal(review.passed,false);assert.equal(review.findings.length,8);
 assert.deepEqual(review,JSON.parse(raw));
 assert.throws(()=>parseAnimalSemanticReview(JSON.stringify({...review,passed:true})),/ANIMAL_REVIEW_INVALID/);
 assert.equal(sha(load('review')),sha(bytes));
});
