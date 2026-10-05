/** Local integration candidate. Account display identity is never an authority proof. */
export type Identity={account:string}|null;
export type Journey={id:string;title:string;version:number};
export type Directory={journeys:Journey[];legacy?:Journey};
export type CloudHint={kind:'found';journey:string}|{kind:'not-in-recent-window'|'unavailable'|'invalid'};
export type View={phase:'waiting'|'loading'|'choose'|'claiming'|'ready'|'connection-needed'|'error';scope?:string;journeys:Journey[];legacy?:Journey;selected?:Journey;hint?:CloudHint;error?:string};
export type Ports={gameId:string;identity:()=>Identity;storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;
 /** Optional legacy discovery experiment; omitted on the default PG account path. */
 readHint?:(signal:AbortSignal)=>Promise<CloudHint>;
 /** These must use the supported authenticated platform→game path. No user ID in a JSON body establishes ownership. */
 authority?:{list:(signal:AbortSignal)=>Promise<Directory>;claim:(journey:string,requestId:string,signal:AbortSignal)=>Promise<Directory>};
 changed?:(view:View)=>void};
const uuid=(v:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export class AccountJourneyLink{
 view:View={phase:'waiting',journeys:[]};private epoch=0;private controller=new AbortController();
 constructor(private p:Ports){if(!uuid(p.gameId))throw Error('INVALID_GAME_ID')}
 private identityScope(){const i=this.p.identity();return i&&i.account&&i.account!=='__alteru_guest__'?`account-link-v1:${this.p.gameId}:${encodeURIComponent(i.account)}`:undefined}
 private publish(view:View){this.view=view;this.p.changed?.(view);return view}
 private current(epoch:number,scope:string){if(epoch!==this.epoch)return false;if(this.identityScope()!==scope){this.cancel();return false}return true}
 cancel(){this.epoch++;this.controller.abort();this.controller=new AbortController();return this.publish({phase:'waiting',journeys:[]})}
 private validate(d:Directory){if(!Array.isArray(d.journeys)||d.journeys.length>100||[...d.journeys,...(d.legacy?[d.legacy]:[])].some(j=>!uuid(j.id)||typeof j.title!=='string'||j.title.length>200||!Number.isSafeInteger(j.version)||j.version<0)||new Set(d.journeys.map(j=>j.id)).size!==d.journeys.length)throw Error('INVALID_DIRECTORY');return d}
 async connect(){
  this.cancel();const epoch=this.epoch,scope=this.identityScope();if(!scope)return this.view;
  this.publish({phase:'loading',scope,journeys:[]});
  try{const hint:CloudHint=this.p.readHint?await this.p.readHint(this.controller.signal).catch(()=>({kind:'unavailable' as const})):{kind:'unavailable'};if(!this.current(epoch,scope))return this.view;
   if(!this.p.authority)return this.publish({phase:'connection-needed',scope,journeys:[],hint});
   const d=this.validate(await this.p.authority.list(this.controller.signal));if(!this.current(epoch,scope))return this.view;
   for(const j of d.journeys)this.p.storage.removeItem(scope+':claim:'+j.id);
   const saved=this.p.storage.getItem(scope+':selection');const selected=d.journeys.find(j=>j.id===saved)??(hint.kind==='found'?d.journeys.find(j=>j.id===hint.journey):undefined);
   return this.publish({phase:selected?'ready':'choose',scope,...d,selected,hint});
  }catch(e:any){if(!this.current(epoch,scope))return this.view;return this.publish({phase:'error',scope,journeys:[],error:String(e.message)})}
 }
 choose(id:string){const scope=this.view.scope;if(!scope||scope!==this.identityScope()){this.cancel();return false}const selected=this.view.journeys.find(j=>j.id===id);if(!selected||!['choose','ready'].includes(this.view.phase))return false;this.p.storage.setItem(scope+':selection',id);this.publish({...this.view,phase:'ready',selected});return true}
 async claimLegacy(confirmed:boolean){
  if(!confirmed)return this.view;const {scope,legacy}=this.view;if(!scope||scope!==this.identityScope()||!legacy||!this.p.authority||!['choose','ready'].includes(this.view.phase))return this.view;
  const epoch=this.epoch,key=scope+':claim:'+legacy.id;let requestId=this.p.storage.getItem(key);if(!requestId){requestId=crypto.randomUUID();this.p.storage.setItem(key,requestId)}
  const previous=this.view;this.publish({...previous,phase:'claiming'});
  try{const d=this.validate(await this.p.authority.claim(legacy.id,requestId,this.controller.signal));if(!this.current(epoch,scope))return this.view;
   this.p.storage.removeItem(key);return this.publish({phase:'choose',scope,...d,hint:previous.hint});
  }catch(e:any){if(!this.current(epoch,scope))return this.view;this.publish({...previous,error:String(e.message)});return this.view}
 }
}
/** Public platform save list is only a discovery hint, never a credential vault.
 * A missing row among the latest six is NOT proof of an empty account. */
export function readRecentHint(rows:unknown,account:string,gameId:string):CloudHint{
 if(!Array.isArray(rows))return {kind:'unavailable'};
 const row=rows.find(r=>r&&String(r.user_id)===account);if(!row)return {kind:'not-in-recent-window'};
 try{const data=JSON.parse(row.resource_data),link=data.harborJourneyLinkV1;if(!link||link.gameId!==gameId||!uuid(link.selectedJourney))return {kind:'invalid'};
  if(Object.keys(link).some(k=>!['gameId','selectedJourney'].includes(k)))return {kind:'invalid'};
  return {kind:'found',journey:link.selectedJourney};
 }catch{return {kind:'invalid'}}
}
/** Metadata only. Caller must preserve other platform save fields and use its existing ownership/concurrency contract. */
export function publicHint(gameId:string,selectedJourney:string){if(!uuid(gameId)||!uuid(selectedJourney))throw Error('INVALID_LINK');return {harborJourneyLinkV1:{gameId,selectedJourney}}}
