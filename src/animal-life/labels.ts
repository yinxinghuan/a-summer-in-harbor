import type {Words} from '../world/data';
import type {Observation} from './types';
export const behaviorLabels:Record<Observation,Words>={'sun-rest':['晒太阳','sunning'],'sleep':['睡眠','sleeping'],'shore-space':['留出空间','leaving room']};
export function observationLabel(animal:string,behavior:Observation):Words{
 const m=/^harbor-(cat|gull)-(\d+)$/.exec(animal),n=m?.[2]??'?';
 const name:Words=animal==='harbor-shore-crab-1'?['岸边的蟹','Shore crab']:animal==='harbor-cat-1'?['车站猫','Station cat']:m?.[1]==='cat'?[`猫${n}`,`Cat ${n}`]:[`海鸥${n}`,`Gull ${n}`];
 return [name[0]+' · '+behaviorLabels[behavior][0],name[1]+' · '+behaviorLabels[behavior][1]];
}
export function observationRecordLabel(id:string):Words|undefined{
 const m=/^observe:(harbor-(?:(?:cat|gull)-\d+|shore-crab-1)):(sun-rest|sleep|shore-space)$/.exec(id);return m?observationLabel(m[1],m[2] as Observation):undefined;
}
