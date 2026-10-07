import type {AnimalSample,AnimalNotebook} from './types';

type SampleHead={version:number;scene:string;townMinutes?:number;position:{x:number;y:number};animalNotebookV1?:AnimalNotebook};
/** Checkpoints may retain an old sample. Reading it never renews its proof. */
export function currentAnimalSample(head:SampleHead,sample=head.animalNotebookV1?.sample,player=head.position):AnimalSample|undefined{
 return sample&&sample.version===head.version&&sample.scene===head.scene&&sample.minute===(head.townMinutes??540)&&Math.hypot(player.x-sample.player.x,player.y-sample.player.y)<=2?sample:undefined;
}
