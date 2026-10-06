import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
// Deployment places public.mjs beside vendor/, so resolve external paths from
// the project root before saving the distributable in dist-server/.
const result=await build({entryPoints:['server/public.ts'],bundle:true,platform:'node',format:'esm',outfile:'public.mjs',write:false,external:['./vendor/dynamic-runtime/*'],banner:{js:"import { createRequire as harborCreateRequire } from 'node:module'; const require = harborCreateRequire(import.meta.url);"}});
await mkdir('dist-server',{recursive:true});
await writeFile('dist-server/public.mjs',result.outputFiles[0].contents);
