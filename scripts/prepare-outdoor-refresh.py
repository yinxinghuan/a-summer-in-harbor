"""Process platform sprites: same documented chroma-key contract, no geometry repaint."""
from pathlib import Path
from PIL import Image
import json,hashlib,sys
root=Path(__file__).resolve().parents[1]
meta_path=root/'src/world/art-dimensions.json';meta=json.loads(meta_path.read_text())
manifest=json.loads((root/(sys.argv[1] if len(sys.argv)>1 else 'doc/art/outdoor-refresh-20261001.json')).read_text())
keys=manifest['keys']+manifest.get('existing_reprocessed',[])
for key in keys:
 src=root/'doc/art'/key/'source.webp'; im=Image.open(src).convert('RGBA'); px=im.load()
 if key.startswith('floor'):
  out=root/'public/art'/f'{key}.png';im.save(out)
  meta[key]={'width':im.width,'height':im.height,'sourceSha':hashlib.sha256(src.read_bytes()).hexdigest(),'processedSha':hashlib.sha256(out.read_bytes()).hexdigest(),'process':'decode PNG, unchanged geometry','status':'candidate; final renderer review required'}
  continue
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=px[x,y]
   if r>120 and b>100 and min(r,b)-g>50:px[x,y]=(0,0,0,0)
 box=im.getbbox();im=im.crop(box);original=im.size
 # Physical sprite pixel density is close to the 108px actor at 56 world units.
 max_side=420 if key.startswith('tree') or key in ('nature-sapling-v1','nature-broadleaf-v1','flora-maple-v1','flora-cedar-v1') else 240
 scale=min(1,max_side/max(im.size));im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
 out=root/'public/art'/f'{key}.png';im.save(out)
 meta[key]={'width':im.width,'height':im.height,'sourceBounds':list(box),'sourceCropSize':list(original),'uniformRuntimeScale':scale,'sourceSha':hashlib.sha256(src.read_bytes()).hexdigest(),'processedSha':hashlib.sha256(out.read_bytes()).hexdigest(),'process':'magenta colour key, tight crop, uniform nearest scaling; no geometry changes','status':'candidate; final renderer review required'}
meta_path.write_text(json.dumps(meta,indent=2))
