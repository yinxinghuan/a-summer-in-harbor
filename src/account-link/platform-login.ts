import {GAME_UUID} from '../game-id';
import {liveShellAccount,identitySnapshot} from './transport';

let opening:Promise<string>|undefined;
/** Opens the existing shell's authenticated transport. The platform owns the
 * email form, verification and session; the game reads its live ID afterwards. */
export function signInToPlatform():Promise<string>{
 if(opening)return opening;
 const known=liveShellAccount();
 if(known&&known!=='__invalid_shell_identity__')return Promise.resolve(known);
 opening=(async()=>{
  const deadline=Date.now()+10000;
  while(typeof (window as any).Aigram?.callAigramAPI!=='function'){
   if(Date.now()>=deadline)throw Error('PLATFORM_LOGIN_UNAVAILABLE');
   await new Promise<void>(resolve=>setTimeout(resolve,100));
  }
  // Existing protected stats read, complete documented parameters. This GET
  // neither creates a game save nor reports a play event or calls a model.
  const result=await (window as any).Aigram.callAigramAPI(`/note/aigram/ai/game/get/play/stats?session_id=${encodeURIComponent(GAME_UUID)}&event=play`,'GET',null);
  if(!result||(result.retcode!==0&&result.errcode!==0))throw Error('PLATFORM_LOGIN_REQUIRED');
  const id=liveShellAccount();
  if(!id||id==='__invalid_shell_identity__')throw Error('PLATFORM_LOGIN_REQUIRED');
  identitySnapshot().assert();return id;
 })().finally(()=>{opening=undefined});
 return opening;
}
