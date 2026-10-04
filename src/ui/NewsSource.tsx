import {sourceFor} from '../story/town-news';
import {newsAvailabilityLabel} from '../story/news-edition';
import type {Save} from '../story/state';
import {tx,type Locale} from '../world/data';
const date=(value:string,locale:Locale)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat(locale==='zh'?'zh-CN':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';
export function NewsSource({save,locale}:{save:Save;locale:Locale}){const r=sourceFor(save);return <section className="harbor-news-source"><small>{tx(save.newsEdition?newsAvailabilityLabel(save):['现实资讯 · 2026-10-04核对的本地样例','Real-world source · local sample checked 2026-10-04'],locale)}</small><p>{tx(r.summary,locale)}</p><p className="harbor-news-dates">{tx(['发布：','Published: '],locale)}{date(r.publishedAt,locale)}{save.newsEdition&&<><br/>{tx(['抓取：','Fetched: '],locale)}{date(r.fetchedAt,locale)}<br/>{tx(['核对：','Checked: '],locale)}{date(save.newsEdition.lastCheckedAt,locale)}</>}</p><a href={r.canonicalURL} target="_blank" rel="noopener noreferrer">{r.source} · {tx(['查看官方原文','Read the official source'],locale)}</a></section>}
