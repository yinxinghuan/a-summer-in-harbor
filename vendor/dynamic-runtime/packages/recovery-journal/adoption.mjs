// Separate from ordinary action IDs; stable across response loss and reload.
export class AdoptionJournal {
  constructor({storage,prefix,post,get,assertResult,lock=async(_key,fn)=>fn()}){Object.assign(this,{storage,prefix,post,get,assertResult,lock});}
  async adopt({session_id,expected_version,artifact_hash}){
    return this.lock(this.prefix+'adoption',async()=>{
      if(this.storage.getItem(this.prefix+'adoption'))throw Error('PENDING_ADOPTION');
      const envelope={adoption_id:globalThis.crypto.randomUUID(),session_id,expected_version,artifact_hash};
      this.storage.setItem(this.prefix+'adoption',JSON.stringify({envelope}));
      return this.settle();
    });
  }
  async recover(){return this.lock(this.prefix+'adoption',()=>this.settle());}
  async settle(){
    const key=this.prefix+'adoption',raw=this.storage.getItem(key);if(!raw)return null;
    let saved;try{saved=JSON.parse(raw);}catch{throw Error('INVALID_ADOPTION_PENDING');}
    const b=saved.envelope;if(!b||!/^[a-zA-Z0-9-]{16,80}$/.test(b.adoption_id??'')||typeof b.session_id!=='string'||!Number.isSafeInteger(b.expected_version)||!/^[a-f0-9]{64}$/.test(b.artifact_hash??''))throw Error('INVALID_ADOPTION_PENDING');
    const terminal=new Set(['VERSION_CONFLICT','DELTA_STALE','SOURCE_ALREADY_FORKED','SEMANTIC_REVIEW_REQUIRED','ARTIFACT_REVOKED','ADOPTION_ID_CONFLICT','ARTIFACT_NOT_FOUND']);
    if(saved.rejection&&!terminal.has(saved.rejection))throw Error('INVALID_ADOPTION_PENDING');
    let result;
    if(!saved.rejection){try{result=await this.post(b);this.assertResult(result,b);}catch(e){if(!terminal.has(e.message))throw e;saved.rejection=e.message;this.storage.setItem(key,JSON.stringify(saved));}}
    if(saved.rejection)result={kind:'recovered',rejection:saved.rejection,head:await this.get(b.session_id)};
    else{
      const latest=await this.get(result.head.id);
      if(!latest||latest.id!==result.head.id||!Number.isSafeInteger(latest.version)||latest.version<result.head.version)throw Error('SESSION_RESPONSE_REGRESSED');
      if(latest.version!==result.head.version)result={...result,kind:'recovered',head:latest};
    }
    if(this.storage.getItem(key)===JSON.stringify(saved))this.storage.removeItem(key);
    return result;
  }
}
