import {validateCompositeBudgets} from '../rule-composer/index.mjs';
import {canonical,sha256} from '../rule-compiler/index.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)&&v.length<=48&&!['constructor','prototype'].includes(v);
const fail=()=>{throw Object.assign(Error('COMPOSITE_PROFILE_INVALID'),{code:'COMPOSITE_PROFILE_INVALID'});};

/** Separate static-composition profile, NOT a delta permission upgrade or a production authorization.
 * platformPolicy must come from an operator-owned configuration, not model output. */
export function validateCompositeProfile(input,platformPolicy){
  if(!exact(input,['format','id','gameId','budgets'])||input.format!=='alteru-composite-profile-v1'||!id(input.id)||!id(input.gameId))fail();
  if(!exact(platformPolicy,['format','id','revision','budgets'])||platformPolicy.format!=='alteru-composite-platform-policy-v1'||!id(platformPolicy.id)||!Number.isSafeInteger(platformPolicy.revision)||platformPolicy.revision<1)fail();
  validateCompositeBudgets(input.budgets,platformPolicy.budgets);
  const profile=structuredClone(input),policy=structuredClone(platformPolicy);
  return {profile,policy,profileHash:sha256(canonical(profile)),platformPolicyHash:sha256(canonical(policy))};
}
