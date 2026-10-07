import {compileAnimalStoryChoice,assertCompiledAnimalChoice,parseAnimalSemanticReview,animalGroundingSourceHash,animalGroundingPolicy} from './animal-grounding';
import {AnimalContentRegistry,builtInCommissions,canonical,contentHash,validateCommission} from './animal-content';
import type {AnimalCommission,AnimalLifeSave} from '../src/animal-life/types';
import type {Action} from '../src/story/state';
import type {createRuntime} from './runtime';
import {createAnimalLife,assertAnimalNotebook} from './animal-life';
import {acceptedAnimals} from '../src/animals/art';
// @ts-expect-error frozen shared builder, no network transport created here
import {createProposalBuilder} from '../vendor/dynamic-runtime/packages/dynamic-pipeline/proposal-builder.mjs';

const format='harbor-animal-review-v1';
export const animalProposalPolicy={schema:1,id:'animal-notebook-v1',semanticReviewProtocol:'grounded-choice-v4',maximumReviewFindings:8,maximumFindingLength:300,observations:['sun-rest','sleep','shore-space'],maximumRequirements:4,maximumAdoptions:4,relationshipReward:1,items:[],newAbilities:[],species:[],modelCallsPerProposal:2};
export const animalSourceHash=contentHash({policy:animalProposalPolicy,animals:acceptedAnimals,builtin:builtInCommissions,grounding:animalGroundingSourceHash});
const observationFacts=acceptedAnimals.map(a=>({id:a.id,species:a.species,schedule:Object.entries(a.schedule).map(([period,slot])=>({period,scene:slot.scene,activity:slot.activity})),statementPolicy:'Only name a location/behavior/time when this exact animal has that registered schedule. Combining observations does not place them together.'}));
export type Review={format:typeof format;passed:boolean;findings:string[]};
const parseReview=parseAnimalSemanticReview;
/** Domain adapter around the existing generation/review/gateway flow. Stage
 * writes immutable artifacts only; it cannot modify a journey or grant rewards. */
