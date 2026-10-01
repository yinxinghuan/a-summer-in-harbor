import {randomUUID} from 'node:crypto';
import {initialState,domainPatch,canonical,sha256} from '../rule-compiler/index.mjs';
import {AuthorityError} from '../authority-session/index.mjs';
import {decodeEffects} from './decode-effects.mjs';
const fail=code=>{throw new AuthorityError(code,422);};
/** Projected-state canary, not a drop-in adapter for either graphical game. */
export function createRuleRuntime({definition,compiled,loadBound,runProlog,spawn,validatePosition}){
  const rootHash=sha256(canonical(compiled));
  const policy={
    initial:(locale,id)=>({id,world:definition.rules.gameId,version:0,mapVersion:rootHash,locale,position:spawn(definition.rules.initialLocation),binding:null,catalog:[],state:initialState(definition.rules)}),
    assertReadable:h=>{if(!h||h.world!==definition.rules.gameId||typeof h.id!=='string'||!Number.isSafeInteger(h.version)||!h.state?.facts)fail('WORLD_MISMATCH');},
    upgrade:h=>{policy.assertReadable(h);return structuredClone(h);},
    scene:h=>h.state.location,
    position:(h,p)=>validatePosition(h.state.location,p),
    validateAction:b=>{if(!b||b.type!=='rule'||typeof b.rule_id!=='string'||b.rule_id.length>80)fail('INVALID_ACTION');},
    prepare:async(head,body)=>{
      if(head.state.location!==body.sceneId||body.expected_version!==head.version)throw new AuthorityError('VERSION_CONFLICT',409);
      const source=head.binding?await loadBound(head):{definition,compiled};
      if(sha256(canonical(source.compiled))!==(head.binding?source.descriptor?.rules_artifact_hash:rootHash))fail('DELTA_ARTIFACT_MISMATCH');
      if(!source.definition.rules.actions.some(a=>a.id===body.rule_id))fail('INVALID_ACTION');
      const replies=await runProlog(source.compiled,[{action_id:body.rule_id,state:head.state}]);
      if(!Array.isArray(replies)||replies.length!==1)fail('RULE_OUTPUT_INVALID');
      const cartridge={...domainPatch(source.definition.rules,head.locale),characters:source.definition.rules.characters??[]};
      const effects=decodeEffects(replies[0],source.definition,cartridge,{...head.state,locale:head.locale,map:cartridge.initialMap});
      if(!replies[0].accepted)fail('INVALID_ACTION');
      const next=structuredClone(head);
      for(const e of effects){
        switch(e.type){
          case 'fact':next.state.facts[e.id]=e.value;break;
          case 'fact-add':next.state.facts[e.id]+=e.delta;break;
          case 'stat':next.state.stats[e.id]+=e.delta;break;
          case 'map':next.state.location=e.nodeId;next.position=validatePosition(e.nodeId,spawn(e.nodeId));break;
          case 'inventory':{const old=next.state.inventory.find(i=>i.id===e.itemId),count=(old?.count??0)+(e.action==='add'?e.count:-e.count);next.state.inventory=next.state.inventory.filter(i=>i.id!==e.itemId);if(count)next.state.inventory.push({id:e.itemId,count});break;}
          case 'party':{const old=next.state.characters.find(c=>c.id===e.characterId),status=e.change==='add'?'companion':'departed';if(old)old.status=status;else next.state.characters.push({id:e.characterId,status});break;}
          case 'danger':next.state.danger_phase='calm';break;
          case 'session':next.ended=e.ended;break;
          case 'objective':case 'clock':next[e.type]=e.value;break;
          // Numeric clock progression needs a game-specific time projection.
          default:fail('UNSUPPORTED_EFFECT');
        }
      }
      next.version++;return{kind:'action',accepted:true,head:next,effects,engine:'swi-prolog',receipt_id:randomUUID()};
    },
    preserveConcurrent:(candidate,current)=>{if(candidate.state.location===current.state.location)candidate.position={...current.position};},
  };return policy;
}
