import type {LifeHost} from './life-runtime';

/** Inventory actions concern only this authority-owned journey's bag. They have
 * no physical entity, resident, plot, animation or news proof. Explicit domain
 * bindings are separate from unfinished spatial bindings. */
export const lifeBagTarget='life-bag';
export const inventoryLifeActions=Object.freeze(['life:save-seed','life:close-order'] as const);
export function createInventoryLifeHost():LifeHost{
 return {admit:(s,a,c)=>{
  if(a.scene!==s.scene)throw Error('SCENE_MISMATCH');
  if(a.target!==lifeBagTarget||!inventoryLifeActions.includes(a.action as any)||a.action!=='life:'+c.verb)throw Error('LIFE_INVENTORY_NOT_ADMITTED');
  if(c.verb!=='save-seed'&&c.verb!=='close-order')throw Error('LIFE_INVENTORY_NOT_ADMITTED');
  // Position, version, challenge locks, exact refs and item/expiry checks are
  // enforced by createLifeRuntime + original authority + applyLife, never by
  // client-supplied proof. All spatial verbs remain denied by this host.
  return {scene:s.scene,target:lifeBagTarget};
 }};
}
