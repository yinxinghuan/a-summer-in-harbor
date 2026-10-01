import json,subprocess,re
from pathlib import Path
result=[]
for p in Path('public/audio').glob('*.mp3'):
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=sample_rate,channels','-of','json',str(p)]))
 r=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-af','volumedetect,silencedetect=noise=-50dB:d=2','-f','null','-'],capture_output=True,text=True)
 result.append({'file':str(p),'duration':float(info['format']['duration']),'streams':info['streams'],'meanDb':float(re.search(r'mean_volume: ([-.\d]+)',r.stderr)[1]),'peakDb':float(re.search(r'max_volume: ([-.\d]+)',r.stderr)[1]),'longSilence':re.findall(r'silence_duration: ([-.\d]+)',r.stderr)})
Path('doc/qa/audio-analysis.json').write_text(json.dumps({'files':result,'masterGain':0.22,'crossfadeSeconds':2,'perceptualListening':'not established by numeric analysis'},indent=2))
print(json.dumps(result,indent=2))
