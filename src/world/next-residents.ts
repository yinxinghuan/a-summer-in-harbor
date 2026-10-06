import source from '../story/next-residents.json';import type {Words} from './data';
export type NextResident={activity:Words;id:string;name:Words;role:Words;unknown:Words;intro:Words;art:string;mapArt?:string;avatarArt?:string;artPlan:string;artStatus:string;partner:string;partnerName:Words;routes:{scene:string;at:{x:number;y:number}}[];title:Words;question:Words;request:Words;partnerQuestion:Words;partnerReply:Words;choices:{id:string;label:Words;reply:Words}[];recall:Words};
// All six independently admitted families are playable. Existing save facts need no migration.
export const nextResidents=source as NextResident[];
export const nextPeople=Object.fromEntries(nextResidents.map(p=>[p.id,{name:p.name,unknown:p.unknown,intro:p.intro,art:p.art,...(p.mapArt?{mapArt:p.mapArt}:{}),...(p.avatarArt?{avatarArt:p.avatarArt}:{})}]));
export const nextRoutes=Object.fromEntries(nextResidents.map(p=>[p.id,p.routes]));
export const nextRoles=Object.fromEntries(nextResidents.map(p=>[p.id,p.role]));
