import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';

const fail=code=>{throw new Error(code);};
const text=(v,max=256)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('PG_INVALID_IDENTIFIER');return v;};
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('PG_INVALID_INTEGER');return v;};
const safeNumber=v=>{const n=Number(v);integer(n);return n;};
const name=s=>{if(typeof s!=='string'||!/^kit_[a-z0-9_]{1,48}$/.test(s))fail('PG_INVALID_SCHEMA');return `"${s}"`;};
const json=v=>{const s=JSON.stringify(v);if(s===undefined||Buffer.byteLength(s)>1024*1024)fail('PG_JSON_LIMIT');return s;};
const context=new AsyncLocalStorage();

/** Candidate-specific DDL, ONLY an explicit administrative/test connection may call this.
 * Not a migration of the existing SQLite tables; no player data import. */
export async function initializeCandidateSchema(client,{schema}={}){
  const s=name(schema);
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.worlds (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, world_id TEXT UNIQUE NOT NULL,
    game_id TEXT NOT NULL, environment TEXT NOT NULL CHECK(environment IN ('test','production')))`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.heads (
    world BIGINT NOT NULL REFERENCES ${s}.worlds(id), owner TEXT NOT NULL, session TEXT NOT NULL,
    version BIGINT NOT NULL CHECK(version>=0), data JSONB NOT NULL, PRIMARY KEY(world,owner,session))`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.receipts (
    world BIGINT NOT NULL REFERENCES ${s}.worlds(id), owner TEXT NOT NULL, action TEXT NOT NULL,
    session TEXT NOT NULL, digest TEXT NOT NULL, response JSONB NOT NULL, PRIMARY KEY(world,owner,action))`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.journal (
    world BIGINT NOT NULL REFERENCES ${s}.worlds(id), owner TEXT NOT NULL, session TEXT NOT NULL,
    cursor BIGINT NOT NULL, action TEXT NOT NULL, event JSONB NOT NULL, PRIMARY KEY(world,owner,session,cursor))`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.jobs (
    world BIGINT NOT NULL REFERENCES ${s}.worlds(id), owner TEXT NOT NULL, id TEXT NOT NULL,
    digest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','running','ready','failed')),
    holder TEXT, fence BIGINT NOT NULL DEFAULT 0, expires BIGINT, result JSONB,
    PRIMARY KEY(world,owner,id))`);
  await client.query(`CREATE TABLE IF NOT EXISTS ${s}.usage (
    world BIGINT NOT NULL REFERENCES ${s}.worlds(id), budget_key TEXT NOT NULL, calls BIGINT NOT NULL CHECK(calls>=0),
    PRIMARY KEY(world,budget_key))`);
}
export async function registerCandidateWorld(client,{schema,worldId,gameId,environment}={}){
  const s=name(schema);text(worldId);text(gameId);if(!['test','production'].includes(environment))fail('PG_ENVIRONMENT_REQUIRED');
  await client.query(`INSERT INTO ${s}.worlds(world_id,game_id,environment) VALUES($1,$2,$3) ON CONFLICT(world_id) DO NOTHING`,[worldId,gameId,environment]);
  const r=(await client.query(`SELECT * FROM ${s}.worlds WHERE world_id=$1`,[worldId])).rows[0];
  if(r.game_id!==gameId||r.environment!==environment)fail('PG_WORLD_REGISTRATION_CONFLICT');
  return String(r.id);
}

/** Pool injection only: no ambient DATABASE_URL and no fallback to SQLite.
 * PG advisory locks coordinate this API; they are NOT a defense against arbitrary privileged SQL.
 * The PGlite driver may only opt out in explicit test mode and is not a concurrency certificate. */
export async function openCandidateStore({pool,schema,worldId,gameId,environment,driver='pg',now,lockTimeoutMs=2000}={}){
  const s=name(schema);text(worldId);text(gameId);integer(lockTimeoutMs,1,10000);
  if(!['test','production'].includes(environment)||!['pg','pglite-test'].includes(driver)||driver==='pglite-test'&&environment!=='test')fail('PG_ENVIRONMENT_REQUIRED');
  if(environment!=='test')fail('PG_CANDIDATE_TEST_ONLY');
  if(now!==undefined&&(typeof now!=='function'||environment!=='test'))fail('PG_TEST_CLOCK_FORBIDDEN');
  if(!pool||typeof pool.connect!=='function')fail('PG_EXPLICIT_POOL_REQUIRED');
  const client=await pool.connect();let world;
  try{world=(await client.query(`SELECT * FROM ${s}.worlds WHERE world_id=$1`,[worldId])).rows[0];}finally{client.release();}
  if(!world)fail('PG_UNREGISTERED_WORLD');
  if(world.game_id!==gameId||world.environment!==environment)fail('PG_WORLD_SCOPE_MISMATCH');
  const worldKey=String(world.id),token={};let tail=Promise.resolve(),closed=false;
  const clock=async c=>now?integer(now()):safeNumber((await c.query('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS ms')).rows[0].ms);
  const tx=work=>{
    if(closed)return Promise.reject(Error('PG_STORE_CLOSED'));
    // Nested transactions are rejected, including across handles: no pool deadlocks.
    if(context.getStore())return Promise.reject(Error('PG_NESTED_TRANSACTION'));
    const run=async()=>{
      const c=await pool.connect();let began=false,discard;
      try{
        await c.query('BEGIN');began=true;
        await c.query("SELECT set_config('lock_timeout',$1,true)",[`${lockTimeoutMs}ms`]);
        await c.query("SELECT set_config('statement_timeout',$1,true)",['5000ms']);
        if(driver==='pg')await c.query('SELECT pg_advisory_xact_lock($1::bigint)',[worldKey]);
        const result=await context.run(token,()=>work(c));
        await c.query('COMMIT');began=false;return result;
      }catch(e){if(began)await c.query('ROLLBACK').catch(error=>{discard=error;});throw e;}finally{c.release(discard);}
    };
    // Serialize callers of one handle; distinct handles rely on the real PG lock.
    const result=tail.then(run,run);tail=result.catch(()=>{});return result;
  };
  const row=async(c,owner,session)=>{
    const r=(await c.query(`SELECT * FROM ${s}.heads WHERE world=$1 AND owner=$2 AND session=$3`,[worldKey,text(owner),text(session)])).rows[0];
    if(!r)fail('PG_SESSION_NOT_FOUND');return {...r,version:safeNumber(r.version)};
  };
  const lease=async(c,ticket)=>{
    if(ticket?.worldId!==worldId)fail('PG_LEASE_SCOPE');
    const r=(await c.query(`SELECT * FROM ${s}.jobs WHERE world=$1 AND owner=$2 AND id=$3`,[worldKey,text(ticket.owner),text(ticket.id)])).rows[0];
    if(!r||r.status!=='running'||r.holder!==ticket.holder||String(r.fence)!==String(ticket.fence)||safeNumber(r.expires)<=await clock(c))fail('PG_LEASE_LOST');
    return r;
  };
  const api={worldId,gameId,environment,driver,
    async close(){closed=true;await tail;}, // injected pool lifecycle belongs to caller
    async health(){return tx(async c=>(await c.query('SELECT 1 AS ok')).rows[0].ok===1);},
    async create({owner,session,data}){text(owner);text(session);const encoded=json(data);
      return tx(async c=>{await c.query(`INSERT INTO ${s}.heads(world,owner,session,version,data) VALUES($1,$2,$3,0,$4::jsonb)`,[worldKey,owner,session,encoded]);return {version:0,data:JSON.parse(encoded)};});},
    async get({owner,session}){return tx(async c=>{const r=await row(c,owner,session);return {version:r.version,data:r.data};});},
    async events({owner,session}){return tx(async c=>{await row(c,owner,session);return (await c.query(`SELECT cursor,action,event FROM ${s}.journal WHERE world=$1 AND owner=$2 AND session=$3 ORDER BY cursor`,[worldKey,owner,session])).rows.map(r=>({...r,cursor:safeNumber(r.cursor)}));});},
    /** Caller MUST prepare/validate with SWI BEFORE commit. This storage API does not adjudicate rules. */
    async commit({owner,session,action,digest,expectedVersion,data,event,response}){
      text(owner);text(session);text(action);text(digest);integer(expectedVersion,0,Number.MAX_SAFE_INTEGER-1);
      const encoded={data:json(data),event:json(event),response:json(response)};
      return tx(async c=>{
        const old=(await c.query(`SELECT session,digest,response FROM ${s}.receipts WHERE world=$1 AND owner=$2 AND action=$3`,[worldKey,owner,action])).rows[0];
        if(old){if(old.digest!==digest||old.session!==session)fail('PG_ACTION_CONFLICT');return old.response;}
        const current=await row(c,owner,session);if(current.version!==expectedVersion)fail('PG_VERSION_CONFLICT');
        const next=expectedVersion+1;
        const changed=await c.query(`UPDATE ${s}.heads SET version=$4,data=$5::jsonb WHERE world=$1 AND owner=$2 AND session=$3 AND version=$6`,[worldKey,owner,session,next,encoded.data,expectedVersion]);
        if(changed.rowCount!==1)fail('PG_VERSION_CONFLICT');
        await c.query(`INSERT INTO ${s}.journal(world,owner,session,cursor,action,event) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[worldKey,owner,session,next,action,encoded.event]);
        await c.query(`INSERT INTO ${s}.receipts(world,owner,action,session,digest,response) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[worldKey,owner,action,session,digest,encoded.response]);
        return JSON.parse(encoded.response);
      });
    },
    async enqueue({owner,id,digest}){text(owner);text(id);text(digest);
      return tx(async c=>{
        await c.query(`INSERT INTO ${s}.jobs(world,owner,id,digest,status) VALUES($1,$2,$3,$4,'queued') ON CONFLICT(world,owner,id) DO NOTHING`,[worldKey,owner,id,digest]);
        const r=(await c.query(`SELECT digest,status FROM ${s}.jobs WHERE world=$1 AND owner=$2 AND id=$3`,[worldKey,owner,id])).rows[0];
        if(r.digest!==digest)fail('PG_JOB_CONFLICT');return {status:r.status};
      });},
    async claim({owner,id,leaseMs}){text(owner);text(id);integer(leaseMs,1,120000);
      return tx(async c=>{
        const at=await clock(c),holder=randomUUID();
        const r=(await c.query(`UPDATE ${s}.jobs SET status='running',holder=$4,fence=fence+1,expires=$5 WHERE world=$1 AND owner=$2 AND id=$3 AND status='queued' RETURNING fence`,[worldKey,owner,id,holder,at+leaseMs])).rows[0];
        if(!r)fail('PG_JOB_NOT_QUEUED');return {worldId,owner,id,holder,fence:String(r.fence)};
      });},
    async renew(ticket,leaseMs){integer(leaseMs,1,120000);return tx(async c=>{await lease(c,ticket);await c.query(`UPDATE ${s}.jobs SET expires=$4 WHERE world=$1 AND owner=$2 AND id=$3`,[worldKey,ticket.owner,ticket.id,(await clock(c))+leaseMs]);});},
    async reserveCall(ticket,{budgetKey,maxCalls}){text(budgetKey);integer(maxCalls,0,1000000);
      return tx(async c=>{
        await lease(c,ticket);
        await c.query(`INSERT INTO ${s}.usage(world,budget_key,calls) VALUES($1,$2,0) ON CONFLICT(world,budget_key) DO NOTHING`,[worldKey,budgetKey]);
        const r=(await c.query(`UPDATE ${s}.usage SET calls=calls+1 WHERE world=$1 AND budget_key=$2 AND calls<$3 RETURNING calls`,[worldKey,budgetKey,maxCalls])).rows[0];
        if(!r)fail('PG_MODEL_BUDGET_EXHAUSTED');return safeNumber(r.calls);
      });},
    async finish(ticket,result){const encoded=json(result);return tx(async c=>{await lease(c,ticket);await c.query(`UPDATE ${s}.jobs SET status='ready',result=$4::jsonb,holder=NULL,expires=NULL WHERE world=$1 AND owner=$2 AND id=$3`,[worldKey,ticket.owner,ticket.id,encoded]);});},
    // No global startup UPDATE. Only expired jobs in THIS world fail, and are never auto reissued.
    async recoverExpired(){return tx(async c=>(await c.query(`UPDATE ${s}.jobs SET status='failed',result=$2::jsonb,holder=NULL,expires=NULL,fence=fence+1 WHERE world=$1 AND status='running' AND expires<=$3 RETURNING id`,[worldKey,json({error:'GENERATION_INTERRUPTED_NO_AUTORETRY'}),await clock(c)])).rows.map(r=>r.id));},
    async job({owner,id}){return tx(async c=>{const r=(await c.query(`SELECT status,fence,expires,result FROM ${s}.jobs WHERE world=$1 AND owner=$2 AND id=$3`,[worldKey,text(owner),text(id)])).rows[0];if(!r)fail('PG_JOB_NOT_FOUND');return {...r,fence:String(r.fence),expires:r.expires===null?null:safeNumber(r.expires)};});},
  };
  return Object.freeze(api);
}
