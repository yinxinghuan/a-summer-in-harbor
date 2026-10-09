import esbuild from 'esbuild';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';
const source=fileURLToPath(new URL('../',import.meta.url)),out=resolve(source,'../evidence');mkdirSync(out,{recursive:true});
const commit='58c46bdd1dfe09c977e86076a4686d78473af1d2',raw=execFileSync('git',['show',commit+':src/weather/state.ts'],{cwd:source,encoding:'utf8'});
execFileSync('git',['diff','--exit-code',commit,'--','src/story/crops.ts'],{cwd:source,stdio:'pipe'});
await esbuild.build({absWorkingDir:source,entryPoints:['src/weather/state.ts'],outfile:out+'/old58-reader.mjs',bundle:true,platform:'node',format:'esm',target:'node22',plugins:[{name:'actual-old58-module',setup(b){b.onLoad({filter:/src\/weather\/state\.ts$/},()=>({contents:raw,loader:'ts',resolveDir:source+'/src/weather'}))}}]});
const hash=raw=>createHash('sha256').update(raw).digest('hex');
writeFileSync(out+'/old58-reader-lock.json',JSON.stringify({sourceCommit:commit,sourceSHA256:hash(raw),bundleSHA256:hash(readFileSync(out+'/old58-reader.mjs')),unchangedDependency:'src/story/crops.ts'},null,2)+'\n');
