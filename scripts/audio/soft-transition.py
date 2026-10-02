"""Original deterministic soft wooden/felt transition cue. MIT. No external samples or fees."""
from pathlib import Path
import math,wave,struct,json,hashlib
root=Path(__file__).resolve().parents[2];sr=44100;n=round(sr*.3);a=[]
for i in range(n):
 t=i/sr;attack=math.sin(min(1,t/.014)*math.pi/2)**2;end=math.sin(min(1,(n-1-i)/sr/.045)*math.pi/2)**2
 # Damped wooden body with a quiet rounded second contact; no broadband hiss.
 body=(math.sin(2*math.pi*220*t)+.28*math.sin(2*math.pi*440*t)+.12*math.sin(2*math.pi*715*t))*math.exp(-t/.045)*attack
 u=max(0,t-.055);second=(math.sin(2*math.pi*330*u)+.12*math.sin(2*math.pi*660*u))*math.exp(-u/.065)*min(1,u/.016)**2
 a.append((body+.3*second)*end)
p=max(map(abs,a));a=[v/p*.18 for v in a];path=root/'public/audio/transition-soft.wav'
with wave.open(str(path),'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(b''.join(struct.pack('<h',round(v*32767)) for v in a))
record={'method':__doc__,'sampleRate':sr,'channels':1,'durationSeconds':.3,'peak':.18,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'externalSamples':[],'paidRequests':0,'sourceScript':'scripts/audio/soft-transition.py'}
(root/'doc/audio/transition-20261002.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
