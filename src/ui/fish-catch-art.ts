import type{SpeciesId}from'../challenges/fishing-catalog';
/** Species-exact PNGs, pinned to completed library admission 2026-10-23. No generic/species substitution. */
export const fishCatchArt={
 'bay-silverside':new URL('./fishing-art/fish-bay-silverside.png',import.meta.url).href,
 'night-mullet':new URL('./fishing-art/fish-night-mullet.png',import.meta.url).href,
 'harbor-goby':new URL('./fishing-art/fish-harbor-goby.png',import.meta.url).href,
 'sand-flounder':new URL('./fishing-art/fish-sand-flounder.png',import.meta.url).href,
 'coastal-bass':new URL('./fishing-art/fish-coastal-bass.png',import.meta.url).href,
 'striped-mackerel':new URL('./fishing-art/fish-striped-mackerel.png',import.meta.url).href,
 'silver-herring':new URL('./fishing-art/fish-silver-herring.png',import.meta.url).href,
 'shore-bream':new URL('./fishing-art/fish-shore-bream.png',import.meta.url).href,
 'stream-minnow':new URL('./fishing-art/fish-stream-minnow.png',import.meta.url).href,
 'river-perch':new URL('./fishing-art/fish-river-perch.png',import.meta.url).href,
 'brown-trout':new URL('./fishing-art/fish-brown-trout.png',import.meta.url).href,
 'river-chub':new URL('./fishing-art/fish-river-chub.png',import.meta.url).href,
}as const satisfies Record<SpeciesId,string>;
