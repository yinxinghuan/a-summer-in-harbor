import {getGameApiBase} from '../game-id';import type {Save,Action} from './state';import type {Locale} from '../world/data';
const storage=()=>window.alteruLocalStorage;
const pendingKey='harbor-pending-v1';
async function request(path:string,body?:unknown){const r=await fetch(getGameApiBase()+'/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error??'REQUEST_FAILED'),{status:r.status,terminal:data.terminal});return data}
export async function connect(locale:Locale):Promise<Save>{
 await request('/bootstrap',{});const directory=await request('/sessions');let id=storage().getItem('harbor-journey');
 if(!id||!directory.some((s:{id:string})=>s.id===id)){id=directory[0]?.id;if(!id){let enrollment=storage().getItem('harbor-enroll');if(!enrollment){enrollment=crypto.randomUUID();storage().setItem('harbor-enroll',enrollment)}const save=await request('/sessions',{enrollment_id:enrollment,locale});id=save.id;}storage().setItem('harbor-journey',id!)}
 const pending=storage().getItem(pendingKey);if(pending){const p=JSON.parse(pending);if(p.id===id){try{await request('/sessions/'+id+'/action',p.action);storage().removeItem(pendingKey)}catch(e:any){if(e.terminal===true||(e.terminal!==false&&e.status>=400&&e.status<500))storage().removeItem(pendingKey);else throw e}}}
 // Historical receipts must never roll back a newer authoritative head.
 return request('/sessions/'+id);
}
export async function send(s:Save,a:Action):Promise<{head:Save;text:[string,string]}>{
 const work=async()=>{
  if(storage().getItem(pendingKey))throw Error('PENDING_ACTION');storage().setItem(pendingKey,JSON.stringify({id:s.id,action:a}));
  try{const result=await request('/sessions/'+s.id+'/action',a);storage().removeItem(pendingKey);const latest=await request('/sessions/'+s.id);return {...result,head:latest};}catch(e:any){if(e.terminal===true||(e.terminal!==false&&e.status>=400&&e.status<500))storage().removeItem(pendingKey);throw e}
 };
 return navigator.locks?navigator.locks.request('harbor-authority-writer',work):work();
}
export async function checkpoint(s:Save,position:{x:number;y:number}){if(storage().getItem(pendingKey))return;await request('/sessions/'+s.id+'/checkpoint',{expected_version:s.version,sceneId:s.scene,position})}

export type Usage={room?:{remaining:number};resetAt:number;dialogue:{remaining:number;maximum:number;retryAt:number|null;pending:number}};
export async function readUsage():Promise<Usage>{return request('/usage')}

export type NoteMedia={status:string;room:string;retryable?:boolean;url?:string};
export async function ensureNoteImage(id:string,room:string):Promise<NoteMedia>{return request('/sessions/'+id+'/media/'+room+'/prepare',{})}
export function noteImageUrl(id:string,room:string){return getGameApiBase()+'/api/sessions/'+id+'/media/'+room}
