import {validateProfile} from '../game-profile/index.mjs';
import {isDeepStrictEqual} from 'node:util';
import {canonical,sha256,compile,applyForTest} from '../rule-compiler/index.mjs';

const fail=(code)=>{throw Object.assign(new Error(code),{code,status:422});};
const fromWire=e=>e.type==='map'?{type:'map',nodeId:e.node_id}
  :e.type==='inventory'?{type:'inventory',action:e.action,itemId:e.item_id,count:e.count}
  :e.type==='fact_add'?{type:'fact-add',id:e.id,delta:e.delta}
  :e.type==='party'?{type:'party',change:e.change,characterId:e.character_id}
  :e.type==='clock_add'?{type:'clock-add',minutes:e.minutes}:e;

/** Offline evidence builder, never a state writer or activation API.
 * Paths are explicit server/test-owned witnesses, not accepted from a model as
 * proof. An incomplete path, exception, unavailable engine or timeout fails.
 */
export async function verifyRuleDelta({prepared,sourceState,runProlog,remainingPath,dynamicPath,profile}) {
  profile=validateProfile(profile,prepared?.definition?.rules);
  const {definition,compiled,content,descriptor,lineage}=prepared;
  if(prepared.status!=='prepared-unverified' || descriptor.profile_hash!==sha256(canonical(profile)) || descriptor.profile!==profile.id || sha256(canonical(descriptor))!==prepared.artifact_hash
    || sha256(canonical(content))!==descriptor.content_hash
    || sha256(canonical(lineage))!==descriptor.lineage_hash
    || sha256(canonical(compiled))!==descriptor.rules_artifact_hash
    || !isDeepStrictEqual(await compile(definition.rules),compiled)) fail('DELTA_ARTIFACT_MISMATCH');
  for(const path of [remainingPath,dynamicPath])if(!Array.isArray(path)||!path.length||path.length>128
    || path.some(id=>typeof id!=='string'||!definition.rules.actions.some(a=>a.id===id))) fail('DELTA_WITNESS_INVALID');
  const rules=definition.rules;
  // Reject malformed test snapshots instead of filling missing authority state.
  if(!sourceState || !rules.locations.some(n=>n.id===sourceState.location)
    || !['calm','warning','confrontation'].includes(sourceState.danger_phase)
    || !sourceState.stats || Object.keys(sourceState.stats).length!==3
    || rules.stats.some(s=>!Number.isSafeInteger(sourceState.stats[s.id])||sourceState.stats[s.id]<s.min||sourceState.stats[s.id]>s.max)
    || !sourceState.facts || rules.facts.some(f=>!Object.hasOwn(sourceState.facts,f.id)||typeof sourceState.facts[f.id]!==typeof f.initial)
    || !Array.isArray(sourceState.inventory) || !Array.isArray(sourceState.characters)
    || new Set(sourceState.inventory.map(i=>i.id)).size!==sourceState.inventory.length
    || sourceState.inventory.some(i=>!rules.items.some(d=>d.id===i.id)||!Number.isSafeInteger(i.count)||i.count<1||i.count>999)
    || new Set(sourceState.characters.map(c=>c.id)).size!==sourceState.characters.length
    || sourceState.characters.some(c=>!rules.characters.some(d=>d.id===c.id)||!['known','companion','departed'].includes(c.status))) fail('DELTA_STATE_INVALID');
  if(sourceState.facts[profile.completion.fact]!==false)fail('DELTA_CHECKPOINT_COMPLETE');
  const cases=JSON.parse(compiled['witness.json']).cases;
  const baseline=await runProlog(compiled,cases.map(c=>({action_id:c.actionId,state:c.state})));
  if(!isDeepStrictEqual(baseline,cases.map(c=>({accepted:c.accepted,effects:c.effects}))))fail('DELTA_BASELINE_FAILED');
  const step=async(state,id)=>{
    const result=await runProlog(compiled,[{action_id:id,state}]);
    if(!Array.isArray(result)||result.length!==1||typeof result[0]?.accepted!=='boolean'||!Array.isArray(result[0].effects))fail('RULE_OUTPUT_INVALID');
    return result[0];
  };
  async function replay(path) {
    let state=structuredClone(sourceState);const trace=[];
    for(const id of path){
      const result=await step(state,id);
      if(!result.accepted)fail('DELTA_PATH_BLOCKED');
      state=applyForTest(rules,state,result.effects.map(fromWire));
      trace.push({action_id:id,effects:result.effects});
      if(state.facts[profile.completion.fact]===true && id!==profile.completion.action)fail('DELTA_COMPLETION_BYPASS');
    }
    if(path.at(-1)!==profile.completion.action||state.facts[profile.completion.fact]!==true)fail('DELTA_PATH_INCOMPLETE');
    return {trace,final_state:state};
  }
  const remaining=await replay(remainingPath),dynamic=await replay(dynamicPath);
  const proposed=rules.actions.filter(a=>!a.id.startsWith('sys-dyn-')&&a.when.op==='all'
    && a.when.rules.some(r=>r.op==='map-is'&&r.nodeId===content.locations.at(-1).id));
  if(!dynamicPath.includes(prepared.entry_action_id)||!dynamicPath.includes(prepared.escape_action_id)
    || proposed.some(a=>!dynamicPath.includes(a.id))) fail('DELTA_NEW_ACTIONS_UNTESTED');
  const entry=await step(sourceState,prepared.entry_action_id);
  if(!entry.accepted)fail('DELTA_ENTRY_BLOCKED');
  let inside=applyForTest(rules,sourceState,entry.effects.map(fromWire));
  let repeatProbes=0,exitProbes=0;
  // Execute the actual inside sequence, then retry after it finishes: a later
  // action must not reset an earlier one's one-shot marker.
  const localSequence=dynamicPath.slice(dynamicPath.indexOf(prepared.entry_action_id)+1,dynamicPath.indexOf(prepared.escape_action_id));
  for(const id of localSequence){const result=await step(inside,id);if(!result.accepted)fail('DELTA_PATH_BLOCKED');inside=applyForTest(rules,inside,result.effects.map(fromWire));}
  for(const action of proposed){const result=await step(inside,action.id);if(result.accepted||result.effects.length)fail('DELTA_REPEAT_REWARD');repeatProbes++;}
  for(const phase of ['calm','warning','confrontation']){
    const exhausted=structuredClone(inside);exhausted.inventory=[];exhausted.danger_phase=phase;
    for(const s of rules.stats)exhausted.stats[s.id]=s.min;
    const result=await step(exhausted,prepared.escape_action_id);
    const destination=content.locations.at(-1).parent_id;
    if(!isDeepStrictEqual(result,{accepted:true,effects:[{type:'map',node_id:destination}]}))fail('DELTA_ESCAPE_FAILED');exitProbes++;
  }
  // This is bounded mechanical evidence, not a universal reachability proof,
  // not a signature, and not permission to bypass the later CAS/fork gate.
  return {status:'offline-verified-not-adopted',artifact_hash:prepared.artifact_hash,
    source:structuredClone(descriptor.source),source_state_hash:sha256(canonical(sourceState)),
    baseline_cases:cases.length,remaining,dynamic,repeat_probes:repeatProbes,escape_probes:exitProbes,
    model_calls:0,session_writes:0,activation:false};
}
