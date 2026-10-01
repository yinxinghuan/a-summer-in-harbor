// Explicit migration command; do not grant schema ownership to runtime role.
import {Pool} from 'pg';import {privateText,validatePublicConfig} from '../server/public-config';import {GAME_UUID} from '../src/game-id';
// @ts-expect-error frozen skill export
import {initializeCandidateSchema,registerCandidateWorld} from '../vendor/dynamic-runtime/packages/pg-candidate/index.mjs';
// @ts-expect-error frozen skill export
import {initializeAsyncAuthoritySchema} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const config=validatePublicConfig(JSON.parse(await privateText(process.env.HARBOR_CONFIG_FILE)));
const pool=new Pool({host:config.pgHost,database:config.database,user:process.env.HARBOR_MIGRATOR_USER,password:await privateText(process.env.HARBOR_MIGRATOR_PASSWORD_FILE),max:1});if(!/^harbor_[a-z0-9_]+$/.test(process.env.HARBOR_MIGRATOR_USER??''))throw Error('MIGRATOR_REQUIRED');
const client=await pool.connect();try{const options={schema:config.schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};await initializeCandidateSchema(client,options);await initializeAsyncAuthoritySchema(client,options);await registerCandidateWorld(client,options);await client.query(`GRANT USAGE ON SCHEMA "${config.schema}" TO "${config.user}"`);await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${config.schema}" TO "${config.user}"`);console.log(JSON.stringify({migrated:true,gameId:GAME_UUID,schema:config.schema}));}finally{client.release();await pool.end()}
