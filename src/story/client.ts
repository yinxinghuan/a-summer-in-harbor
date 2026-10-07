import {rememberReply,draftKey} from './dialogue-reading';
import {getGameApiBase} from '../game-id';import type {Save,Action} from './state';import type {Locale} from '../world/data';
import {identitySnapshot,identityFetch,enableAccountMode} from '../account-link/transport';
const storage=()=>window.alteruLocalStorage;
type Scope=ReturnType<typeof identitySnapshot>;
const key=(name:string,s:Scope)=>s.account?`harbor-account:${encodeURIComponent(s.scope)}:${name}`:name;
const pendingKey=(s:Scope,id=bound?.scope===s.scope?bound.id:'unselected')=>key('harbor-pending-v2:'+id,s);
export const hasPendingAction=()=>!!storage().getItem(pendingKey(identitySnapshot()));
async function request(path:string,body?:unknown,s=identitySnapshot()){
 const r=await identityFetch(getGameApiBase()+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'X-Harbor-Dynamic-Assets':'1',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})},s);const data=await r.json();s.assert();if(!r.ok)throw Object.assign(Error(data.error??'REQUEST_FAILED'),{status:r.status,terminal:data.terminal});return data;
}
export type JourneyChoice={browserClaimed?:boolean;journeys:{id:string;version:number;scene:string}[];legacy:{id:string;version:number;scene:string}[]};
let choice:{scope:string;data:JourneyChoice}|undefined;let bound:{scope:string;id:string}|undefined;
export function connectionChoice(){const s=identitySnapshot();return choice?.scope===s.scope?choice.data:undefined}
const bind=(s:Scope,head:Save)=>{s.assert();bound={scope:s.scope,id:head.id};return head};
function requireBound(head:Save,s:Scope){s.assert();if(bound?.scope!==s.scope||bound.id!==head.id)throw Error('IDENTITY_CHANGED')}
export async function connect(locale:Locale):Promise<Save>{
 const boot=await request('/bootstrap',{});enableAccountMode(boot.mode);const s=identitySnapshot();
 const directory=await request('/sessions',undefined,s);let id=storage().getItem(key('harbor-journey',s));
 if(!id||!directory.some((j:{id:string})=>j.id===id)){
  const legacy=s.account?await request('/account/legacy',undefined,s):[];
  if(s.account&&(legacy.length||directory.length>1)) {choice={scope:s.scope,data:{journeys:directory,legacy}};throw Error('JOURNEY_SELECTION_REQUIRED')}
  id=directory[0]?.id;if(!id){let enrollment=storage().getItem(key('harbor-enroll',s));if(!enrollment){enrollment=crypto.randomUUID();storage().setItem(key('harbor-enroll',s),enrollment)}try{const head=await request('/sessions',{enrollment_id:enrollment,locale},s);id=head.id}catch(e:any){if(!s.account&&e.message==='ENROLLMENT_ALREADY_CLAIMED'){choice={scope:s.scope,data:{journeys:[],legacy:[],browserClaimed:true}};throw Error('JOURNEY_SELECTION_REQUIRED')}throw e}}
  s.assert();storage().setItem(key('harbor-journey',s),id!);
 }
 choice=undefined;
 // Preserve historical pending envelopes by journey; never submit one as another account.
 const oldKey=key('harbor-pending-v1',s),old=storage().getItem(oldKey);if(old&&JSON.parse(old).id===id&&!storage().getItem(pendingKey(s,id!))){storage().setItem(pendingKey(s,id!),old);storage().removeItem(oldKey)}
 const pending=storage().getItem(pendingKey(s,id!));if(pending){const p=JSON.parse(pending);if(p.id===id){try{const recovered=await request('/sessions/'+id+'/action',p.action,s);const entry=recovered.head.history.find((h:{id:string})=>h.id===p.action.action_id);if(entry){rememberReply(storage(),recovered.head,entry,locale);if(entry.person&&entry.question&&storage().getItem(draftKey(id!,entry.person))?.trim()===entry.question)storage().removeItem(draftKey(id!,entry.person))};s.assert();storage().removeItem(pendingKey(s,id!))}catch(e:any){s.assert();if(e.terminal===true||(e.terminal!==false&&e.status>=400&&e.status<500))storage().removeItem(pendingKey(s,id!));else throw e}}}
 return bind(s,await request('/sessions/'+id,undefined,s));
}
export async function chooseJourney(locale:Locale,option:{kind:'existing'|'claim'|'new';id?:string;confirmed?:boolean}):Promise<Save>{
 const s=identitySnapshot(),c=connectionChoice();if(!c||(!s.account&&!c.browserClaimed))throw Error('JOURNEY_SELECTION_REQUIRED');let id=option.id;
 if(option.kind==='claim'){
  if(!option.confirmed||!c.legacy.some(j=>j.id===id))throw Error('CLAIM_CONFIRMATION_REQUIRED');
  const k=key('claim:'+id,s);let requestId=storage().getItem(k);if(!requestId){requestId=crypto.randomUUID();storage().setItem(k,requestId)}
  await request('/account/claim',{journey:id,requestId,confirmed:true},s);s.assert();storage().removeItem(k);
  const old=storage().getItem('harbor-pending-v2:'+id)??storage().getItem('harbor-pending-v1');if(old&&JSON.parse(old).id===id&&!storage().getItem(pendingKey(s,id!)))storage().setItem(pendingKey(s,id!),old);
 }else if(option.kind==='new'){
  const k=key('harbor-choice-enroll',s);let enrollment=storage().getItem(k);if(!enrollment){enrollment=crypto.randomUUID();storage().setItem(k,enrollment)}id=(await request('/sessions',{enrollment_id:enrollment,locale},s)).id;s.assert();storage().removeItem(k);
 }else if(!c.journeys.some(j=>j.id===id))throw Error('JOURNEY_NOT_FOUND');
 s.assert();storage().setItem(key('harbor-journey',s),id!);choice=undefined;return connect(locale);
}
export async function send(head:Save,a:Action):Promise<{head:Save;text:[string,string]}>{
 const s=identitySnapshot();requireBound(head,s);
 const work=async()=>{requireBound(head,s);if(storage().getItem(pendingKey(s)))throw Error('PENDING_ACTION');storage().setItem(pendingKey(s),JSON.stringify({id:head.id,action:a}));
  try{const result=await request('/sessions/'+head.id+'/action',a,s);const entry=result.head.history.find((h:{id:string})=>h.id===a.action_id);if(entry)rememberReply(storage(),result.head,entry,(a.payload as {locale?:Locale})?.locale??head.locale);s.assert();storage().removeItem(pendingKey(s));const latest=await request('/sessions/'+head.id,undefined,s);return {...result,head:bind(s,latest)}}catch(e:any){s.assert();if(e.terminal===true||(e.terminal!==false&&e.status>=400&&e.status<500))storage().removeItem(pendingKey(s));throw e}
 };return navigator.locks?navigator.locks.request('harbor-authority-writer:'+s.scope,work):work();
}
export async function checkpoint(head:Save,position:{x:number;y:number}){const s=identitySnapshot();requireBound(head,s);if(storage().getItem(pendingKey(s)))return;await request('/sessions/'+head.id+'/checkpoint',{expected_version:head.version,sceneId:head.scene,position},s)}
export type Usage={room?:{remaining:number};resetAt:number;dialogue:{remaining:number;maximum:number;retryAt:number|null;pending:number}};
export async function readUsage():Promise<Usage>{return request('/usage')}
export type NoteMedia={status:string;room:string;retryable?:boolean;url?:string};
export async function ensureNoteImage(id:string,room:string):Promise<NoteMedia>{return request('/sessions/'+id+'/media/'+room+'/prepare',{})}
export async function loadNoteImage(id:string,room:string){const s=identitySnapshot();const r=await identityFetch(getGameApiBase()+'/api/sessions/'+id+'/media/'+room,{},s);if(!r.ok)throw Error('MEDIA_UNAVAILABLE');const blob=await r.blob();s.assert();return URL.createObjectURL(blob)}

export async function readLife(head:Save):Promise<import('../ui/LifeBag').LifeView>{const scope=identitySnapshot();requireBound(head,scope);return request('/sessions/'+head.id+'/life',undefined,scope)}
export async function readLandPreview(head:Save,region:string,at?:{x:number;y:number}):Promise<import('../life/land').LandPreview>{const scope=identitySnapshot();requireBound(head,scope);const query=new URLSearchParams({region,...(at?{x:String(at.x),y:String(at.y)}:{})});return request('/sessions/'+head.id+'/land-preview?'+query,undefined,scope)}
