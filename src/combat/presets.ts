import type {EncounterConfig,Attack} from './core';
const punch:Attack={windup:7,active:6,recovery:17,reach:34,damage:1,arc:Math.PI*.7};
const base:EncounterConfig={id:'harbor-sparring',version:1,width:320,height:340,obstacles:[],player:{id:'player',position:{x:160,y:270},radius:10,health:5,speed:110,attack:punch},enemies:[{id:'coach',position:{x:160,y:100},radius:11,health:4,speed:60,attack:{...punch,windup:39,recovery:40,reach:37},thinkDelay:28}],objective:{kind:'defeat'},maxTicks:7200,dodge:{duration:13,cooldown:48,speed:220,invulnerableStart:1,invulnerableEnd:11}};
export const sparring=base;
export const footwork:EncounterConfig={...structuredClone(base),id:'harbor-footwork',enemies:[{...base.enemies[0],id:'coach-toss',speed:0,health:100,attack:{...punch,windup:50,active:1,recovery:52,projectileSpeed:150}}],obstacles:[{x:65,y:154,w:62,h:22},{x:205,y:154,w:48,h:22}],objective:{kind:'reach',zone:{x:130,y:12,w:60,h:30}}};
export const endurance:EncounterConfig={...structuredClone(base),id:'harbor-endurance',objective:{kind:'survive',ticks:1200},enemies:[{...base.enemies[0],health:100}]};
export const encounterPresets:Record<string,EncounterConfig>={sparring,footwork,endurance};
