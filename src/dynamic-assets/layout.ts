import slots from './slots.json';
import {worldWithFlags} from '../world/data';
export {slots};
export function dynamicWorld(flags:string[],enabled:boolean){const base=worldWithFlags(flags);if(!enabled)return base;const scenes={...base.scenes};for(const slot of slots){const s=scenes[slot.scene];scenes[slot.scene]={...s,obstacles:[...s.obstacles,...slot.footprints]}}return {...base,scenes}}
