import {AuthorityError} from './error.mjs';

const fail=(code,status=400)=>{throw new AuthorityError(code,status);};
const ownerRequired=owner=>{if(typeof owner!=='string'||!owner.trim()||owner.length>256)fail('AUTH_REQUIRED',401);};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(id);
const wire=v=>JSON.parse(JSON.stringify(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>JSON.stringify(canonical(v));

/** Test candidate only. Runtime computation is outside database transactions. */
export class AsyncSessionAuthority {
  #store; #runtime; #now; #inFlight=new Map();
  constructor(store,runtime,{now=Date.now,narrationPolicy={windowMs:60000,turnsPerWindow:0}}={}){
    if(store?.environment!=='test'||typeof store.transaction!=='function')fail('ASYNC_AUTHORITY_TEST_ONLY');
    if(narrationPolicy.turnsPerWindow!==0||!Number.isSafeInteger(narrationPolicy.windowMs)||narrationPolicy.windowMs<1)fail('ASYNC_NARRATION_DISABLED');
    this.#store=store;this.#runtime=runtime;this.#now=now;
  }
  async #row(repo,owner,id){const row=await repo.session(owner,id);if(!row)fail('SESSION_NOT_FOUND',404);return row;}
  #head(row){const h=this.#runtime.upgrade(JSON.parse(row.data));if(JSON.stringify(h)!==row.data)fail('MIGRATION_REQUIRED',409);return h;}
  async #replay(repo,owner,action,hash){const r=await repo.receipt(owner,action);if(!r)return null;if(r.digest!==hash)fail('ACTION_ID_CONFLICT',409);return JSON.parse(r.response);}
  #validate(owner,body,operation='action'){
    ownerRequired(owner);const key=operation==='ending'?'ending_id':'action_id';
    if(!body||!validId(body[key])||!Number.isSafeInteger(body.expected_version)||body.expected_version<0)fail('INVALID_ACTION');
    if(operation==='ending'){if(!this.#runtime.ending)fail('ENDING_UNAVAILABLE',503);this.#runtime.ending.validate(body);}
    else this.#runtime.validateAction(body);
    return wire(body);
  }
  async #single(key,hash,work){
    const old=this.#inFlight.get(key);if(old){if(old.hash!==hash)fail('ACTION_ID_CONFLICT',409);return wire(await old.promise);}
    const promise=Promise.resolve().then(work);this.#inFlight.set(key,{hash,promise});
    try{return wire(await promise);}finally{if(this.#inFlight.get(key)?.promise===promise)this.#inFlight.delete(key);}
  }
  async create(owner,enrollment,locale,options){
    ownerRequired(owner);if(!validId(enrollment))fail('INVALID_ENROLLMENT');if(!['zh','en'].includes(locale))fail('INVALID_LOCALE');
    options=options===undefined?undefined:wire(options);const hash=digest(options===undefined?{locale}:{locale,options});
    return this.#store.transaction(async repo=>{
      const old=await repo.enrollment(owner,enrollment);
      if(old){if(old.enrollment_digest!==hash)fail('ENROLLMENT_ID_CONFLICT',409);return this.#head(await this.#row(repo,owner,old.id));}
      const sample=await repo.sample();if(sample)this.#runtime.assertReadable(JSON.parse(sample.data));
      if(await repo.count(owner)>=100)fail('SESSION_LIMIT',429);
      const id=crypto.randomUUID(),head=wire(this.#runtime.initial(locale,id,options));
      this.#runtime.assertReadable(head);if(head.id!==id||head.version!==0)fail('INVALID_INITIAL_HEAD');
      await repo.insert(owner,enrollment,hash,head,this.#now());return head;
    });
  }
  async get(owner,id){ownerRequired(owner);return this.#store.transaction(async repo=>this.#head(await this.#row(repo,owner,id)));}
  async directory(owner){ownerRequired(owner);return this.#store.transaction(async repo=>(await repo.list(owner)).map(row=>{const h=this.#head(row);return {id:row.id,version:h.version,cursor:row.cursor,scene:this.#runtime.scene(h),updated:row.updated};}));}
  async events(owner,id,after){ownerRequired(owner);if(!Number.isSafeInteger(after)||after<0)fail('INVALID_CURSOR');return this.#store.transaction(async repo=>{await this.#row(repo,owner,id);return repo.events(id,after);});}
  async checkpoint(owner,id,body){
    ownerRequired(owner);body=wire(body??{});
    return this.#store.transaction(async repo=>{
      const row=await this.#row(repo,owner,id),head=this.#head(row);
      if(body.sceneId!==this.#runtime.scene(head)||body.expected_version!==head.version)fail('STALE_POSITION',409);
      const context=this.#runtime.spatialContext?.(head,body)??head,position=this.#runtime.position(context,body.position);
      context.position=position;this.#runtime.assertReadable(context);
      if(context.id!==head.id||context.version!==head.version)fail('INVALID_POSITION');
      await repo.write(owner,context,row.cursor,this.#now());return {position};
    });
  }
  async action(owner,id,body){return this.#dispatch(owner,id,body,'action');}
  async ending(owner,id,body){return this.#dispatch(owner,id,body,'ending');}
  async #dispatch(owner,id,body,operation){
    body=this.#validate(owner,body,operation);
    const receiptId=operation==='ending'?'ending:'+body.ending_id:body.action_id;
    const hash=digest(operation==='ending'?{id,body,operation}:{id,body});
    return this.#single(JSON.stringify([owner,receiptId]),hash,async()=>{
      const snapshot=await this.#store.transaction(async repo=>{
        const cached=await this.#replay(repo,owner,receiptId,hash);if(cached)return {cached};
        const head=this.#head(await this.#row(repo,owner,id));if(head.version!==body.expected_version)fail('VERSION_CONFLICT',409);return {head};
      });
      if(snapshot.cached)return snapshot.cached;
      const base=wire(snapshot.head),response=operation==='ending'?await this.#runtime.ending.prepare(snapshot.head,body):await this.#runtime.prepare(snapshot.head,body,()=>false,Object.freeze({owner,worldId:this.#store.worldId}));
      return this.#store.transaction(repo=>this.#commit(repo,owner,id,body,hash,operation,receiptId,base,wire(response)));
    });
  }
  async #commit(repo,owner,id,body,hash,operation,receiptId,base,response,prepared=false){
    const cached=await this.#replay(repo,owner,receiptId,hash);if(cached)return cached;
    const row=await this.#row(repo,owner,id),current=this.#head(row);
    if(current.mapVersion!==base.mapVersion)fail('JOURNEY_VERSION_UNSUPPORTED',409);
    if(current.version!==base.version)fail('VERSION_CONFLICT',409);
    if(response.head?.id!==id||response.head.version!==base.version+1)fail('INVALID_COMMIT_CANDIDATE',409);
    this.#runtime.assertReadable(response.head);
    if(operation==='ending'){
      this.#runtime.ending.assertCurrent(base,current);
      if(response.kind!=='ending'||this.#runtime.scene(response.head)!==this.#runtime.scene(current))fail('INVALID_COMMIT_CANDIDATE',409);
      response.head.position={...current.position};
    }
    if(prepared)this.#runtime.assertPrepared?.(response.head,current,typeof response.actionId==='string'?response.actionId:undefined);
    this.#runtime.preserveConcurrent(response.head,current);this.#runtime.assertReadable(response.head);
    if(response.head.id!==id||response.head.version!==base.version+1)fail('INVALID_COMMIT_CANDIDATE',409);
    const cursor=row.cursor+(operation==='ending'?0:1),result=wire({...response,cursor});
    await repo.write(owner,response.head,cursor,this.#now());
    if(operation==='action')await repo.addEvent(id,cursor,body.action_id,{cursor,version:response.head.version,action_id:body.action_id,kind:response.kind});
    await repo.addReceipt(owner,receiptId,hash,result);await repo.clearPrepared(owner,id);return result;
  }
  async prepareAction(owner,id,body){
    body=this.#validate(owner,body);const hash=digest({id,body});
    return this.#single(JSON.stringify([owner,'prepare:'+body.action_id]),hash,async()=>{
      const snapshot=await this.#store.transaction(async repo=>{
        const cached=await this.#replay(repo,owner,body.action_id,hash);if(cached)return {ready:{status:'committed',result:cached}};
        const head=this.#head(await this.#row(repo,owner,id)),old=await repo.prepared(owner,body.action_id);
        if(old){if(old.digest!==hash)fail('ACTION_ID_CONFLICT',409);const base=JSON.parse(old.base);if(head.version!==base.version||head.mapVersion!==base.mapVersion)fail('VERSION_CONFLICT',409);return {ready:{status:'prepared',result:JSON.parse(old.response)}};}
        if(head.version!==body.expected_version)fail('VERSION_CONFLICT',409);
        if(await repo.preparedCount(owner)>=32)fail('PREPARED_ACTION_LIMIT',429);return {head};
      });
      if(snapshot.ready)return snapshot.ready;
      const base=wire(snapshot.head),response=wire(await this.#runtime.prepare(snapshot.head,body,()=>false,Object.freeze({owner,worldId:this.#store.worldId})));
      if(response.kind!=='action'||response.accepted!==true||response.head?.id!==id||response.head.version!==base.version+1)fail('UNSUPPORTED_ACTION',409);
      this.#runtime.assertReadable(response.head);
      return this.#store.transaction(async repo=>{
        const cached=await this.#replay(repo,owner,body.action_id,hash);if(cached)return {status:'committed',result:cached};
        const current=this.#head(await this.#row(repo,owner,id));if(current.version!==base.version||current.mapVersion!==base.mapVersion)fail('VERSION_CONFLICT',409);
        const old=await repo.prepared(owner,body.action_id);if(old){if(old.digest!==hash)fail('ACTION_ID_CONFLICT',409);return {status:'prepared',result:JSON.parse(old.response)};}
        if(await repo.preparedCount(owner)>=32)fail('PREPARED_ACTION_LIMIT',429);
        await repo.addPrepared(owner,body.action_id,id,hash,base,response);return {status:'prepared',result:response};
      });
    });
  }
  async commitPreparedAction(owner,id,body){
    body=this.#validate(owner,body);const hash=digest({id,body});
    return this.#store.transaction(async repo=>{
      const cached=await this.#replay(repo,owner,body.action_id,hash);if(cached)return cached;
      const old=await repo.prepared(owner,body.action_id);if(!old)fail('ACTION_NOT_PREPARED',409);if(old.digest!==hash)fail('ACTION_ID_CONFLICT',409);
      return this.#commit(repo,owner,id,body,hash,'action',body.action_id,JSON.parse(old.base),JSON.parse(old.response),true);
    });
  }
}
