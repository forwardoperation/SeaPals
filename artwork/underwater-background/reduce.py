"""Produce reduced-weight, all-vector versions without changing the master SVG."""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tmp' / 'underwater-svg-tools'))
import vtracer

PROFILES = {
    'light': dict(size=(768, 512), filter_speckle=3, color_precision=7,
                  layer_difference=12, length_threshold=5, path_precision=1),
    'small': dict(size=(600, 400), filter_speckle=3, color_precision=6,
                  layer_difference=16, length_threshold=5, path_precision=1),
}

def build(name, profile):
    settings = dict(profile)
    width, height = settings.pop('size')
    trace_input = ROOT / f'trace-input-{name}.png'
    output = ROOT / f'underwater-background-{name}.svg'
    Image.open(ROOT / 'water-cleaned.png').resize((width, height), Image.Resampling.LANCZOS).save(trace_input)
    vtracer.convert_image_to_svg_py(str(trace_input), str(output),
        colormode='color', hierarchical='stacked', mode='spline',
        corner_threshold=60, max_iterations=10, splice_threshold=45, **settings)
    svg = output.read_text(encoding='utf-8')
    svg = svg[svg.index('<svg '):]
    svg = re.sub(r'<!--.*?-->', '', svg, flags=re.S)
    svg = svg.replace(f'width="{width}" height="{height}"',
        f'width="1536" height="1024" viewBox="0 0 {width} {height}"', 1)
    svg = svg.replace('version="1.1" ', '', 1)
    root_end = svg.index('>') + 1
    svg = svg[:root_end] + '<title>Sunlit underwater background</title>' + svg[root_end:]
    svg = re.sub(r'>\s+<', '><', svg)
    # Whitespace before path commands is optional; preserve separation between numbers.
    svg = re.sub(r' d="([^"]+)"', lambda m: ' d="' + re.sub(r'\s*([MLCQSTHVZmlcqsthvz])\s*', r'\1', m[1]).strip() + '"', svg)
    output.write_text(svg, encoding='utf-8')
    root = ET.fromstring(svg)
    tags = [node.tag.split('}')[-1] for node in root.iter()]
    assert all(tag in ('svg', 'title', 'path') for tag in tags)
    assert 'href=' not in svg and 'data:image' not in svg
    report = dict(file=output.name, bytes=output.stat().st_size, paths=tags.count('path'),
                  reduction_percent=round(100*(1-output.stat().st_size/(ROOT/'underwater-background.svg').stat().st_size), 2),
                  viewBox=root.attrib['viewBox'], settings=profile, embedded_images=0)
    print(json.dumps(report), flush=True)
    return report

if __name__ == '__main__':
    results = [build(name, settings) for name, settings in PROFILES.items()]
    (ROOT / 'reduced-report.json').write_text(json.dumps(results, indent=2)+'\n', encoding='utf-8')
