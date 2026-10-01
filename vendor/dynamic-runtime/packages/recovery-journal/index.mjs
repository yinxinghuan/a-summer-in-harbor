export {RecoverableSessionClient} from './core.mjs';
export {AdoptionJournal} from './adoption.mjs';
// Browser scope is a cache namespace, never server authentication.
export function recoveryScope({deployment,subject,world}){
  for(const value of [deployment,subject,world])if(typeof value!=='string'||!value.trim())throw Error('RECOVERY_SCOPE_REQUIRED');
  return 'alteru-kit:'+JSON.stringify([deployment,subject,world])+':';
}
