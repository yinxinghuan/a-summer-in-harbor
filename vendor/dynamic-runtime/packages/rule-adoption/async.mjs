import {randomUUID} from 'node:crypto';
import {canonical,sha256} from '../rule-compiler/index.mjs';
import {AuthorityError,assertOwner} from '../authority-session/index.mjs';
import {verifyRuleDelta} from '../rule-delta/index.mjs';
import {witnessPaths} from '../rule-delta/witness-path.mjs';
import {validateProfile} from '../game-profile/index.mjs';

const hash=v=>sha256(canonical(v));
const wire=v=>JSON.parse(JSON.stringify(v));
const fail=(code,status=409)=>{throw new AuthorityError(code,status);};
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(v);
const validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

function integrity(a,expected){
  const p=a?.prepared,d=p?.descriptor;
  if(!d||p.artifact_hash!==expected||hash(d)!==expected||hash(p.compiled)!==d.rules_artifact_hash
    ||hash(p.content)!==d.content_hash||hash(p.lineage)!==d.lineage_hash||hash(a.profile)!==d.profile_hash
    ||a.source_head_hash!==d.source_head_hash||a.lineage&&hash(a.lineage)!==d.lineage_hash)
    fail('DELTA_ARTIFACT_MISMATCH');
  validateProfile(a.profile,p.definition.rules);
  if(a.profile.semanticReview.required&&(a.semantic?.passed!==true||!['en','zh'].every(l=>a.semantic.locales?.includes(l))))fail('SEMANTIC_REVIEW_REQUIRED');
  return p;
}

/** Async projected-state adoption candidate. No HTTP upload endpoint or live
 * producer. Only a trusted, already admitted pipeline calls stage(). The
 * evidence is re-executed before staging; all fork writes share the authority
 * store transaction/lock. Native graphical projections still need an adapter. */
