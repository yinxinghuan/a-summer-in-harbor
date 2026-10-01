import {SessionAuthority as Core} from './core.mjs';
import {AuthorityError} from './error.mjs';
export {AuthorityError} from './error.mjs';
export {SqliteStorage} from './sqlite.mjs';
export const assertOwner=owner=>{if(typeof owner!=='string'||!owner.trim()||owner.length>256)throw new AuthorityError('AUTH_REQUIRED',401);};
export class SessionAuthority extends Core {
  constructor(db,runtime,{now=Date.now,narrationPolicy={windowMs:60000,turnsPerWindow:0}}={}){
    if(!Number.isSafeInteger(narrationPolicy.turnsPerWindow)||narrationPolicy.turnsPerWindow<0||!Number.isSafeInteger(narrationPolicy.windowMs)||narrationPolicy.windowMs<1)throw new AuthorityError('INVALID_NARRATION_POLICY');
    super(db,runtime,now,Object.freeze({...narrationPolicy}));
  }
  row(owner,id){assertOwner(owner);return super.row(owner,id);}
  create(owner,enrollment,locale,options){assertOwner(owner);if(!['en','zh'].includes(locale))throw new AuthorityError('INVALID_LOCALE');return super.create(owner,enrollment,locale,options);}
  directory(owner){assertOwner(owner);return super.directory(owner);}
  async action(owner,id,body){this.validateEnvelope(owner,body,'action_id');return super.action(owner,id,body);}
  async ending(owner,id,body){this.validateEnvelope(owner,body,'ending_id');return super.ending(owner,id,body);}
  async prepareAction(owner,id,body){this.validateEnvelope(owner,body,'action_id');return super.prepareAction(owner,id,body);}
  async commitPreparedAction(owner,id,body){this.validateEnvelope(owner,body,'action_id');return super.commitPreparedAction(owner,id,body);}
  validateEnvelope(owner,body,key){
    assertOwner(owner);
    if(!body||!/^[a-zA-Z0-9-]{16,80}$/.test(body[key]??'')||!Number.isSafeInteger(body.expected_version)||body.expected_version<0)throw new AuthorityError('INVALID_ACTION');
  }
}
