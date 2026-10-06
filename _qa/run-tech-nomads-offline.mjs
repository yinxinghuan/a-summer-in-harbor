import {readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const excluded={'account-pg.test.ts':'Requires separately authorized actual QA PostgreSQL URL.','animal-pg.test.ts':'Requires separately authorized actual QA PostgreSQL URL.','turn-pg.test.ts':'Requires separately authorized actual QA PostgreSQL URL.','news-account-http.test.ts':'HTTP listener prohibited by this sandbox; no new backend service in this task.','temporary-account-http.test.ts':'HTTP listener prohibited by this sandbox; no new backend service in this task.'};
const files=readdirSync('_qa').filter(f=>f.endsWith('.test.ts')&&!excluded[f]).sort().map(f=>'_qa/'+f);
const result=spawnSync(process.execPath,['--import','tsx','--test','--test-concurrency=2',...files],{encoding:'utf8',maxBuffer:10*1024*1024});
const out='../evidence';mkdirSync(out,{recursive:true});writeFileSync(out+'/tests-offline.tap',result.stdout+(result.stderr||''));
const total=/^# tests (\d+)/m.exec(result.stdout),passed=/^# pass (\d+)/m.exec(result.stdout),failed=/^# fail (\d+)/m.exec(result.stdout);
const summary={kind:'deterministic-offline-only',node:process.version,selectedFiles:files,notRun:excluded,tests:total?Number(total[1]):null,passed:passed?Number(passed[1]):null,failed:failed?Number(failed[1]):null,exitCode:result.status,noExternalNetwork:true,noModel:true,noMedia:true,noBackendService:true};writeFileSync(out+'/tests-offline.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));process.exitCode=result.status??1;
