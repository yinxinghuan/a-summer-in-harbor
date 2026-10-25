import{fishCatchArt}from'./fish-catch-art';
import{fishCatalog,type SpeciesId}from'../challenges/fishing-catalog';
import{tx,type Locale}from'../world/data';
/** Mount only after the authoritative pending result says caught. This component never awards or consumes goods. */
export function CatchReveal({species,locale,first,restored}:{species?:SpeciesId;locale:Locale;first?:boolean;restored:boolean}){
 const name=species?fishCatalog[species].name:['鲜鱼','Fresh fish']as const;
 return <div className="harbor-catch-reveal" data-catch-reveal data-catch-species={species??'legacy-fresh-fish'} data-catch-restored={restored} role="status">
  {species&&<img src={fishCatchArt[species]} alt={tx(name,locale)} width="112" height="80"/>}
  <div><small>{tx(restored?['待领取鱼获','Saved catch']:['钓到了！','You caught one!'],locale)}</small><strong>{tx(name,locale)}</strong>{first&&<span>{tx(['首次发现','First discovery'],locale)}</span>}</div>
 </div>;
}
