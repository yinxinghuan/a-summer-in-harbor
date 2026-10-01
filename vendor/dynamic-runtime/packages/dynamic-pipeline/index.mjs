import {canonical,sha256} from '../rule-compiler/index.mjs';
import {prepareRuleDelta,verifyRuleDelta} from '../rule-delta/index.mjs';
import {witnessPaths} from '../rule-delta/witness-path.mjs';
import {validateProfile,resolveLimits} from '../game-profile/index.mjs';
import {assertOwner,AuthorityError} from '../authority-session/index.mjs';
import {assembleSlots} from './slots.mjs';
export {createProposalBuilder} from './proposal-builder.mjs';
const fail=(code,status=422)=>{throw new AuthorityError(code,status);};
const hash=v=>sha256(canonical(v));
export function createPipeline({db,profile,loadSource,producer,reviewer,runProlog,overrides={},clock=Date.now}){
  profile=validateProfile(profile);const limits=resolveLimits(profile,overrides);
  if(!db.worldId||db.worldId!==profile.gameId)fail('WORLD_MISMATCH');
  db.run('CREATE TABLE IF NOT EXISTS kit_jobs(owner TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,session TEXT NOT NULL,status TEXT NOT NULL,artifact TEXT,error TEXT,PRIMARY KEY(owner,id))');
  db.run('CREATE TABLE IF NOT EXISTS kit_artifacts(owner TEXT NOT NULL,hash TEXT NOT NULL,data TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,hash))');
  db.run('CREATE TABLE IF NOT EXISTS kit_usage(key TEXT PRIMARY KEY,n INTEGER NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS kit_audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,actor_hash TEXT NOT NULL,kind TEXT NOT NULL,subject_hash TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS kit_attempts(owner TEXT NOT NULL,job TEXT NOT NULL,attempt INTEGER NOT NULL,raw TEXT NOT NULL,error TEXT,PRIMARY KEY(owner,job,attempt))');
  // Construct once at startup, after the single writer has acquired its DB.
  db.run("UPDATE kit_jobs SET status='failed',error='GENERATION_INTERRUPTED' WHERE status IN ('queued','running')");
  const one=(sql,...args)=>db.all(sql,...args)[0];
  const audit=(owner,kind,subject)=>db.run('INSERT INTO kit_audit(at,actor_hash,kind,subject_hash) VALUES(?,?,?,?)',clock(),hash(owner),kind,hash(subject));
  const count=k=>one('SELECT n FROM kit_usage WHERE key=?',k)?.n??0;
  const increment=k=>db.run('INSERT INTO kit_usage VALUES(?,1) ON CONFLICT(key) DO UPDATE SET n=n+1',k);
  const view=r=>({request_id:r.id,status:r.status,artifact_hash:r.artifact??null,error:r.error??null});
  const jobs=new Map();
  function load(owner,artifactHash){assertOwner(owner);const r=one('SELECT * FROM kit_artifacts WHERE owner=? AND hash=?',owner,artifactHash);if(!r)fail('ARTIFACT_NOT_FOUND',404);if(r.revoked)fail('ARTIFACT_REVOKED',409);const a=JSON.parse(r.data);if(hash(a.prepared.descriptor)!==artifactHash)fail('DELTA_ARTIFACT_MISMATCH');return a;}
  async function invoke(adapter,payload,owner,job,kind){
    if(!adapter||!['fixture','live'].includes(adapter.mode))fail('MODEL_ADAPTER_UNAVAILABLE',503);
    if(adapter.mode==='live')db.transaction(()=>{if(count('model-calls')>=limits.totalModelCalls)fail('DYNAMIC_MODEL_LIMIT',429);increment('model-calls');audit(owner,'model-call-reserved',{job,kind});});
    const controller=new AbortController();let timer;
    try{return await Promise.race([
      Promise.resolve().then(()=>adapter.run(structuredClone(payload),{signal:controller.signal})),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AuthorityError('MODEL_TIMEOUT',504));},60000);}),
    ]);}finally{clearTimeout(timer);}
  }
  async function process(owner,id,context){
    try{
      let lastError;
      for(let attempt=0;attempt<limits.proposalAttempts;attempt++){
        const draft=await invoke(producer,{profile,source:context.snapshot,state:context.state,lineage:context.lineage,parent:context.parent.rules,attempt,previousError:lastError??null},owner,id,'proposal');
        const raw=JSON.stringify(draft);if(Buffer.byteLength(raw??'')>65536)fail('MODEL_OUTPUT_TOO_LARGE');
        db.run('INSERT INTO kit_attempts VALUES(?,?,?,?,NULL)',owner,id,attempt,raw??'null');
        let prepared,report;
        try{
          const proposalId='p-'+hash({owner,id}).slice(0,20);
          const authored=profile.strictness==='slots-v1'?assembleSlots(draft,{profile,proposalId,parentId:context.state.location}):draft;
          const proposal={format:'alteru-rule-delta-v1',contract_version:2,profile:profile.id,proposal_id:proposalId,base:context.parentBinding,grounding:{source:context.snapshot,motivation:authored.motivation},add:authored.add};
          prepared=await prepareRuleDelta({...context,proposal,profile});
          prepared.descriptor.source_head_hash=hash(context.head);
          prepared.descriptor.parent_composite_hash=context.head.binding?.artifact_hash??null;
          prepared.artifact_hash=hash(prepared.descriptor);
          const sourceState={...structuredClone(context.state),facts:{...Object.fromEntries(prepared.definition.rules.facts.map(f=>[f.id,f.initial])),...context.state.facts}};
          report=await verifyRuleDelta({prepared,sourceState,runProlog,profile,...witnessPaths(prepared,sourceState,profile,context.parent.rules.actions.length)});
        }catch(e){lastError=e.code??e.message;db.run('UPDATE kit_attempts SET error=? WHERE owner=? AND job=? AND attempt=?',lastError,owner,id,attempt);if(attempt+1===limits.proposalAttempts)throw e;continue;}
        let semantic={passed:false,mode:'disabled',reason:profile.semanticReview.disabledReason};
        if(profile.semanticReview.required){
          semantic=await invoke(reviewer,{profile,draft,prepared,source:context.state},owner,id,'review');
          if(semantic?.passed!==true||!Array.isArray(semantic.locales)||!['en','zh'].every(l=>semantic.locales.includes(l))){db.run('UPDATE kit_attempts SET error=? WHERE owner=? AND job=? AND attempt=?','SEMANTIC_REJECTED',owner,id,attempt);fail('SEMANTIC_REJECTED');}
          semantic={...semantic,mode:reviewer.mode};
        }
        const artifact={prepared,report,semantic,profile,source_head_hash:hash(context.head),source_state_hash:hash(context.state),lineage:prepared.lineage};
        db.transaction(()=>{
          db.run('INSERT INTO kit_artifacts(owner,hash,data) VALUES(?,?,?)',owner,prepared.artifact_hash,JSON.stringify(artifact));
          db.run("UPDATE kit_jobs SET status='ready',artifact=? WHERE owner=? AND id=?",prepared.artifact_hash,owner,id);audit(owner,'artifact-ready',prepared.artifact_hash);
        });return;
      }
    }catch(e){db.transaction(()=>{db.run("UPDATE kit_jobs SET status='failed',error=? WHERE owner=? AND id=?",e.code??e.message,owner,id);audit(owner,'proposal-failed',{id,code:e.code??e.message});});}
  }
  async function propose(owner,body){
    assertOwner(owner);
    if(!body||Object.keys(body).sort().join(',')!=='expected_version,request_id,session_id'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.request_id??'')||typeof body.session_id!=='string'||!Number.isSafeInteger(body.expected_version)||body.expected_version<0)fail('INVALID_REQUEST',400);
    body=structuredClone(body);const digest=hash(body),key=JSON.stringify([owner,body.request_id]);
    const old=one('SELECT * FROM kit_jobs WHERE owner=? AND id=?',owner,body.request_id);
    if(old){if(old.digest!==digest)fail('ACTION_ID_CONFLICT',409);if(jobs.has(key))await jobs.get(key);return view(one('SELECT * FROM kit_jobs WHERE owner=? AND id=?',owner,body.request_id));}
    const context=structuredClone(await loadSource(owner,body.session_id));
    validateProfile(profile,context.parent.rules);
    if(context.snapshot.session_id!==body.session_id||context.head.id!==body.session_id||context.head.version!==body.expected_version||context.snapshot.version!==body.expected_version)fail('VERSION_CONFLICT',409);
    if(context.lineage.depth>=profile.maxChainDepth||!profile.parents.includes(context.state.location)||profile.gateFacts.some(f=>context.state.facts[f]!==true)||context.state.facts[profile.completion.fact]!==false)fail('PROPOSAL_GATE_CLOSED',409);
    const dayKey='daily:'+hash(owner)+':'+new Date(clock()).toISOString().slice(0,10);
    const admitted=db.transaction(()=>{
      const raced=one('SELECT * FROM kit_jobs WHERE owner=? AND id=?',owner,body.request_id);if(raced){if(raced.digest!==digest)fail('ACTION_ID_CONFLICT',409);return false;}
      if(one("SELECT COUNT(*) AS n FROM kit_jobs WHERE status='running'").n>=limits.serviceConcurrent)fail('SERVICE_BUSY',429);
      if(one("SELECT COUNT(*) AS n FROM kit_jobs WHERE owner=? AND session=? AND status='running'",owner,body.session_id).n)fail('SESSION_BUSY',429);
      if(count(dayKey)>=limits.perOwnerDaily)fail('DAILY_LIMIT',429);
      increment(dayKey);db.run("INSERT INTO kit_jobs VALUES(?,?,?,?,'running',NULL,NULL)",owner,body.request_id,digest,body.session_id);audit(owner,'proposal-started',body);
      return true;
    });
    if(admitted){const task=process(owner,body.request_id,context);jobs.set(key,task);try{await task;}finally{jobs.delete(key);}}else if(jobs.has(key))await jobs.get(key);
    return view(one('SELECT * FROM kit_jobs WHERE owner=? AND id=?',owner,body.request_id));
  }
  return{propose,load,limits,modelCalls:()=>count('model-calls'),drain:()=>Promise.all([...jobs.values()]),
    revoke(owner,artifactHash){load(owner,artifactHash);db.transaction(()=>{db.run('UPDATE kit_artifacts SET revoked=1 WHERE owner=? AND hash=?',owner,artifactHash);audit(owner,'artifact-revoked',artifactHash);});}};
}
