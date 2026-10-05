/** Separate process, separate SQLite connection; synthetic fixture input only. */
// @ts-expect-error isolated candidate
import {createAccountJourneyService} from '../server/account-journeys.mjs';
// @ts-expect-error candidate storage extension
import {openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
import {runtime} from '../server/runtime';
const [path,journey,account,requestId]=process.argv.slice(2),gameId='e78df027-7ef4-4d49-82eb-ea91f03d9fb3';
if(!path.includes('/harbor-claim-')||!['a','b'].includes(account))throw Error('SYNTHETIC_FIXTURE_ONLY');
const store=openAsyncSqliteAuthorityStore({path,worldId:'claim-world',gameId});
const svc=createAccountJourneyService({enabled:true,store,runtime,verifyActor:async()=>({gameId,kind:'account',owner:account.repeat(64),browserOwner:'c'.repeat(64),assertCurrent:async()=>{}})});
process.once('message',async()=>{try{const result=await svc.claim({}, {journey,requestId,confirmed:true});process.send?.({result})}catch(e:any){process.send?.({error:e.code??e.message})}finally{await store.close();process.disconnect()}});
process.send?.({ready:true});
