// Shared, no-retry generation/review orchestration. This is NOT admission or
// a session writer. Domain hooks are trusted server configuration, not JSON
// supplied by a player or a model. The existing durable gateway owns charging.
import {AuthorityError} from '../authority-session/index.mjs';
import {canonical,sha256} from '../rule-compiler/index.mjs';
const hash=v=>sha256(canonical(v));
const fail=code=>{throw new AuthorityError(code);};
const hooks=['validateSource','generationMessages','parseDraft','prepareDraft','reviewMessages','parseReview','knownContext'];
export function createProposalBuilder({sourceHash,worldId,gateway,adapter}){
 if(typeof gateway?.call!=='function'||! /^[a-f0-9]{64}$/.test(sourceHash??'')||typeof worldId!=='string'||!worldId||hooks.some(k=>typeof adapter?.[k]!=='function')||typeof adapter?.reviewFormat!=='string'||!adapter.reviewFormat)fail('PROPOSAL_BUILDER_CONFIG');
 // Retain the original finance request IDs and proposal IDs. Extracting this
 // shared flow must not turn a replay into a second billed model request.
 return async(rawContext,{signal,isCurrent=async()=>true}={})=>{
  const context=structuredClone(rawContext),{head,cursor,owner,request_id}=context;
  if(context.worldId!==worldId||typeof owner!=='string'||!owner||!Number.isSafeInteger(cursor)||cursor<0||! /^[a-zA-Z0-9-]{16,80}$/.test(request_id??'')||typeof head?.id!=='string'||!Number.isSafeInteger(head?.version)||head.version<0)fail('PROPOSAL_CONTEXT_INVALID');
  await adapter.validateSource(head);
  const check=async()=>{if(signal?.aborted)fail('PROPOSAL_TIMEOUT');if(!await isCurrent())fail('DELTA_STALE');};
  const binding={sourceHash,source_head_hash:hash(head),session:head.id,version:head.version,cursor};
  const id=purpose=>'room-'+hash({worldId,request_id,purpose}).slice(0,56);
  const messages=adapter.generationMessages(head);
  if(context.previousRejection){
   if(typeof context.previousRejection!=='string'||context.previousRejection.length>1000)fail('PROPOSAL_CONTEXT_INVALID');
   messages.push({role:'user',content:'An operator rejected the prior attempt for this same evidence. Produce a new draft respecting these corrections; do not invent replacements: '+context.previousRejection});
  }
  await check();
  const raw=await gateway.call({owner,id:id('generation'),purpose:'generation',payload:{messages,binding}});
  await check();
  let draft;try{draft=adapter.parseDraft(raw);}catch{fail('MODEL_DRAFT_INVALID');}
  let artifact;try{artifact=await adapter.prepareDraft({head,cursor,draft,proposalId:'player-'+hash({worldId,request_id}).slice(0,32)});}catch{fail('MODEL_DRAFT_INVALID');}
  if(! /^[a-f0-9]{64}$/.test(artifact?.prepared?.artifact_hash??''))fail('MODEL_DRAFT_INVALID');
  await check();
  const reviewRaw=await gateway.call({owner,id:id('review'),purpose:'semantic-review',payload:{messages:adapter.reviewMessages(head,draft),binding:{...binding,artifact_hash:artifact.prepared.artifact_hash}}});
  await check();
  let semantic;try{semantic=adapter.parseReview(reviewRaw);}catch{fail('SEMANTIC_REVIEW_INVALID');}
  artifact.semantic=semantic;
  // A negative review stays negative. Stage/adopt remain separate operations;
  // this layer never overrides a rejection, authorizes a fork, or writes facts.
  artifact.review_packet={format:adapter.reviewFormat,binding,draft,knownContext:adapter.knownContext(messages),semantic};
  if(adapter.admission){
   const audit=adapter.admission;
   if(typeof audit.policy!=='string'||typeof audit.messages!=='function'||typeof audit.parse!=='function')fail('ADMISSION_CONFIG_INVALID');
   let review=null;
   // A rejection never receives an extra paid attempt and cannot be overridden.
   if(semantic.passed===true){
    await check();
    const raw=await gateway.call({owner,id:id('admission-review'),purpose:'semantic-review',payload:{messages:audit.messages(artifact),binding:{...binding,artifact_hash:artifact.prepared.artifact_hash,policy:audit.policy}}});
    await check();
    try{review=audit.parse(raw,artifact);}catch{fail('ADMISSION_REVIEW_INVALID');}
   }
   artifact.admission={policy:audit.policy,artifact_hash:artifact.prepared.artifact_hash,packet_hash:hash(artifact.review_packet),review};
  }
  return artifact;
 };
}
