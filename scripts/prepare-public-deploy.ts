/** Stage secret bindings outside the public repository; never print their values. */
import {mkdir,copyFile,symlink,lstat,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateText,validatePublicConfig} from '../server/public-config';
const root=fileURLToPath(new URL('../',import.meta.url));
const config=validatePublicConfig(JSON.parse(await privateText(process.env.HARBOR_CONFIG_FILE)));
const token=await privateText(process.env.HARBOR_EDGE_FILE);
if(!/^[a-f0-9]{64}$/.test(token)||!/^https:\/\/[a-z0-9.-]+$/.test(config.upstreamOrigin??''))throw Error('PRIVATE_DEPLOY_CONFIG_INVALID');
const output=resolve(process.argv[2]??'');
if(!/^\/private\/tmp\/harbor-public-deploy-[a-z0-9-]+$/.test(output))throw Error('EXPLICIT_PRIVATE_STAGING_PATH_REQUIRED');
try{await lstat(output);throw Error('STAGING_DIRECTORY_ALREADY_EXISTS')}catch(e:any){if(e.code!=='ENOENT')throw e}
await lstat(join(root,'dist/index.html'));await mkdir(output,{mode:0o700});
if((await realpath(output))!==output)throw Error('STAGING_REALPATH_MISMATCH');
await mkdir(join(output,'worker'),{mode:0o700});
await copyFile(join(root,'worker/index.js'),join(output,'worker/index.js'));
await symlink(join(root,'dist'),join(output,'dist'));
const values={HARBOR_PUBLIC_ORIGIN:config.publicOrigin,HARBOR_GAME_BASE:'/'+config.gameId,HARBOR_UPSTREAM_ORIGIN:config.upstreamOrigin,HARBOR_EXPIRES_AT:config.expiresAt===null?'none':String(config.expiresAt),...(config.timePolicy?{HARBOR_TIME_POLICY:config.timePolicy}:{}),HARBOR_IDENTITY_MODE:config.identityMode};
await writeFile(join(output,'worker/bindings.json'),JSON.stringify({bindings:[...Object.entries(values).map(([name,text])=>({name,type:'plain_text',text})),{name:'HARBOR_EDGE_TOKEN',type:'secret_text',text:token}]}),{mode:0o600});
console.log(JSON.stringify({prepared:true,gameId:config.gameId,expiresAt:config.expiresAt,privateBindingsOutsideRepository:true}));
