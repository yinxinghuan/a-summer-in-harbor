"""Public AlterU API. Stable requests, no hidden references or automatic retries."""
import json,uuid,time,subprocess,hashlib,sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
BASE='https://game.aiwaves.tech/alteru-media/api'
SESSION=json.loads((ROOT/'doc/game-identity.json').read_text())['uuid']
COMMON='Polished 16-bit pixel art with carefully clustered pixels, dark restrained outlines, coastal summer palette, soft upper-left light. Elevated ORTHOGRAPHIC camera looking down 50 degrees, zero sideways yaw, no vanishing point. '
ASSETS={
'hero-root':COMMON+'One full body ordinary adult newcomer age 28, slightly wavy dark brown short hair, sea-teal overshirt rolled sleeves over ivory T shirt, sand trousers, brown practical shoes, no carried bag, relaxed neutral standing facing screen DOWN. Friendly understated adult proportions: total body height 4 heads, not childlike. Both shoes visible and separated, arms at sides. Single complete figure on absolutely uniform pure magenta #ff00ff background, no shadow or ground. Strong readable silhouette, approximately 560 pixels tall centered on 1024 canvas. No lettering.',
'cafe-counter':COMMON+'One complete small seaside cafe service counter of honey oak, mint green lower panel, simple silver espresso machine and two cups physically resting on its top. Front and back tabletop edges equal length and perfectly horizontal, depth edges vertical in image. Rectangular top, not trapezoid. Counter width twice adult shoulder width. No people, chairs, floor, wall, cast shadow or text. Uniform pure magenta #ff00ff background with clear margins.',
'floor-stone':'Seamless flat TOP DOWN orthographic texture only, edge to edge. Restrained 16-bit pixel art. Warm grey coastal paving of small irregular rectangular stone slabs with sparse sand in joints; all seams aligned horizontally or vertically. Equal scale everywhere. No wall, furniture, object, border, greenery or lighting gradient. 1024x1024.',
'wall-north':COMMON+'Single horizontal segment of a salt-white painted timber interior wall, 6:1 width to visible height. Thin flat warm-grey top cap takes 12 percent of total visible height, vertical cream painted plank facade takes 80 percent, narrow dark wood skirting 8 percent. No door, no window, no corners, no pilaster, no furniture, no environment. Flat straight parallel horizontal edges. Uniform pure magenta #ff00ff background, segment centered with large margins. Side ends flush cut. Not a short garden fence. No shadow outside object.',
'door-front':COMMON+'A single rectangular mint-painted wooden moving panel, visible front face 400 pixels wide by 500 pixels tall, thin own top surface 18 pixels deep visible from above. This panel is an interior door leaf seen from elevated orthographic camera: circular brass knob base projects to a horizontally elongated ellipse, visible upper surface of handle, two small hinges at right. Thin right edge. No fixed frame, no architrave, no lintel, no wall, no threshold, no extra border. Complete panel with natural worn paint details. Centered on uniform pure magenta #ff00ff background. No text.'}
ASSETS.update(json.loads((ROOT/'doc/art/prompts.json').read_text()) if (ROOT/'doc/art/prompts.json').exists() else {})
def generate(key):
 d=ROOT/'doc/art'/key;d.mkdir(parents=True,exist_ok=True)
 req=d/'request.json'
 if not req.exists():
  spec=ASSETS[key] if isinstance(ASSETS[key],dict) else {'prompt':ASSETS[key],'refs':[]}
  req.write_text(json.dumps({'request_id':str(uuid.uuid4()),'session_id':SESSION,'model':'gpt-image-2.5-sunburst','mode':'edit' if spec['refs'] else 'text','prompt':spec['prompt'],'reference_urls':spec['refs'],'size':{'width':1024,'height':1024},'quality':'high','background':'opaque'},indent=2))
 out=d/'response.json'
 if out.exists():
  data=json.loads(out.read_text())
  if data.get('status')!='succeeded':print(key,'existing non-success; inspect before retry',flush=True);return
 else:
  t=time.time()
  result=subprocess.run(['curl','-sS','--max-time','260','-X','POST',BASE+'/v1/images/generations','-H','Content-Type: application/json','--data-binary','@'+str(req)],capture_output=True)
  if result.returncode: (d/'transport-error.txt').write_text(result.stderr.decode());print(key,'unknown transport outcome; keep request ID',flush=True);return
  out.write_bytes(result.stdout)
  try:data=json.loads(result.stdout)
  except Exception:print(key,'non JSON response',flush=True);return
  (d/'timing.json').write_text(json.dumps({'seconds':round(time.time()-t,2),'mode':json.loads(req.read_text())['mode'],'references':len(json.loads(req.read_text())['reference_urls']),'review':'pending'}))
 url=data.get('media',{}).get('url')
 if not url: print(key,data,flush=True);return
 target=d/'source.webp'
 if not target.exists():subprocess.run(['curl','-sS','--fail','--max-time','90',url,'-o',str(target)],check=True)
 (d/'source.sha256').write_text(hashlib.sha256(target.read_bytes()).hexdigest())
 print(key,'downloaded; visual review pending',flush=True)
keys=sys.argv[1:] or list(ASSETS)
with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(generate,keys))
