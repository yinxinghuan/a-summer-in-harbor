"""Offline plan audit only. No HTTP client, generation, upload or auth access."""
from pathlib import Path
import json,math,uuid
root=Path(__file__).parent
p=json.loads((root/'generation-plan.json').read_text());m=json.loads((root/'assembly-manifest.template.json').read_text())
assert p['generationAuthorized'] is False and p['actualPostAttempts']==0
jobs=p['jobs'];ids={j['id'] for j in jobs};assert len(jobs)==len(ids)==21
assert sum(j['max_post_attempts'] for j in jobs)==42
assert sum(j['max_post_attempts'] for j in jobs if j['id'] in p['pilotJobIds'])==10
assert len(m['frames'])==48 and sum('mirror-full-frame' not in f['transform'] for f in m['frames'])==36
for j in jobs:
 uuid.UUID(j['request_id_first']);assert j['actual_post_attempts']==0 and not j['accepted'];assert j['reference_urls']==[]
 assert len(j['prompt'])<=32000 and j['n']==1 and j['max_post_attempts']==2
 w,h=j['size'].values();assert w%16==h%16==0 and max(w,h)<=3840 and 655360<=w*h<=8294400 and max(w,h)/min(w,h)<=3
 if j['mode']=='edit':assert j['reference_parent_job'] in ids and j['reference_parent_job']==j['actor']+'-identity'
 else:assert j['reference_parent_job'] is None
for f in m['frames']:assert f['parentJob'] in ids and not f['sourceAccepted'] and f['sourceRect'] is None
print(json.dumps({'planningConsistency':'pass','jobs':21,'independentFinalPoses':36,'assembledCells':48,'firstPassPosts':21,'pilotCap':10,'wholeCap':42,'actualPosts':0,'mediaQA':'not run; no media exists','referenceResolution':'pending accepted same-batch roots'},indent=2))
