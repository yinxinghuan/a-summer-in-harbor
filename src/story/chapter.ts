import {has,type Save} from './state';
import type {Words} from '../world/data';

/** Read-only chapter view. Opening it never awards anything or changes a save. */
export function chapterReview(s:Save):null|{route:Words;changes:Words[];next:Words[]} {
 if(!has(s,'market-open'))return null;
 const route:Words=has(s,'route-choice:bridge')
  ?['你修好了小桥，恢复公共通路。住户不必开放自己的庭院。','You repaired the footbridge and restored public access. Residents did not have to open their garden.']
  :has(s,'route-choice:trail')
  ?['你找回了山坡公共小路。路远一些，但避开了私人庭院。','You recovered the public hillside trail. It is a longer walk, clear of the private garden.']
  :has(s,'route-choice:garden')
  ?['你与住户约好只在上午十点到十二点借道。庭院仍然是他们的家。','You agreed access with the resident from ten until noon. The garden remains their home.']
  :['你安排好了通往海岸的路线，夏日集市已经开放。','You arranged access to the coast, and the summer market is open.'];
 const changes:Words[]=[['集市摊位已经开放；这一章的主要目标完成了。','The market stalls are open. This chapter’s main goal is complete.']];
 if(has(s,'terrace-fixed'))changes.push(['咖啡馆的露台灯也亮起来了。','The café’s terrace lantern is working again, too.']);
 if(has(s,'bag-returned'))changes.push(['你替玛拉找回工具袋，在小镇安顿了下来。','You returned Mara’s tool bag and settled into town.']);
 const next:Words[]=[['码头 · 试试钓鱼，收获可交给咖啡馆。','The pier · Try fishing and take your catch to the café.'],['拳馆 · 练习出拳和走位。','The club · Practice sparring and footwork.'],['小镇各处 · 继续认识街坊、自由提问，回看旅行手记。','Around town · Meet neighbors, ask your own questions, and revisit your journal.']];
 return {route,changes,next};
}
