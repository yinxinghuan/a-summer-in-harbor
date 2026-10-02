"""Original deterministic Foley-like synthesis. No external samples/services/fees.
MIT, same license as this project. Not a recorded physical shoe.
"""
from pathlib import Path
import math, random, wave, struct, hashlib, json
root=Path(__file__).resolve().parents[2]
rows=[]
for name,seed,tone in [('step-soft-a',4021,94),('step-soft-b',4022,88)]:
    sr=44100; duration=.14; rng=random.Random(seed); lp=0.; bass=0.; samples=[]
    for i in range(round(sr*duration)):
        t=i/sr; noise=rng.uniform(-1,1)
        lp+=.12*(noise-lp); bass+=.016*(lp-bass)
        # Heel then quiet sole: two soft, overlapping unpitched contacts, no click.
        attack=min(1,t/.006)
        heel=attack*math.exp(-t/0.025)
        sole=0 if t<.028 else min(1,(t-.028)/.01)*math.exp(-(t-.028)/.027)
        end=min(1,max(0,(duration-t)/.022))
        value=((lp-bass)*(.72*heel+.32*sole)+.11*math.sin(2*math.pi*tone*t)*heel)*end
        samples.append(value)
    peak=max(abs(x) for x in samples); samples=[x/peak*.22 for x in samples]
    path=root/'public/audio'/f'{name}.wav'
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(b''.join(struct.pack('<h',round(x*32767)) for x in samples))
    rows.append(dict(file=path.name,durationSeconds=duration,sampleRate=sr,channels=1,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),peakDb=20*math.log10(max(abs(x) for x in samples)),rmsDb=20*math.log10(math.sqrt(sum(x*x for x in samples)/len(samples)))))
(root/'doc/audio/footsteps-20261002.json').write_text(json.dumps(dict(method='Original deterministic band-limited noise and damped body synthesis; not field recording',license='MIT (project)',sourceScript='scripts/audio/soft-footsteps.py',externalSamples=[],paidRequests=0,files=rows),indent=2)+'\n')
print(json.dumps(rows,indent=2))
