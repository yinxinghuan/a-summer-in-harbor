"""Read-only RGBA PNG audit; no image encoder, transforms or external package."""
from pathlib import Path
import struct, zlib, json, hashlib, datetime

def rgba(path):
    source = path.read_bytes()
    assert source[:8] == b'\x89PNG\r\n\x1a\n'
    offset, compressed = 8, bytearray()
    while offset < len(source):
        length = struct.unpack('>I', source[offset:offset+4])[0]
        kind = source[offset+4:offset+8]
        data = source[offset+8:offset+8+length]
        if kind == b'IHDR':
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', data)
            assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
        if kind == b'IDAT':
            compressed.extend(data)
        offset += length + 12
    stream = zlib.decompress(compressed)
    stride, prior, decoded = width * 4, bytearray(width * 4), bytearray()
    for y in range(height):
        start = y * (stride + 1)
        mode = stream[start]
        row = bytearray(stream[start+1:start+1+stride])
        for x in range(stride):
            left = row[x-4] if x >= 4 else 0
            above = prior[x]
            diagonal = prior[x-4] if x >= 4 else 0
            if mode == 0: predictor = 0
            elif mode == 1: predictor = left
            elif mode == 2: predictor = above
            elif mode == 3: predictor = (left + above) // 2
            elif mode == 4:
                p = left + above - diagonal
                candidates = [left, above, diagonal]
                predictor = min(candidates, key=lambda v: abs(p-v))
            else: raise ValueError('Unknown PNG filter')
            row[x] = (row[x] + predictor) & 255
        decoded.extend(row)
        prior = row
    return width, height, decoded

rows = []
for person in ['harper', 'tess', 'noor']:
    width, height, pixels = rgba(Path(f'public/art/npc-{person}.png'))
    assert (width, height) == (384, 512)
    mirrors = []
    for col in range(3):
        same = all(pixels[((128+y)*width+col*128+x)*4:((128+y)*width+col*128+x)*4+4] ==
                   pixels[((256+y)*width+col*128+127-x)*4:((256+y)*width+col*128+127-x)*4+4]
                   for y in range(128) for x in range(128))
        mirrors.append(same)
    assert all(mirrors)
    assets = []
    for suffix, size in [('', (384,512)), ('-avatar', (256,256)), ('-root-v2', (512,512))]:
        path = Path(f'public/art/npc-{person}{suffix}.png')
        w, h, data = rgba(path)
        assert (w,h) == size
        magenta = sum(data[i+3]>0 and data[i]>220 and data[i+1]<80 and data[i+2]>220 for i in range(0,len(data),4))
        assert magenta == 0 and min(data[3::4]) == 0
        assets.append(dict(path=str(path), size=size, format='RGBA', visibleStrongMagenta=magenta,
                           sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    rows.append(dict(person=person, wholeFrameRightMirrors=mirrors, consumerAssets=assets))
result = dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), assets=rows,
              sourceBytesModified=False, newMediaPosts=0)
Path('doc/qa/tech-nomads-owner-20261006/owner-consumer-pixel-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS:9 RGBA consumers,9 exact whole-frame mirrors,visible strong-magenta0;source bytes unchanged')
