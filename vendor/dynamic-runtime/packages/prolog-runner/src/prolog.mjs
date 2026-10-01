import {spawn} from 'node:child_process';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function makeProlog({directory,utilPath,swipl='swipl',resolverPath=path.join(path.dirname(fileURLToPath(import.meta.url)),'resolve-batch.pl')}){
 let active=0;
 return async function run(compiled,cases){
  if(active>=2)throw new Error('RULE_ENGINE_BUSY');
  active++;
  try{
   const text=compiled['rules.pl'],hash=createHash('sha256').update(text).digest('hex');
   const manifest=JSON.parse(compiled['manifest.json']);
   if(!/^rpg_[a-f0-9]{64}$/.test(manifest.moduleName))throw new Error('RULE_ARTIFACT_INVALID');
   await mkdir(directory,{recursive:true,mode:0o700});
   const file=path.join(directory,hash+'.pl');
   try{await writeFile(file,text,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
   if(await readFile(file,'utf8')!==text)throw new Error('RULE_ARTIFACT_INVALID');
   return await new Promise((resolve,reject)=>{
    const child=spawn(swipl,['-q','-f',resolverPath,'--',utilPath,file,manifest.moduleName],{stdio:['pipe','pipe','pipe']});
    let output='',size=0,done=false;
    const fail=code=>{if(done)return;done=true;clearTimeout(timer);child.kill('SIGKILL');reject(new Error(code));};
    const timer=setTimeout(()=>fail('RULE_ENGINE_TIMEOUT'),15000);
    child.on('error',()=>fail('RULE_ENGINE_UNAVAILABLE'));child.stdin.on('error',()=>fail('RULE_ENGINE_UNAVAILABLE'));
    child.stderr.on('data',()=>{});
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024)fail('RULE_OUTPUT_TOO_LARGE');else output+=chunk;});
    child.on('close',code=>{if(done)return;clearTimeout(timer);done=true;
     if(code!==0)return reject(new Error('RULE_ENGINE_FAILED'));
     try{const data=JSON.parse(output);if(!Array.isArray(data.results)||data.results.length!==cases.length)throw 0;resolve(data.results);}
     catch{reject(new Error('RULE_OUTPUT_INVALID'));}});
    child.stdin.end(JSON.stringify({cases})+'\n');
   });
  }finally{active--;}
 };
}
