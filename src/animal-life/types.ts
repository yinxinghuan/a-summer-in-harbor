import type {LifeSave} from '../life/types';
import type {Words} from '../world/data';
import type {AnimalState} from '../animals/types';
import type {Point} from '../engine/world';

export type Observation='sun-rest'|'sleep'|'shore-space';
export type AnimalRef={id:string;revision:number;hash:string;capability:'animal-notebook-v1'};
export type AnimalCommission={schema:1;id:string;revision:number;capability:'animal-notebook-v1';resident:'mara'|'ruth'|'owen'|'dani';title:Words;brief:Words;page:Words;requirements:{animal:string;behavior:Observation}[]};
export type AnimalSample={sourceAction:string;version:number;scene:string;minute:number;player:Point;behavior:Observation;frame:AnimalState};
export type AnimalNotebook={schema:1;adopted?:{definition:AnimalCommission;ref:AnimalRef;artifactHash:string}[];sample?:AnimalSample;briefs:AnimalRef[];active?:{ref:AnimalRef;sourceAction:string;minute:number};pages:{ref:AnimalRef;sourceAction:string;minute:number}[]};
export type AnimalLifeSave=LifeSave&{animalNotebookV1?:AnimalNotebook};
export type AnimalCommand={verb:'sample'}|{verb:'record'}|{verb:'brief'|'accept'|'share'|'cancel';ref:AnimalRef};
export const observationId=(animal:string,behavior:Observation)=>'observe:'+animal+':'+behavior;
