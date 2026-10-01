import {canonical,resolve,applyForTest} from '../rule-compiler/index.mjs';
// Witness construction only; every resulting step is independently replayed by SWI.
export function pathTo(rules,start,goal){
  const key=s=>canonical({...s,inventory:[...s.inventory].sort((a,b)=>a.id.localeCompare(b.id))});
  const queue=[{state:start,path:[]}],seen=new Set([key(start)]);
  for(let i=0;i<queue.length&&i<5000;i++){
    const{state,path}=queue[i];if(goal(state))return path;if(path.length>=32)continue;
    for(const a of rules.actions){const r=resolve(rules,state,a.id);if(!r.accepted)continue;const next=applyForTest(rules,state,r.effects),k=key(next);if(!seen.has(k)&&queue.length<5000){seen.add(k);queue.push({state:next,path:[...path,a.id]});}}
  }throw Error('DYNAMIC_WITNESS_NOT_FOUND');
}
export function witnessPaths(prepared,sourceState,profile,parentActionCount,{completionActionIds}={}){
  const rules=prepared.definition.rules,goal=s=>s.facts[profile.completion.fact]===true;
  // Optional server-authored search slice, never a model/browser witness.
  // It changes only search breadth. Preconditions/effects are unchanged and
  // verifyRuleDelta independently replays every resulting step in SWI.
  if(completionActionIds!==undefined&&(!Array.isArray(completionActionIds)||!completionActionIds.length||completionActionIds.length>32||new Set(completionActionIds).size!==completionActionIds.length||completionActionIds.some(id=>!rules.actions.some(a=>a.id===id))))throw Error('DYNAMIC_WITNESS_ACTIONS_INVALID');
  const completionRules=completionActionIds?{...rules,actions:rules.actions.filter(a=>completionActionIds.includes(a.id))}:rules;
  const remainingPath=pathTo(completionRules,sourceState,goal);
  const step=(s,id)=>{const r=resolve(rules,s,id);if(!r.accepted)throw Error('DYNAMIC_ENTRY_BLOCKED');return applyForTest(rules,s,r.effects);};
  let inside=step(sourceState,prepared.entry_action_id);
  const newActions=rules.actions.slice(parentActionCount).filter(a=>!a.id.startsWith('sys-dyn-'));
  const markers=newActions.flatMap(a=>a.effects.filter(e=>e.type==='fact'&&e.id.startsWith('sys-dyn-done-')).map(e=>e.id));
  const local=pathTo({...rules,actions:newActions},inside,s=>markers.every(id=>s.facts[id]===true));
  for(const id of local)inside=step(inside,id);inside=step(inside,prepared.escape_action_id);
  return{remainingPath,dynamicPath:[prepared.entry_action_id,...local,prepared.escape_action_id,...pathTo(completionRules,inside,goal)]};
}
