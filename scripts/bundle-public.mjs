/** Build a Linux-portable server bundle; no private configuration is included. */
import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
const root=process.cwd();
await mkdir('dist-server',{recursive:true});
for(const [name,entry] of Object.entries({public:'server/public.ts',migrate:'scripts/migrate-public.ts','pg-canary':'scripts/pg-canary.ts'}))await build({entryPoints:[entry],outfile:`dist-server/${name}.mjs`,bundle:true,platform:'node',format:'esm',target:'node22',external:['pg-native'],plugins:[{name:'preserve-rule-runtime',setup(b){b.onResolve({filter:/vendor\/dynamic-runtime/},a=>({path:'./'+relative(root,resolve(a.resolveDir,a.path)),external:true}))}}],banner:{js:"import { createRequire as harborCreateRequire } from 'node:module'; const require = harborCreateRequire(import.meta.url);"}});
await cp('vendor','dist-server/vendor',{recursive:true});
console.log('Harbor server bundles prepared without private configuration');
