/** Build a Linux-portable server bundle; no private configuration is included. */
import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist-server',{recursive:true});
for(const [name,entry] of Object.entries({public:'server/public.ts',migrate:'scripts/migrate-public.ts','pg-canary':'scripts/pg-canary.ts'}))await build({entryPoints:[entry],outfile:`dist-server/${name}.mjs`,bundle:true,platform:'node',format:'esm',target:'node22',external:['pg-native'],banner:{js:"import { createRequire as harborCreateRequire } from 'node:module'; const require = harborCreateRequire(import.meta.url);"}});
console.log('Harbor server bundles prepared without private configuration');
