/** Request-local snapshots prevent a late response from being applied after switching.
 * This protects the client lifecycle, not the authenticity of the supplied ID. */
export class IdentityEpoch{
 private value:string|null=null;private version=0;private active=false;private controller=new AbortController();private listeners=new Set<()=>void>();
 constructor(private read:()=>string|null){}
 enable(enabled:boolean){if(this.active===enabled)return;this.active=enabled;this.observe()}
 observe(){const value=this.active?this.read():null;if(value===this.value)return false;this.value=value;this.version++;this.controller.abort();this.controller=new AbortController();for(const f of this.listeners)f();return true}
 subscribe(f:()=>void){this.listeners.add(f);return()=>{this.listeners.delete(f)}}
 capture(){this.observe();const epoch=this.version,value=this.value,signal=this.controller.signal;return {epoch,account:value,scope:value===null?'browser':`temporary-unverified:${value}`,signal,assert:()=>{this.observe();if(epoch!==this.version||signal.aborted)throw Error('IDENTITY_CHANGED')}}}
}
