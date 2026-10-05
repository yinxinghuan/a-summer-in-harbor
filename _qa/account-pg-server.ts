import {Pool} from 'pg';
// @ts-expect-error frozen runtime
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
// @ts-expect-error frozen runtime
import {initializeAsyncAuthoritySchema,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {makeDemoServer} from './temporary-account-server';import {GAME_UUID} from '../src/game-id';
const raw=process.env.HARBOR_ACCOUNT_QA_PG_URL;if(!raw)throw Error('QA_PG_REQUIRED');const u=new URL(raw);
if(u.hostname!=='127.0.0.1'||u.port!=='55439'||u.pathname!=='/harbor_account_qa_20261005')throw Error('ISOLATED_QA_DATABASE_REQUIRED');
const pool=new Pool({connectionString:raw,max:8});const opts={pool,schema:'kit_account_qa_browser',worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
const conn=await pool.connect();try{await initializeCandidateSchema(conn,opts);await initializeAsyncAuthoritySchema(conn,opts);await registerCandidateWorld(conn,opts)}finally{conn.release()}
const store=await openPgAuthorityStore(opts);const srv=await makeDemoServer({directory:'.data/account-pg',providedStore:store,port:5310});
console.log(JSON.stringify({url:srv.url,database:'isolated local PostgreSQL',identity:'synthetic temporary-unverified',noExternalServices:true}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await srv.close();await pool.end();process.exit(0)});
