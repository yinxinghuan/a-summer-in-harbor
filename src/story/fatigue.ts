import type {Words} from '../world/data';
type S={awakeMinutes?:number;energy:number};
/** Only committed active game minutes, never real time. Integer boundaries make partitioning deterministic. */
export function advanceAwake(s:S,minutes:number){const before=s.awakeMinutes??0,after=before+minutes;const drain=(m:number)=>Math.floor(Math.max(0,m-600)/60)*5;s.energy=Math.max(0,s.energy-drain(after)+drain(before));s.awakeMinutes=after}
export function fatigueLabel(s:S):Words{return (s.awakeMinutes??0)>=960?['今天醒着很久了。随时可以回租屋免费休息，行走和交谈不受限。','It has been a long day. Rest for free in Your Room; walking and conversation remain available.']:(s.awakeMinutes??0)>=600?['开始有些疲倦。继续忙碌会慢慢消耗精力，回家小睡能恢复。','A little tired. Staying busy now slowly uses energy; a nap at home helps.']:['精神尚好。每次休息都可以恢复精力。','Feeling rested. Rest restores energy.']}
