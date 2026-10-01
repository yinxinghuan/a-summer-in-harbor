/** Portable single-player action encounter, deterministic 60 Hz. No DOM, art, narrative, clock or network. */
export type V2={x:number;y:number};
export type Box=V2&{w:number;h:number};
export type Attack={windup:number;active:number;recovery:number;reach:number;damage:number;arc:number;projectileSpeed?:number};
export type ActorSpec={id:string;position:V2;radius:number;health:number;speed:number;attack:Attack;thinkDelay?:number};
export type EncounterConfig={id:string;version:number;width:number;height:number;obstacles:Box[];player:ActorSpec;enemies:ActorSpec[];objective:{kind:'defeat'}|{kind:'survive';ticks:number}|{kind:'reach';zone:Box};maxTicks:number;dodge:{duration:number;cooldown:number;speed:number;invulnerableStart:number;invulnerableEnd:number}};
export type Input={x:number;y:number;attack:boolean;defend:boolean};
export type Actor=ActorSpec&{hp:number;facing:V2;phase:'idle'|'windup'|'active'|'recovery'|'hurt'|'down';remaining:number;attackId:number;hitIds:string[];dodgeTicks:number;dodgeCooldown:number;hurtTicks:number;think:number};
export type Projectile={id:string;source:string;position:V2;velocity:V2;radius:number;damage:number;life:number};
export type CombatEvent={tick:number;type:'windup'|'attack'|'hit'|'miss'|'dodge'|'down'|'result';actor:string;target?:string};
export type CombatState={tick:number;player:Actor;enemies:Actor[];projectiles:Projectile[];result:'playing'|'won'|'lost'|'withdrawn';events:CombatEvent[]};
export type InputRun={input:Input;ticks:number};
const clone=<T>(v:T):T=>structuredClone(v);
const length=(a:V2)=>Math.hypot(a.x,a.y);
const unit=(a:V2):V2=>{const l=length(a);return l?{x:a.x/l,y:a.y/l}:{x:0,y:1}};
const vector=(a:V2,b:V2)=>({x:b.x-a.x,y:b.y-a.y});
const distance=(a:V2,b:V2)=>length(vector(a,b));
const inBox=(p:V2,b:Box)=>p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.w&&p.y<=b.y+b.h;
const finite=(v:number)=>Number.isFinite(v);
export function validateEncounter(c:EncounterConfig){
 if(!c.id||!Number.isSafeInteger(c.version)||c.version<1||![c.width,c.height].every(v=>finite(v)&&v>=120&&v<=4096)||!Number.isSafeInteger(c.maxTicks)||c.maxTicks<60||c.maxTicks>18000)throw Error('INVALID_ARENA');
 if(c.obstacles.length>128||c.enemies.length<1||c.enemies.length>8)throw Error('INVALID_ENCOUNTER_SIZE');
 for(const r of c.obstacles)if(![r.x,r.y,r.w,r.h].every(finite)||r.w<=0||r.h<=0||r.x<0||r.y<0||r.x+r.w>c.width||r.y+r.h>c.height)throw Error('INVALID_OBSTACLE');
 const actors=[c.player,...c.enemies];if(new Set(actors.map(a=>a.id)).size!==actors.length)throw Error('DUPLICATE_ACTOR');
 for(const a of actors){
  if(!a.id||!finite(a.speed)||a.speed<0||a.speed>300||!finite(a.radius)||a.radius<4||a.radius>48||!Number.isInteger(a.health)||a.health<1||a.health>100)throw Error('INVALID_ACTOR');
  const t=a.attack;if(![t.windup,t.active,t.recovery].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=600)||!finite(t.reach)||t.reach<4||t.reach>400||!Number.isInteger(t.damage)||t.damage<1||t.damage>25||!finite(t.arc)||t.arc<.1||t.arc>Math.PI*2||(t.projectileSpeed!==undefined&&(!finite(t.projectileSpeed)||t.projectileSpeed<1||t.projectileSpeed>500)))throw Error('INVALID_ATTACK');
  if(!canOccupy(c,a.position,a.radius))throw Error('BLOCKED_SPAWN');
 }
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)if(distance(actors[i].position,actors[j].position)<actors[i].radius+actors[j].radius)throw Error('OVERLAPPING_SPAWN');
 const d=c.dodge;if(![d.duration,d.cooldown,d.invulnerableStart,d.invulnerableEnd].every(v=>Number.isSafeInteger(v)&&v>=0)||d.duration<1||d.duration>120||d.cooldown<d.duration||d.cooldown>600||d.invulnerableStart>d.invulnerableEnd||d.invulnerableEnd>d.duration||!finite(d.speed)||d.speed<1||d.speed>500)throw Error('INVALID_DODGE');
 if(c.objective.kind==='survive'&&(!Number.isSafeInteger(c.objective.ticks)||c.objective.ticks<1||c.objective.ticks>c.maxTicks))throw Error('INVALID_OBJECTIVE');
 if(c.objective.kind==='reach'&&(![c.objective.zone.x,c.objective.zone.y,c.objective.zone.w,c.objective.zone.h].every(finite)||c.objective.zone.w<16||c.objective.zone.h<16||c.objective.zone.x<0||c.objective.zone.y<0||c.objective.zone.x+c.objective.zone.w>c.width||c.objective.zone.y+c.objective.zone.h>c.height))throw Error('INVALID_OBJECTIVE');
 if(!['defeat','survive','reach'].includes(c.objective.kind))throw Error('INVALID_OBJECTIVE');
}
export function canOccupy(c:EncounterConfig,p:V2,r:number){
 if(!finite(p.x)||!finite(p.y)||p.x-r<0||p.y-r<0||p.x+r>c.width||p.y+r>c.height)return false;
 return !c.obstacles.some(b=>{const x=Math.max(b.x,Math.min(p.x,b.x+b.w)),y=Math.max(b.y,Math.min(p.y,b.y+b.h));return Math.hypot(p.x-x,p.y-y)<r});
}
function clearLine(c:EncounterConfig,a:V2,b:V2){const n=Math.ceil(distance(a,b)/2);for(let i=0;i<=n;i++){const t=n?i/n:0,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(c.obstacles.some(r=>inBox(p,r)))return false}return true}
function actor(spec:ActorSpec):Actor{return {...clone(spec),hp:spec.health,facing:{x:0,y:1},phase:'idle',remaining:0,attackId:0,hitIds:[],dodgeTicks:0,dodgeCooldown:0,hurtTicks:0,think:spec.thinkDelay??30}}
export function beginEncounter(config:EncounterConfig):CombatState{validateEncounter(config);const player=actor(config.player),enemies=config.enemies.map(actor);if(enemies[0])player.facing=unit(vector(player.position,enemies[0].position));for(const enemy of enemies)enemy.facing=unit(vector(enemy.position,player.position));return {tick:0,player,enemies,projectiles:[],result:'playing',events:[]}}
export function normalizeInput(i:Input):Input{
 if(!i||!finite(i.x)||!finite(i.y)||Math.abs(i.x)>1||Math.abs(i.y)>1||typeof i.attack!=='boolean'||typeof i.defend!=='boolean')throw Error('INVALID_INPUT');
 const d=Math.max(1,Math.hypot(i.x,i.y));return {x:i.x/d,y:i.y/d,attack:i.attack,defend:i.defend};
}
function move(c:EncounterConfig,a:Actor,v:V2,others:Actor[]){
 const n=Math.max(1,Math.ceil(length(v)/2)),clear=(p:V2)=>canOccupy(c,p,a.radius)&&!others.some(o=>o.hp>0&&distance(p,o.position)<a.radius+o.radius);
 for(let i=0;i<n;i++){const x={x:a.position.x+v.x/n,y:a.position.y};if(clear(x))a.position=x;const y={x:a.position.x,y:a.position.y+v.y/n};if(clear(y))a.position=y;}
}
function emit(s:CombatState,type:CombatEvent['type'],actor:string,target?:string){s.events.push({tick:s.tick,type,actor,...(target?{target}:{})})}
function vulnerable(c:EncounterConfig,a:Actor){const elapsed=c.dodge.duration-a.dodgeTicks;return !a.dodgeTicks||elapsed<c.dodge.invulnerableStart||elapsed>=c.dodge.invulnerableEnd}
function damage(c:EncounterConfig,s:CombatState,from:Actor,to:Actor,amount:number){
 if(to.hp<=0||!vulnerable(c,to))return false;
 to.hp=Math.max(0,to.hp-amount);to.hurtTicks=10;emit(s,'hit',from.id,to.id);
 if(!to.hp){to.phase='down';to.remaining=0;emit(s,'down',to.id)}return true;
}
function startAttack(s:CombatState,a:Actor){a.phase='windup';a.remaining=a.attack.windup;a.attackId++;a.hitIds=[];emit(s,'windup',a.id)}
function attackTick(c:EncounterConfig,s:CombatState,a:Actor,targets:Actor[]){
 if(a.hp<=0||a.phase==='idle'||a.phase==='down')return;
 if(a.phase==='active'&&!a.attack.projectileSpeed){for(const t of targets){
  const v=vector(a.position,t.position),dist=length(v),u=unit(v),dot=u.x*a.facing.x+u.y*a.facing.y;
  if(t.hp>0&&!a.hitIds.includes(t.id)&&dist<=a.attack.reach+t.radius&&dot>=Math.cos(a.attack.arc/2)&&clearLine(c,a.position,t.position)){a.hitIds.push(t.id);damage(c,s,a,t,a.attack.damage)}
 }}
 a.remaining--;if(a.remaining>0)return;
 if(a.phase==='windup'){
  a.phase='active';a.remaining=a.attack.active;emit(s,'attack',a.id);
  if(a.attack.projectileSpeed){s.projectiles.push({id:`${a.id}-${a.attackId}`,source:a.id,position:{...a.position},velocity:{x:a.facing.x*a.attack.projectileSpeed,y:a.facing.y*a.attack.projectileSpeed},radius:4,damage:a.attack.damage,life:180})}
 }else if(a.phase==='active'){if(!a.hitIds.length&&!a.attack.projectileSpeed)emit(s,'miss',a.id);a.phase='recovery';a.remaining=a.attack.recovery}
 else{a.phase='idle';a.think=a.thinkDelay??30}
}
/** Mutates only the encounter state supplied by caller; events are the latest frame, bounded. */
export function stepEncounter(c:EncounterConfig,s:CombatState,raw:Input):CombatState{
 if(s.result!=='playing')return s;
 const input=normalizeInput(raw);s.events=[];s.tick++;const p=s.player,all=[p,...s.enemies];
 for(const a of all){a.hurtTicks=Math.max(0,a.hurtTicks-1);a.dodgeCooldown=Math.max(0,a.dodgeCooldown-1)}
 if(p.hp>0){
  if(p.phase==='idle'&&!p.dodgeTicks){
   if(input.x||input.y)p.facing=unit(input);
   if(input.defend&&!p.dodgeCooldown){p.dodgeTicks=c.dodge.duration;p.dodgeCooldown=c.dodge.cooldown;emit(s,'dodge',p.id)}
   else if(input.attack)startAttack(s,p);
  }
  const v=p.dodgeTicks?p.facing:{x:input.x,y:input.y},speed=p.dodgeTicks?c.dodge.speed:p.phase==='idle'?p.speed:p.speed*.3;
  move(c,p,{x:v.x*speed/60,y:v.y*speed/60},s.enemies);if(p.dodgeTicks)p.dodgeTicks--;
 }
 for(const e of s.enemies){if(e.hp<=0)continue;
  if(e.phase==='idle'){
   const v=vector(e.position,p.position),d=length(v);e.facing=unit(v);e.think=Math.max(0,e.think-1);
   const range=e.attack.projectileSpeed?220:e.attack.reach+p.radius-2;
   if(d>range||!clearLine(c,e.position,p.position))move(c,e,{x:e.facing.x*e.speed/60,y:e.facing.y*e.speed/60},all.filter(a=>a!==e));
   else if(!e.think)startAttack(s,e);
  }
 }
 attackTick(c,s,p,s.enemies);for(const e of s.enemies)attackTick(c,s,e,[p]);
 for(const b of s.projectiles){
  b.life--;const n=Math.max(1,Math.ceil(length(b.velocity)/60/2)),source=all.find(a=>a.id===b.source)!;
  for(let i=0;i<n&&b.life>0;i++){
   b.position.x+=b.velocity.x/60/n;b.position.y+=b.velocity.y/60/n;
   if(!canOccupy(c,b.position,b.radius)){b.life=0;break}
   const targets=b.source===p.id?s.enemies:[p];const hit=targets.find(a=>a.hp>0&&distance(a.position,b.position)<=a.radius+b.radius);
   if(hit){damage(c,s,source,hit,b.damage);b.life=0;}
  }
 }
 s.projectiles=s.projectiles.filter(b=>b.life>0);
 if(p.hp<=0)s.result='lost';else if(c.objective.kind==='defeat'&&s.enemies.every(e=>e.hp<=0)||c.objective.kind==='survive'&&s.tick>=c.objective.ticks||c.objective.kind==='reach'&&inBox(p.position,c.objective.zone))s.result='won';else if(s.tick>=c.maxTicks)s.result='lost';
 if(s.result!=='playing')emit(s,'result',p.id);
 return s;
}
export function replayEncounter(c:EncounterConfig,runs:InputRun[]){
 if(!Array.isArray(runs)||runs.length>c.maxTicks)throw Error('INVALID_RECORDING');const s=beginEncounter(c);let ticks=0;
 for(const r of runs){if(!Number.isSafeInteger(r.ticks)||r.ticks<1||(ticks+=r.ticks)>c.maxTicks)throw Error('INVALID_RECORDING');normalizeInput(r.input);for(let i=0;i<r.ticks;i++){if(s.result!=='playing')throw Error('INPUT_AFTER_RESULT');stepEncounter(c,s,r.input)}}
 return s;
}
export function appendInput(runs:InputRun[],input:Input){const clean=normalizeInput(input),last=runs.at(-1);if(last&&JSON.stringify(last.input)===JSON.stringify(clean))last.ticks++;else runs.push({input:clean,ticks:1})}
export class FixedClock{
 private accumulator=0;
 update(seconds:number,step:()=>void){if(!finite(seconds)||seconds<0)throw Error('INVALID_DELTA');this.accumulator+=Math.min(seconds,.1);let count=0;while(this.accumulator+1e-9>=1/60){this.accumulator-=1/60;step();count++;}return count}
 reset(){this.accumulator=0}
}
