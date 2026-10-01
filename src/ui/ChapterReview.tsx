import {chapterReview} from '../story/chapter';
import {tx,type Locale} from '../world/data';
import type {Save} from '../story/state';
export function ChapterReview({save,locale}:{save:Save;locale:Locale}){
 const review=chapterReview(save);if(!review)return null;
 return <div className="harbor-chapter-review"><small>{tx(['第一章 · 夏日集市','CHAPTER ONE · THE SUMMER MARKET'],locale)}</small><h3>{tx(['在这里留下了你的痕迹','You have made a place here'],locale)}</h3><p>{tx(review.route,locale)}</p><h3>{tx(['留下的变化','What changed'],locale)}</h3><ul>{review.changes.map((w,i)=><li key={i}>{tx(w,locale)}</li>)}</ul><h3>{tx(['还想逛一会儿','Stay a little longer'],locale)}</h3><ul>{review.next.map((w,i)=><li key={i}>{tx(w,locale)}</li>)}</ul><p>{tx(['也可以在这里歇一会儿。已完成的行动已经保存；关闭回顾后，会回到刚才的位置。','This is also a good place to pause. Completed actions are saved. Close this review to return to where you were.'],locale)}</p></div>;
}
