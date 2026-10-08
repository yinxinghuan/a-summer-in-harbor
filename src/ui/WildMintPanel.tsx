import {mintNode,mintItem,type PlantUseVerb} from '../life/plant-uses';
import {mintArtAccepted,wildMintAssets} from '../world/wild-mint-art';
import {tx,type Locale} from '../world/data';
import {useView} from './PlantUsesPanel';
import type {LifeView} from './LifeBag';
import type {Save} from '../story/state';
export function WildMintPanel({save,view,target,locale,current,busy,onAction}:{save:Save;view:LifeView|null;target:string;locale:Locale;current:boolean;busy:boolean;onAction:(v:PlantUseVerb)=>void}){
 const p=useView(view);if(!p?.mintEnabled||!mintArtAccepted(wildMintAssets)||p.mintArtId!==wildMintAssets.id)return null;
 const locked=busy||!current||!!save.activeChallenge,starts=p.mintNewStarts??p.newStarts;
 return target===mintNode.id?<section className="harbor-item" data-wild-mint><h3>{tx(['野薄荷','Wild mint'],locale)}</h3><p>{tx(['只取少量叶，保留活株。采一份耗2体力和10分钟；十二个游戏小时后再来。','Take a few leaves and keep the clump. One portion costs 2 energy and 10 minutes; return after twelve game hours.'],locale)}</p><button disabled={locked||!starts} onClick={()=>onAction('observe-mint')}>{tx(['记下观察','Record the observation'],locale)}</button><button disabled={locked||!starts||p.mint.stock<=1} onClick={()=>onAction('collect-mint')}>{tx(['采一份叶','Collect one portion of leaves'],locale)}</button></section>:target==='dani'&&p.mint.observed&&!p.mint.shared?<section className="harbor-item"><button disabled={locked} onClick={()=>onAction('share-mint')}>{tx(['分享我的薄荷观察','Share my mint observation'],locale)}</button></section>:target==='life-bag'&&(save.items[mintItem]??0)>0&&!p.mint.archived?<section className="harbor-item"><button disabled={locked} onClick={()=>onAction('archive-mint')}>{tx(['收入记录 · 消耗一份叶','Add to my notebook · use one portion'],locale)}</button></section>:null;
}
