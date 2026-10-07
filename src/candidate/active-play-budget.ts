/** Foreground eligibility is client-reported; it can only reduce server elapsed.
 * Monotonic accounting is independent of rendering FPS and has no input timeout. */
export function createActivePlayBudget(at:number,active=false){
 let cursor=at,enabled=active,bank=0;
 const advance=(next:number)=>{const elapsed=next-cursor;cursor=next;if(!Number.isFinite(elapsed)||elapsed<0||elapsed>3000){bank=0;return}if(enabled)bank=Math.min(3000,bank+elapsed)};
 return {set(active:boolean,at:number){advance(at);enabled=active},take(at:number){advance(at);const whole=Math.floor(bank);bank-=whole;return whole},reset(at:number,active:boolean){cursor=at;bank=0;enabled=active}};
}
