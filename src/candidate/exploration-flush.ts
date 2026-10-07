import type {Save} from '../story/state';
let flush:(business?:boolean)=>Promise<Save|undefined>=async()=>undefined;
let release:()=>void=()=>{};
let fence:(s:Save)=>{client:string;lease?:string;activeMs:number}|undefined=()=>undefined;
export const activePlayActionFence=(s:Save)=>fence(s);
export function registerActivePlayFence(next:typeof fence){fence=next;return()=>{if(fence===next)fence=()=>undefined}}
export const flushCandidateMovement=(business=false)=>flush(business);
export const resumeCandidateAuthority=()=>release();
export function registerCandidateFlush(next:typeof flush,nextRelease=()=>{}){flush=next;release=nextRelease;return()=>{if(flush===next){flush=async()=>undefined;release=()=>{}}}}
