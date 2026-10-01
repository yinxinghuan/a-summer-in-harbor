import {randomUUID} from 'node:crypto';
import {canonical,sha256} from '../rule-compiler/index.mjs';
import {assertOwner,AuthorityError} from '../authority-session/index.mjs';
export {createRuleRuntime} from './runtime.mjs';
const hash=v=>sha256(canonical(v));
const fail=(code,status=409)=>{throw new AuthorityError(code,status);};
/** Internal projected-head adapter: head.state holds compiler state.
 * No browser snapshot or callback can supply the new facts/content/binding. */
export function createAdoption({authority,pipeline,now=Date.now}){
  const db=authority.db;
  db.run('CREATE TABLE IF NOT EXISTS kit_adoptions(owner TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,source TEXT NOT NULL,version INTEGER NOT NULL,response TEXT NOT NULL,PRIMARY KEY(owner,id),UNIQUE(owner,source,version))');
  db.run('CREATE TABLE IF NOT EXISTS kit_media(session TEXT NOT NULL,slot TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(session,slot))');
  return function adopt(owner,body){
    assertOwner(owner);
    if(!body||Object.keys(body).sort().join(',')!=='adoption_id,artifact_hash,expected_version,session_id'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.adoption_id??'')||!/^[a-f0-9]{64}$/.test(body.artifact_hash??'')||!Number.isSafeInteger(body.expected_version))fail('INVALID_ADOPTION',400);
    body=structuredClone(body);const digest=hash(body);
    return db.transaction(()=>{
      const old=db.all('SELECT * FROM kit_adoptions WHERE owner=? AND id=?',owner,body.adoption_id)[0];
      if(old){if(old.digest!==digest)fail('ADOPTION_ID_CONFLICT');return JSON.parse(old.response);}
      const row=authority.row(owner,body.session_id),head=JSON.parse(row.data);
      if(head.version!==body.expected_version)fail('VERSION_CONFLICT');
      const artifact=pipeline.load(owner,body.artifact_hash),p=artifact.prepared;
      if(artifact.profile.semanticReview.required&&artifact.semantic.passed!==true)fail('SEMANTIC_REVIEW_REQUIRED');
      if(p.descriptor.source.session_id!==head.id||p.descriptor.source.version!==head.version||p.descriptor.source.cursor!==row.cursor||artifact.source_head_hash!==hash(head)||artifact.source_state_hash!==hash(head.state))fail('DELTA_STALE');
      if(hash(p.compiled)!==p.descriptor.rules_artifact_hash||hash(p.content)!==p.descriptor.content_hash||hash(p.lineage)!==p.descriptor.lineage_hash||hash(artifact.profile)!==p.descriptor.profile_hash||artifact.report.artifact_hash!==p.artifact_hash)fail('DELTA_ARTIFACT_MISMATCH');
      if(db.all('SELECT id FROM kit_adoptions WHERE owner=? AND source=? AND version=?',owner,head.id,head.version).length)fail('SOURCE_ALREADY_FORKED');
      if(db.all('SELECT COUNT(*) AS n FROM journeys WHERE owner=?',owner)[0].n>=100)fail('SESSION_LIMIT',429);
      const next=structuredClone(head);next.id=randomUUID();next.version=0;
      next.binding={artifact_hash:p.artifact_hash,ruleset_version:p.definition.rules.rulesetVersion};
      next.catalog=structuredClone(p.content.locations);
      for(const f of p.definition.rules.facts)if(!Object.hasOwn(next.state.facts,f.id)){if(f.initial!==false)fail('DELTA_PROTECTED_WRITE');next.state.facts[f.id]=false;}
      // All previously committed state is untouched; only false declarations added.
      for(const [k,v]of Object.entries(head.state.facts))if(canonical(next.state.facts[k])!==canonical(v))fail('DELTA_PROTECTED_WRITE');
      authority.runtime.assertReadable(next);
      const result={kind:'adopted',head:next,source_id:head.id,artifact_hash:p.artifact_hash,cursor:0};
      db.run('INSERT INTO journeys VALUES(?,?,?,?,?,?,?)',next.id,owner,'adoption:'+body.adoption_id,digest,JSON.stringify(next),0,now());
      db.run('INSERT INTO kit_media(session,slot,data) SELECT ?,slot,data FROM kit_media WHERE session=?',next.id,head.id);
      db.run('INSERT INTO kit_adoptions VALUES(?,?,?,?,?,?)',owner,body.adoption_id,digest,head.id,head.version,JSON.stringify(result));
      db.run('INSERT INTO kit_audit(at,actor_hash,kind,subject_hash) VALUES(?,?,?,?)',now(),hash(owner),'adopted',hash({source:head.id,target:next.id,artifact:p.artifact_hash}));
      return result;
    });
  };
}
