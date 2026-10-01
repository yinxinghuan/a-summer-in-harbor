import type {Room} from './data';

/** Authored activity groups. Move grounded contacts with each sprite, and leave
 * task/door approach positions clear. Set dressing alone adds no hidden action.
 */
export function organizeDailyLife(rooms:Record<string,Room>){
 const move=(scene:string,id:string,x:number,y:number)=>{
  const p=rooms[scene].props.find(p=>p.id===id);if(!p)throw Error(`Missing ${scene}/${id}`);
  const dx=x-p.at.x,dy=y-p.at.y;p.at={x,y};if(p.footprint)p.footprint={...p.footprint,x:p.footprint.x+dx,y:p.footprint.y+dy};
 };
 const put=(scene:string,id:string,art:string,x:number,y:number,width:number,fw=0,fh=0)=>rooms[scene].props.push({id:'use-'+id,art,at:{x,y},width,...(fw&&fh?{footprint:{x:x-fw/2,y:y-fh,w:fw,h:fh}}:{})});
 const drop=(scene:string,...ids:string[])=>rooms[scene].props=rooms[scene].props.filter(p=>!ids.includes(p.id));
 const type=(scene:string,id:string,art:string,width:number,fw:number,fh:number)=>{const p=rooms[scene].props.find(p=>p.id===id)!;p.art=art;p.width=width;p.footprint={x:p.at.x-fw/2,y:p.at.y-fh,w:fw,h:fh}};
 const person=(scene:string,id:string,x:number,y:number)=>{const e=rooms[scene].entities.find(e=>e.id===id)!;e.at={x,y};e.approach={x:x-8,y:y+42}};
 // Sleep/storage at left; daylight reading at right; arrival and washing below.
 move('home','books-and-linen',332,303);move('home','life-bedside',332,345);
 drop('home','bag');put('home','unpacking','life-open-luggage-v1',429,433,47,38,19);
 move('home','breakfast',577,401);move('home','chair',577,425);
 move('home','life-reading-shelf',630,350);move('home','fern',638,423);
 move('home','summer-coat',626,533);move('home','woven-rug',395,447);
 rooms.home.props.find(p=>p.id==='woven-rug')!.width=167;
 type('home','entry-planter','plant',28,15,12);move('home','entry-planter',316,527);
 put('home','washing','life-washstand-v1',328,501,39,33,19);
 // Counter/pastry form one service zone. Chairs actually meet table edges.
 move('cafe','pantry',365,315);move('cafe','life-quiet-chair',450,429);
 move('cafe','table-a',450,465);move('cafe','chair-b',615,508);move('cafe','chair-a',410,469);
 move('cafe','woven-rug',527,533);rooms.cafe.props.find(p=>p.id==='woven-rug')!.width=255;
 put('cafe','used-cups','life-cup-cart-v1',310,396,37,31,20);
 person('cafe','theo',579,330);
 // Repair work and wheel stock meet; timber has its own storage bay.
 move('workshop','tools',407,342);move('workshop','tool-storage',490,299);
 move('workshop','spares',616,377);move('workshop','wood-stock',323,521);
 move('workshop','bench',369,450);drop('workshop','life-repair-bicycle');
 put('workshop','active-repair','life-repair-stand-v1',602,462,79,64,25);
 person('workshop','june',510,358);
 // Replenishment end, dry goods, produce aisle and shopkeeper till side.
 move('grocery','counter',402,320);move('grocery','shelf',552,300);
 move('grocery','rest',363,425);move('grocery','storage',632,346);
 move('grocery','plants',627,528);
 person('grocery','luis',552,376);
 // Clear exercise floor; kit and drinking water next to rest bench.
 move('gym','gloves',568,345);move('gym','life-punchbag',348,330);
 move('gym','towel-shelf',615,430);move('gym','rest',600,489);move('gym','fern',647,512);
 person('gym','idris',443,380);
 // Reception, browsing clothes, and a listening corner each have a use side.
 move('secondhand','old-coat',333,325);move('secondhand','old-luggage',330,378);
 move('secondhand','book-shelf',608,333);move('secondhand','bench',606,435);
 move('secondhand','life-books',347,513);move('secondhand','chair',390,388);type('secondhand','chair','dining-chair-back-v1',23,19,17);
 // Logbook desk remains authoritative; instruments and archives belong nearby.
 move('weather','records',596,339);move('weather','life-archived-logs',318,331);
 move('weather','rest',597,448);move('weather','raincoat',637,526);
 put('weather','chart-board','life-weather-board-v1',484,289,65,54,15);
 put('weather','record-chair','dining-chair-back-v1',352,378,23,19,17);
 // Keeper's chart and maintenance storage make a single working corner.
 move('lighthouse','chart-table',603,323);move('lighthouse','records',608,430);
 move('lighthouse','keeper-coat',325,523);move('lighthouse','bench',359,450);
 put('lighthouse','keeper-tools','fishing-kit',653,485,34,28,17);
 for(const id of ['workshop-annex-1','workshop-annex-2'])move(id,'green',636,330);
 put('workshop-annex-1','parts','harbor-crates',325,440,37,29,18);
 put('workshop-annex-2','archives','interior-bookcase-v1',631,310,53,46,18);

 // Shared street: waiting in shade, bicycles beside shops, planting at thresholds.
 move('station','tree-south',341,830);move('station','arrival-bench',439,774);
 move('station','arrival-flowers',470,815);move('station','birch-arrival',350,735);
 move('station','life-wildflowers-0',355,816);move('station','life-wildflowers-1',320,784);
 move('station','bench-square',920,690);move('station','life-hydrangea-2',945,745);
 move('station','life-sapling-2',1162,742);move('station','life-wildflowers-2',1066,699);
 // Dockside work pocket. Vegetation grows beside the building, not in the paving.
 move('harbor','life-stored-boat',385,725);move('harbor','crates-b',505,729);
 put('harbor','nets','life-net-rack-v1',258,699,90,76,17);
 move('harbor','crates-a',202,610);move('harbor','life-juniper-0',1094,349);
 move('harbor','quay-planter',992,573);
 // Shopping frontage versus shaded sitting pocket.
 move('market','life-market-produce',420,601);move('market','life-customer-bicycle',1016,718);
 move('market','square-bench',780,891);move('market','square-birch',729,833);
 move('market','life-broadleaf-0',841,846);move('market','life-wildflowers-1',887,888);
 // A pull-up point below the coastal road, plants in sheltered rock/tree pockets.
 type('coast','view-bench','bench',68,58,14);
 move('coast','life-pulled-up-boat',292,725);put('coast','rope-kit','fishing-kit',395,743,37,30,19);
 move('coast','life-juniper-0',326,351);move('coast','life-juniper-1',840,802);
 move('coast','life-beachgrass-0',244,772);move('coast','life-beachgrass-1',377,792);
 move('coast','life-sapling-0',1030,379);
 // Woodland edge groups, rather than isolated dots at equal intervals.
 move('hill','life-sapling-0',358,423);move('hill','life-juniper-0',397,455);
 move('hill','life-wildflowers-0',508,454);move('hill','life-sapling-2',236,789);
 move('hill','life-juniper-2',1117,777);move('hill','life-wildflowers-3',194,795);
 // Two working beds and their tools share one garden patch, leaving the note clear.
 move('garden','life-vegetable-bed',330,535);move('garden','life-seedling-bed',330,615);
 move('garden','life-wheelbarrow',230,600);move('garden','life-sapling-0',143,625);put('garden','potting','life-potting-bench-v1',205,525,79,66,25);
 move('garden','life-hydrangea-2',683,495);move('garden','garden-seat',641,457);
 move('garden','life-wildflowers-1',677,541);
 // Tent, kitchen and seating surround a safe cold fire ring. Map table stays usable.
 move('camp','life-cooking',618,383);move('camp','picnic-crate',713,390);
 move('camp','rest',620,477);type('camp','rest','bench-back-v3',76,66,14);put('camp','cold-fire','life-cold-firepit-v1',574,420,48,39,21);
 move('camp','life-juniper-0',278,349);move('camp','life-wildflowers-0',285,379);
 // Seated conversation court: inward-facing seats, parked bike on the perimeter.
 move('courtyard','bench',624,442);move('courtyard','life-garden-cycle',698,475);
 move('courtyard','flowers',650,366);move('courtyard','life-hydrangea-0',595,522);
 put('courtyard','shared-seat','bench',572,351,68,58,14);
 // Goods touch the stall frontage, not the middle of the square.
 move('bazaar','life-produce',328,376);move('bazaar','life-record-sale',694,388);
 move('bazaar','empty-bench',710,594);
 // Beach equipment: timber, boat and drying nets form the shore work area.
 type('beach','shore-seat','bench',68,58,14);
 move('beach','life-rowboat',610,440);put('beach','drying-net','life-net-rack-v1',515,364,93,78,18);
 move('beach','life-beachgrass-0',186,327);move('beach','life-beachgrass-1',212,368);
 move('beach','life-beachgrass-2',695,530);move('beach','life-beachgrass-3',749,536);
 // Stream bank and shaded margin. Repair clutter is on dry ground beside notice.
 move('path','life-juniper-0',365,265);move('path','life-beachgrass-1',392,253);
 move('path','life-wildflowers-0',193,563);move('path','life-juniper-2',258,613);
 put('path','repair-stock','driftwood',310,409,42,35,17);
 // Fishing station alongside seats leaves the pier axis open.
 move('dock','tackle',451,350);move('dock','bench',587,390);move('dock','rope-crates',608,294);
}

// Reachable standing spaces for the implied activity; these are QA geometry,
// not interaction targets or new gameplay promises.
export const dailyUseSpaces=[
 {scene:'home',activity:'read at desk side',x:527,y:390},
 {scene:'home',activity:'reach bedside',x:324,y:365},
 {scene:'cafe',activity:'collect used cups',x:335,y:382},
 {scene:'workshop',activity:'work beside repair stand',x:547,y:453},
 {scene:'garden',activity:'use potting bench',x:197,y:540},
 {scene:'garden',activity:'tend planting beds',x:395,y:570},
 {scene:'camp',activity:'reach cooking table',x:654,y:365},
 {scene:'weather',activity:'read observation board',x:476,y:303},
 {scene:'beach',activity:'reach drying nets',x:510,y:385},
 {scene:'lighthouse',activity:'reach maintenance cabinet',x:553,y:427},
];
