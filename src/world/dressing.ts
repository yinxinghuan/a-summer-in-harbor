import type {Room} from './data';

/** Place-specific dressing, independently generated sprites on a shared foot scale.
 * Small grass/flowers are walk-through. Solid props block only ground contact.
 * Keep routes, door approaches and conversation space free of decoration.
 */
export function dressHarbor(rooms:Record<string,Room>){
 const put=(scene:string,id:string,art:string,x:number,y:number,width:number,groundW=0,groundH=0)=>{
  rooms[scene].props.push({id:'life-'+id,art,at:{x,y},width,...(groundW&&groundH?{footprint:{x:x-groundW/2,y:y-groundH,w:groundW,h:groundH}}:{})});
 };
 const replace=(scene:string,id:string,art:string,width:number,groundW:number,groundH:number)=>{
  const p=rooms[scene].props.find(p=>p.id===id);if(!p)throw Error(`Missing furnishing ${scene}/${id}`);
  p.art=art;p.width=width;p.footprint={x:p.at.x-groundW/2,y:p.at.y-groundH,w:groundW,h:groundH};
 };
 const remove=(scene:string,...ids:string[])=>{rooms[scene].props=rooms[scene].props.filter(p=>!ids.includes(p.id))};
 const greenery=(scene:string,kind:'sapling'|'broadleaf'|'hydrangea'|'juniper'|'wildflowers'|'beachgrass',points:[number,number,number][])=>{
  for(const [i,[x,y,w]] of points.entries())put(scene,`${kind}-${i}`,`nature-${kind}-v1`,x,y,w,kind==='sapling'?9:kind==='broadleaf'?24:0,kind==='sapling'?8:kind==='broadleaf'?16:0);
 };
 // Domestic warmth, then distinct trades. New furniture replaces generic shelves.
 replace('home','books-and-linen','home-wardrobe-v1',43,37,17);
 put('home','bedside','home-bedside-v1',324,389,24,20,13);
 replace('cafe','pantry','cafe-pastry-v1',84,76,24);
 remove('cafe','outside-bench');
 put('cafe','quiet-chair','wooden-chair',330,485,23,19,17);
 replace('grocery','rest','grocery-produce-v1',77,68,25);
 replace('grocery','storage','grocery-produce-v1',60,52,20);
 replace('secondhand','book-shelf','secondhand-records-v1',82,72,24);
 replace('secondhand','old-coat','secondhand-clothing-v1',57,50,16);
 replace('weather','records','weather-instruments-v1',72,64,23);
 replace('lighthouse','records','lighthouse-lanterns-v1',78,68,24);
 replace('gym','towel-shelf','gym-towels-v1',72,64,21);
 remove('gym','club-coat');
 put('gym','punchbag','gym-punchbag-v1',634,338,23,21,15);
 replace('workshop','spares','workshop-tires-v1',65,57,27);
 remove('workshop','coat');
 put('workshop','repair-bicycle','town-bicycle-v1',637,531,66,60,15);
 replace('workshop-annex-1','desk-b','workshop-tires-v1',75,65,29);
 replace('workshop-annex-2','desk-b','secondhand-records-v1',73,63,24);
 for(const id of ['workshop-annex-1','workshop-annex-2']){
  const seat=rooms[id].props.find(p=>p.id==='seat')!;seat.at.y=494;
  replace(id,'seat','wooden-chair',23,19,17);
 }

 // Direction families: physical ground rectangles change with the object facing.
 replace('home','chair','dining-chair-back-v1',23,19,17);
 replace('cafe','chair-a','dining-chair-side-v1',17,14,21);
 {const p=rooms.cafe.props.find(p=>p.id==='chair-a')!;p.at={x:411,y:462};p.footprint={x:404,y:441,w:14,h:21}}
 replace('cafe','chair-b','dining-chair-back-v1',23,19,17);
 replace('cafe','table-a','dining-table-front-v1',58,52,25);
 rooms.cafe.props.find(p=>p.id==='table-b')!.at.x=615;
 rooms.cafe.props.find(p=>p.id==='chair-b')!.at.x=615;
 replace('cafe','chair-b','dining-chair-back-v1',23,19,17);
 replace('cafe','table-b','dining-table-side-v2',38,34,48);
 replace('home','breakfast','dining-table-front-v1',58,52,25);
 put('home','reading-shelf','interior-bookcase-v1',625,270,51,45,18);
 put('weather','archived-logs','interior-bookcase-v1',320,275,54,47,18);
 put('secondhand','books','interior-bookcase-v1',650,545,55,48,18);
 // Station: an inhabited village green, broad shade trees and garden edges.
 replace('station','tree-west','nature-broadleaf-v1',180,24,16);
 greenery('station','sapling',[[395,375,37],[850,850,40],[1150,635,40]]);
 greenery('station','hydrangea',[[158,389,48],[336,380,43],[935,640,45],[963,912,44]]);
 greenery('station','wildflowers',[[370,693,23],[412,755,25],[875,777,26],[1110,955,24]]);
 put('station','parked-bicycle','town-bicycle-v1',843,368,69,61,16);
 // Harbor: practical working objects at the quay, planting restricted to town edge.
 put('harbor','mooring-west','harbor-bollard-v1',680,565,24,17,13);
 put('harbor','mooring-east','harbor-bollard-v1',1065,565,24,17,13);
 put('harbor','stored-boat','coast-rowboat-v1',380,745,132,114,31);
 put('harbor','repair-cycle','town-bicycle-v1',398,322,66,58,16);
 greenery('harbor','juniper',[[1020,345,48]]);
 // Market: small planted pockets around stalls; the central square remains usable.
 greenery('market','broadleaf',[[805,805,165]]);
 greenery('market','sapling',[[410,815,36],[1150,440,38]]);
 greenery('market','hydrangea',[[145,420,48],[940,390,42],[255,775,45]]);
 greenery('market','wildflowers',[[1060,815,24],[200,835,24]]);
 put('market','market-produce','grocery-produce-v1',365,654,58,50,20);
 put('market','customer-bicycle','town-bicycle-v1',855,706,66,58,16);
 // Windy coast: low salt-tolerant plants and open sand, not inland flowerbeds.
 greenery('coast','juniper',[[330,370,58],[860,580,54],[980,390,47]]);
 greenery('coast','beachgrass',[[370,637,24],[420,692,22],[670,761,27],[860,744,25],[905,829,23]]);
 greenery('coast','sapling',[[760,370,37]]);
 put('coast','pulled-up-boat','coast-rowboat-v1',285,735,136,118,32);
 // Hill: a layered woodland border with clear cross paths and sunny glades.
 greenery('hill','broadleaf',[[438,435,175]]);
 greenery('hill','sapling',[[250,445,38],[1190,380,40],[450,790,36]]);
 greenery('hill','juniper',[[220,350,57],[935,800,53],[1115,800,55]]);
 greenery('hill','wildflowers',[[520,677,23],[790,650,26],[1090,345,25],[175,680,22]]);
 // Low border groups leave a broad route clear while enclosing the clearing.
 greenery('garden','sapling',[[180,615,39],[805,615,38]]);
 greenery('camp','beachgrass',[[205,597,25],[752,642,24]]);
 greenery('courtyard','juniper',[[175,590,54],[805,625,49]]);
 greenery('path','broadleaf',[[175,615,165]]);
 // Destinations each have their own activity vignette.
 greenery('garden','hydrangea',[[250,310,46],[730,600,48],[355,525,43]]);
 greenery('garden','wildflowers',[[200,515,23],[690,485,25]]);
 put('garden','vegetable-bed','garden-raised-bed-v1',325,568,116,108,52);
 put('garden','wheelbarrow','garden-wheelbarrow-v1',653,545,72,57,21);
 put('garden','seedling-bed','garden-raised-bed-v1',655,295,99,92,45);
 greenery('camp','juniper',[[275,530,58],[705,595,53],[700,240,49]]);
 greenery('camp','sapling',[[315,275,39],[635,590,37]]);
 greenery('camp','wildflowers',[[270,455,21],[595,230,24]]);
 put('camp','cooking','camp-cooking-v1',655,405,60,52,24);
 greenery('courtyard','hydrangea',[[315,545,47],[685,280,45]]);
 greenery('courtyard','sapling',[[310,260,38]]);
 greenery('courtyard','wildflowers',[[710,585,24],[280,458,23]]);
 put('courtyard','garden-cycle','town-bicycle-front-v1',627,517,25,18,43);
 greenery('bazaar','broadleaf',[[150,510,165]]);
 greenery('bazaar','hydrangea',[[790,425,47],[700,630,43]]);
 greenery('bazaar','wildflowers',[[260,605,23]]);
 put('bazaar','produce','grocery-produce-v1',313,385,68,58,23);
 put('bazaar','record-sale','secondhand-records-v1',650,390,63,55,21);
 greenery('beach','beachgrass',[[175,410,23],[265,530,29],[330,600,22],[775,567,26],[700,285,24]]);
 greenery('beach','juniper',[[620,255,54],[200,240,56]]);
 put('beach','rowboat','coast-rowboat-v1',590,463,137,119,33);
 greenery('path','juniper',[[320,250,55],[645,425,53],[350,535,51]]);
 greenery('path','sapling',[[650,245,39]]);
 greenery('path','wildflowers',[[220,535,23],[625,555,24]]);
 greenery('path','beachgrass',[[705,480,25],[270,465,22]]);
 put('dock','mooring-left','harbor-bollard-v1',343,285,24,17,13);
 put('dock','mooring-right','harbor-bollard-v1',635,486,24,17,13);
}
