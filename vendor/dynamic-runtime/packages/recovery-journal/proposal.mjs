// Proposal IDs are not turn IDs or adoption IDs. Persist before first submit.
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(v);
const states=new Set(['running','approving','review_required','ready','failed','rejected','stale']);
const terminalErrors=new Set(['VERSION_CONFLICT','SESSION_NOT_FOUND','MODEL_UNAVAILABLE','PROPOSAL_GATE_CLOSED','DAILY_LIMIT','SERVICE_BUSY','SESSION_BUSY','PROPOSAL_ID_CONFLICT']);
for(const code of ['AI_ROOM_DAILY_LIMIT','AI_COOLDOWN','AI_REQUEST_IN_PROGRESS','AI_REQUEST_CONFLICT','AI_RETRY_NEW_REQUEST'])terminalErrors.add(code);
export class ProposalJournal{
  constructor({storage,prefix,post,get,lock=async(_k,f)=>f()}){Object.assign(this,{storage,prefix,post,get,lock});}
  read(){const raw=this.storage.getItem(this.prefix+'proposal');if(!raw)return null;let b;try{b=JSON.parse(raw);}catch{throw Error('INVALID_PROPOSAL_PENDING');}if(!id(b.request_id)||!id(b.session_id)||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||Object.keys(b).sort().join(',')!=='expected_version,request_id,session_id')throw Error('INVALID_PROPOSAL_PENDING');return b;}
  check(v,b){if(v?.request_id!==b.request_id||v?.session_id!==b.session_id||v?.expected_version!==b.expected_version||!states.has(v.status)||!['live','authored-fixture','disabled'].includes(v.mode))throw Error('INVALID_PROPOSAL_RESPONSE');if(v.status==='ready'&&(!/^[a-f0-9]{64}$/.test(v.artifact_hash??'')||!['en','zh'].every(l=>typeof v.label?.[l]==='string'&&typeof v.detail?.[l]==='string')))throw Error('INVALID_PROPOSAL_RESPONSE');return v;}
  async settle(){const b=this.read();if(!b)return null;try{return this.check(await this.post(b),b);}catch(e){if(!terminalErrors.has(e.message))throw e;return {request_id:b.request_id,session_id:b.session_id,expected_version:b.expected_version,status:e.message==='VERSION_CONFLICT'?'stale':'failed',mode:'disabled',error:e.message};}}
  async start({session_id,expected_version}){return this.lock(this.prefix+'proposal',async()=>{const old=this.read();if(old){if(old.session_id!==session_id)throw Error('PENDING_PROPOSAL');return this.settle();}const b={request_id:globalThis.crypto.randomUUID(),session_id,expected_version};if(!id(session_id)||!Number.isSafeInteger(expected_version)||expected_version<0)throw Error('INVALID_REQUEST');this.storage.setItem(this.prefix+'proposal',JSON.stringify(b));return this.settle();});}
  recover(){return this.lock(this.prefix+'proposal',()=>this.settle());}
  poll(){return this.lock(this.prefix+'proposal',async()=>{const b=this.read();return b?this.check(await this.get(b.request_id),b):null;});}
  async retry({session_id,expected_version}){return this.lock(this.prefix+'proposal',async()=>{
    const old=this.read();if(!old||old.session_id!==session_id)throw Error('PENDING_PROPOSAL');
    const status=await this.settle();if(!['failed','rejected','stale'].includes(status?.status))throw Error('PENDING_PROPOSAL');
    if(!Number.isSafeInteger(expected_version)||expected_version<0)throw Error('INVALID_REQUEST');
    const b={request_id:globalThis.crypto.randomUUID(),session_id,expected_version};
    this.storage.setItem(this.prefix+'proposal',JSON.stringify(b));return this.settle();
  });}
  // Must be called after explicit acknowledgement or completed adoption; never
  // automatically discard a network error with unknown outcome.
  clear(request_id){const current=this.read();if(current&&(!request_id||current.request_id===request_id))this.storage.removeItem(this.prefix+'proposal');}
}
