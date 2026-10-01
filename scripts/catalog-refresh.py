"""Document generated prop provenance and actual placements; not a shared asset service."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
layout=json.loads((root/'doc/world-layout.json').read_text())
meta_path=root/'src/world/art-dimensions.json';meta=json.loads(meta_path.read_text())
manifest_names=['outdoor-richness-20261001','place-richness-20261001','orientation-refresh-20261001']
rows=[]
for name in manifest_names:
 p=root/'doc/art'/f'{name}.json';m=json.loads(p.read_text());rejected=m.get('rejected',{})
 for key in m['keys']:
  req=json.loads((root/'doc/art'/key/'request.json').read_text());res=json.loads((root/'doc/art'/key/'response.json').read_text())
  placements=[{'scene':scene,'prop':prop['id'],'width':prop['width'],'height':round(prop['width']*meta[key]['height']/meta[key]['width'],2),'anchor':prop['at'],'footprint':prop.get('footprint'),'walkThrough':not prop.get('footprint')} for scene,r in layout['rooms'].items() for prop in r['props'] if prop['art']==key]
  status='rejected: '+rejected[key] if key in rejected else 'accepted in current game renderer; awaiting user review'
  meta[key]['status']=status
  rows.append({'id':key,'category':'vegetation' if key.startswith('nature-') else 'furniture-or-prop','projection':'elevated orthographic 50 degrees','orientation':'back' if '-back-' in key else 'side' if '-side-' in key else 'front' if '-front-' in key else 'see exact prompt','model':res['media']['model'],'mode':req['mode'],'referenceCount':len(req['reference_urls']),'requestId':req['request_id'],'sourceUrl':res['media']['url'],'sourceSha':meta[key]['sourceSha'],'processedSha':meta[key]['processedSha'],'promptPath':f'doc/art/{key}/request.json','localPath':f'public/art/{key}.png','rights':'New platform-generated asset, no third-party game image input; service terms govern output, no independent exclusive-rights claim','status':status,'placements':placements})
 m['status']='renderer-reviewed; awaiting user review; not deployed';m['evidence']='doc/qa/richness-20261001.md';p.write_text(json.dumps(m,indent=2,ensure_ascii=False))
meta_path.write_text(json.dumps(meta,indent=2,ensure_ascii=False))
families=[{'id':'park-bench','members':{'front':'bench','back':'bench-back-v3','side':'bench-side-v3'},'note':'Side view uses narrow/deep contact rectangle; existing front retained.'},{'id':'green-dining-chair','members':{'front':'wooden-chair','back':'dining-chair-back-v1','right':'dining-chair-side-v1'},'note':'Text-matched paint and construction; free-generation wear can differ. No planar rotation.'},{'id':'oak-dining-table','members':{'long-edge-front':'dining-table-front-v1','short-edge-front':'dining-table-side-v2'},'rejected':['dining-table-side-v1'],'note':'Two independently generated orientations, common leg height; tabletop depth/contact dimensions differ.'},{'id':'sea-green-city-bicycle','members':{'right':'town-bicycle-v1','front':'town-bicycle-front-v1'},'note':'Front view exposes basket/handlebar, wheels aligned in depth, different collision contact.'}]
(root/'doc/art/richness-catalog-20261001.json').write_text(json.dumps({'scope':'Local project metadata for a future library; no shared service created','heroVisibleHeight':56,'assets':rows,'orientationFamilies':families},indent=2,ensure_ascii=False))
print(f'{len(rows)} candidates, {sum(bool(r["placements"]) for r in rows)} used; reference counts {sorted(set(r["referenceCount"] for r in rows))}')
