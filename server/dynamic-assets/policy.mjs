import {AsyncLocalStorage} from 'node:async_hooks';
import {readFile,lstat} from 'node:fs/promises';
export const requestContext=new AsyncLocalStorage();
export const fail=(code,status=403)=>{throw Object.assign(Error(code),{code,status})};
export function createPolicy({mode='off',document={entries:[]},now=Date.now}){
 if(!['off','qa'].includes(mode)||!Array.isArray(document.entries)||document.entries.length>2)fail('ASSET_QA_CONFIG',500);
 const entries=document.entries,enabledAt=document.enabledAt;
 if(entries.length&&(!Number.isSafeInteger(enabledAt)||enabledAt<1))fail('ASSET_QA_CONFIG',500);
 for(const e of entries)if(!/^[a-f0-9]{64}$/.test(e.owner)||!/^[a-f0-9-]{36}$/.test(e.sessionId)||typeof e.enrollment!=='string'||!e.enrollment.startsWith('asset-b-qa-')||!Number.isSafeInteger(e.createdAt)||!Number.isSafeInteger(e.expiresAt)||e.createdAt>enabledAt||enabledAt-e.createdAt>86400000||e.expiresAt!==enabledAt+86400000)fail('ASSET_QA_CONFIG',500);
 if(new Set(entries.map(e=>e.owner)).size!==entries.length||new Set(entries.map(e=>e.sessionId)).size!==entries.length)fail('ASSET_QA_CONFIG',500);
 const entry=(owner,id)=>entries.find(e=>e.owner===owner&&e.sessionId===id);
 return Object.freeze({entry,entries:structuredClone(entries),enabled(owner,id){const e=entry(owner,id);return mode==='qa'&&!!e&&now()>=enabledAt&&now()<e.expiresAt},assert(owner,id){if(!this.enabled(owner,id))fail('ASSET_QA_CLOSED');return entry(owner,id)},expires(owner,id){return this.assert(owner,id).expiresAt}});
}
export async function loadPolicy(env=process.env){const mode=env.HARBOR_DYNAMIC_ASSET_MODE??'off';if(!env.HARBOR_DYNAMIC_ASSET_ALLOWLIST_FILE){if(mode!=='off')fail('ASSET_QA_CONFIG',500);return createPolicy({mode})}const path=env.HARBOR_DYNAMIC_ASSET_ALLOWLIST_FILE,s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o777)!==0o600||s.size>8192)fail('ASSET_QA_CONFIG',500);return createPolicy({mode,document:JSON.parse(await readFile(path,'utf8'))})}
