// Manual-only normal public shell. No synthetic bridge, ID, email or credential injection.
import {createServer,request} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {makeDemoServer} from './temporary-account-server';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {createReviewedAnimalLife} from '../server/reviewed-animal-life';
import {withBasilPlantUses} from '../server/plant-basil';
import {withWildMint} from '../server/wild-mint';
const assembly=createExplorationAssembly({createLife:createReviewedAnimalLife,crabEnabled:true,resolveDialogue:async()=>{throw Error('MODEL_DISABLED')},decorateLife:(life:any)=>withWildMint(withBasilPlantUses(life,{enabled:true,newStarts:true}),{enabled:true,newStarts:true})});
const backend=await makeDemoServer({directory:'../manual-qa-data',accountOnly:true,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const frontend=createServer((req,res)=>{
 const path=new URL(req.url!,'http://localhost').pathname;
 if(path.includes('/api/')){const dest=new URL(req.url!,backend.url),proxy=request(dest,{method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode??502,r.headers);r.pipe(res)});proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});req.pipe(proxy);return}
 if(req.method!=='GET'){res.writeHead(405);res.end();return}
 if(path==='/_qa/status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({scope:'manual local QA only',productionWrites:0,syntheticIdentities:false,modelCallsDisabled:true}));return}
 const file=resolve('dist','.'+(path==='/'?'/index.html':decodeURIComponent(path)));
 if(!file.startsWith(resolve('dist')+'/')||!existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
});
await new Promise<void>(r=>frontend.listen(5596,'127.0.0.1',r));
console.log(JSON.stringify({entry:'http://127.0.0.1:5596/',scope:'manual local QA; unchanged public guest-shell; real email/OTP entered by user only; no production saves or synthetic identities'}));
let closing=false;async function close(){if(closing)return;closing=true;await new Promise<void>(r=>frontend.close(()=>r()));await backend.close();process.exit(0)}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
