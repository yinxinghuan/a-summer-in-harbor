// Durable proposal workflow, separate from turns and adoption. No model transport
// is installed here. Trusted builders must use the existing budgeted gateway.
import {randomUUID} from 'node:crypto';
import {canonical,sha256} from '../rule-compiler/index.mjs';
import {AuthorityError,assertOwner} from '../authority-session/index.mjs';
const hash=v=>sha256(canonical(v));
const fail=(code,status=409)=>{throw new AuthorityError(code,status);};
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(v);
const active=new Set(['running','approving']);
const terminal=new Set(['failed','rejected','stale']);
export function createProposalJobs({store,build,stage,validateSource,mode='disabled',now=Date.now,timeoutMs=180000,fixtureApproval=false,dailyApproval,automaticReview,requestAllowance=false}){
  if(typeof requestAllowance!=='boolean')fail('PROPOSAL_CONFIGURATION');
  if(store?.environment!=='test'||!['disabled','authored-fixture','live'].includes(mode)||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>300000)fail('PROPOSAL_CONFIGURATION');
  if(fixtureApproval&&mode!=='authored-fixture')fail('PROPOSAL_CONFIGURATION');
  if(automaticReview&&(mode!=='live'||fixtureApproval||typeof automaticReview.policy!=='string'||!automaticReview.policy||typeof automaticReview.decide!=='function'))fail('PROPOSAL_CONFIGURATION');
  const grant=dailyApproval===undefined?null:structuredClone(dailyApproval);
  if(grant){
    const budgetOnly=mode==='live'&&Object.keys(grant).sort().join(',')==='expiresAt,maximum,modelBudgetId,owner,policy,startsAt'&&grant.maximum===null&&grant.policy==='model-budget-only-v1'&&typeof grant.modelBudgetId==='string'&&grant.modelBudgetId.length>0;
    const dailySix=Object.keys(grant).sort().join(',')==='expiresAt,maximum,owner,startsAt'&&grant.maximum===6&&Math.floor(grant.startsAt/86400000)===Math.floor((grant.expiresAt-1)/86400000);
    if((!budgetOnly&&!dailySix)||!Number.isSafeInteger(grant.startsAt)||!Number.isSafeInteger(grant.expiresAt)||grant.startsAt>=grant.expiresAt)fail('PROPOSAL_CONFIGURATION');
    assertOwner(grant.owner);Object.freeze(grant);
  }
  const tasks=new Set();
  const audit=(r,owner,kind,subject)=>r.addDynamicAudit(randomUUID(),now(),hash(owner),kind,hash(subject));
  const decode=row=>{if(!row)fail('PROPOSAL_NOT_FOUND',404);return JSON.parse(row.data);};
  const reviewHash=a=>hash({artifact_hash:a.prepared.artifact_hash,packet:a.review_packet??null,semantic:a.semantic??null,...(a.admission?{admission:a.admission}:{})});
  const save=(r,owner,id,d)=>r.writeProposal(owner,id,d.status,d);
  async function expire(r,row){
    const d=decode(row);
    if(active.has(d.status)&&d.deadline<=now()){d.status='failed';d.error='PROPOSAL_INTERRUPTED';delete d.artifact;await save(r,row.owner,row.id,d);await audit(r,row.owner,'proposal-interrupted',row.id);}
    return d;
  }
  const view=(row,d)=>{
    const v={request_id:row.id,session_id:row.session,expected_version:d.version,status:d.stale?'stale':d.status,mode:d.mode,error:d.error??null};
    if(d.status==='ready'){const room=d.artifact.prepared.content.locations.at(-1);Object.assign(v,{artifact_hash:d.artifact.prepared.artifact_hash,label:room.label,detail:room.detail});}
    if(d.status==='ready'&&d.artifact.goalReceipt?.status==='ready')v.goal={question:structuredClone(d.artifact.goalReceipt.goal.question),reason:structuredClone(d.artifact.goalReceipt.goal.reason),sources:structuredClone(d.artifact.goalSources)};
    return v;
  };
  async function current(r,owner,id){
    const row=await r.proposal(owner,id),d=await expire(r,row);
    if(!terminal.has(d.status)){
      const s=await r.session(owner,row.session);
      if(!s||hash(JSON.parse(s.data))!==d.sourceHash||s.cursor!==d.cursor){
        // Keep an in-flight slot occupied until its builder finishes or lease
        // expires. Merely polling a stale job must not allow paid-call overlap.
        d.stale=true;if(!active.has(d.status))d.status='stale';d.error='DELTA_STALE';
        if(!active.has(d.status))delete d.artifact;await save(r,owner,id,d);
      }
    }
    return {row,d};
  }
  async function failJob(owner,id,token,code){
    await store.transaction(async r=>{const row=await r.proposal(owner,id),d=await expire(r,row);if(d.token!==token||!active.has(d.status))return;d.status='failed';d.error=code;delete d.artifact;await save(r,owner,id,d);await audit(r,owner,'proposal-failed',{id,code});});
  }
  // Internal review capability only; deliberately not exposed as a player route.
  async function review(owner,id,{artifact_hash,review_hash,passed,reason=''},reviewer='operator'){
    assertOwner(owner);if(!validId(id)||typeof passed!=='boolean'||typeof reason!=='string'||reason.length>1000)fail('INVALID_REVIEW',400);
    const selected=await store.transaction(async r=>{
      const {row,d}=await current(r,owner,id);
      if(d.decision){
        if(d.decision.artifact_hash!==artifact_hash||d.decision.review_hash!==(review_hash??null)||d.decision.passed!==passed||(d.decision.reason??'')!==reason)fail('REVIEW_DECISION_CONFLICT');
        return null; // Lost approval response is replayed, not restaged.
      }
      if(d.status!=='review_required')fail('PROPOSAL_NOT_REVIEWABLE');
      if(d.artifact.prepared.artifact_hash!==artifact_hash)fail('REVIEW_HASH_MISMATCH');
      if(d.artifact.review_packet&&reviewHash(d.artifact)!==review_hash)fail('REVIEW_PACKET_MISMATCH');
      if(passed&&d.artifact.review_packet&&d.artifact.semantic?.passed!==true)fail('SEMANTIC_REVIEW_REQUIRED');
      d.decision={artifact_hash,review_hash:review_hash??null,passed,reason,at:now(),reviewer};
      await audit(r,owner,'proposal-review-decision',{id,...d.decision});
      if(!passed){d.status='rejected';d.error=reviewer==='operator'?'OPERATOR_REJECTED':'AUTOMATIC_REVIEW_REJECTED';delete d.artifact;await save(r,owner,id,d);await audit(r,owner,'proposal-rejected',{id,artifact_hash});return null;}
      d.status='approving';d.token=randomUUID();d.deadline=now()+timeoutMs;await save(r,owner,id,d);return structuredClone(d);
    });
    if(selected){
      try{
        // Re-runs integrity and real SWI in the adoption boundary. No fork here.
        const result=await stage(owner,selected.artifact);
        if(result?.artifact_hash!==artifact_hash)fail('PROPOSAL_ARTIFACT_MISMATCH');
        await store.transaction(async r=>{const {d}=await current(r,owner,id);if(d.status!=='approving'||d.token!==selected.token)return;d.status=d.stale?'stale':'ready';if(d.stale)delete d.artifact;await save(r,owner,id,d);await audit(r,owner,d.stale?'proposal-stale':'proposal-ready',{id,artifact_hash});});
      }catch(e){await failJob(owner,id,selected.token,e instanceof AuthorityError?e.code:'PROPOSAL_VERIFICATION_FAILED');}
    }
    return get(owner,id);
  }
  async function process(owner,id,context,token){
    const controller=new AbortController();let timer;
    try{
      const isCurrent=()=>store.transaction(async r=>{const {d}=await current(r,owner,id);return d.status==='running'&&!d.stale&&d.token===token;});
      const artifact=await Promise.race([Promise.resolve().then(()=>build(structuredClone(context),{signal:controller.signal,isCurrent})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AuthorityError('PROPOSAL_TIMEOUT',504));},timeoutMs);})]);
      // Compiled trusted artifact includes the existing parent rules and SWI
      // witnesses (~2.7 MiB here). This is not a model-output allowance; the
      // builder's raw-output and compiler/profile limits remain unchanged.
      if(Buffer.byteLength(JSON.stringify(artifact)??'')>4*1024*1024)fail('PROPOSAL_TOO_LARGE');
      if(artifact?.source_head_hash!==hash(context.head)||artifact?.prepared?.descriptor?.source?.session_id!==context.head.id||artifact?.prepared?.descriptor?.source?.cursor!==context.cursor)fail('PROPOSAL_SOURCE_MISMATCH');
      // The decision function is trusted configuration, never a player/model flag.
      const auto=automaticReview?.decide(structuredClone(artifact));
      if(automaticReview&&(!auto||typeof auto.passed!=='boolean'||typeof auto.reason!=='string'||auto.reason.length>1000))fail('AUTOMATIC_REVIEW_INVALID');
      const saved=await store.transaction(async r=>{
        const {d}=await current(r,owner,id);if(d.status!=='running'||d.token!==token)return false;
        if(d.stale){d.status='stale';delete d.artifact;await save(r,owner,id,d);return false;}
        d.status='review_required';d.artifact=artifact;await save(r,owner,id,d);await audit(r,owner,'proposal-review-required',id);return true;
      });
      if(saved&&fixtureApproval)await review(owner,id,{artifact_hash:artifact.prepared.artifact_hash,passed:true});
      if(saved&&auto)await review(owner,id,{artifact_hash:artifact.prepared.artifact_hash,review_hash:reviewHash(artifact),...auto},automaticReview.policy);
    }catch(e){await failJob(owner,id,token,e instanceof AuthorityError?e.code:'PROPOSAL_GENERATION_FAILED');}
    finally{clearTimeout(timer);}
  }
  async function get(owner,id){assertOwner(owner);if(!validId(id))fail('INVALID_REQUEST',400);return store.transaction(async r=>{const {row,d}=await current(r,owner,id);return view(row,d);});}
  return Object.freeze({get,review,
    // Operator capability only. No player HTTP route may expose this packet.
    async inspect(owner,id){assertOwner(owner);if(!validId(id))fail('INVALID_REQUEST',400);return store.transaction(async r=>{const {row,d}=await current(r,owner,id);return {...view(row,d),decision:d.decision??null,...(d.artifact?{artifact_hash:d.artifact.prepared.artifact_hash,review_hash:reviewHash(d.artifact),packet:d.artifact.review_packet??null,content:d.artifact.review_packet?{locations:d.artifact.prepared.content.locations}:d.artifact.prepared.content,semantic:d.artifact.semantic??null}:{})};});},
    async latest(owner,session){assertOwner(owner);if(!validId(session))fail('INVALID_REQUEST',400);return store.transaction(async r=>{if(!await r.session(owner,session))fail('SESSION_NOT_FOUND',404);const rows=await r.proposals(owner,session);if(!rows.length)return null;const {row,d}=await current(r,owner,rows[0].id);return view(row,d);});},
    async submit(owner,input){
      assertOwner(owner);
      if(!input||Object.keys(input).sort().join(',')!=='expected_version,request_id,session_id'||!validId(input.request_id)||!validId(input.session_id)||!Number.isSafeInteger(input.expected_version)||input.expected_version<0)fail('INVALID_REQUEST',400);
      const b=structuredClone(input),digest=hash(b);
      const admitted=await store.transaction(async r=>{
        const old=await r.proposal(owner,b.request_id);
        if(old){if(old.digest!==digest)fail('PROPOSAL_ID_CONFLICT');const {row,d}=await current(r,owner,b.request_id);return {view:view(row,d)};}
        const row=await r.session(owner,b.session_id);if(!row)fail('SESSION_NOT_FOUND',404);
        const head=JSON.parse(row.data);if(head.version!==b.expected_version)fail('VERSION_CONFLICT');
        if(mode==='disabled'||typeof build!=='function')fail('MODEL_UNAVAILABLE',503);
        validateSource(head);
        let count=0;for(const a of await r.activeProposals()){const d=await expire(r,a);if(active.has(d.status)){count++;if(a.owner===owner&&a.session===b.session_id)fail('SESSION_BUSY',429);}}
        if(count>=(requestAllowance?16:2))fail('SERVICE_BUSY',429);
        let previousRejection;
        for(const old of await r.proposals(owner,b.session_id)){const d=await expire(r,old);if(['running','approving','review_required','ready'].includes(d.status)&&d.sourceHash===hash(head))fail('SESSION_BUSY',429);if(!previousRejection&&d.status==='rejected'&&d.version===head.version&&d.cursor===row.cursor&&d.decision?.reason)previousRejection=d.decision.reason;}
        const time=now(),maximum=grant&&owner===grant.owner&&time>=grant.startsAt&&time<grant.expiresAt?grant.maximum:3;
        if(!requestAllowance&&maximum!==null&&await r.proposalCount(owner,Math.floor(time/86400000)*86400000)>=maximum)fail('DAILY_LIMIT',429);
        const d={status:'running',mode,version:head.version,sourceHash:hash(head),cursor:row.cursor,token:randomUUID(),deadline:now()+timeoutMs};
        await r.addProposal(owner,b.request_id,b.session_id,digest,d.status,now(),d);await audit(r,owner,'proposal-started',b);
        return {view:view({id:b.request_id,session:b.session_id},d),context:{head,cursor:row.cursor,request_id:b.request_id,owner,worldId:store.worldId,previousRejection},token:d.token};
      });
      if(admitted.context){const task=process(owner,b.request_id,admitted.context,admitted.token);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(()=>{});}
      return admitted.view;
    },
    drain:()=>Promise.all([...tasks]),
  });
}
