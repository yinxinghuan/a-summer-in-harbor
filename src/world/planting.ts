import type {Room} from './data';

/** Planting follows habitat and existing activity pockets, never random scatter.
 * Short foliage is walk-through; woody trees and containers have ground contacts.
 */
export function enrichPlanting(rooms:Record<string,Room>){
 const add=(scene:string,art:string,x:number,y:number,width:number,fw=0,fh=0)=>{
  rooms[scene].props.push({id:`flora-${rooms[scene].props.length}`,art:`flora-${art}-v1`,at:{x,y},width,...(art==='clover'?{floorDecoration:true}:{}),...(fw?{footprint:{x:x-fw/2,y:y-fh,w:fw,h:fh}}:{})});
 };
 const change=(scene:string,id:string,art:string,width:number,fw:number,fh:number)=>{
  const p=rooms[scene].props.find(p=>p.id===id)!;p.art=`flora-${art}-v1`;p.width=width;p.footprint={x:p.at.x-fw/2,y:p.at.y-fh,w:fw,h:fh};
 };
 // Streets: a varied canopy and low growth behind the waiting / shopping spaces.
 change('station','tree-west','maple',158,21,14);
 const streetTree=rooms.station.props.find(p=>p.id==='tree-west')!;streetTree.at={x:105,y:685};streetTree.footprint={x:94.5,y:671,w:21,h:14};
 for(const [x,y,w] of [[280,849,37],[383,868,42],[1020,748,38]])add('station','clover',x,y,w);
 add('station','rose',267,793,49);add('station','fern',367,866,34);add('station','rose',1190,890,43);
 change('market','landscape-3','maple',151,22,14);
 add('market','rose',752,951,52);add('market','fern',859,876,34);add('market','clover',795,950,48);add('market','clover',889,926,44);
 add('market','rose',1100,786,45);
 // Salt-tolerant low planting on landward margins, no lush forest in the surf.
 add('harbor','pot-rubber',1102,380,29,16,12);add('harbor','herbs',1020,548,31,25,12);
 add('dock','herbs',632,329,33,27,12);
 add('coast','rose',858,839,50);add('coast','clover',804,858,42);add('coast','fern',348,386,33);
 add('coast','rose',963,386,43);add('coast','clover',965,410,35);
 add('beach','rose',273,305,45);add('beach','clover',256,331,28);
 // Hillside: spaced tall silhouettes with fern understory and small clearings.
 change('hill','landscape-1','cedar',64,18,12);
 add('hill','maple',954,710,132,20,13);add('hill','fern',1090,805,38);add('hill','fern',412,477,39);
 add('hill','clover',467,493,49);add('hill','clover',946,838,43);add('hill','rose',1127,370,49);
 change('camp','shade-west','cedar',61,18,12);
 add('camp','fern',178,389,34);add('camp','fern',767,568,37);add('camp','clover',744,598,46);add('camp','clover',228,403,39);
 add('camp','cedar',159,619,54,16,11);
 // Residential gardening grows around the courtyard, not across its seating.
 add('courtyard','rose',736,576,47);add('courtyard','fern',221,402,37);add('courtyard','clover',208,435,43);add('courtyard','herbs',632,294,35,29,12);
 add('garden','rose',742,646,47);add('garden','clover',796,655,42);add('garden','fern',182,390,37);add('garden','herbs',188,580,34,28,12);
 add('garden','maple',852,363,120,18,12);
 add('bazaar','rose',788,667,45);add('bazaar','clover',833,670,36);add('bazaar','fern',171,550,38);add('bazaar','herbs',311,298,31,26,12);
 // Stream banks: reeds rise from the dry edge, low ferns below the trees.
 add('path','reeds',545,254,32);add('path','reeds',413,252,27);add('path','fern',225,644,37);add('path','clover',249,664,43);
 // Interior foliage varies by care and use, without moving approved furniture.
 change('home','fern','pot-rubber',30,16,12);
 change('cafe','fern','pot-rubber',32,17,12);
 add('grocery','herbs',590,528,29,24,11);
 add('workshop','pot-rubber',646,299,27,14,10);
 change('gym','fern','pot-rubber',30,16,12);
 add('secondhand','pot-rubber',643,515,29,16,12);
 add('weather','herbs',604,511,29,24,11);
 add('lighthouse','pot-rubber',329,310,28,15,11);
 change('workshop-annex-1','green','pot-rubber',29,16,11);
 change('workshop-annex-2','green','herbs',32,26,12);
}
