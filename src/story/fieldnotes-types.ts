import type {Words} from '../world/data';
export type FieldRoom={id:string;title:Words;detail:Words;observations:{id:string;label:Words;text:Words;read:boolean}[]};
export type FieldNotes={artifact:string;depth:number;rooms:FieldRoom[];state:any};
