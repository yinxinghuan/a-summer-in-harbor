import {preflightComposite,composeRules} from './index.mjs';
import {validateCompositeProfile} from '../game-profile/composite.mjs';
import {canonical,sha256} from '../rule-compiler/index.mjs';
const base=()=>({format:'alteru-creation-preflight-report-v1',ok:false,stage:'capacity',
  mechanicallyVerified:false,liveModelAcceptance:false,dynamicAdoptionReady:false,productionReady:false});
const fail=code=>{throw Object.assign(Error(code),{code});};
function assemble(draft,gameProfile,platformPolicy){
  const allowed=['format','sourceHash','spatialContract','units','factWriters'];
  if(!draft||typeof draft!=='object'||Array.isArray(draft)||Object.keys(draft).length!==allowed.length||allowed.some(k=>!Object.hasOwn(draft,k))||draft.format!=='alteru-composite-draft-v1')fail('CREATION_DRAFT_SHAPE');
  const settings=validateCompositeProfile(gameProfile,platformPolicy);
  if(!Array.isArray(draft.units)||!draft.units.length||draft.units.some(u=>u?.rules?.gameId!==settings.profile.gameId))fail('CREATION_GAME_MISMATCH');
  const source={...structuredClone(draft),format:'alteru-composite-source-v1',profile:settings.profile.budgets,envelope:settings.policy.budgets,
    policyContext:{profileId:settings.profile.id,profileHash:settings.profileHash,platformPolicyId:settings.policy.id,platformPolicyHash:settings.platformPolicyHash}};
  return {source,settings,requestHash:sha256(canonical({draft,gameProfile:settings.profile,platformPolicy:settings.policy}))};
}
const diagnose=e=>({code:typeof e?.code==='string'?e.code:'CREATION_INPUT_INVALID',
  remedy:typeof e?.remedy==='string'?e.remedy:'检查草案与独立 profile/平台策略的格式及 gameId；不得删掉既有事实或让模型提高平台上限。'});

/** Offline only. Capacity pass is not compilation, reachability, SWI or deployment acceptance. */
export function preflightCreation({draft,gameProfile,platformPolicy}){
  try{
    const {source,settings,requestHash}=assemble(draft,gameProfile,platformPolicy),result=preflightComposite(source);
    if(!result.ok)return {...base(),diagnostic:{code:result.diagnostic.code,remedy:result.diagnostic.remedy}};
    return {...base(),ok:true,gameId:settings.profile.gameId,profileHash:settings.profileHash,platformPolicyHash:settings.platformPolicyHash,requestHash,
      metrics:result.metrics,partitions:result.partitions,unitMapping:result.unitMapping,
      remainingChecks:['compile-and-artifact-budget','swi-witness','game-integration','dynamic-adoption','deployment']};
  }catch(e){return {...base(),diagnostic:diagnose(e)};}
}

/** Enforces the same operator policy in actual compilation, not just a UI hint. */
export async function compileCreation({draft,gameProfile,platformPolicy}){
  const assembled=assemble(draft,gameProfile,platformPolicy);
  const bundle=await composeRules(assembled.source);
  return {format:'alteru-creation-compiled-v1',requestHash:assembled.requestHash,profileHash:assembled.settings.profileHash,
    platformPolicyHash:assembled.settings.platformPolicyHash,bundle,mechanicallyVerified:false,productionReady:false};
}
