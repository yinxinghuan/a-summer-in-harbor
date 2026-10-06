"""Read-only source audit. Writes only local QA JSON; no image processing."""
import hashlib, json
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageChops

source = Path('/Users/yin/code/games/harbor-residents-art-20261006')
output = Path(__file__).resolve().parents[1] / 'doc/qa/mira-owner-20261006'
output.mkdir(exist_ok=True)
def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path):
    return json.loads((source / path).read_text())
report = {'profiles': {}, 'maps': {}}
for resident in ['mira']:
  for component in ['avatar', 'portrait']:
    meta = read(f'assets/{resident}-{component}.json')
    review = read(f'reviews/{resident}-{component}.json')
    expected = meta['consumer']['sha256']
    image = Image.open(source / f'assets/{resident}-{component}.png').convert('RGBA')
    native = Image.open(meta['native']['path']).convert('RGBA')
    raw = Image.open(meta['source']['path']).convert('RGB')
    assert digest(source / f'assets/{resident}-{component}.png') == expected == review['consumerSHA256'] == meta['consumer']['sha256']
    assert digest(meta['source']['path']) == meta['source']['sha256'] == review['sourceSHA256']
    assert digest(meta['native']['path']) == meta['native']['sha256']
    assert native.resize(image.size, Image.Resampling.NEAREST).tobytes() == image.tobytes()
    assert review['decision'] == 'pass'
    strong = sum(a > 0 and r > 180 and b > 180 and g < 110 and min(r, b) - g > 80 for r, g, b, a in image.getdata())
    inclusive = [(i % image.width, i // image.width, rgba) for i, rgba in enumerate(image.getdata()) if rgba[3] > 0 and rgba[0] >= 180 and rgba[2] >= 180 and rgba[1] <= 110 and min(rgba[0], rgba[2]) - rgba[1] >= 80]
    assert strong == 0
    # Fully opaque interior at least two source pixels from transparency.
    core = native.getchannel('A').point(lambda a: 255 if a == 255 else 0).filter(ImageFilter.MinFilter(5))
    difference = ImageChops.difference(raw, native.convert('RGB'))
    assert Image.composite(difference, Image.new('RGB', raw.size), core).getbbox() is None
    assert image.size == ((256, 256) if component == 'avatar' else (512, 640))
    report['profiles'][f'{resident}-{component}'] = {'sha256': expected, 'size': image.size, 'strongMagentaPixels': strong, 'strongDefinition': 'alpha>0; R,B>180; G<110; min(R,B)-G>80 (existing extraction audit)', 'inclusiveBoundaryCandidateCount': len(inclusive), 'inclusiveBoundaryCandidates': inclusive, 'nearestSampling': True, 'fixedRawSourceSHA256': meta['source']['sha256'], 'nativeSHA256': meta['native']['sha256'], 'independentOpaqueInteriorRGBUnchanged': True, 'AIReview': 'pass', 'ownerUIReview': 'pending'}
    for prefix in ['assets', 'reviews']:
        (output / f'{resident}-{component}-{prefix}.json').write_bytes((source / f'{prefix}/{resident}-{component}.json').read_bytes())
for resident in ['mira']:
    plan = read(f'pose-plans/{resident}.json')
    meta = read(f'assets/{resident}.json')
    review = read(f'reviews/{resident}-suite.json')
    image = Image.open(source / f'assets/{resident}.png').convert('RGBA')
    assert image.size == (384, 512)
    assert digest(source / f'assets/{resident}.png') == meta['atlas']['sha256'] == review['atlasSHA256']
    assert review['decision'] == 'pass'
    checks = []
    for direction, poses in plan['generatedDirections'].items():
        for pose, item in poses.items():
            raw = source / item['sourcePath']
            request_dir = raw.parent if (raw.parent / 'request.json').exists() else raw.parent.parent
            request = json.loads((request_dir / 'request.json').read_text())
            result = json.loads((raw.parent / 'result.json').read_text())
            response = json.loads((raw.parent / 'response.json').read_text())
            assert digest(raw) == item['sha256']
            assert request['request_id'] == item['requestId'] == result['requestId']
            assert result['taskId'] == item['taskId']
            assert request['model'] == 'gpt-image-2.5-sunburst' and request['n'] == 1 and request['size'] == {'width': 1024, 'height': 1024}
            assert response['status'] == 'succeeded' and result['status'] == 'succeeded'
            assert response['request_id'] == item['requestId'] and response['task_id'] == item['taskId']
            checks.append({'direction': direction, 'pose': pose, 'sha256': item['sha256'], 'requestId': item['requestId'], 'taskId': item['taskId'], 'model': request['model'], 'mode': request['mode'], 'sourcePath': item['sourcePath'], 'sameIdRecovery': raw.parent != request_dir})
    assert len(checks) == 9
    boxes = []
    for row in range(4):
        for col in range(3):
            frame = image.crop((col * 128, row * 128, (col + 1) * 128, (row + 1) * 128))
            bounds = frame.getchannel('A').getbbox()
            assert bounds[1] == 14 and bounds[3] == 122 and bounds[0] > 0 and bounds[2] < 128
            boxes.append({'row': row, 'col': col, 'alphaBounds': bounds})
    for col in range(3):
        assert ImageOps.mirror(image.crop((col * 128, 128, (col + 1) * 128, 256))).tobytes() == image.crop((col * 128, 256, (col + 1) * 128, 384)).tobytes()
    captures = read(f'evidence/{resident}-walk/capture.json')
    renderer = []
    for capture in captures:
        assert not capture['errors']
        stops = [sample for sample in capture['motion'] if 'stopped' in sample]
        assert len(stops) == 4 and all(s['stopped']['pose'] == 'stand' for s in stops)
        phases = {cycle['direction']: sorted(set(s['pose'] for s in cycle['samples'])) for cycle in capture['cycles']}
        assert all(set(v) >= {'stride-0', 'stride-1', 'stride-2'} for v in phases.values())
        renderer.append({'viewport': capture['viewport'], 'phaseCoverage': phases, 'stops': stops, 'errors': capture['errors'], 'realIPhone': capture['realIPhone'], 'actualGameIntegration': capture['actualGameIntegration']})
    report['maps'][resident] = {'sha256': meta['atlas']['sha256'], 'size': image.size, 'nineFixedSources': checks, 'alphaBounds': boxes, 'wholeFrameSideMirror': True, 'isolatedRendererEvidence': renderer, 'actualCandidateUI': 'pending'}
    for src, dst in [(f'assets/{resident}.json', f'{resident}-atlas-metadata.json'), (f'pose-plans/{resident}.json', f'{resident}-pose-plan.json'), (f'reviews/{resident}-suite.json', f'{resident}-source-ai-review.json')]:
        (output / dst).write_bytes((source / src).read_bytes())
(output / 'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'profileCount': len(report['profiles']), 'strongMagenta': [v['strongMagentaPixels'] for v in report['profiles'].values()], 'opaqueInterior': 'unchanged', 'boundaryCandidates': {k:v['inclusiveBoundaryCandidateCount'] for k,v in report['profiles'].items()}, 'maps': {k: {'sha256':v['sha256'],'sources':len(v['nineFixedSources']),'viewports':[x['viewport']['css'] for x in v['isolatedRendererEvidence']]} for k,v in report['maps'].items()}}, ensure_ascii=False))
