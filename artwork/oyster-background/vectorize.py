"""Trace the visible oyster environment as editable, bitmap-free SVG paths.

The four supplied oyster contours are excluded with a deterministic alpha
selection. No hidden scenery is synthesized and no source colors are edited.
Run from the repository root: python artwork/oyster-background/vectorize.py
"""
from pathlib import Path
import json
import re
import sys
import time
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tmp' / 'underwater-svg-tools'))
import vtracer

SETTINGS = dict(
    colormode='color', hierarchical='stacked', mode='spline',
    filter_speckle=2, color_precision=8, layer_difference=2,
    corner_threshold=75, length_threshold=3.5, max_iterations=10,
    splice_threshold=45, path_precision=2,
)


def polygon_points(path, offset_x, offset_y):
    """Read the supplied closed M/L polygon paths without approximate geometry."""
    commands = re.findall(r'[A-Za-z]', path)
    if not commands or any(command not in 'MLZ' for command in commands):
        raise ValueError('Expected only absolute M/L/Z polygon contours')
    numbers = list(map(float, re.findall(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?', path)))
    if len(numbers) % 2:
        raise ValueError('Odd polygon coordinate count')
    return [(numbers[i] + offset_x, numbers[i+1] + offset_y)
            for i in range(0, len(numbers), 2)]


def main():
    started = time.monotonic()
    source = Image.open(ROOT / 'reference.png').convert('RGBA')
    width, height = source.size
    contours = json.loads((ROOT / 'foreground-contours.json').read_text('utf-8-sig'))
    alpha = Image.new('L', source.size, 255)
    draw = ImageDraw.Draw(alpha)
    oyster_contours = [c for c in contours if c['id'] != '4473:42171']
    rock_contours = [c for c in contours if c['id'] == '4473:42171']
    for contour in oyster_contours:
        for path in contour['paths']:
            draw.polygon(polygon_points(path['data'], contour['x'], contour['y']), fill=0)
    # The green outlined foreground boulder is part of the requested rocks.
    # It overlaps the oysters in the source and remains visible above their bases.
    for contour in rock_contours:
        for path in contour['paths']:
            draw.polygon(polygon_points(path['data'], contour['x'], contour['y']), fill=255)
    source.putalpha(alpha)
    trace_input = ROOT / 'trace-input.png'
    source.save(trace_input)
    output = ROOT / 'oyster-background.svg'
    vtracer.convert_image_to_svg_py(str(trace_input), str(output), **SETTINGS)
    svg = output.read_text('utf-8')
    svg = svg.replace('<svg ', f'<svg viewBox="0 0 {width} {height}" ', 1)
    root_end = svg.index('>', svg.index('<svg ')) + 1
    svg = (svg[:root_end] + '\n<title>Oyster reef - visible background</title>'
           '\n<desc>Editable vector color contours of the original teal water, '
           'distant reef, foreground rock and visible seabed. The four oyster shapes '
           'remain transparent. No hidden scenery has been reconstructed and no '
           'bitmap data is embedded.</desc>\n'
           '<g id="Oyster-environment-vector-colors">' + svg[root_end:])
    svg = svg.replace('</svg>', '</g>\n</svg>')
    output.write_text(svg, encoding='utf-8')
    tree = ET.fromstring(svg)
    ns = {'s': 'http://www.w3.org/2000/svg'}
    paths = tree.findall('.//s:path', ns)
    assert paths
    assert not tree.findall('.//s:image', ns)
    assert not tree.findall('.//s:script', ns)
    assert 'data:image' not in svg and 'href=' not in svg
    report = {
        'width': width, 'height': height, 'viewBox': tree.attrib['viewBox'],
        'paths': len(paths), 'bytes': output.stat().st_size,
        'embedded_images': 0, 'external_references': 0,
        'foreground_regions_excluded': len(oyster_contours),
        'foreground_rock_included': True,
        'source_image': 'reference.png', 'source_contours': 'foreground-contours.json',
        'trace_settings': SETTINGS,
        'seconds': round(time.monotonic() - started, 2),
        'note': 'Only visible environment is traced; excluded foreground stays transparent.',
    }
    (ROOT / 'vector-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