export function createAsyncAdoption({store,runtime,runProlog,now=Date.now}){
  if(store?.environment!=='test'||typeof store.transaction!=='function'||typeof runProlog!=='function')fail('ASYNC_ADOPTION_TEST_ONLY');
  const headOf=row=>{
    if(!row)fail('SESSION_NOT_FOUND',404);
    const h=runtime.upgrade(JSON.parse(row.data));
    if(JSON.stringify(h)!==row.data)fail('MIGRATION_REQUIRED');
    return h;
  };
  const sourceMatches=(row,a)=>{
    const h=headOf(row),s=a.prepared.descriptor.source;
    if(h.version!==s.version)fail('VERSION_CONFLICT');
    if(h.id!==s.session_id||row.cursor!==s.cursor||hash(h)!==a.source_head_hash||hash(h.state)!==a.source_state_hash
      ||(h.binding?.artifact_hash??null)!==a.prepared.descriptor.parent_composite_hash)fail('DELTA_STALE');
    if(h.world!==store.gameId||a.profile.gameId!==store.gameId)fail('WORLD_MISMATCH');
    return h;
  };
  const readArtifact=row=>{
    if(!row)fail('ARTIFACT_NOT_FOUND',404);
    if(Number(row.revoked)!==0)fail('ARTIFACT_REVOKED');
    let a;try{a=JSON.parse(row.data);}catch{fail('DELTA_ARTIFACT_MISMATCH');}
    if(hash(a)!==row.digest)fail('DELTA_ARTIFACT_MISMATCH');
    integrity(a,row.hash);
    if(a.report?.status!=='offline-verified-not-adopted'||a.report.artifact_hash!==row.hash)fail('DELTA_ARTIFACT_MISMATCH');
    return a;
  };
  const audit=(repo,owner,kind,subject)=>repo.addDynamicAudit(randomUUID(),now(),hash(owner),kind,hash(subject));
  return Object.freeze({
    async stage(owner,input){
      assertOwner(owner);
      const a=wire(input),p=integrity(a,a?.prepared?.artifact_hash);
      if(!validHash(p.artifact_hash))fail('DELTA_ARTIFACT_MISMATCH');
      // Reject stale sources before running expensive verification; check again
      // in the final transaction because prepare/verification can be slow.
      const head=await store.transaction(async repo=>sourceMatches(await repo.session(owner,p.descriptor.source.session_id),a));
      await runtime.validateDynamicArtifact?.(head,a);
      const sourceState={...wire(head.state),facts:{...Object.fromEntries(p.definition.rules.facts.map(f=>[f.id,f.initial])),...head.state.facts}};
      const room=p.content.locations.at(-1)?.id;
      const parentActionCount=p.definition.rules.actions.findIndex(action=>action.id===p.entry_action_id
        ||action.when?.op==='all'&&action.when.rules.some(rule=>rule.op==='map-is'&&rule.nodeId===room));
      if(parentActionCount<0)fail('DELTA_ARTIFACT_MISMATCH');
      // Never accept a caller's claim that its Prolog report passed.
      a.report=await verifyRuleDelta({prepared:p,sourceState,runProlog,profile:a.profile,
        ...witnessPaths(p,sourceState,a.profile,parentActionCount,{completionActionIds:runtime.completionWitnessActionIds})});
      const digest=hash(a);
      return store.transaction(async repo=>{
        sourceMatches(await repo.session(owner,p.descriptor.source.session_id),a);
        const old=await repo.artifact(owner,p.artifact_hash);
        if(old){readArtifact(old);if(old.digest!==digest)fail('ARTIFACT_ID_CONFLICT');return {artifact_hash:p.artifact_hash};}
        await repo.addArtifact(owner,p.artifact_hash,digest,a);
        await audit(repo,owner,'artifact-ready',p.artifact_hash);
        return {artifact_hash:p.artifact_hash};
      });
    },
    async load(owner,artifactHash){assertOwner(owner);return store.transaction(async repo=>readArtifact(await repo.artifact(owner,artifactHash)));},
    async loadForHead(head){
      return store.transaction(async repo=>{
        const row=await repo.boundArtifact(head),a=readArtifact(row);
        if(canonical(JSON.parse(row.head_data).binding)!==canonical(head.binding))fail('DELTA_ARTIFACT_MISMATCH');
        if(head.world!==store.gameId||head.binding.ruleset_version!==a.prepared.definition.rules.rulesetVersion)fail('WORLD_MISMATCH');
        return a.prepared;
      });
    },
    async revoke(owner,artifactHash){
      assertOwner(owner);return store.transaction(async repo=>{
        readArtifact(await repo.artifact(owner,artifactHash));
        // A live bound journey must retain its safe exit. Full revocation and
        // fallback policy is a later governance task, not deletion here.
        if((await repo.list(owner)).some(r=>JSON.parse(r.data).binding?.artifact_hash===artifactHash))fail('ARTIFACT_IN_USE');
        await repo.revokeArtifact(owner,artifactHash);await audit(repo,owner,'artifact-revoked',artifactHash);
      });
    },
    async adopt(owner,input){
      assertOwner(owner);
      if(!input||Object.keys(input).sort().join(',')!=='adoption_id,artifact_hash,expected_version,session_id'
        ||!validId(input.adoption_id)||!validId(input.session_id)||!validHash(input.artifact_hash)
        ||!Number.isSafeInteger(input.expected_version)||input.expected_version<0)fail('INVALID_ADOPTION',400);
      const body=wire(input),digest=hash(body);
      return store.transaction(async repo=>{
        const old=await repo.adoption(owner,body.adoption_id);
        if(old){if(old.digest!==digest)fail('ADOPTION_ID_CONFLICT');return JSON.parse(old.response);}
        const row=await repo.session(owner,body.session_id),head=headOf(row);
        if(head.version!==body.expected_version)fail('VERSION_CONFLICT');
        const a=readArtifact(await repo.artifact(owner,body.artifact_hash)),p=a.prepared;
        sourceMatches(row,a);
        if(await repo.sourceAdoption(owner,head.id,head.version))fail('SOURCE_ALREADY_FORKED');
        if(await repo.count(owner)>=100)fail('SESSION_LIMIT',429);
        const next=wire(head);next.id=randomUUID();next.version=0;
        next.binding={artifact_hash:p.artifact_hash,ruleset_version:p.definition.rules.rulesetVersion};
        next.catalog=wire(p.content.locations);
        for(const f of p.definition.rules.facts)if(!Object.hasOwn(next.state.facts,f.id)){
          if(f.initial!==false)fail('DELTA_PROTECTED_WRITE');next.state.facts[f.id]=false;
        }
        for(const [k,v] of Object.entries(head.state.facts))if(canonical(next.state.facts[k])!==canonical(v))fail('DELTA_PROTECTED_WRITE');
        // Trusted game projection only; never accept a browser-provided head.
        // Runs inside the same fork transaction, without opening another store.
        await runtime.projectAdoption?.(next,head,a);
        runtime.assertReadable(next);
        const result={kind:'adopted',head:next,source_id:head.id,artifact_hash:p.artifact_hash,cursor:0};
        await repo.insert(owner,'adoption:'+body.adoption_id,digest,next,now());
        await repo.copyMedia(head.id,next.id);
        await repo.addAdoption(owner,body.adoption_id,digest,head.id,head.version,result);
        await audit(repo,owner,'adopted',{source:head.id,target:next.id,artifact:p.artifact_hash});
        return result;
      });
    },
  });
}