export function createAnimalProposalPipeline(store:any,gateway:{call:(v:any)=>Promise<string>},worldId:string){
 if(store.environment!=='test')throw Error('ANIMAL_PIPELINE_LOCAL_ONLY');
 const builder=createProposalBuilder({sourceHash:animalSourceHash,worldId,gateway,adapter:{
  reviewFormat:format,
  validateSource:(s:AnimalLifeSave)=>{if(s.activeChallenge||!s.known.length)throw Error('ANIMAL_SOURCE_UNAVAILABLE')},
  generationMessages:(s:AnimalLifeSave)=>[{role:'system',content:'Choose ONE optional animal observation story. Return JSON with exactly schema:1,id,revision,resident,theme,observations. theme is compare-routines or leave-space. observations has 2-4 distinct {animal,behavior,period,scene}, one exact existing individual schedule fact each. behavior is sun-rest/sleep for a cat at its exact activity or shore-space for a scheduled gull. No title, prose, rules, effects, rewards, new species, new abilities or ownership. Facts become author-rendered bilingual sentences; you choose their grouping and story theme. Ground EACH individual time independently. The resident must be already introduced. Do not copy the requirements of an existing commission.'},{role:'user',content:JSON.stringify({policy:animalProposalPolicy,grounding:animalGroundingPolicy,knownResidents:s.known.filter(p=>['mara','ruth','owen','dani'].includes(p)),observationFacts,existing:[...builtInCommissions,...(s.animalNotebookV1?.adopted??[]).map(e=>e.definition)]})}],
  parseDraft:(raw:string)=>{if(typeof raw!=='string'||Buffer.byteLength(raw)>8000)throw Error('ANIMAL_DRAFT_SIZE');return JSON.parse(raw)},
  prepareDraft:({head,cursor,draft}:any)=>{
   const choice=structuredClone(draft);draft=compileAnimalStoryChoice(choice,head.known);validateCommission(draft);if(!head.known.includes(draft.resident))throw Error('ANIMAL_UNKNOWN_RESIDENT');
   const existing=[...builtInCommissions,...(head.animalNotebookV1?.adopted??[]).map((e:any)=>e.definition)];
   if(existing.some(d=>d.id===draft.id||canonical([...d.requirements].sort((a,b)=>canonical(a).localeCompare(canonical(b))))===canonical([...draft.requirements].sort((a:any,b:any)=>canonical(a).localeCompare(canonical(b))))))throw Error('ANIMAL_COSMETIC_DUPLICATE');
   const registry=new AnimalContentRegistry([draft]),ref=registry.ref(draft.id,draft.revision),binding={session:head.id,version:head.version,cursor,sourceHash:animalSourceHash,sourceHeadHash:contentHash(head),worldId};
   const prepared={grounded:choice,definition:structuredClone(draft),ref,binding};return {prepared:{...prepared,artifact_hash:contentHash(prepared)}};
  },
  reviewMessages:(s:AnimalLifeSave,draft:AnimalCommission)=>[{role:'system',content:'Review the proposed animal notebook story. Return ONLY a JSON object with exactly format, passed and findings: {"format":"harbor-animal-review-v1","passed":true,"findings":[]} when accepted, or {"format":"harbor-animal-review-v1","passed":false,"findings":["specific rejection reason"]}. findings must contain at most 8 strings, each at most 300 characters. Split independent problems into short concrete findings rather than one long explanation. findings contains problems only, never positive commentary; passed=true requires findings=[]. Compare every location/time/behavior claim against observationFacts for the exact animal. Reject invented co-location, such as a courtyard cat described on a shore or beach. Reject unknown identities, invented owners, hidden facts, promised currency/items/new abilities, harmful pursuit, near-duplicate stories or merely renamed existing commissions. A fixed +1 relationship is implemented by the engine only. No model effect syntax is allowed.'},{role:'user',content:JSON.stringify({policy:animalProposalPolicy,known:s.known,choice:draft,compiled:compileAnimalStoryChoice(draft,s.known),observationFacts,existing:[...builtInCommissions,...(s.animalNotebookV1?.adopted??[]).map(e=>e.definition)]})}],
  parseReview,knownContext:(messages:any)=>JSON.parse(messages[1].content),
 }});
 const load=async(owner:string,hash:string)=>store.transaction(async(tx:any)=>{if(!/^[a-f0-9]{64}$/.test(hash))throw Error('ANIMAL_ARTIFACT_INVALID');const row=await tx.artifact(owner,hash);if(!row||Number(row.revoked)!==0)throw Error('ANIMAL_ARTIFACT_UNAVAILABLE');const a=JSON.parse(row.data),{artifact_hash:_,...prepared}=a.prepared??{};if(a.prepared?.artifact_hash!==hash||contentHash(prepared)!==hash||contentHash(a)!==row.digest||a.prepared.binding?.sourceHash!==animalSourceHash||a.prepared.binding?.worldId!==worldId)throw Error('ANIMAL_ARTIFACT_INVALID');parseReview(JSON.stringify(a.semantic));validateCommission(a.prepared.definition);assertCompiledAnimalChoice(a.prepared.grounded,a.prepared.definition);const ref=new AnimalContentRegistry([a.prepared.definition]).ref(a.prepared.definition.id,a.prepared.definition.revision);if(canonical(ref)!==canonical(a.prepared.ref))throw Error('ANIMAL_ARTIFACT_INVALID');return a});
 return {worldId,load,async propose(owner:string,s:AnimalLifeSave,request_id:string){
  const isCurrent=()=>store.transaction(async(tx:any)=>{const row=await tx.session(owner,s.id);return !!row&&contentHash(JSON.parse(row.data))===contentHash(s)});
  const artifact=await builder({worldId,owner,head:s,cursor:s.cursor,request_id},{isCurrent});
  const hash=artifact.prepared.artifact_hash;
  await store.transaction(async(tx:any)=>{const row=await tx.session(owner,s.id);if(!row||contentHash(JSON.parse(row.data))!==contentHash(s))throw Error('DELTA_STALE');const old=await tx.artifact(owner,hash);if(old&&old.digest!==contentHash(artifact))throw Error('ANIMAL_ARTIFACT_CONFLICT');if(!old)await tx.addArtifact(owner,hash,contentHash(artifact),artifact)});
  return structuredClone(artifact);
 }};
}
export type AnimalProposalPipeline=ReturnType<typeof createAnimalProposalPipeline>;
export function registryForAnimals(s:AnimalLifeSave,enabled=true){
 const adopted=s.animalNotebookV1?.adopted??[];
 if(!Array.isArray(adopted)||adopted.length>4)throw Error('UNSUPPORTED_ANIMAL_ADOPTIONS');
 const ids=new Set<string>();for(const e of adopted){if(!e||Object.keys(e).sort().join(',')!=='artifactHash,definition,ref'||!/^[a-f0-9]{64}$/.test(e.artifactHash)||builtInCommissions.some(d=>d.id===e.definition?.id)||ids.has(e.definition?.id))throw Error('UNSUPPORTED_ANIMAL_ADOPTIONS');validateCommission(e.definition);const r=new AnimalContentRegistry([e.definition]);if(canonical(r.ref(e.definition.id,e.definition.revision))!==canonical(e.ref))throw Error('UNSUPPORTED_ANIMAL_ADOPTIONS');ids.add(e.definition.id)}
 const defs=[...builtInCommissions,...adopted.map(e=>e.definition)];return new AnimalContentRegistry(defs,enabled?defs.map(d=>d.id+'@'+d.revision):[]);
}
/** Same authority/CAS writer as ordinary gameplay; adoption adds an immutable
 * optional definition, never inventory, facts, relationships or new capabilities. */
