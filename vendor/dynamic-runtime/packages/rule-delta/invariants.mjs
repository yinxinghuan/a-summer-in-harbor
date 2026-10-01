import {canonical,applyForTest} from '../rule-compiler/index.mjs';
// Bounded deterministic-seed exploration, never a proof of universal safety.
// It is additive evidence; game-specific protected paths remain mandatory.
export async function probeInvariants({prepared,sourceState,profile,runProlog,seeds=8,steps=12}){
  if(!Number.isInteger(seeds)||seeds<1||seeds>32||!Number.isInteger(steps)||steps<1||steps>64)throw Error('PROBE_BUDGET_INVALID');
  const rules=prepared.definition.rules,location=prepared.content.locations.at(-1);
  const toDomain=e=>e.type==='map'?{type:'map',nodeId:e.node_id}:e.type==='inventory'?{type:'inventory',action:e.action,itemId:e.item_id,count:e.count}:e.type==='fact_add'?{type:'fact-add',id:e.id,delta:e.delta}:e.type==='party'?{type:'party',change:e.change,characterId:e.character_id}:e;
  let transitions=0,exits=0;
  for(let seed=1;seed<=seeds;seed++){
    let rng=seed,state=structuredClone(sourceState);const seen=new Map();
    for(let n=0;n<steps;n++){
      const results=await runProlog(prepared.compiled,rules.actions.map(a=>({action_id:a.id,state})));
      if(results.length!==rules.actions.length||results.some(r=>typeof r?.accepted!=='boolean'||!Array.isArray(r.effects)||(!r.accepted&&r.effects.length)))throw Error('RULE_OUTPUT_INVALID');
      const enabled=results.map((r,i)=>r.accepted?i:-1).filter(i=>i>=0);if(!enabled.length)break;
      // Force a visit before random choice, so short seeds exercise new content.
      rng=(Math.imul(rng,1664525)+1013904223)>>>0;
      const entry=rules.actions.findIndex(a=>a.id===prepared.entry_action_id);
      const index=n===0&&results[entry]?.accepted?entry:enabled[rng%enabled.length],a=rules.actions[index];
      const next=applyForTest(rules,state,results[index].effects.map(toDomain));transitions++;
      if(state.facts[profile.completion.fact]!==next.facts[profile.completion.fact]&&a.id!==profile.completion.action)throw Error('INVARIANT_TERMINAL_BYPASS');
      for(const s of rules.stats)if(!Number.isSafeInteger(next.stats[s.id])||next.stats[s.id]<s.min||next.stats[s.id]>s.max)throw Error('INVARIANT_STAT_BOUND');
      if(a.id.startsWith('sys-dyn-')===false&&a.when?.op==='all'&&a.when.rules.some(r=>r.op==='map-is'&&r.nodeId===location.id)){
        if(seen.has(a.id))throw Error('INVARIANT_REPEAT_ACTION');seen.set(a.id,true);
      }
      if(next.location===location.id){
        const exhausted=structuredClone(next);exhausted.inventory=[];for(const s of rules.stats)exhausted.stats[s.id]=s.min;
        const [escape]=await runProlog(prepared.compiled,[{action_id:prepared.escape_action_id,state:exhausted}]);
        if(canonical(escape)!==canonical({accepted:true,effects:[{type:'map',node_id:location.parent_id}]}))throw Error('INVARIANT_ESCAPE');exits++;
      }
      state=next;
    }
  }
  return{kind:'bounded-invariant-probes',seeds,steps,transitions,escapeChecks:exits,universalProof:false,oldStreetProtectedPathValidated:false,modelCalls:0};
}
