import json,hashlib,pathlib,sys,subprocess,time,datetime,uuid
D=pathlib.Path(__file__).resolve().parent
L=D/'ledger.json'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(x):
 t=L.with_suffix('.tmp');t.write_text(json.dumps(x,ensure_ascii=False,indent=2));t.replace(L)
if not L.exists():
 p=D.parent/'residents-art-proposal-20261004/generation-plan.json'
 raw=p.read_bytes();(D/'frozen-plan.json').write_bytes(raw)
 save(dict(authorization={'relayedBy':'小小银','sourceThread':'01a0ff79-c6a9-74f9-b4a0-1de1e4f8d0b3','userApproval':'Sentinel_6be2bb90a5bc8191907c97a3aa5d2188','replyTo':'Sentinel_4807dfd985f88191bc2c50da8ca4dda3','approvedAt':'2026-10-04T05:50:26Z','scope':'21 planned image jobs, 42 POST maximum, 2 per job, Avery gate before expansion, no purchases/deploy'},planSha256=hashlib.sha256(raw).hexdigest(),frozenAt=now(),attempts=[],reviews=[],pilotRendererApproved=False))
l=json.loads(L.read_text());plan=json.loads((D/'frozen-plan.json').read_text());cmd=sys.argv[1]
if cmd=='status':print(json.dumps({'posts':len(l['attempts']),'pilotPassed':l['pilotRendererApproved'],'attempts':[{k:a.get(k) for k in ['job','requestId','status','taskId','file']} for a in l['attempts']]}));sys.exit()
if cmd=='accept':
 job=sys.argv[2];a=next(a for a in reversed(l['attempts']) if a['job']==job)
 assert a['status']=='succeeded'
 l['reviews'].append(dict(job=job,requestId=a['requestId'],time=now(),reviewer='AI',decision='source-accepted',reason=sys.argv[3],renderer='pending'))
 save(l);sys.exit()
assert cmd=='generate'
job=sys.argv[2];j=next(j for j in plan['jobs'] if j['id']==job)
assert len(l['attempts'])<42
assert not any(a['status'] in ['sending','unknown','running','queued'] for a in l['attempts']), 'Unresolved generation: STOP'
prev=[a for a in l['attempts'] if a['job']==job]
assert len(prev)<2
assert job.startswith('avery-') or l['pilotRendererApproved'], 'Pilot renderer gate'
if job.startswith('avery-'):assert sum(a['job'].startswith('avery-') for a in l['attempts'])<10
refs=[]
if j['reference_parent_job']:
 parent=next(a for a in reversed(l['attempts']) if a['job']==j['reference_parent_job'])
 assert parent['status']=='succeeded' and any(r['requestId']==parent['requestId'] and r['decision']=='source-accepted' for r in l['reviews'])
 refs=[parent['url']];assert refs[0].startswith('https://')
requestId=j['request_id_first'] if not prev else str(uuid.uuid4())
body={k:j[k] for k in ['session_id','mode','prompt','model','n','quality','background','size']}
body.update(request_id=requestId,reference_urls=refs)
if prev:
 assert prev[-1]['status'] in ['succeeded','failed']
 # Explicit per-job corrective prompt, only intentional regeneration. No automatic retry.
 assert len(sys.argv)==4,'Second attempt requires correction file'
 body['prompt']=pathlib.Path(sys.argv[3]).read_text()
req=D/'requests'/f'{job}-{len(prev)+1}.json';req.write_text(json.dumps(body,ensure_ascii=False,indent=2))
out=D/'responses'/f'{job}-{len(prev)+1}.json'
a=dict(job=job,requestId=requestId,start=now(),status='sending',bodyFile=str(req.relative_to(D)),bodySha256=hashlib.sha256(req.read_bytes()).hexdigest(),references=refs)
l['attempts'].append(a);save(l)
print('POST',len(l['attempts']),job,requestId,flush=True)
t=time.monotonic()
r=subprocess.run(['curl','--silent','--show-error','--max-time','300','--request','POST','--header','Content-Type: application/json','--data-binary','@'+str(req),'--output',str(out),'--write-out','%{http_code}',j['endpoint']],capture_output=True,text=True)
a.update(elapsedSeconds=round(time.monotonic()-t,2),httpStatus=r.stdout,exitCode=r.returncode,end=now(),responseFile=str(out.relative_to(D)))
try:response=json.loads(out.read_text())
except Exception:response={}
a['status']=response.get('status','failed' if response.get('error') and r.stdout not in ['502','504'] else 'unknown')
a['taskId']=response.get('task_id');a['error']=response.get('error');save(l)
if a['status']=='succeeded':
 url=response['media']['url'];assert url.startswith('https://');a['url']=url;save(l)
 f=D/'raw'/f'{job}-{len(prev)+1}.webp'
 dl=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','90','--output',str(f),url],capture_output=True,text=True)
 if dl.returncode:print('Download failed; generation succeeded, do not regenerate');sys.exit(2)
 a.update(file=str(f.relative_to(D)),sha256=hashlib.sha256(f.read_bytes()).hexdigest());save(l)
print(json.dumps({k:a.get(k) for k in ['job','status','httpStatus','taskId','elapsedSeconds','file','error']}),flush=True)
