import type {AnimalDef,SpeciesProfile,Slot} from './types';
export const profiles:Record<'cat'|'gull'|'dog',SpeciesProfile>={
 cat:{collision:{w:30,h:18},speed:28,stride:24,retreatDistance:0,landingDistance:0,flightSpeed:0,flightHeight:0,wingHz:0,cooldown:0,followStop:0,followMax:0},
 gull:{collision:{w:12,h:6},speed:18,stride:16,retreatDistance:64,landingDistance:92,flightSpeed:92,flightHeight:20,wingHz:4,cooldown:3,followStop:0,followMax:0},
 // Algorithm fixture only: no dog art, game individual or approved new production.
 dog:{collision:{w:22,h:10},speed:36,stride:28,retreatDistance:0,landingDistance:0,flightSpeed:0,flightHeight:0,wingHz:0,cooldown:0,followStop:44,followMax:96},
};
const slot=(scene:string,x:number,y:number,w:number,h:number,activity:Slot['activity']='wander'):Slot=>({scene,region:{x,y,w,h},activity,points:[{x:x+16,y:y+16},{x:x+w-16,y:y+16},{x:x+w-16,y:y+h-16},{x:x+16,y:y+h-16}]});
export const animals:AnimalDef[]=[
 {id:'harbor-cat-1',species:'cat',visualVersion:'domestic-cat-v1',schedule:{morning:slot('station',740,620,110,100,'sun-rest'),afternoon:slot('station',740,620,110,100),evening:slot('market',550,750,100,90),night:slot('courtyard',550,465,110,85,'sleep')}},
 {id:'harbor-cat-2',species:'cat',visualVersion:'domestic-cat-v1',schedule:{morning:slot('courtyard',550,465,110,85,'sun-rest'),afternoon:slot('market',550,750,100,90),evening:slot('station',740,620,110,100),night:slot('courtyard',550,465,110,85,'sleep')}},
 {id:'harbor-cat-3',species:'cat',visualVersion:'domestic-cat-v1',schedule:{morning:slot('market',550,750,100,90),afternoon:slot('courtyard',550,465,110,85,'sun-rest'),evening:slot('market',700,740,100,100),night:slot('courtyard',550,465,110,85,'sleep')}},
 ...[1,2,3,4].map((n):AnimalDef=>({id:'harbor-gull-'+n,species:'gull',visualVersion:'coastal-gull-v1',schedule:{morning:slot(n<=2?'coast':'beach',n<=2?610:510,n<=2?610:380,n<=2?280:220,n<=2?175:190),afternoon:slot(n<=2?'beach':'dock',n<=2?510:335,n<=2?380:400,n<=2?220:290,n<=2?190:180),evening:slot('coast',610,610,280,175)}})),
];
