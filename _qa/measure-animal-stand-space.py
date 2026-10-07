"""Read-only RGBA measurement for static candidate preview; never a collider."""
import hashlib, json, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
inputs = json.load(sys.stdin)

def source(relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('SOURCE_PATH')
    return path

def measure(relative, frames):
    path = source(relative)
    image = Image.open(path).convert('RGBA')
    result = {}
    for key, frame in frames.items():
        x, y, width, height, anchor_x, anchor_y, scale = frame
        if min(x, y) < 0 or x + width > image.width or y + height > image.height:
            raise ValueError('FRAME_BOUNDS')
        bounds = image.crop((x, y, x + width, y + height)).getchannel('A').getbbox()
        if bounds is None:
            raise ValueError('EMPTY_FRAME')
        left, top, right, bottom = bounds
        result[key] = {'alphaBounds': list(bounds), 'relative': {
            'x': (left - width * anchor_x) * scale,
            'y': (top - height * anchor_y) * scale,
            'w': (right - left) * scale, 'h': (bottom - top) * scale}}
    return {'source': relative, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'size': list(image.size), 'frames': result}

result = {'schema': 2, 'purpose': 'static display envelopes, not ground colliders',
          'activationAllowed': False, 'sourceCommit': 'ce6944b756efe8ed0ff0f7453673d5c82141cbbd',
          'candidates': {}, 'people': {}, 'animals': {}, 'props': {}}
for section in ['candidates', 'people', 'animals', 'props']:
    for identity, item in inputs[section].items():
        result[section][identity] = measure(item['source'], item['frames'])
        if section == 'props':
            result[section][identity].update({'scene': item['scene'], 'foot': item['foot']})
json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
sys.stdout.write('\n')