export function createAnimalProposalRuntime(base:ReturnType<typeof createRuntime>,pipeline:AnimalProposalPipeline,newStarts=true){
 const baseAssembly=createAnimalLife(base);
 const assemble=(s:AnimalLifeSave)=>createAnimalLife(base,registryForAnimals(s,newStarts));
 const rt={...baseAssembly.runtime,
  assertReadable(s:AnimalLifeSave){assemble(s).runtime.assertReadable(s)},
  validateAction(a:Action){if(a.action!=='animal-life:adopt')return baseAssembly.runtime.validateAction(a);base.validateAction(a);const p=a.payload as any;if(!p||Object.keys(p).join(',')!=='artifactHash'||!/^[a-f0-9]{64}$/.test(p.artifactHash))throw Error('INVALID_ANIMAL_ADOPTION')},
  async prepare(s:AnimalLifeSave,a:Action,cancel?:unknown,context?:{owner:string}){
   if(a.action!=='animal-life:adopt')return assemble(s).runtime.prepare(s,a,cancel,context);
   this.validateAction(a);this.assertReadable(s);base.position(s,a.position);
   if(!newStarts)throw Error('ANIMAL_CONTENT_CLOSED');if(a.target!=='animal-notebook'||a.scene!==s.scene||a.expected_version!==s.version||s.activeChallenge||s.turnBattle)throw Error('ANIMAL_ADOPTION_UNAVAILABLE');if(!context?.owner)throw Error('ANIMAL_ADOPTION_OWNER_REQUIRED');
   const hash=(a.payload as any).artifactHash,artifact=await pipeline.load(context.owner,hash),p=artifact.prepared;
   if(artifact.semantic.passed!==true)throw Error('ANIMAL_REVIEW_REJECTED');if(p.binding.session!==s.id||p.binding.version!==s.version||p.binding.cursor!==s.cursor||p.binding.sourceHeadHash!==contentHash(s))throw Error('DELTA_STALE');
   const head=structuredClone(s);head.animalNotebookV1??={schema:1,briefs:[],pages:[]};const n=head.animalNotebookV1;n.adopted??=[];if(n.adopted.length>=4||n.adopted.some(e=>e.ref.id===p.ref.id))throw Error('ANIMAL_ADOPTION_CAPACITY');n.adopted.push({artifactHash:hash,definition:structuredClone(p.definition),ref:{...p.ref}});delete n.sample;
   const text:[string,string]=['新的观察故事已收进目录。还需要亲自接下约定与观察，才会留下经历。','The observation story is in your notebook. Accept the plan and make the observations yourself to create a memory.'];
   head.position={...a.position};head.version++;head.cursor++;head.history.push({id:a.action_id,kind:'action',text});head.history=head.history.slice(-500);this.assertReadable(head);return {head,text,kind:'animal-life:adopt',accepted:true,actionId:a.action};
  },
 };
 return {...baseAssembly,runtime:rt,animalProject:(s:AnimalLifeSave)=>assemble(s).animalProject(s),lifeProject:(s:AnimalLifeSave)=>assemble(s).lifeProject(s)};
}
