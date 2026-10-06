import family from './art.json';
import {animals} from './config';
import {animalReviewAccepted, type AnimalArt} from './render-contract';
import {animalSheet} from './rpgjs-sheet';

// Fixed game-consumer candidate. Producer review and unresolved library gates
// remain in doc/qa/animals-integration-20261006. No library admission is implied.
export const animalArts = family as unknown as Record<string, AnimalArt>;
export const acceptedAnimals = animals.filter(def => {
 const art = animalArts[def.visualVersion];
 if (!art || art.species !== def.species || !animalReviewAccepted(art.review)) return false;
 animalSheet(art); // Require complete four-direction families before enabling actions.
 return true;
});
export const animalSheets = [...new Set(acceptedAnimals.map(def => def.visualVersion))]
 .map(version => animalSheet(animalArts[version]));
