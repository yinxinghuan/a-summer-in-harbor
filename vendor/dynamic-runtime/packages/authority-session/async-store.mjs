import {AsyncLocalStorage} from 'node:async_hooks';
import {SqliteStorage} from './sqlite.mjs';
import {AuthorityError} from './error.mjs';

const context=new AsyncLocalStorage();
const fail=code=>{throw new AuthorityError(code);};
const id=v=>{if(typeof v!=='string'||!v.trim()||v.length>256)fail('ASYNC_STORE_SCOPE_REQUIRED');return v;};
const schemaName=v=>{if(typeof v!=='string'||!/^kit_[a-z0-9_]{1,48}$/.test(v))fail('PG_INVALID_SCHEMA');return `"${v}"`;};
const number=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)fail('ASYNC_STORE_INTEGER');return n;};
const ddl=(prefix,integer)=>[
  `CREATE TABLE IF NOT EXISTS ${prefix}async_player_usage(world TEXT NOT NULL,owner TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,created ${integer} NOT NULL,deadline ${integer} NOT NULL,status TEXT NOT NULL,PRIMARY KEY(world,owner,kind,id))`,
  `CREATE INDEX IF NOT EXISTS async_player_usage_time ON ${prefix}async_player_usage(world,owner,created)`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_journeys(world TEXT NOT NULL,id TEXT NOT NULL,owner TEXT NOT NULL,enrollment TEXT NOT NULL,enrollment_digest TEXT NOT NULL,data TEXT NOT NULL,cursor ${integer} NOT NULL,updated ${integer} NOT NULL,PRIMARY KEY(world,id),UNIQUE(world,owner,enrollment))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_receipts(world TEXT NOT NULL,owner TEXT NOT NULL,action TEXT NOT NULL,digest TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(world,owner,action))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_journal(world TEXT NOT NULL,session TEXT NOT NULL,cursor ${integer} NOT NULL,action TEXT NOT NULL,event TEXT NOT NULL,PRIMARY KEY(world,session,cursor))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_prepared(world TEXT NOT NULL,owner TEXT NOT NULL,action TEXT NOT NULL,session TEXT NOT NULL,digest TEXT NOT NULL,base TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(world,owner,action))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_artifacts(world TEXT NOT NULL,owner TEXT NOT NULL,hash TEXT NOT NULL,digest TEXT NOT NULL,data TEXT NOT NULL,revoked ${integer} NOT NULL DEFAULT 0,PRIMARY KEY(world,owner,hash))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_adoptions(world TEXT NOT NULL,owner TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,source TEXT NOT NULL,version ${integer} NOT NULL,response TEXT NOT NULL,PRIMARY KEY(world,owner,id),UNIQUE(world,owner,source,version))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_media(world TEXT NOT NULL,session TEXT NOT NULL,slot TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(world,session,slot))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_dynamic_audit(world TEXT NOT NULL,id TEXT NOT NULL,at ${integer} NOT NULL,actor_hash TEXT NOT NULL,kind TEXT NOT NULL,subject_hash TEXT NOT NULL,PRIMARY KEY(world,id))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_model_budgets(world TEXT NOT NULL,id TEXT NOT NULL,maximum ${integer} NOT NULL,used ${integer} NOT NULL,PRIMARY KEY(world,id))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_model_calls(world TEXT NOT NULL,budget TEXT NOT NULL,owner TEXT NOT NULL,id TEXT NOT NULL,digest TEXT NOT NULL,status TEXT NOT NULL,response TEXT,error TEXT,PRIMARY KEY(world,budget,owner,id))`,
  `CREATE TABLE IF NOT EXISTS ${prefix}async_proposals(world TEXT NOT NULL,owner TEXT NOT NULL,id TEXT NOT NULL,session TEXT NOT NULL,digest TEXT NOT NULL,status TEXT NOT NULL,created ${integer} NOT NULL,data TEXT NOT NULL,PRIMARY KEY(world,owner,id))`,
];

/** Explicit administrative DDL; never called while opening a runtime handle. */
export async function initializeAsyncAuthoritySchema(client,{schema}={}){
  const prefix=schemaName(schema)+'.';
  // Requires the already initialized candidate schema/world registry.
  await client.query(`SELECT world_id FROM ${prefix}worlds LIMIT 0`);
  await client.query('BEGIN');
  try{for(const sql of ddl(prefix,'BIGINT'))await client.query(sql);await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}
}

function repository(query,prefix,world,alive){
  const q=(sql,values=[])=>{if(!alive())return Promise.reject(new AuthorityError('ASYNC_TRANSACTION_EXPIRED'));return query(sql.replaceAll('@',prefix),values);};
  const rows=async(sql,values)=> (await q(sql,values)).rows;
  const one=async(sql,values)=> (await rows(sql,values))[0];
  const normalized=r=>r?{...r,cursor:number(r.cursor),updated:number(r.updated)}:r;
  return Object.freeze({
    usageRequest:(owner,kind,id)=>one('SELECT * FROM @async_player_usage WHERE world=? AND owner=? AND kind=? AND id=?',[world,owner,kind,id]),
    usageRequests:(owner,since)=>rows('SELECT * FROM @async_player_usage WHERE world=? AND owner=? AND created>=? ORDER BY created,id',[world,owner,since]),
    addUsageRequest:(owner,kind,id,digest,created,deadline)=>q("INSERT INTO @async_player_usage(world,owner,kind,id,digest,created,deadline,status) VALUES(?,?,?,?,?,?,?,'reserved')",[world,owner,kind,id,digest,created,deadline]),
    settleUsageRequest:(owner,kind,id,status)=>q('UPDATE @async_player_usage SET status=? WHERE world=? AND owner=? AND kind=? AND id=?',[status,world,owner,kind,id]),
    countModelCall:async budget=>{const r=await q('UPDATE @async_model_budgets SET used=used+1 WHERE world=? AND id=?',[world,budget]);if(r.rowCount!==1)fail('MODEL_APPROVAL_LEDGER_MISSING');},
    session:async(owner,session)=>normalized(await one('SELECT * FROM @async_journeys WHERE world=? AND owner=? AND id=?',[world,owner,session])),
    enrollment:(owner,enrollment)=>one('SELECT id,enrollment_digest FROM @async_journeys WHERE world=? AND owner=? AND enrollment=?',[world,owner,enrollment]),
    sample:()=>one('SELECT data FROM @async_journeys WHERE world=? LIMIT 1',[world]),
    count:async owner=>number((await one('SELECT COUNT(*) AS n FROM @async_journeys WHERE world=? AND owner=?',[world,owner])).n),
    list:async owner=>(await rows('SELECT * FROM @async_journeys WHERE world=? AND owner=? ORDER BY updated DESC,id LIMIT 100',[world,owner])).map(normalized),
    insert:(owner,enrollment,digest,head,at)=>q('INSERT INTO @async_journeys(world,id,owner,enrollment,enrollment_digest,data,cursor,updated) VALUES(?,?,?,?,?,?,?,?)',[world,head.id,owner,enrollment,digest,JSON.stringify(head),0,at]),
    write:async(owner,head,cursor,at)=>{const result=await q('UPDATE @async_journeys SET data=?,cursor=?,updated=? WHERE world=? AND owner=? AND id=?',[JSON.stringify(head),cursor,at,world,owner,head.id]);if(result.rowCount!==1)fail('SESSION_NOT_FOUND');},
    receipt:(owner,action)=>one('SELECT digest,response FROM @async_receipts WHERE world=? AND owner=? AND action=?',[world,owner,action]),
    addReceipt:(owner,action,digest,response)=>q('INSERT INTO @async_receipts(world,owner,action,digest,response) VALUES(?,?,?,?,?)',[world,owner,action,digest,JSON.stringify(response)]),
    events:async(session,after)=>(await rows('SELECT event FROM @async_journal WHERE world=? AND session=? AND cursor>? ORDER BY cursor LIMIT 100',[world,session,after])).map(r=>JSON.parse(r.event)),
    addEvent:(session,cursor,action,event)=>q('INSERT INTO @async_journal(world,session,cursor,action,event) VALUES(?,?,?,?,?)',[world,session,cursor,action,JSON.stringify(event)]),
    prepared:(owner,action)=>one('SELECT digest,base,response FROM @async_prepared WHERE world=? AND owner=? AND action=?',[world,owner,action]),
    preparedCount:async owner=>number((await one('SELECT COUNT(*) AS n FROM @async_prepared WHERE world=? AND owner=?',[world,owner])).n),
    addPrepared:(owner,action,session,digest,base,response)=>q('INSERT INTO @async_prepared(world,owner,action,session,digest,base,response) VALUES(?,?,?,?,?,?,?)',[world,owner,action,session,digest,JSON.stringify(base),JSON.stringify(response)]),
    clearPrepared:(owner,session)=>q('DELETE FROM @async_prepared WHERE world=? AND owner=? AND session=?',[world,owner,session]),
    artifact:(owner,hash)=>one('SELECT * FROM @async_artifacts WHERE world=? AND owner=? AND hash=?',[world,owner,hash]),
    addArtifact:(owner,hash,digest,data)=>q('INSERT INTO @async_artifacts(world,owner,hash,digest,data) VALUES(?,?,?,?,?)',[world,owner,hash,digest,JSON.stringify(data)]),
    revokeArtifact:(owner,hash)=>q('UPDATE @async_artifacts SET revoked=1 WHERE world=? AND owner=? AND hash=?',[world,owner,hash]),
    boundArtifact:session=>one('SELECT a.*,j.data AS head_data FROM @async_artifacts a JOIN @async_journeys j ON a.world=j.world AND a.owner=j.owner WHERE j.world=? AND j.id=? AND a.hash=?',[world,session.id,session.binding.artifact_hash]),
    adoption:(owner,id)=>one('SELECT digest,response FROM @async_adoptions WHERE world=? AND owner=? AND id=?',[world,owner,id]),
    sourceAdoption:(owner,source,version)=>one('SELECT id FROM @async_adoptions WHERE world=? AND owner=? AND source=? AND version=?',[world,owner,source,version]),
    addAdoption:(owner,id,digest,source,version,response)=>q('INSERT INTO @async_adoptions(world,owner,id,digest,source,version,response) VALUES(?,?,?,?,?,?,?)',[world,owner,id,digest,source,version,JSON.stringify(response)]),
    media:session=>rows('SELECT slot,data FROM @async_media WHERE world=? AND session=? ORDER BY slot',[world,session]),
    addMedia:(session,slot,data)=>q('INSERT INTO @async_media(world,session,slot,data) VALUES(?,?,?,?)',[world,session,slot,JSON.stringify(data)]),
    // Trusted sidecar services only; callers verify owner/session in this tx.
    // Mutable jobs never change the story head, cursor or action receipts.
    putMedia:(session,slot,data)=>q('INSERT INTO @async_media(world,session,slot,data) VALUES(?,?,?,?) ON CONFLICT(world,session,slot) DO UPDATE SET data=excluded.data',[world,session,slot,JSON.stringify(data)]),
    copyMedia:(source,target)=>q('INSERT INTO @async_media(world,session,slot,data) SELECT world,?,slot,data FROM @async_media WHERE world=? AND session=?',[target,world,source]),
    addDynamicAudit:(id,at,actor,kind,subject)=>q('INSERT INTO @async_dynamic_audit(world,id,at,actor_hash,kind,subject_hash) VALUES(?,?,?,?,?,?)',[world,id,at,actor,kind,subject]),
    dynamicAudit:()=>rows('SELECT at,actor_hash,kind,subject_hash FROM @async_dynamic_audit WHERE world=? ORDER BY at,id',[world]),
    modelBudget:async budget=>{const r=await one('SELECT maximum,used FROM @async_model_budgets WHERE world=? AND id=?',[world,budget]);return r?{maximum:number(r.maximum),used:number(r.used)}:null;},
    proposal:(owner,id)=>one('SELECT * FROM @async_proposals WHERE world=? AND owner=? AND id=?',[world,owner,id]),
    proposals:(owner,session)=>rows('SELECT * FROM @async_proposals WHERE world=? AND owner=? AND session=? ORDER BY created DESC,id LIMIT 100',[world,owner,session]),
    proposalCount:async(owner,since)=>number((await one('SELECT COUNT(*) AS n FROM @async_proposals WHERE world=? AND owner=? AND created>=?',[world,owner,since])).n),
    activeProposals:()=>rows("SELECT * FROM @async_proposals WHERE world=? AND status IN ('running','approving')",[world]),
    addProposal:(owner,id,session,digest,status,created,data)=>q('INSERT INTO @async_proposals(world,owner,id,session,digest,status,created,data) VALUES(?,?,?,?,?,?,?,?)',[world,owner,id,session,digest,status,created,JSON.stringify(data)]),
    writeProposal:(owner,id,status,data)=>q('UPDATE @async_proposals SET status=?,data=? WHERE world=? AND owner=? AND id=?',[status,JSON.stringify(data),world,owner,id]),
    addModelBudget:(budget,maximum)=>q('INSERT INTO @async_model_budgets(world,id,maximum,used) VALUES(?,?,?,0)',[world,budget,maximum]),
    // Administrative CAS only. Never changes used, calls, identities or worlds.
    resizeModelBudget:async(budget,previous,maximum)=>{if(!Number.isSafeInteger(previous)||!Number.isSafeInteger(maximum)||previous<0||maximum<0)fail('MODEL_BUDGET_CONFIG_CONFLICT');const r=await q('UPDATE @async_model_budgets SET maximum=? WHERE world=? AND id=? AND maximum=? AND used<=?',[maximum,world,budget,previous,maximum]);if(r.rowCount!==1)fail('MODEL_BUDGET_CONFIG_CONFLICT');},
    useModelBudget:async budget=>{const r=await q('UPDATE @async_model_budgets SET used=used+1 WHERE world=? AND id=? AND used<maximum',[world,budget]);if(r.rowCount!==1)fail('MODEL_BUDGET_EXHAUSTED');},
    modelCall:(budget,owner,id)=>one('SELECT digest,status,response,error FROM @async_model_calls WHERE world=? AND budget=? AND owner=? AND id=?',[world,budget,owner,id]),
    addModelCall:(budget,owner,id,digest)=>q("INSERT INTO @async_model_calls(world,budget,owner,id,digest,status) VALUES(?,?,?,?,?,'reserved')",[world,budget,owner,id,digest]),
    finishModelCall:async(budget,owner,id,status,response,error)=>{const r=await q("UPDATE @async_model_calls SET status=?,response=?,error=? WHERE world=? AND budget=? AND owner=? AND id=? AND status='reserved'",[status,response===undefined?null:JSON.stringify(response),error??null,world,budget,owner,id]);if(r.rowCount!==1)fail('MODEL_CALL_NOT_RESERVED');},
  });
}

function store({worldId,gameId,driver,acquire,begin,commit,rollback,dispose,prefix=''}){
  let tail=Promise.resolve(),closed=false;
  const transaction=work=>{
    if(closed)return Promise.reject(new AuthorityError('ASYNC_STORE_CLOSED'));
    if(context.getStore())return Promise.reject(new AuthorityError('NESTED_TRANSACTION'));
    const run=async()=>{
      const client=await acquire();let active=false,began=false,discard;const pending=[];
      const query=(...args)=>{const p=Promise.resolve().then(()=>client.query(...args));pending.push(p);p.catch(()=>{});return p;};
      try{
        await begin(client);began=true;active=true;
        const repo=repository(query,prefix,worldId,()=>active);
        const result=await context.run(true,()=>work(repo));
        active=false;await Promise.all(pending);await commit(client);began=false;return result;
      }catch(error){active=false;await Promise.allSettled(pending);if(began)try{await rollback(client);}catch(e){discard=e;}throw error;}
      finally{active=false;client.release(discard);}
    };
    const promise=tail.then(run,run);tail=promise.catch(()=>{});return promise;
  };
  return Object.freeze({worldId,gameId,driver,environment:'test',transaction,
    async close(){if(context.getStore())fail('NESTED_TRANSACTION');closed=true;await tail;await dispose?.();},
  });
}

/** Owns its connection; not an async wrapper around a concurrently used legacy store. */
export function openAsyncSqliteAuthorityStore({path=':memory:',worldId,gameId,environment='test'}={}){
  id(worldId);id(gameId);if(environment!=='test')fail('ASYNC_AUTHORITY_TEST_ONLY');
  const db=new SqliteStorage(path,{worldId});
  try{
    db.run('CREATE TABLE IF NOT EXISTS async_world_binding(world TEXT PRIMARY KEY,game TEXT NOT NULL)');
    db.transaction(()=>{const old=db.all('SELECT game FROM async_world_binding WHERE world=?',worldId)[0];if(old&&old.game!==gameId)fail('PG_WORLD_SCOPE_MISMATCH');if(!old)db.run('INSERT INTO async_world_binding VALUES(?,?)',worldId,gameId);for(const sql of ddl('','INTEGER'))db.run(sql);});
  }catch(e){db.close();throw e;}
  const client={query:async(sql,values=[])=>sql.startsWith('SELECT')?{rows:db.raw.prepare(sql).all(...values)}:{rowCount:Number(db.raw.prepare(sql).run(...values).changes),rows:[]},release(){}};
  return store({worldId,gameId,driver:'sqlite',acquire:async()=>client,begin:async()=>db.raw.exec('BEGIN IMMEDIATE'),commit:async()=>db.raw.exec('COMMIT'),rollback:async()=>db.raw.exec('ROLLBACK'),dispose:async()=>db.close()});
}

/** Explicit pool + registered test world only. Does not read any environment credentials. */
export async function openPgAuthorityStore({pool,schema,worldId,gameId,environment,driver='pg',lockTimeoutMs=2000}={}){
  id(worldId);id(gameId);const prefix=schemaName(schema)+'.';
  if(environment!=='test'||!['pg','pglite-test'].includes(driver))fail('ASYNC_AUTHORITY_TEST_ONLY');
  if(!Number.isSafeInteger(lockTimeoutMs)||lockTimeoutMs<1||lockTimeoutMs>10000)fail('PG_INVALID_INTEGER');
  if(!pool||typeof pool.connect!=='function')fail('PG_EXPLICIT_POOL_REQUIRED');
  const check=await pool.connect();let world;
  try{world=(await check.query(`SELECT * FROM ${prefix}worlds WHERE world_id=$1`,[worldId])).rows[0];if(!world)fail('PG_UNREGISTERED_WORLD');if(world.game_id!==gameId||world.environment!==environment)fail('PG_WORLD_SCOPE_MISMATCH');await check.query(`SELECT world FROM ${prefix}async_journeys LIMIT 0`);}finally{check.release();}
  const acquire=async()=>{const c=await pool.connect();return {raw:c,release:error=>c.release(error),query:(sql,values)=>{let n=0;return c.query(sql.replaceAll('?',()=>'$'+(++n)),values);}};};
  return store({worldId,gameId,driver,prefix,acquire,
    begin:async c=>{await c.raw.query('BEGIN');try{await c.raw.query("SELECT set_config('lock_timeout',$1,true)",[`${lockTimeoutMs}ms`]);await c.raw.query("SELECT set_config('statement_timeout',$1,true)",['5000ms']);if(driver==='pg')await c.raw.query('SELECT pg_advisory_xact_lock($1::bigint)',[String(world.id)]);}catch(e){try{await c.raw.query('ROLLBACK');}catch(error){c.release(error);c.release=()=>{};}throw e;}},
    commit:c=>c.raw.query('COMMIT'),rollback:c=>c.raw.query('ROLLBACK'),
  });
}
