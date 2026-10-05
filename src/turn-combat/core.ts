/** Pure deterministic one-on-one rules: no world, identity, money or clock. */
export type Move='strike'|'guard'|'recover'|'supply';
export type Intent={id:'heavy'|'light'|'rest';damage:number};
export type Config={id:string;version:1;playerMax:number;opponentMax:number;strike:number;counter:number;recover:number;supply:number;maxRounds:number;intents:Intent[]};
export type Turn={round:number;move:Move;intent:Intent['id'];dealt:number;taken:number;healed:number};
export type Bout={schema:1;configId:string;configVersion:1;round:number;player:number;opponent:number;counter:boolean;supplyUsed:number;outcome:'playing'|'won'|'lost'|'limit';log:Turn[]};
export function startBout(c:Config):Bout{return {schema:1,configId:c.id,configVersion:1,round:0,player:c.playerMax,opponent:c.opponentMax,counter:false,supplyUsed:0,outcome:'playing',log:[]}}
export function intent(c:Config,b:Bout){return c.intents[b.round%c.intents.length]}
export function validBout(c:Config,b:Bout){return !!b&&b.schema===1&&b.configId===c.id&&b.configVersion===c.version&&Number.isInteger(b.round)&&b.round>=0&&b.round<=c.maxRounds&&Number.isInteger(b.player)&&b.player>=0&&b.player<=c.playerMax&&Number.isInteger(b.opponent)&&b.opponent>=0&&b.opponent<=c.opponentMax&&typeof b.counter==='boolean'&&[0,1].includes(b.supplyUsed)&&['playing','won','lost','limit'].includes(b.outcome)&&Array.isArray(b.log)&&b.log.length===b.round&&b.log.every((t,i)=>t.round===i+1&&['strike','guard','recover','supply'].includes(t.move)&&t.intent===c.intents[i%c.intents.length].id&&[t.dealt,t.taken,t.healed].every(n=>Number.isInteger(n)&&n>=0&&n<=100))&&(b.outcome==='playing'?b.player>0&&b.opponent>0&&b.round<c.maxRounds:b.outcome==='won'?b.opponent===0:b.outcome==='lost'?b.player===0:b.round===c.maxRounds)}
export function resolveTurn(c:Config,b:Bout,move:Move):Bout{
 if(!validBout(c,b))throw Error('UNSUPPORTED_BATTLE');if(b.outcome!=='playing')throw Error('BATTLE_FINISHED');
 if(!['strike','guard','recover','supply'].includes(move))throw Error('INVALID_BATTLE_MOVE');if(move==='supply'&&b.supplyUsed)throw Error('SUPPLY_ALREADY_USED');
 const n=structuredClone(b),forecast=intent(c,b);let dealt=0,taken=0,healed=0;
 if(move==='strike'){dealt=Math.min(n.opponent,c.strike+(n.counter?c.counter:0));n.opponent-=dealt}
 if(move==='recover'||move==='supply'){healed=Math.min(c.playerMax-n.player,move==='supply'?c.supply:c.recover);n.player+=healed}
 n.counter=move==='guard';if(move==='supply')n.supplyUsed++;
 if(n.opponent>0){taken=Math.min(n.player,move==='guard'?Math.ceil(forecast.damage/4):forecast.damage);n.player-=taken}
 n.round++;n.outcome=n.opponent===0?'won':n.player===0?'lost':n.round===c.maxRounds?'limit':'playing';n.log.push({round:n.round,move,intent:forecast.id,dealt,taken,healed});return n;
}
