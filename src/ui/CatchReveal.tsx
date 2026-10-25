import{fishCatchArt}from'./fish-catch-art';
import{fishCatalog,type SpeciesId}from'../challenges/fishing-catalog';
import{tx,type Locale,type Words}from'../world/data';
/** Mount only after the authoritative pending result says caught. This component never awards or consumes goods. */
export function CatchReveal({species,locale,first,restored}:{species?:SpeciesId;locale:Locale;first?:boolean;restored:boolean}){
 const name:Words=species?[fishCatalog[species].name[0],fishCatalog[species].name[1]]:['鲜鱼','Fresh fish'];
 return <div className="harbor-catch-reveal" data-catch-reveal data-catch-species={species??'legacy-fresh-fish'} data-catch-restored={restored} role="status">
  {species?<img src={fishCatchArt[species]} alt={tx(name,locale)} width="112" height="80"/>:<svg data-catch-generic viewBox="-14 -9 26 18" width="112" height="80" role="img" aria-label={tx(['通用鲜鱼图示，并非具体鱼种','Generic fresh-fish icon, not a species illustration'],locale)}><path d="M -7 0 Q 0 -6 6 0 Q 0 6 -7 0 L -11 -4 V 4 Z"/></svg>}
  <div><small>{tx(restored?['待领取鱼获','Saved catch']:['钓到了！','You caught one!'],locale)}</small><strong>{tx(name,locale)}</strong>{!species&&<span>{tx(['通用鱼获 · 不登记物种','Generic catch · no species entry'],locale)}</span>}{first&&<span>{tx(['首次发现','First discovery'],locale)}</span>}</div>
 </div>;
}
