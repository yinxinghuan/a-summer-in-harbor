from pathlib import Path
import subprocess,json,hashlib,re,shutil
root=Path(__file__).resolve().parents[2]; raw=root/'doc/audio/originals';raw.mkdir(exist_ok=True)
report=[]
for path in (root/'public/audio').glob('*.mp3'):
 source=raw/path.name
 if not source.exists():shutil.copyfile(path,source)
 result=subprocess.run(['ffmpeg','-hide_banner','-i',str(source),'-af','volumedetect','-f','null','-'],capture_output=True,text=True)
 mean=float(re.search(r'mean_volume: ([-.\d]+)',result.stderr)[1]);peak=float(re.search(r'max_volume: ([-.\d]+)',result.stderr)[1])
 targets={'step':-30,'door':-24,'hit':-24,'progress':-22};target=targets.get(path.stem,-21)
 gain=min(target-mean,-2-peak)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(source)]))
 fade=.04 if path.stem in targets else .5
 filt=f'volume={gain}dB,afade=t=in:d=0.01,afade=t=out:st={max(0,duration-fade)}:d={fade}'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-af',filt,'-b:a','160k',str(path)],check=True)
 report.append({'file':path.name,'originalSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'masteredSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'gainDb':round(gain,2),'fadeOut':fade,'semanticListening':'not machine verified'})
(root/'doc/audio/mastering.json').write_text(json.dumps(report,indent=2))
print('Mastered',len(report),'platform recordings; originals preserved')
