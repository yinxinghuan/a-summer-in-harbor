import {tx,type Locale,type Entity} from '../world/data';
import type {Save} from '../story/state';
import type {Command} from '../life/types';
import type {LifeView} from './LifeBag';
import {lifeItemImage} from '../world/life-crop-art';
import {CropImage} from './CropImage';
export function LifeCropPanel({save,view,target,locale,busy,onCommand}:{save:Save;view:LifeView|null;target:Entity;locale:Locale;busy:boolean;onCommand:(c:Command)=>void}){
 const plants=view?.plants,bed=plants?.plots.find(p=>p.target===target.id);
 if(!plants||!bed)return <p>{tx(['种植接线暂未开放，菜畦位置已保存。','Planting is not available here yet. Your bed is saved.'],locale)}</p>;
 const stale=view.snapshotVersion!==save.version,locked=busy||stale||plants.blocked,status=bed.status;
 return <section className="harbor-life-crop" data-life-plot={bed.id}>
 <p>{tx(['种植、浇水、收成都耗2精力、推进10游戏分钟；另计既有疲劳。离线不推进时间。','Planting, watering and harvesting each cost 2 energy and 10 game minutes, plus existing fatigue. Time does not advance offline.'],locale)}</p>
 {stale&&<p role="status">{tx(['正在读取新进度，请稍候。','Reading updated progress. One moment.'],locale)}</p>}
 {status?<>
 <h3>{tx(status.name,locale)}</h3><p>{tx([`有效湿润生长 ${status.grown}/${status.growMinutes} 分钟`,`Watered growth: ${status.grown}/${status.growMinutes} minutes`],locale)}</p>
 <p>{tx(status.ready?['豆荚成熟了，收成后空畦可以再种。','The pods are ready. Harvest to free the bed.']:status.needsWater?['土干了，生长暂停。浇水可恢复，植株不会死亡。','The soil is dry. Growth pauses; watering resumes it. The plant survives.']:['土仍湿润。去做别的事，游戏时间推进后再来看看。','The soil is still wet. Do something else and return as game time advances.'],locale)}</p>
 <button disabled={locked||save.energy<2||!status.needsWater} onClick={()=>onCommand({verb:'water',plot:bed.id})}>{tx(['浇水 · 2精力 · 10分钟','Water · 2 energy · 10 minutes'],locale)}</button>
 <button disabled={locked||save.energy<2||!status.ready} onClick={()=>onCommand({verb:'harvest',plot:bed.id})}>{tx(['收成 · 2精力 · 10分钟','Harvest · 2 energy · 10 minutes'],locale)}</button>
 </>:<><p>{tx(['空畦：需要同批次种子。杂货铺06:00–17:00售种。','Empty bed: you need a seed from an available batch. The grocer sells seeds 06:00–17:00.'],locale)}</p>
 {view.batches.filter(b=>b.kind==='seed'&&b.ref.id==='crop:snap-pea').map(b=><article className="harbor-item" key={b.id}>{lifeItemImage(b.ref,'seed')&&<CropImage transparent image={lifeItemImage(b.ref,'seed')!} alt={tx(b.name,locale)}/>}<p>{tx(b.name,locale)} ×{b.quantity}</p><button disabled={locked||!b.startAvailable||save.energy<2} onClick={()=>onCommand({verb:'plant',ref:b.ref,plot:bed.id})}>{tx(['播种 · 2精力 · 10分钟','Plant · 2 energy · 10 minutes'],locale)}</button>{!b.startAvailable&&<p>{tx(['此旧批次已停止新种植，实物与记录保留。','New planting is closed for this archived batch. Its goods and records remain.'],locale)}</p>}</article>)}
 </>}
 </section>;
}
export function LifeCropCounter({save,view,locale,busy,onCommand}:{save:Save;view:LifeView|null;locale:Locale;busy:boolean;onCommand:(c:Command)=>void}){
 if(!view?.plants)return null;const p=view.plants,locked=busy||view.snapshotVersion!==save.version||p.blocked||!p.shopOpen;
 return <section className="harbor-life-crop" data-life-counter><h3>{tx(['脆荚种子与收成','Snap pea seeds & harvest'],locale)}</h3>
 <p>{tx(['$6种子 · 浇水后720游戏分钟成熟 · 收成3份，每份可售$4。全部卖得$12；留1份再卖2份得$8，并保留下一轮的种子。','A seed costs $6. After 720 watered game minutes, harvest 3 units worth $4 each. Sell all for $12, or keep one for seed and sell two for $8.'],locale)}</p>
 <CropImage transparent image={lifeItemImage(p.ref,'seed')!} alt={tx(p.definition.name,locale)}/>
 <button disabled={locked||!p.newStarts||save.cash<p.definition.seedCost} onClick={()=>onCommand({verb:'buy-seed',ref:p.ref})}>{tx(['买1包脆荚种子 · $6','Buy 1 snap pea seed packet · $6'],locale)}</button>
 {!p.shopOpen&&<p>{tx(['柜台已关，06:00–17:00再来。产物会保留。','The counter is closed. Return 06:00–17:00; your produce keeps.'],locale)}</p>}
 {view.batches.filter(b=>b.kind==='produce'&&b.ref.id==='crop:snap-pea').map(b=><article key={b.id} className="harbor-item">{lifeItemImage(b.ref,'produce')&&<CropImage transparent image={lifeItemImage(b.ref,'produce')!} alt={tx(b.name,locale)}/>}<p>{tx(b.name,locale)} ×{b.quantity}</p><button disabled={locked||save.cash+b.salePrice>999} onClick={()=>onCommand({verb:'sell',ref:b.ref})}>{tx([`卖1份 · +$${b.salePrice}`,`Sell 1 unit · +$${b.salePrice}`],locale)}</button></article>)}
 </section>;
}
